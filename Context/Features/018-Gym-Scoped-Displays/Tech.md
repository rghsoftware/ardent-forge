# Tech Plan: Gym-Scoped Displays (F018)

**Spec:** [Spec.md](./Spec.md)
**Stacks involved:** Supabase (Postgres + RLS + Realtime + Edge Functions + Auth) · React 19 / TypeScript / TanStack Router / TanStack Query / Zustand · Tauri / Rust / SQLite (touched only for the `display_visible` removal sweep)

---

## Architecture Overview

The existing display pipeline (F008/F009) is a single-channel fan-out:

```
phone (publisher) ──► Supabase channel "display" ──► TV (subscriber)
                                ▲
                                │
                  Edge Function "display-idle-snapshot"
                  (cron, queries all instance users)
```

This feature partitions every node along the gym dimension:

```
phone (publisher, configured with active gym at workout start)
        │
        ▼
Supabase channel "display:gym:{gym_id}"  ◄──  one channel per gym
        │
        ▼
TV (subscriber, configured from route param /display/gym/$gymId)
        ▲
        │
Edge Function "display-idle-snapshot"
(cron, loops over all gyms; one broadcast per gym; query joins gym_members)
```

The publisher / channel / subscriber / Edge Function are all _modified_, not rewritten. The wire format (`DisplaySnapshot`, `IdleSnapshot`, the four event types) stays exactly the same. Only the **channel name** changes, plus the data sources for the Edge Function and the routing on the TV side. This minimizes blast radius and lets us reuse all the existing tests by just substituting the channel name.

The new entity layer is two tables (`gyms`, `gym_members`) with simple RLS, two domain types, two TanStack Query hooks, and a workout-start picker. The gym is selected once per workout, captured into publisher state, and held for the lifetime of the workout. Mid-workout switching is W5 in the spec (out of scope).

---

## Key Decisions

### D1: Schema shape -- two tables, no role hierarchy

**Decision:** Two tables: `gyms` (entity) and `gym_members` (M:N join). Owner is a scalar column on `gyms` (`owner_user_id`), not a separate role row. No "admin" tier.

**Schema (Postgres):**

```sql
create table gyms (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 60),
  owner_user_id   uuid not null references auth.users on delete cascade,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index idx_gyms_one_default
  on gyms (is_default)
  where is_default = true;

create table gym_members (
  gym_id     uuid not null references gyms on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (gym_id, user_id)
);

create index idx_gym_members_user_gym
  on gym_members (user_id, gym_id);
```

**Why:**

- The composite PK `(gym_id, user_id)` gives free uniqueness and a `(gym_id, ...)`-leading index for "list members of a gym."
- The separate `(user_id, gym_id)` index covers the "list gyms a user belongs to" query that the picker needs (M22 in the spec).
- `is_default boolean` plus the partial unique index enforces at most one default gym per instance, while still allowing zero defaults (e.g., a fresh DB before the migration runs, or an admin who deleted the default).
- No `role` column on `gym_members`. Owner permissions (`UPDATE`/`DELETE` gym, kick members) are derived from the scalar `gyms.owner_user_id`. Adding roles later is a `gym_members.role` column when we need it.

**Related ADRs:** None pre-existing in this area. Flagged as ADR-012 candidate below.

### D2: RLS policy design -- two read roles, four write rules

**Decision:** Two distinct read postures, narrow write rules.

**Reads:**

- `gyms`: any **authenticated** user can `SELECT *` (any column). Plus a _narrower_ `anon` SELECT policy that exposes **only `id` and `name`** (column-level grants on the table for the `anon` role). M21/RD-16. The display reads the gym name once at boot; nothing else can be read by anon.
- `gym_members`: a user can `SELECT` rows where `user_id = auth.uid()` (their own memberships) OR rows belonging to a gym they themselves are a member of (so the picker can show "12 members"). No anon read, ever.

**Writes:**

- `INSERT into gyms` -- any authenticated user, with the row check `owner_user_id = auth.uid()` (M4).
- `UPDATE / DELETE gyms` -- only when `owner_user_id = auth.uid()` (M5).
- `INSERT into gym_members` -- any authenticated user can self-enroll (`user_id = auth.uid()`); cannot insert another user's membership (M6).
- `DELETE from gym_members` -- a user can leave (`user_id = auth.uid()`), and the gym owner can kick (`auth.uid() in (select owner_user_id from gyms where id = gym_id)`) (M7).

**Why anon can read `gyms.name`:** The display has no JWT, only the publishable key. RD-16 commits us to letting it resolve a UUID into a human name once at boot. We do this with a **column-level GRANT** plus a permissive RLS policy on `gyms` for the `anon` role, scoped to the two columns. Memberships, ownership, timestamps stay locked. The privacy delta is zero -- gym names are operator-facing labels, less revealing than the user display names already on the board view.

**Implementation note:** Postgres lets us grant column-level SELECT (`grant select (id, name) on gyms to anon;`) which restricts which columns anon can ask for. The RLS policy provides the row filter (in this case: all rows allowed because gyms are public-within-instance for any authenticated user, and the anon column grant + permissive RLS lets `anon` read `id, name` of every row).

```sql
-- Authenticated read: any logged-in user sees all gyms
create policy gyms_select_authenticated on gyms
  for select to authenticated using (true);

-- Anon read: column-level GRANT restricts to (id, name); policy is permissive
create policy gyms_select_anon on gyms
  for select to anon using (true);

revoke all on gyms from anon;
grant select (id, name) on gyms to anon;
```

The `revoke all` then `grant select(id, name)` is the canonical column-level grant pattern in Postgres. Combined with the `gyms_select_anon` policy, the anon role can `select id, name from gyms` but `select * from gyms` errors on column-level access denial.

### D3: Channel-naming function -- one source of truth

**Decision:** Add `getGymChannelName(gymId: string): string` to a new shared module `src/lib/gym-channel.ts`. Every publisher, subscriber, Edge Function, seed script, and test must use this helper. No string literals containing `display:gym:` in production code.

**Why:** The current code has the literal `'display'` scattered across at least 5 files. We're already going to touch all of them; gating the new format behind one function makes future channel-naming changes free. TA15 in the spec asserts no string literals.

```ts
// src/lib/gym-channel.ts
export const GYM_CHANNEL_PREFIX = 'display:gym:'

export function getGymChannelName(gymId: string): string {
  return `${GYM_CHANNEL_PREFIX}${gymId}`
}

export function parseGymIdFromChannel(channelName: string): string | null {
  if (!channelName.startsWith(GYM_CHANNEL_PREFIX)) return null
  return channelName.slice(GYM_CHANNEL_PREFIX.length) || null
}
```

### D4: Publisher state model -- gym_id captured at start, held for the workout

**Decision:** The display publisher gains a **third piece of module-scope state** alongside `_displayVisible`: an `_activeGymId: string | null`. Workout start sets it via a new `configureDisplayPublisher({ gymId })` call (extending the existing function signature). All publish functions check `_activeGymId !== null` before sending; null = no-op (Private workout). The publisher keeps the gym ID until the workout ends.

This replaces the existing `_displayVisible` state, which goes away with the `display_visible` column. The function signature evolves:

```ts
// before
export function configureDisplayPublisher({ displayVisible }: { displayVisible: boolean }): void

// after
export function configureDisplayPublisher({ gymId }: { gymId: string | null }): void
```

The channel itself is **created lazily on first publish**, exactly as today, but the channel name is now `getGymChannelName(_activeGymId)` instead of `'display'`. If `_activeGymId` changes mid-workout (which W5 says it can't, but defense in depth), the publisher tears down the old channel and creates a new one on the next send. This costs one extra `removeChannel` call in the rare path and prevents stale fan-out.

**Why:** Keeping all gym state in module-scope mirrors the existing `_client` / `_displayVisible` / `_helloResponder` pattern. The hook (`use-display-broadcast`) is the only thing that calls `configureDisplayPublisher`, so the contract stays narrow.

### D5: Subscriber configuration -- gym_id from route param

**Decision:** The display route file moves from `src/routes/display.tsx` to `src/routes/display/gym/$gymId.tsx`. The `$gymId` param is read via TanStack Router's `useParams`, validated as a UUID, and passed to `subscribeToDisplay({ gymId, handlers })` (extending the existing function signature). The subscriber computes its channel name via `getGymChannelName(gymId)`.

A new sibling file `src/routes/display/index.tsx` (the legacy `/display` no-gym path) renders a friendly "Display not configured" page (S6) without ever creating a Supabase client.

**Why TanStack Router file-based:** Matches existing convention. The `$gymId` segment is the established parameter syntax. Keeps URL building automatic.

**Why split out the not-configured page as its own route:** Lets us avoid the `useEffect`-creates-client cost on the legacy path. The legacy page is purely static.

### D6: Idle Edge Function fan-out -- one cron, N broadcasts

**Decision:** The existing `display-idle-snapshot` Edge Function loops over every gym in a single invocation. For each gym it (a) calls a parameterized `get_display_idle_sessions(gym_id uuid)` RPC and (b) broadcasts one `idle_snapshot` event to `display:gym:{gym_id}`. One cron, one Edge Function, N broadcasts where N = `count(gyms)`.

**Options considered:**

- **(a) One cron job per gym** -- requires dynamic cron management when gyms are created/deleted. Too operationally heavy.
- **(b) One cron, one function, parameterized via query string** -- requires a wrapper that fans out, or someone (where?) calling the function once per gym. Adds an orchestration layer.
- **(c) One cron, one function, internal loop over gyms** -- chosen. Single deployment artifact. Linear cost in gym count, acceptable at friends-and-family scale (the cron runs once a minute regardless).

**Why (c) wins:** Lowest operational complexity; one function to monitor, one deployment, one set of logs. The risk of "Edge Function broadcast count grows linearly" is captured in the Spec.md risk table; mitigation is "revisit if it bites at 50+ gyms." Won't be an issue in practice.

**RPC change:**

```sql
drop function if exists get_display_idle_sessions();
drop function if exists get_display_idle_sessions(uuid);

create function get_display_idle_sessions(p_gym_id uuid)
returns table (
  display_name text,
  session_name text,
  session_type text,
  day_label text
)
language sql
security definer
stable
as $$
  select
    up.display_name,
    st.name as session_name,
    ss.session_type,
    ss.day_label
  from program_activations pa
  join programs p on p.id = pa.program_id
  join blocks b on b.program_id = p.id
    and b.ordinal = pa.current_block_ordinal
  join block_weeks bw on bw.block_id = b.id
    and bw.week_number = pa.current_week_number
  join scheduled_sessions ss on ss.block_week_id = bw.id
    and ss.day_of_week is not null
    and ss.day_of_week = extract(dow from now())
  join session_templates st on st.id = ss.session_template_id
  join user_profiles up on up.id = pa.user_id
  -- NEW: filter by gym membership instead of display_visible
  join gym_members gm on gm.user_id = pa.user_id and gm.gym_id = p_gym_id
  left join workout_logs wl on wl.session_template_id = ss.session_template_id
    and wl.user_id = pa.user_id
    and date(wl.started_at) = current_date
    and wl.completed_at is not null
  where wl.id is null
  order by up.display_name
  limit 3;
$$;

revoke execute on function get_display_idle_sessions(uuid) from public, anon, authenticated;
grant execute on function get_display_idle_sessions(uuid) to service_role;
```

The `display_visible` filter is replaced by the `gym_members` join -- if you're a member of the gym, your scheduled sessions show on its TV; if you're not, they don't. The gym is the new opt-in surface, not a per-user flag.

### D7: S7 mechanism -- DB trigger on auth.users insert

**Decision:** A Postgres `security definer` function fires on `INSERT` into `auth.users` and enrolls the new user in the gym where `is_default = true`, if any. No-op if no default gym exists.

```sql
create or replace function public.enroll_new_user_in_default_gym()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_gym_id uuid;
begin
  select id into v_default_gym_id from gyms where is_default = true limit 1;
  if v_default_gym_id is not null then
    insert into gym_members (gym_id, user_id)
    values (v_default_gym_id, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_auth_user_default_gym
  after insert on auth.users
  for each row execute function public.enroll_new_user_in_default_gym();
```

**Options considered:**

- **(a) DB trigger** (chosen) -- atomic with sign-up, can't be missed, no app coordination, handles OAuth + email + future auth flows uniformly.
- **(b) Post-signup callback in `auth.tsx::signUp`** -- easy to test in vitest, can show UI feedback. But doesn't fire for OAuth callbacks (different code path). Doesn't fire if a user is created out-of-band (e.g., admin tools, seed scripts). Misses passive sign-up via deep link.
- **(c) Lazy creation when the user opens the picker** -- doesn't fire until the user is already in the start-workout flow, defeating the "no thinking required" goal of S7.

**Why (a) wins:** The trigger fires for every path that creates an `auth.users` row. There are no other auth.users triggers in this codebase today, but the existing convention for cross-table consistency _is_ triggers (see `20260326000004_add_triggers.sql` -- four triggers enforcing user_id consistency). This feature follows the same pattern. The `on conflict do nothing` clause makes the trigger idempotent against races (e.g., trigger fires twice for the same user during sign-up retry).

**Test considerations:** Triggers are harder to unit-test from TypeScript than callbacks, but Supabase has a working pattern: spin up a local DB, call `auth.admin.createUser`, query `gym_members`. We do this in an integration test (TA20).

**Related ADRs:** None. Flagged as ADR-012 candidate.

### D8: Sticky default storage -- localStorage with structured value

**Decision:** A single localStorage key `ardent_forge_last_gym_choice` stores the user's last picker selection. Value is either a UUID string (a gym ID) or the literal string `'private'`. On load, the picker validates that a stored UUID is still in the user's gym membership list -- if not (e.g., they left that gym), it falls back to `'private'`.

```ts
// src/lib/gym-picker-storage.ts
const KEY = 'ardent_forge_last_gym_choice'

export type GymPickerChoice = string | 'private' // gym UUID or private literal

export function readLastGymChoice(): GymPickerChoice | null {
  try {
    return (localStorage.getItem(KEY) as GymPickerChoice) || null
  } catch (err) {
    console.warn('[gym-picker] Failed to read last choice:', err)
    return null
  }
}

export function writeLastGymChoice(choice: GymPickerChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch (err) {
    console.warn('[gym-picker] Failed to write last choice:', err)
  }
}
```

**Why localStorage and not the DB:** RD-6 commits us to per-device sticky default. The friends-and-family pattern is one phone per athlete; cross-device sync is W (deferred). The pattern matches F015 onboarding state (ADR-010).

**Why the validation step:** Without it, a user who leaves a gym but still has it stored in localStorage would have the picker default to a gym they no longer belong to. The picker needs to be self-correcting.

### D9: Migration shape -- one set-based statement, idempotent

**Decision:** A single SQL migration creates the schema, the trigger, and the data migration (Home gym + memberships). The data migration is one `INSERT ... SELECT ... WHERE NOT EXISTS` statement plus one trigger backfill. RD-18 commits us to set-based, idempotent-by-construction.

```sql
-- Schema (gyms, gym_members, indices, RLS, anon grants)
-- (omitted -- see D1, D2)

-- Trigger function + trigger
-- (see D7)

-- Data migration: create one default Home gym if any user exists and no default
-- gym is yet defined; enroll all existing users.
do $$
declare
  v_owner   uuid;
  v_gym_id  uuid;
begin
  -- Pick an owner: the oldest user in the system. Friends-and-family
  -- convention: the first user is typically the host.
  select id into v_owner from auth.users order by created_at asc limit 1;

  -- Skip if no users yet, or if a default gym already exists.
  if v_owner is null then return; end if;
  if exists (select 1 from gyms where is_default = true) then return; end if;

  -- Create the default Home gym, owned by the host.
  insert into gyms (name, owner_user_id, is_default)
  values ('Home', v_owner, true)
  returning id into v_gym_id;

  -- Enroll every existing user (including the host) who is not already in
  -- any gym. This is the set-based, idempotent statement.
  insert into gym_members (gym_id, user_id)
  select v_gym_id, u.id
  from auth.users u
  where not exists (
    select 1 from gym_members gm where gm.user_id = u.id
  );

  raise notice
    'F018 migration: created Home gym % owned by %, enrolled % users.',
    v_gym_id,
    v_owner,
    (select count(*) from gym_members where gym_id = v_gym_id);
end$$;

-- Drop legacy display_visible column
alter table user_profiles drop column if exists display_visible;
```

**Why a `do $$ ... end$$` block:** We need a small amount of imperative logic to short-circuit on empty `auth.users` and to capture the gym id for the membership INSERT. Wrapping in an anonymous block avoids polluting the schema with a function we'll never call again.

**Why the `if exists (... is_default = true) then return`:** Idempotency. Running the migration twice (manually or in a recovery scenario) does not create a second Home gym.

**`raise notice`:** Operators read the migration log post-deploy. The notice is the bridge from "migration ran" to "the new TV URL is `/display/gym/<v_gym_id>`."

### D10: Picker UX -- bottom-sheet on mobile, dialog on desktop

**Decision:** A new component `src/components/workout/gym-picker-sheet.tsx` renders as a bottom-sheet on mobile (`vaul` / `@radix-ui/react-dialog` -- whatever the existing pattern uses; defer choice to the implementation) and as a centered modal on desktop. Rows are 48px tall (gym hand requirement), ALL-CAPS gym name, member count badge, sticky-default highlighted with the ember accent. The "Private (don't publish)" row is visually identical but with `text-secondary` and a `material-symbols-outlined visibility_off` icon.

The sheet is **invoked from the existing `handleStartWorkout` callback in `src/routes/_authenticated/index.tsx`**. The flow becomes:

1. User taps "Start Workout"
2. Picker opens, preselected to last choice (or `'private'` for new users)
3. User taps a row (or taps the preselected one to confirm)
4. Picker closes; `startWorkout(userId, { gymId })` proceeds
5. The publisher is configured with `gymId` and the workout begins

A user with **zero gym memberships** sees the picker but it has only the Private row. The hint text "Join a gym from settings to publish your workouts to a TV" appears under the row. M13.

A user with **one gym membership and a sticky default = that gym** still sees the picker, single tap to confirm. We deliberately do not auto-skip the picker even in the single-gym case, because the Private option needs to remain reachable in one tap. (If user feedback says "too many taps," we can revisit and add a "skip when only one option matches sticky default" optimization.)

**Why a dedicated component, not inline JSX:** Reused by `handleStartWorkout` and `handleStartProgrammedSession` (both in `index.tsx`). Probably also by future "start ad-hoc workout from session detail" entry points. One component, multiple call sites.

### D11: Workout-start integration point -- adapt `handleStartWorkout` to await the picker

**Decision:** The picker is implemented as an imperatively-opened modal returning a `Promise<GymPickerChoice | null>` (null = user cancelled). `handleStartWorkout` becomes:

```tsx
const handleStartWorkout = async () => {
  if (!userId) {
    console.error('[today-page] Cannot start workout: no authenticated user')
    setStartError('You must be signed in to start a workout.')
    return
  }
  setStartError(null)

  const choice = await openGymPicker({ userId }) // returns string | 'private' | null
  if (choice === null) return // user cancelled

  try {
    const workoutLog = await startWorkout(userId)
    configureDisplayPublisher({ gymId: choice === 'private' ? null : choice })
    writeLastGymChoice(choice)
    navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
  } catch (err) {
    console.error('[today-page] handleStartWorkout:', err)
    setStartError('Failed to start workout. Check your connection and try again.')
  }
}
```

**Why imperative opening:** The picker is a modal lifecycle, not a persistent component, and the start-workout flow is sequential (decide → create → configure → navigate). An imperative `await openGymPicker(...)` reads naturally and avoids the "controlled modal state spread across the route component" trap. The pattern follows the existing `confirm()`-style modals in the project (need to verify during impl, but the convention is to wrap radix-dialog in a hook that returns a promise).

**Alternative considered:** A controlled modal with a `pending state` flag. Rejected because it forks the start-workout state machine into "deciding" / "starting" / "navigating" sub-states, when in reality these are sequential steps with one user decision in the middle.

### D12: Workout header gym label -- conditional render, single-gym hide

**Decision:** A new component `src/components/workout/active-workout-gym-label.tsx` reads the user's gym memberships via `useGyms()`, the active publisher gym ID via a new selector, and conditionally renders a tertiary-row label only when `gyms.length >= 2`. Style: ALL-CAPS, label-medium, `text-secondary`, prefixed with the section pattern `OPERATOR · {GYM_NAME}` (per S2).

**Where it mounts:** Inside the active workout header alongside the session-type metadata. Specifically the existing `tracker.tsx` (or wherever the active workout shell is -- defer to impl). The label is purely informational; no interactivity.

**Why the single-gym hide:** S2/M23. One-gym users have nothing to disambiguate; the label is chrome.

### D13: Profile / Settings -- new "Gyms" section

**Decision:** Add a new section in `src/routes/_authenticated/profile.tsx` titled "Gyms" with three subsections:

1. **My gyms** -- list of `gym_members` rows for the current user, each row showing gym name, member count badge, and a "Leave" button. Owner gyms additionally show a "Delete gym" button (with confirmation modal per S4).
2. **Browse all gyms** -- collapsible. List of every gym on the instance (from M3's authenticated SELECT policy). Already-joined gyms are visually distinguished (greyed Join button or "Joined" label). Joining is a single tap.
3. **Create gym** -- a `name` text input and a "Create" button. The owner is set to the current user via the M4 RLS rule.

The section follows the existing profile.tsx layout pattern (section header in ALL-CAPS, divider via tonal layering, ToggleRow-equivalent rows).

**Why all in one route file:** Profile / settings is already a single long route in this codebase; adding a section follows the convention. A separate `/profile/gyms` subroute would be over-architected for the friends-and-family scale.

### D14: Tauri SQLite -- only the `display_visible` removal sweep

**Decision:** The Tauri SQLite schema does NOT get `gyms` or `gym_members` tables. The publisher is online-only (it requires a Supabase Realtime channel), so the gym selection only matters in online flows. Offline workouts effectively pick `'private'` automatically because the publisher no-ops without a Supabase client.

**However**, the Tauri side DOES need to drop `display_visible`:

- `src-tauri/migrations/NNN_drop_display_visible.sql` (new)
- `src-tauri/src/models.rs` -- remove `display_visible: Option<i32>` from `UserProfileRow`
- `src-tauri/src/commands/user_profile.rs` -- remove `display_visible` from `UpdateUserProfileInput`, the UPSERT column list, and the bind expression
- `src/lib/data-mapper.ts` -- remove `display_visible` from `toUserProfile` / `fromUserProfile`
- `src/domain/types/user.ts` -- remove `displayVisible: z.boolean().optional()` from `userProfileSchema`
- `src/routes/_authenticated/profile.tsx` -- remove the "Display visibility" toggle (replaced by the Gyms section)
- `src/hooks/use-display-broadcast.ts` -- remove the `displayVisible` read from the user profile; replaced by the active gym ID from D4
- All tests touching `displayVisible`

This is a sweep, not a re-architecture. Captured as a discrete cleanup phase in Steps.md.

**Why no Tauri SQLite gym tables:** Gyms are an online concept (publishing requires online). Adding offline gym membership would force us to choose between "stale gym list while offline" and "no picker while offline," neither of which improves the UX. Easier: when offline, the picker shows only Private. The user can still log workouts; nothing publishes. When they go online, the next workout shows the full picker again.

### D15: Test infrastructure -- three layers, no new tools

**Decision:** Tests live in three existing layers, no new test tooling needed.

1. **Unit tests (Vitest + happy-dom)** -- channel-name function, picker-storage, picker component (with mocked `useGyms`), publisher state model (with mocked Supabase channel). Existing `src/lib/__tests__/display-publisher.test.ts` becomes the template.
2. **Postgres / RLS tests** -- using `pgtap` or just plain SQL `do $$ ... end$$` blocks against the local Supabase. Asserts: anon can read `gyms.name` but not `select *`, gym owner can update, non-owner cannot, member can leave their own row, owner can kick. These run in CI via `npx supabase db reset && psql ... < test-rls.sql` -- exact harness defer to impl.
3. **Edge Function tests** -- Deno test as for `chat-media-*/index_test.ts`. Seed two gyms, two users, one membership each. Invoke `display-idle-snapshot`. Assert two broadcasts on two channels with disjoint payloads.

**No E2E (Playwright) test in this feature.** The end-to-end "phone publishes → display renders" was validated in F008/F009 and the wire format isn't changing. The risk is in the partitioning logic, which is fully covered at the unit and integration layers.

---

## File Plan

### New files

| File                                                                 | Purpose                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260407000001_create_gyms.sql`                 | Schema (gyms, gym_members, indices), RLS policies, anon grants, trigger function, trigger, data migration (Home gym + enrollments), drop `display_visible` |
| `supabase/migrations/20260407000002_replace_idle_sessions_rpc.sql`   | New `get_display_idle_sessions(p_gym_id uuid)` RPC, drops the no-arg version                                                                               |
| `src-tauri/migrations/NNN_drop_display_visible.sql`                  | SQLite parallel: `ALTER TABLE user_profiles DROP COLUMN display_visible`                                                                                   |
| `src/domain/types/gym.ts`                                            | `gymSchema` Zod type, `gymMemberSchema`, `Gym`, `GymMember`                                                                                                |
| `src/lib/gym-channel.ts`                                             | `getGymChannelName`, `parseGymIdFromChannel`, `GYM_CHANNEL_PREFIX` constant                                                                                |
| `src/lib/gym-picker-storage.ts`                                      | `readLastGymChoice`, `writeLastGymChoice`, `GymPickerChoice` type                                                                                          |
| `src/hooks/use-gyms.ts`                                              | `useGyms()` (list user's gyms), `useAllGyms()` (browse), `useCreateGym()`, `useDeleteGym()`                                                                |
| `src/hooks/use-gym-members.ts`                                       | `useGymMembers(gymId)`, `useJoinGym()`, `useLeaveGym()`, `useKickGymMember()`                                                                              |
| `src/hooks/use-gym-picker.ts`                                        | `useGymPicker()` returning `openGymPicker()` imperative API + the picker portal                                                                            |
| `src/components/workout/gym-picker-sheet.tsx`                        | The bottom-sheet/modal picker UI (D10)                                                                                                                     |
| `src/components/workout/active-workout-gym-label.tsx`                | Workout header label component (D12)                                                                                                                       |
| `src/components/profile/gym-management-section.tsx`                  | Profile/settings "Gyms" section (D13)                                                                                                                      |
| `src/routes/display/gym/$gymId.tsx`                                  | The new display route (D5)                                                                                                                                 |
| `src/routes/display/index.tsx`                                       | The legacy `/display` "not configured" page (S6)                                                                                                           |
| `src/lib/__tests__/gym-channel.test.ts`                              | Channel-name function tests                                                                                                                                |
| `src/lib/__tests__/gym-picker-storage.test.ts`                       | LocalStorage tests with self-correction                                                                                                                    |
| `src/components/workout/__tests__/gym-picker-sheet.test.tsx`         | Picker component tests (zero-gym, single-gym, multi-gym, sticky-default, Private always present)                                                           |
| `src/components/workout/__tests__/active-workout-gym-label.test.tsx` | Single-gym hide test                                                                                                                                       |
| `src/components/profile/__tests__/gym-management-section.test.tsx`   | Settings tests                                                                                                                                             |
| `src/hooks/__tests__/use-gyms.test.ts`                               | Hook tests with mocked adapter                                                                                                                             |
| `supabase/tests/018_gym_rls.sql`                                     | RLS policy tests (pgtap or plain SQL)                                                                                                                      |
| `supabase/functions/display-idle-snapshot/index_test.ts`             | Updated/new Deno test for the per-gym fan-out                                                                                                              |

### Modified files

| File                                                | Change                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/display-publisher.ts`                      | Replace `_displayVisible` with `_activeGymId`. `configureDisplayPublisher` signature changes to `{ gymId: string \| null }`. Channel name now `getGymChannelName(_activeGymId)`. All publish functions check `_activeGymId !== null`. |
| `src/lib/display-subscriber.ts`                     | `subscribeToDisplay` signature gains `gymId`. Channel name now `getGymChannelName(gymId)`.                                                                                                                                            |
| `src/lib/__tests__/display-publisher.test.ts`       | Replace `displayVisible` test cases with `activeGymId` cases. New cases: gym A vs gym B publish to different channels; null gym = no-op.                                                                                              |
| `src/lib/__tests__/display-publisher-hello.test.ts` | Same updates.                                                                                                                                                                                                                         |
| `src/lib/__tests__/display-subscriber.test.ts`      | Channel name assertions updated to use `getGymChannelName(...)`.                                                                                                                                                                      |
| `src/hooks/use-display-broadcast.ts`                | Stop reading `displayVisible` from user profile. Read active gym from a new selector or pass it explicitly. Configure publisher with `gymId` instead of `displayVisible`.                                                             |
| `src/routes/_authenticated/index.tsx`               | `handleStartWorkout` and `handleStartProgrammedSession` await `openGymPicker(...)` before calling `startWorkout`. Configure publisher with the chosen gym. Write sticky default.                                                      |
| `src/routes/_authenticated/profile.tsx`             | Remove "Display visibility" toggle. Remove `displayVisible` state and handling. Add `<GymManagementSection />`.                                                                                                                       |
| `src/components/display/use-idle-snapshot.ts`       | Channel name now `getGymChannelName(gymId)` -- the hook gains a `gymId` arg.                                                                                                                                                          |
| `src/lib/data-mapper.ts`                            | Remove `display_visible` from `toUserProfile` / `fromUserProfile`. Add `toGym` / `fromGym`, `toGymMember` / `fromGymMember`.                                                                                                          |
| `src/domain/types/user.ts`                          | Remove `displayVisible` field.                                                                                                                                                                                                        |
| `src/domain/types/index.ts`                         | Re-export `Gym`, `GymMember`.                                                                                                                                                                                                         |
| `src/lib/data-adapter.ts`                           | Add gym CRUD methods to the adapter interface.                                                                                                                                                                                        |
| `src/lib/supabase-adapter.ts`                       | Implement gym CRUD against Supabase.                                                                                                                                                                                                  |
| `src/lib/tauri-adapter.ts`                          | Implement gym CRUD as no-ops or "online required" errors -- gyms are online-only (D14).                                                                                                                                               |
| `src-tauri/src/models.rs`                           | Remove `display_visible: Option<i32>` from `UserProfileRow`.                                                                                                                                                                          |
| `src-tauri/src/commands/user_profile.rs`            | Remove `display_visible` from `UpdateUserProfileInput` and the UPSERT.                                                                                                                                                                |
| `supabase/functions/display-idle-snapshot/index.ts` | Loop over `select id from gyms`, call `get_display_idle_sessions(p_gym_id := gym.id)`, broadcast to `topic = realtime:display:gym:{gym.id}`.                                                                                          |
| `scripts/seed-display.ts`                           | Update channel name to use `getGymChannelName(...)` (ideally import from `src/lib/gym-channel.ts`, or duplicate the constant if scripts can't import).                                                                                |
| `supabase/seed-reviewer.sql`                        | Remove `display_visible` from the `user_profiles` INSERT, add a Home gym + reviewer membership.                                                                                                                                       |

The full list above should match the Steps.md task breakdown almost 1:1.

---

## Data Flow Detail

### Workout-start happy path

```
[user taps Start Workout]
        │
        ▼
handleStartWorkout()
        │
        ▼
openGymPicker({ userId })  ◄── reads sticky default + useGyms()
        │
        ▼
[user picks gym A or Private]
        │
        ▼
startWorkout(userId)        ◄── creates workout_log row, returns it
        │
        ▼
configureDisplayPublisher({ gymId: 'A' or null })
writeLastGymChoice('A' or 'private')
        │
        ▼
navigate to /log/$workoutId
        │
        ▼
[workout runs, store actions call publishDisplaySnapshot(...)]
        │
        ▼
[publisher checks _activeGymId, sends to display:gym:A]  -- or no-ops if null
```

### Display boot

```
[TV opens /display/gym/<uuid>]
        │
        ▼
DisplayPage reads $gymId from route param, validates UUID
        │
        ▼
boot() async function:
  - resolveConfig() to get supabase publishable key
  - createClient(...)
  - initDisplaySubscriber(client)
  - subscribeToDisplay({ gymId, handlers })
        │
        ▼
[subscriber creates channel display:gym:<uuid>, registers event handlers]
        │
        ▼
[optional: anon SELECT id, name from gyms where id = $gymId, log gym name to console]
        │
        ▼
[subscriber receives workout_snapshot / session_ended / focus / unfocus / idle_snapshot]
        │
        ▼
[useDisplayStore upserts; BoardView / FocusedView / IdleView render]
```

### Idle Edge Function tick

```
[cron fires every minute]
        │
        ▼
handler(req)
        │
        ▼
select id from gyms                      -- one query, all gyms
        │
        ▼
for each gym:
  call get_display_idle_sessions(gym.id) -- per-gym RPC
  build IdleSnapshot payload
  POST /realtime/v1/api/broadcast {
    topic: 'realtime:display:gym:{gym.id}',
    event: 'idle_snapshot',
    payload: ...
  }
        │
        ▼
return { published: true, gym_count, total_sessions }
```

---

## Database Changes

Covered in D1, D2, D6, D7, D9. To summarize the migration sequence:

**`20260407000001_create_gyms.sql`** does (in order):

1. Create `gyms` table
2. Create partial unique index on `gyms.is_default`
3. Create `gym_members` table
4. Create `idx_gym_members_user_gym` index
5. Enable RLS on both tables
6. Create the 6 RLS policies (D2)
7. Column-level grants for `anon` (`revoke all`, `grant select(id, name)`)
8. Create the `enroll_new_user_in_default_gym` function (D7)
9. Create the `trg_auth_user_default_gym` trigger
10. Run the data migration `do $$ ... end$$` block (D9)
11. `alter table user_profiles drop column if exists display_visible`

**`20260407000002_replace_idle_sessions_rpc.sql`** does:

1. `drop function if exists get_display_idle_sessions()`
2. Create `get_display_idle_sessions(p_gym_id uuid)` (D6)
3. `revoke execute ... from public, anon, authenticated; grant execute ... to service_role`

Two migrations rather than one to keep the RPC change reviewable in isolation.

---

## Integration Points

### With the active workout store

The store gains a tiny new selector or external getter for "what gym is the current workout publishing to" -- but the _cleanest_ approach is to keep gym state in the publisher module (D4) and have the workout-header label read it via a new exported function `getActiveGymId(): string | null` from `display-publisher.ts`. This avoids polluting the workout store with display concerns.

### With profile/settings

New `<GymManagementSection />` mounted in `profile.tsx`. Uses `useGyms()`, `useAllGyms()`, `useCreateGym()`, `useDeleteGym()`, `useJoinGym()`, `useLeaveGym()`. The existing "Display visibility" toggle is removed in the same edit.

### With the tracker / active workout route

`<ActiveWorkoutGymLabel />` mounts in the workout header. Reads from `useGyms()` (to count memberships and look up the active gym name) and from `getActiveGymId()`.

### With the display route

The display route file moves from `src/routes/display.tsx` to `src/routes/display/gym/$gymId.tsx`. The `useEffect` boot logic gains a `gymId` arg passed to `subscribeToDisplay`. The legacy `/display` (now `src/routes/display/index.tsx`) is a static "not configured" page.

### With the Edge Function

`display-idle-snapshot` gains an outer loop over `gyms`. The RPC call switches to the parameterized version. The broadcast topic switches to per-gym.

### With seed scripts

`scripts/seed-display.ts` and `supabase/seed-reviewer.sql` need updates: the seed script uses the channel-name function (or the constant), and the reviewer seed creates a Home gym + reviewer membership and removes the `display_visible` column reference.

---

## Risks & Unknowns

| Risk                                                                                                                                                                                                                                                      | Mitigation                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger on `auth.users` is a new pattern in this codebase. The one-line precedent we have for cross-table consistency is `enforce_user_id_match_*` triggers in `20260326000004_add_triggers.sql`, but those fire on app tables, not on the `auth` schema. | Test the trigger explicitly against a local Supabase: create a user via `auth.admin.createUser`, assert a `gym_members` row exists. Document in the migration comment why the trigger lives where it does.                                                            |
| Column-level GRANT on `gyms` for `anon` is new. If we get the policy + grant interaction wrong, we either leak too much (anon reads ownership) or the display can't read at all.                                                                          | RLS test asserts both directions: anon `select id, name from gyms` succeeds; anon `select * from gyms` errors with column-level access denied.                                                                                                                        |
| The `is_default` partial unique index plus the trigger creates a subtle dependency: if the default gym is deleted, new signups stop getting auto-enrolled.                                                                                                | Document in the migration comment. Surface in the gym deletion confirmation modal: "This is the default gym. New users will not be auto-enrolled until you mark another gym as default." (Defer the "mark another as default" UI to a future feature; v1 just warns.) |
| The picker is the new gating step for workout start. If the picker has a bug that prevents it from closing, users cannot start workouts.                                                                                                                  | The picker dispatches a single resolver via `Promise.resolve()` and never holds open state across re-renders. Test: opening + cancelling 100 times in a vitest loop.                                                                                                  |
| The legacy `display:` channel is referenced in 5+ files including tests. Missing one means the publisher and subscriber speak different protocols.                                                                                                        | TA15 enforces "no string literals." A single grep over `display:` (without `gym:`) in non-test code should return zero. Add as a CI lint or just a manual checkpoint in Steps.md.                                                                                     |
| Tauri SQLite schema sweep risks leaving stale `display_visible` references.                                                                                                                                                                               | Same: grep for `display_visible` in `src-tauri/`, `src/lib/data-mapper.ts`, `src/domain/types/`.                                                                                                                                                                      |
| `do $$ ... end$$` data migration runs as `postgres` superuser but inserts into RLS-enabled tables. RLS does not apply to superuser, so the inserts succeed -- but if anyone re-runs the data migration block as a non-superuser, RLS will block it.       | Document that the data migration runs once at deploy time as part of `supabase db push` (which uses superuser context). If we need to re-enroll users later, do it via the app, not the migration block.                                                              |
| **Unknown:** Whether `ardentforge://` deep links can encode a gym pre-selection (e.g., a coach sends a link "do this workout at Garage").                                                                                                                 | Out of scope for v1. Captured as a backlog candidate.                                                                                                                                                                                                                 |
| **Unknown:** The exact existing modal/confirm pattern in the codebase (radix dialog wrapped in a hook? imperative `confirm()` clone?).                                                                                                                    | Resolve during impl by reading the existing pattern (e.g., the share-link modal or sign-out confirm).                                                                                                                                                                 |

---

## ADR Candidates

**ADR-012: Gym partitioning model for the remote display.** Captures: (1) gym as a first-class entity with self-service membership, (2) per-gym broadcast channels, (3) `is_default` flag + auth.users trigger as the new-user enrollment mechanism, (4) the deliberate column-level GRANT loosening for anon `gyms.name` reads. This is a _single_ ADR because all four decisions are coupled -- you can't adopt one without the others. Worth recording because it changes the security posture of the display route (anon column-level read is a meaningful precedent) and introduces the first auth.users trigger in the codebase.

No other ADRs needed. All other decisions in this Tech.md are implementation-level (which file, which library, which test layer) and follow the existing patterns documented in `.claude/rules/`.

---

## Testing Strategy

High-level (specific test tasks live in Steps.md):

### Postgres / RLS

- Two-user pgtap or SQL test: user A creates gym → user B can read it → user B can join it → user A cannot delete user B's membership → user A can kick user B → user A can delete the gym → cascade removes all memberships.
- Anon test: `select id, name from gyms` succeeds, `select * from gyms` errors, `select * from gym_members` errors.
- Trigger test: `auth.admin.createUser({ email })` followed by `select * from gym_members where user_id = ?` -- expect one row pointing to the default gym.
- Migration idempotency test: apply, snapshot row counts, apply again, assert zero new rows.

### TypeScript unit

- `gym-channel.test.ts`: round-trip `parseGymIdFromChannel(getGymChannelName(uuid)) === uuid`.
- `gym-picker-storage.test.ts`: store, read, store invalid, read returns null.
- `gym-picker-sheet.test.tsx`: zero-gym (Private only + hint), single-gym (gym + Private, sticky default = gym), multi-gym (all gyms + Private, sticky default = last picked), invalid sticky default (gym no longer in membership) → falls back to Private.
- `active-workout-gym-label.test.tsx`: 1 gym → no label, 2 gyms → label visible.
- `display-publisher.test.ts` updates: `_activeGymId = null` → all sends are no-ops; `_activeGymId = 'A'` → all sends to channel `display:gym:A`; switching from gym A to gym B mid-test recreates the channel.
- `display-subscriber.test.ts` updates: subscribing with gymId `'A'` opens channel `display:gym:A`.

### Edge Function

- Deno test seeds two users, two gyms (gym A with user 1, gym B with user 2), today's scheduled session for each. Invokes `display-idle-snapshot`. Expects two POSTs to `realtime/v1/api/broadcast` with disjoint topics and disjoint payloads.

### Manual smoke

- Pre-deploy: take a snapshot of dev DB. Apply migrations. Open `/display/gym/<home_gym_id>` (logged from migration notice). Confirm a set on phone. TV updates. Switch to "Private" picker. Confirm a set. TV does NOT update.
- Post-deploy: same flow on the live friends-and-family instance, with the host updating the existing TV's URL to the new gym path.

---

## Revision History

| Date       | Change            | ADR                       |
| ---------- | ----------------- | ------------------------- |
| 2026-04-06 | Initial tech plan | ADR-012 candidate flagged |
