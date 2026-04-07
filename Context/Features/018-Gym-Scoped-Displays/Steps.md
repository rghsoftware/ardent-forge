# Implementation Steps: Gym-Scoped Displays (F018)

**Spec:** [Spec.md](./Spec.md)
**Tech:** [Tech.md](./Tech.md)

## Progress

- **Status:** Complete (S030 automated; S031 manual smoke test pending operator)
- **Current task:** --
- **Last milestone:** Final -- all 30 implementation tasks delivered, all validation gates green

## Team Orchestration

### Team Members

- **db-supabase**
  - Role: Postgres schema, RLS, RPCs, triggers, data migration, Edge Function
  - Agent Type: supabase-specialist
  - Resume: true
- **rust-tauri**
  - Role: Tauri Rust models, command handlers, SQLite migration sweep
  - Agent Type: backend-engineer
  - Resume: true
- **fe-broadcast**
  - Role: Display publisher / subscriber / display route / display hooks
  - Agent Type: frontend-specialist
  - Resume: true
- **fe-ui**
  - Role: Domain types, adapter layer, picker UX, settings UI, workout-start integration
  - Agent Type: frontend-specialist
  - Resume: true
- **security**
  - Role: Audit RLS posture, anon column-level GRANT, auth.users trigger
  - Agent Type: security-auditor
  - Resume: false
- **adr-author**
  - Role: Write ADR-012 Gym Partitioning Model
  - Agent Type: content-writer
  - Resume: false
- **validator**
  - Role: Final read-only quality validation against all spec assertions
  - Agent Type: quality-engineer
  - Resume: false

---

## Tasks

### Phase 1: Foundation primitives

Pure modules with zero DB and zero existing-code dependencies. Three small files that everyone downstream imports.

- [ ] S001: Create `src/lib/gym-channel.ts` exporting `GYM_CHANNEL_PREFIX`, `getGymChannelName(gymId)`, `parseGymIdFromChannel(channelName)`. No external dependencies.
  - **Assigned:** fe-broadcast
  - **Depends:** none
  - **Parallel:** true
- [ ] S001-T: Vitest unit tests for `gym-channel.ts` (round-trip `parse(get(uuid)) === uuid`, prefix constant, parsing rejects unrelated channel names, parsing rejects empty gym ID)
  - **Assigned:** fe-broadcast
  - **Depends:** S001

- [ ] S002: Create `src/lib/gym-picker-storage.ts` exporting `GymPickerChoice` type, `readLastGymChoice()`, `writeLastGymChoice(choice)`. Wraps localStorage with try/catch + `[gym-picker]` log prefixes per error-handling rules.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] S002-T: Vitest unit tests for `gym-picker-storage.ts` (write+read round-trip with UUID, write+read with `'private'`, read returns null on empty, read tolerates corrupted localStorage, write tolerates quota errors)
  - **Assigned:** fe-ui
  - **Depends:** S002

- [ ] S003: Create `src/domain/types/gym.ts` with `gymSchema` (`id`, `name`, `ownerUserId`, `isDefault`, `createdAt`, `updatedAt`), `gymMemberSchema` (`gymId`, `userId`, `joinedAt`), and inferred `Gym` / `GymMember` types. Use `syncableEntitySchema` extension if it fits the existing convention; otherwise plain `z.object`. Re-export from `src/domain/types/index.ts`.
  - **Assigned:** fe-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] S003-T: Vitest unit tests for `gym.ts` schemas (valid gym parses, name length bounds 1-60 enforced, missing required fields rejected, valid gymMember parses)
  - **Assigned:** fe-ui
  - **Depends:** S003

🏁 **MILESTONE M1:** Foundation primitives in place -- channel function, picker storage, and domain types are importable. Verify against [TA15] (channel-naming function exists).

**Contracts:**

- `src/lib/gym-channel.ts` -- `getGymChannelName(gymId)` and `parseGymIdFromChannel(channelName)`; the `GYM_CHANNEL_PREFIX` constant
- `src/lib/gym-picker-storage.ts` -- `GymPickerChoice` type union and `readLastGymChoice` / `writeLastGymChoice` API
- `src/domain/types/gym.ts` -- `Gym`, `GymMember` types and their Zod schemas

---

### Phase 2: Database layer

Two migrations, an RLS test file, and the Edge Function fan-out. The Edge Function depends on the second migration's RPC signature.

- [ ] S004: Write `supabase/migrations/20260407000001_create_gyms.sql`. Include in order: (1) `create table gyms` with `is_default` partial unique index; (2) `create table gym_members` with composite PK and `idx_gym_members_user_gym` index; (3) `enable row level security` on both; (4) the six RLS policies from Tech.md D2; (5) `revoke all on gyms from anon` followed by `grant select (id, name) on gyms to anon`; (6) the `enroll_new_user_in_default_gym` security-definer function and `trg_auth_user_default_gym` trigger; (7) the `do $$ ... end$$` data migration block from Tech.md D9 with both short-circuit guards and the `raise notice` for the new TV URL; (8) `alter table user_profiles drop column if exists display_visible`. The migration must be re-runnable safely (idempotent by construction).
  - **Assigned:** db-supabase
  - **Depends:** none
  - **Parallel:** true
- [ ] S004-T: Create `supabase/tests/018_gym_rls.sql` (or pgtap equivalent) covering: (a) authenticated user A can `INSERT` a gym with `owner_user_id = auth.uid()`, (b) authenticated user B can `SELECT` user A's gym, (c) user B can `INSERT` their own `gym_members` row but not user A's, (d) user A can `UPDATE` and `DELETE` their own gym, (e) user B cannot `UPDATE` or `DELETE` user A's gym, (f) user B can `DELETE` their own membership (leave), (g) user A can `DELETE` user B's membership in user A's gym (kick), (h) anon role can `select id, name from gyms` succeed but `select * from gyms` fails on column-level access, (i) anon role cannot `select` any column from `gym_members`. Maps to [TA1, TA2, TA14, TA17].
  - **Assigned:** db-supabase
  - **Depends:** S004

- [ ] S005: Write `supabase/migrations/20260407000002_replace_idle_sessions_rpc.sql`. Drops the existing `get_display_idle_sessions()` (no-arg). Creates `get_display_idle_sessions(p_gym_id uuid)` that joins `gym_members` to filter to that gym's members (replaces the `up.display_visible = true` filter from the prior version). Revoke from public/anon/authenticated, grant to service_role.
  - **Assigned:** db-supabase
  - **Depends:** S004
  - **Parallel:** false
- [ ] S005-T: SQL test in `supabase/tests/018_idle_rpc.sql` -- seed two gyms with disjoint members and a scheduled session each, call `get_display_idle_sessions(gym_a_id)`, assert only gym A's user appears; same for gym B. Maps to [TA10, M18].
  - **Assigned:** db-supabase
  - **Depends:** S005

- [ ] S006: Add a trigger backfill test in `supabase/tests/018_trigger.sql` -- create a user via `auth.admin.createUser` (or simulate via direct insert into `auth.users` with the appropriate fields), assert exactly one row exists in `gym_members` for that user pointing to the default gym. Test the no-default-gym branch by deleting the default first. Maps to [TA20].
  - **Assigned:** db-supabase
  - **Depends:** S004

- [ ] S007: Update `supabase/functions/display-idle-snapshot/index.ts` to: (a) `select id from gyms` once per invocation, (b) loop and call `supabase.rpc('get_display_idle_sessions', { p_gym_id: gym.id })` per gym, (c) build one `IdleSnapshot` per gym, (d) POST one broadcast per gym to `realtime/v1/api/broadcast` with topic `realtime:display:gym:{gym.id}`. Return summary `{ published, gym_count, total_sessions }`. Use the same `topic` naming convention as the new gym channels (i.e. `realtime:` prefix + `getGymChannelName(...)`-style suffix). Since Deno can't import from `src/lib/gym-channel.ts`, duplicate the prefix constant inline with a comment pointing to the source of truth.
  - **Assigned:** db-supabase
  - **Depends:** S005
  - **Parallel:** false
- [ ] S007-T: Deno test in `supabase/functions/display-idle-snapshot/index_test.ts` -- mock the Supabase client to return two gyms with disjoint members, invoke `handler`, assert (a) two `realtime/v1/api/broadcast` POSTs were made with disjoint topics, (b) each payload's `scheduled_sessions` is non-overlapping, (c) the response body summary is correct. Maps to [TA10, M17].
  - **Assigned:** db-supabase
  - **Depends:** S007

🏁 **MILESTONE M2:** Database layer complete -- schema, RLS, trigger, data migration, RPC, and Edge Function all updated and tested. Verify against [M1, M2, M3-M8, M17, M18, M20, M21, M22, RD-15 through RD-19, TA1, TA2, TA10, TA12, TA14, TA17, TA18, TA19, TA20, TA21].

**Contracts:**

- `supabase/migrations/20260407000001_create_gyms.sql` -- the canonical schema, RLS policies, anon grants, trigger, and data migration. Downstream agents read this to understand `owner_user_id`, `is_default`, `gym_members` PK shape, and what's in the `gyms` row.
- `supabase/migrations/20260407000002_replace_idle_sessions_rpc.sql` -- the new RPC signature `get_display_idle_sessions(p_gym_id uuid)` and its return shape. Edge Function callers and any future RPC consumers reference this.

---

### Phase 3: Domain & adapter sweep

Domain layer changes (remove `displayVisible`, add `Gym` mapping) and adapter wiring. Runs after Phase 2 because the adapter implementations need to know the schema, but parallel with Phase 4 (Tauri Rust sweep) and Phase 5 (display pipeline).

- [ ] S008: Remove `displayVisible` from `src/domain/types/user.ts` (`userProfileSchema`). Update `src/lib/data-mapper.ts` -- remove `display_visible` from `toUserProfile` and `fromUserProfile`. Add `toGym(row): Gym`, `fromGym(gym): Partial<GymRow>`, `toGymMember(row): GymMember`, `fromGymMember(member, userId): Partial<GymMemberRow>`. Define the `GymRow` and `GymMemberRow` row types alongside the existing row type definitions in `data-mapper.ts` (or wherever the existing convention places them).
  - **Assigned:** fe-ui
  - **Depends:** S003, M2
  - **Parallel:** true
- [ ] S008-T: Vitest tests in `src/lib/__tests__/data-mapper-gym.test.ts` covering round-trip for `Gym` and `GymMember`, plus a regression test that `toUserProfile` no longer reads `display_visible` and `fromUserProfile` no longer writes it.
  - **Assigned:** fe-ui
  - **Depends:** S008

- [ ] S009: Add gym CRUD methods to the `DataAdapter` interface in `src/lib/data-adapter.ts`: `listUserGyms(userId): Promise<Gym[]>`, `listAllGyms(): Promise<Gym[]>`, `getGym(gymId): Promise<Gym | null>`, `createGym(input: { name: string }): Promise<Gym>`, `updateGym(input: Partial<Gym> & { id: string }): Promise<Gym>`, `deleteGym(gymId): Promise<void>`, `joinGym(gymId): Promise<void>`, `leaveGym(gymId): Promise<void>`, `kickGymMember(gymId, userId): Promise<void>`, `listGymMembers(gymId): Promise<GymMember[]>`. Keep the interface minimal and verb-based to match the existing style.
  - **Assigned:** fe-ui
  - **Depends:** S008
  - **Parallel:** false

- [ ] S010: Implement the gym CRUD methods in `src/lib/supabase-adapter.ts` against the schema from S004. Use `getCurrentUserId()` (or whatever the existing helper is) for `owner_user_id` defaulting in `createGym`. Use `.single()` where exactly one row is expected. Map all errors to the existing error envelope. Reference: `data-mapper.ts::toGym/fromGym` from S008.
  - **Assigned:** fe-ui
  - **Depends:** S009
  - **Parallel:** true
- [ ] S010-T: Vitest tests in `src/lib/__tests__/supabase-adapter-gym.test.ts` mocking the Supabase client to verify each gym CRUD method makes the expected query and returns the expected mapped shape. Existing `supabase-adapter.test.ts` is the template.
  - **Assigned:** fe-ui
  - **Depends:** S010

- [ ] S011: Implement the gym CRUD methods in `src/lib/tauri-adapter.ts` as **online-required stubs** -- each method throws `new Error('Gyms require an online connection')` (or returns an empty array for read methods, depending on the existing offline-tolerance convention). Reference D14: gyms are online-only.
  - **Assigned:** fe-ui
  - **Depends:** S009
  - **Parallel:** true
- [ ] S011-T: Vitest tests in `src/lib/__tests__/tauri-adapter-gym.test.ts` verifying each gym method either throws the expected error or returns the empty-collection sentinel.
  - **Assigned:** fe-ui
  - **Depends:** S011

🏁 **MILESTONE M3:** Domain & adapter sweep complete -- the type system and adapter layer are gym-aware; `displayVisible` is gone from domain types and the Supabase data-mapper. Verify against [M10 (drop column from app side too)].

**Contracts:**

- `src/lib/data-adapter.ts` -- the `DataAdapter` interface gym methods that hooks consume
- `src/lib/data-mapper.ts` -- `toGym`, `fromGym`, `toGymMember`, `fromGymMember`, plus `GymRow` / `GymMemberRow` row types
- `src/domain/types/gym.ts` -- final shape (already locked in M1, re-confirmed here)

---

### Phase 4: Tauri Rust sweep

Removes `display_visible` from the Tauri-side schema, models, and commands. Runs in parallel with Phase 3 since it doesn't share files with the TypeScript domain sweep.

- [ ] S012: Tauri sweep in three files: (1) `src-tauri/migrations/NNN_drop_display_visible.sql` with `ALTER TABLE user_profiles DROP COLUMN IF EXISTS display_visible;` -- pick the next sequential migration number; (2) `src-tauri/src/models.rs` -- remove `pub display_visible: Option<i32>` from `UserProfileRow`; (3) `src-tauri/src/commands/user_profile.rs` -- remove `display_visible` from `UpdateUserProfileInput`, the column list of the UPSERT, and the bind expression. Verify with `cargo check` from `src-tauri/`.
  - **Assigned:** rust-tauri
  - **Depends:** none (independent of Postgres timeline -- the SQLite is a parallel cache)
  - **Parallel:** true
- [ ] S012-T: Update `src-tauri/src/commands/user_profile.rs` rust tests (`#[cfg(test)]` block, if any) to remove `display_visible` from UPSERT fixtures. Update `src/lib/__tests__/tauri-adapter.test.ts` to remove `display_visible` from `tauriUserProfileResponse` fixtures. Run `cargo test` from `src-tauri/` and `bun run test src/lib/__tests__/tauri-adapter.test.ts`.
  - **Assigned:** rust-tauri
  - **Depends:** S012

🏁 **MILESTONE M4:** Tauri Rust sweep complete -- no `display_visible` references remain on the Tauri side. Verify with: `grep -r display_visible src-tauri/ src/lib/data-mapper.ts src/lib/tauri-adapter.ts` returns zero matches.

**Contracts:**

- `src-tauri/src/models.rs` -- updated `UserProfileRow` shape (no `display_visible`)
- `src-tauri/migrations/NNN_drop_display_visible.sql` -- the parallel SQLite migration

---

### Phase 5: Display pipeline updates

Publisher / subscriber / display route / display hooks. Depends on M1 (channel function) and M3 (gym types from the adapter sweep -- needed by `use-display-broadcast.ts`). Parallel with Phase 4.

- [ ] S013: Update `src/lib/display-publisher.ts` per Tech.md D4 -- replace the `_displayVisible` module variable with `_activeGymId: string | null`. Change `configureDisplayPublisher`'s signature to `{ gymId: string | null }`. Update `ensureChannel()` to use `getGymChannelName(_activeGymId)` (importing from `src/lib/gym-channel.ts`). All publish functions check `_activeGymId !== null` instead of `_displayVisible`. If `_activeGymId` changes between calls, tear down the old channel and let `ensureChannel` recreate it on the next call. Update `isPublisherReady()` to return `_client !== null && _activeGymId !== null`. Reset `_activeGymId` in `destroyDisplayPublisher()`.
  - **Assigned:** fe-broadcast
  - **Depends:** M1, M3
  - **Parallel:** true
- [ ] S013-T: Update `src/lib/__tests__/display-publisher.test.ts` and `src/lib/__tests__/display-publisher-hello.test.ts`. Remove all `displayVisible` cases. New cases: (a) publisher with `gymId = null` is a no-op for all four publish functions, (b) publisher with `gymId = 'A'` sends to channel `display:gym:A` for all four event types, (c) switching from `gymId = 'A'` to `gymId = 'B'` between publishes recreates the channel and sends the second event to `display:gym:B`, (d) publisher with no client at all is still a no-op. Maps to [TA4, TA5, TA15].
  - **Assigned:** fe-broadcast
  - **Depends:** S013

- [ ] S014: Update `src/lib/display-subscriber.ts` to take `gymId` in `subscribeToDisplay`. Compute the channel name via `getGymChannelName(gymId)`. The retry/reconnect logic must remember the `gymId` and reuse it. The `userIdPayloadSchema` and event handlers stay unchanged (the wire format is identical).
  - **Assigned:** fe-broadcast
  - **Depends:** M1, M3
  - **Parallel:** true
- [ ] S014-T: Update `src/lib/__tests__/display-subscriber.test.ts` to assert the channel name is `display:gym:<uuid>` (using `getGymChannelName`) when subscribing with a given `gymId`. Test that reconnect after a `CHANNEL_ERROR` reuses the same `gymId`. Maps to [TA8].
  - **Assigned:** fe-broadcast
  - **Depends:** S014

- [ ] S015: Move the display route. Delete `src/routes/display.tsx` (current location). Create `src/routes/display/gym/$gymId.tsx` containing the equivalent component but reading `$gymId` from `useParams`, validating it's a UUID, passing it to `subscribeToDisplay({ gymId, handlers })`. Optionally fetch the gym name via the anon `select id, name from gyms where id = $gymId` and `console.info('[display] subscribed to gym <name>')` for operator reassurance per S5. Create `src/routes/display/index.tsx` for the legacy `/display` no-gym path -- a static "Display not configured" page per S6 that does NOT create a Supabase client.
  - **Assigned:** fe-broadcast
  - **Depends:** S014
  - **Parallel:** false
- [ ] S015-T: Vitest test in `src/routes/display/__tests__/gym-route.test.tsx` -- mock the subscriber, render `/display/gym/<uuid>`, assert `subscribeToDisplay` was called with the expected gymId. Render `/display/` (the legacy path) and assert no Supabase client was created and no channel was opened. Maps to [TA8, TA9].
  - **Assigned:** fe-broadcast
  - **Depends:** S015

- [ ] S016: Update `src/components/display/use-idle-snapshot.ts` to take a `gymId` argument and subscribe to the per-gym channel via `getGymChannelName(gymId)`. The hook used to subscribe to `'display'` standalone -- it now consumes the same channel as the main subscriber, and arguably duplicates the subscription. **Tech.md D5 implies the idle subscription folds into the main subscriber** (since the wire format is the same channel). Verify and either remove `use-idle-snapshot.ts` entirely or keep it with the `gymId` arg if there's a separate consumer that needs it. Default: read the existing usage and decide; document the choice in the task PR.
  - **Assigned:** fe-broadcast
  - **Depends:** S014
  - **Parallel:** false

- [ ] S017: Update `src/hooks/use-display-broadcast.ts` -- remove the `displayVisible` read from `useUserProfile`, remove the `useEffect` that calls `configureDisplayPublisher({ displayVisible })`. Replace with: a new accept `gymId` argument (or read from the active workout publisher state -- Tech.md D4 leaves the choice to impl). The hook's `useDisplayBroadcast(userId, gymId)` configures the publisher with `gymId` whenever it changes. The `_publisherContext` snapshot context wiring stays unchanged.
  - **Assigned:** fe-broadcast
  - **Depends:** S013
  - **Parallel:** false
- [ ] S017-T: Vitest tests in `src/hooks/__tests__/use-display-broadcast.test.tsx` covering: (a) hook called with `gymId = 'A'` configures the publisher with that gym, (b) hook called with `gymId = null` configures the publisher to no-op mode, (c) changing `gymId` between renders re-configures.
  - **Assigned:** fe-broadcast
  - **Depends:** S017

🏁 **MILESTONE M5:** Display pipeline updated -- publisher, subscriber, route, and hooks are all gym-aware. Channel naming is consistent and uses the helper function. Verify against [M9, M14, M15, M16, TA4, TA5, TA8, TA9, TA15].

**Contracts:**

- `src/lib/display-publisher.ts` -- new `configureDisplayPublisher({ gymId })` signature; `_activeGymId` semantics
- `src/lib/display-subscriber.ts` -- new `subscribeToDisplay({ gymId, handlers })` signature
- `src/routes/display/gym/$gymId.tsx` -- new display route file path; route params shape
- `src/hooks/use-display-broadcast.ts` -- updated hook signature

---

### Phase 6: Hooks for gym CRUD

TanStack Query hooks consumed by the picker, settings UI, and workout header label. Sits between Phase 3 (adapter) and Phase 7 (UI components).

- [ ] S018: Create `src/hooks/use-gyms.ts` exporting `useGyms(userId)` (lists user's memberships joined to gym rows), `useAllGyms()` (lists every gym on instance), `useGym(gymId)` (single gym lookup), `useCreateGym()` (mutation), `useUpdateGym()` (mutation), `useDeleteGym()` (mutation). Use TanStack Query keys per the existing `[domain, action, params]` pattern. All mutations invalidate the relevant query keys on success.
  - **Assigned:** fe-ui
  - **Depends:** M3
  - **Parallel:** true
- [ ] S018-T: Vitest tests in `src/hooks/__tests__/use-gyms.test.tsx` mocking the adapter and verifying each query/mutation calls the correct adapter method, returns the expected mapped shape, and invalidates the right keys on mutation success.
  - **Assigned:** fe-ui
  - **Depends:** S018

- [ ] S019: Create `src/hooks/use-gym-members.ts` exporting `useGymMembers(gymId)` (list members of a gym), `useJoinGym()` (mutation), `useLeaveGym()` (mutation), `useKickGymMember()` (mutation, owner-only enforced server-side via RLS).
  - **Assigned:** fe-ui
  - **Depends:** M3
  - **Parallel:** true
- [ ] S019-T: Vitest tests in `src/hooks/__tests__/use-gym-members.test.tsx` -- one test per hook with mocked adapter.
  - **Assigned:** fe-ui
  - **Depends:** S019

🏁 **MILESTONE M6:** Gym CRUD hooks ready -- the picker, settings UI, and workout header label have a stable data API to consume.

**Contracts:**

- `src/hooks/use-gyms.ts` -- query/mutation hook surface
- `src/hooks/use-gym-members.ts` -- query/mutation hook surface

---

### Phase 7: UI components

Three new components and one shared imperative hook. All consume M6 hooks. The picker is the most behavior-heavy; the workout header label and the settings section are mostly presentational.

- [ ] S020: Create `src/components/workout/gym-picker-sheet.tsx` per Tech.md D10. Use the existing radix-dialog wrapper (or vaul, whichever the codebase uses for bottom-sheets -- check `src/components/ui/` first). Rows are 48px tall, ALL-CAPS gym name, member count badge, sticky-default highlighted with the ember accent. The "Private (don't publish)" row is always present, with `material-symbols-outlined visibility_off` and `text-secondary` styling. The picker is controlled by an `open` prop and emits `onResolve(choice: GymPickerChoice)` and `onCancel()`. Read the user's gyms via `useGyms(userId)`. Read the sticky default via `readLastGymChoice()` and validate it against the membership list -- fall back to `'private'` if invalid.
  - **Assigned:** fe-ui
  - **Depends:** M6, S002
  - **Parallel:** true
- [ ] S020-T: Vitest component tests in `src/components/workout/__tests__/gym-picker-sheet.test.tsx` with mocked `useGyms`. Cases: (a) zero-gym user shows only Private row + hint text, (b) single-gym user shows the gym + Private with the gym preselected when sticky default matches, (c) multi-gym user shows all gyms + Private with sticky default highlighted, (d) sticky default pointing at a gym the user no longer belongs to falls back to Private, (e) tapping a row calls `onResolve` with the right value, (f) tapping outside or pressing Escape calls `onCancel`. Maps to [TA3, TA6, TA7].
  - **Assigned:** fe-ui
  - **Depends:** S020

- [ ] S021: Create `src/hooks/use-gym-picker.ts` exporting `useGymPicker()` returning `{ openGymPicker(args) => Promise<GymPickerChoice | null>, GymPickerPortal }`. The hook holds local state for `isOpen`, the active resolver promise, and the args passed in. `openGymPicker` returns a new promise each call and stores its `resolve`. The portal renders `<GymPickerSheet open={isOpen} onResolve={(choice) => { resolver(choice); setIsOpen(false) }} onCancel={() => { resolver(null); setIsOpen(false) }} />`. The portal must be mounted somewhere in the route tree (the `_authenticated` layout is a good choice).
  - **Assigned:** fe-ui
  - **Depends:** S020
  - **Parallel:** false
- [ ] S021-T: Vitest tests in `src/hooks/__tests__/use-gym-picker.test.tsx`. Cases: (a) `openGymPicker` returns a promise that resolves when the picker emits a choice, (b) calling it twice in sequence rejects/replaces the first promise (or queues -- pick whichever is simpler and document), (c) cancellation resolves with null.
  - **Assigned:** fe-ui
  - **Depends:** S021

- [ ] S022: Create `src/components/workout/active-workout-gym-label.tsx` per Tech.md D12. Reads the user's gym memberships via `useGyms(userId)`. Reads the active gym ID via `getActiveGymId()` (a new exported function in `src/lib/display-publisher.ts` -- add it as part of S013 if not already there). Conditionally renders **only when `gyms.length >= 2`**. Style: tertiary-row label-medium ALL-CAPS, `text-secondary`, format `OPERATOR · {GYM_NAME}`. Mounts inside the active workout header (find the existing header component during impl).
  - **Assigned:** fe-ui
  - **Depends:** M5, M6
  - **Parallel:** true
- [ ] S022-T: Vitest component tests in `src/components/workout/__tests__/active-workout-gym-label.test.tsx`. Cases: (a) 1-gym user renders nothing, (b) 2-gym user with active gym A renders `OPERATOR · GYM A NAME`, (c) gym name lookup miss renders nothing (defensive), (d) `getActiveGymId() === null` renders nothing. Maps to [TA16, M23].
  - **Assigned:** fe-ui
  - **Depends:** S022

- [ ] S023: Create `src/components/profile/gym-management-section.tsx` per Tech.md D13. Three subsections: My gyms (uses `useGyms(userId)`, render rows with name, member-count badge, Leave button, plus Delete-gym button for owned gyms), Browse all gyms (uses `useAllGyms()`, render rows with Join button or "Joined" indicator), Create gym (text input + button using `useCreateGym()`). Confirmation modal for gym deletion per S4 ("This will end any active TV at this gym. Confirm?"). Follows the existing profile.tsx section convention (ALL-CAPS section header, tonal divider). Per S8, add the `// TODO: paginate when gyms.length > ~50` code comment in the Browse subsection.
  - **Assigned:** fe-ui
  - **Depends:** M6
  - **Parallel:** true
- [ ] S023-T: Vitest component tests in `src/components/profile/__tests__/gym-management-section.test.tsx` covering: (a) my gyms list renders with leave/delete buttons appropriately, (b) leave button calls `useLeaveGym` mutation, (c) delete button on an owned gym opens confirmation modal, (d) browse list renders with Join buttons that disable when already joined, (e) create form posts a new gym via `useCreateGym`, (f) the pagination TODO comment exists (lint-style assertion via reading the source file).
  - **Assigned:** fe-ui
  - **Depends:** S023

🏁 **MILESTONE M7:** UI components complete -- picker, gym management section, and workout header label all built and tested. Verify against [S1, S2, S3, S4, S7, S8, M11, M12, M13, M19, M23, TA3, TA6, TA7, TA16].

**Contracts:**

- `src/components/workout/gym-picker-sheet.tsx` -- the picker component API
- `src/hooks/use-gym-picker.ts` -- `openGymPicker` imperative API and `GymPickerPortal`
- `src/components/workout/active-workout-gym-label.tsx` -- the conditional header label component
- `src/components/profile/gym-management-section.tsx` -- the settings section component

---

### Phase 8: Integration

Wire the picker into the start-workout flow and the new section into the profile route. Removes the legacy `display_visible` UI in the same edit.

- [ ] S024: Update `src/routes/_authenticated/profile.tsx`. Remove the `displayVisible` state, the `effectiveDisplayVisible` derived value, the "Display visibility" `<Switch>` row, and the `displayVisible` field from `handleSaveSettings`'s update payload. Mount `<GymManagementSection userId={userId} />` in its place. Confirm the rest of the settings page still compiles and saves correctly. Maps to [M19, M10 (remove `display_visible` UI)].
  - **Assigned:** fe-ui
  - **Depends:** S023, M3
  - **Parallel:** true

- [ ] S025: Update `src/routes/_authenticated/index.tsx` per Tech.md D11. Both `handleStartWorkout` and `handleStartProgrammedSession` become async and await the picker before creating a workout. Pseudocode:
  ```ts
  const choice = await openGymPicker({ userId })
  if (choice === null) return
  const workoutLog = await startWorkout(userId)
  configureDisplayPublisher({ gymId: choice === 'private' ? null : choice })
  writeLastGymChoice(choice)
  navigate(...)
  ```
  Mount the `<GymPickerPortal />` from `useGymPicker` somewhere accessible (top of the route or in the `_authenticated` layout). On error during workout creation, the picker has already closed; the user can retry. Maps to [M11, M12, M13, M14, RD-12, TA4, TA5, TA6, TA7, TA16].
  - **Assigned:** fe-ui
  - **Depends:** S021, S024, M5
  - **Parallel:** false
- [ ] S025-T: Integration test in `src/routes/_authenticated/__tests__/start-workout-flow.test.tsx` -- mock `openGymPicker`, `useActiveWorkout`, and the publisher. Cases: (a) user picks gym A → `configureDisplayPublisher({ gymId: 'A' })` is called with the right ID, (b) user picks Private → `configureDisplayPublisher({ gymId: null })`, (c) user cancels the picker → no workout is created and the publisher is not configured, (d) `writeLastGymChoice` is called with the right value on success.
  - **Assigned:** fe-ui
  - **Depends:** S025

🏁 **MILESTONE M8:** Integration complete -- workout-start flows through the picker, profile shows gym management. The user-facing surface of the feature is wired up end-to-end. Verify against [M11-M14, M19, RD-10, RD-11].

**Contracts:**

- `src/routes/_authenticated/profile.tsx` -- updated profile route with no `displayVisible`
- `src/routes/_authenticated/index.tsx` -- updated start-workout handlers awaiting the picker

---

### Phase 9: Cleanup, security audit, and ADR

- [ ] S026: Update `scripts/seed-display.ts` to use `getGymChannelName(SOME_GYM_ID)` for the channel name, where `SOME_GYM_ID` is either an env var or a hardcoded test UUID. If the script can't import from `src/lib/gym-channel.ts` (due to script-vs-app module resolution), inline the prefix constant with a comment pointing to the source of truth (same pattern as the Edge Function in S007).
  - **Assigned:** fe-broadcast
  - **Depends:** M5
  - **Parallel:** true

- [ ] S027: Update `supabase/seed-reviewer.sql`. Remove `display_visible` from the `INSERT INTO user_profiles` column list and values. Add a Home gym creation block: insert a row into `gyms` with `is_default = true` and the reviewer user as `owner_user_id`, then insert the reviewer's `gym_members` row. Wrap in a `not exists` guard like the migration.
  - **Assigned:** db-supabase
  - **Depends:** M2
  - **Parallel:** true

- [ ] S028: Security audit. Read the migration at `supabase/migrations/20260407000001_create_gyms.sql` and the F018 spec/tech docs. Validate: (a) the six RLS policies actually enforce what Tech.md D2 claims (no membership leakage to other users, no anon membership reads, owner-only mutations); (b) the `revoke all on gyms from anon` followed by `grant select (id, name) on gyms to anon` correctly restricts column access and is not subverted by any other policy or grant; (c) the `enroll_new_user_in_default_gym` function's `security definer` posture is safe -- it doesn't dereference untrusted input, doesn't do anything beyond the documented enroll, and the `set search_path = public` clause prevents search-path attacks; (d) the data migration `do $$ ... end$$` block doesn't accidentally enroll users in gyms they shouldn't be in (e.g., re-running it after a user has left the Home gym should not re-enroll them). Report findings as a checklist; flag any blockers.
  - **Assigned:** security
  - **Depends:** M2
  - **Parallel:** true

- [ ] S029: Write `Context/Decisions/ADR-012-gym-partitioning-model.md`. Use the existing ADR template from `Context/Decisions/`. Capture: (1) the four coupled decisions (gym entity, per-gym channels, auth.users trigger, anon column-level GRANT), (2) the architectural rationale including the friends-and-family scale framing, (3) the alternative considered and rejected (soft fallback / global kill switch), (4) the security implications and the new precedent of `auth.users` triggers in this codebase, (5) the migration impact and the operator-facing TV URL change.
  - **Assigned:** adr-author
  - **Depends:** M5, M8
  - **Parallel:** true
- [ ] S029-D: Update root `CLAUDE.md` only if a new architectural pattern is introduced that future contributors should know about (e.g., the `auth.users` trigger pattern). Otherwise no change. Defer the decision to the adr-author after writing ADR-012.
  - **Assigned:** adr-author
  - **Depends:** S029

🏁 **MILESTONE M9:** Cleanup complete; security audit passed; ADR-012 written. The codebase is consistent and the architectural decision is recorded.

---

### Phase 10: Final validation

- [ ] S030: **validator** runs full quality validation against the spec. Inspects all files modified in this feature against [TA1 through TA21], confirms no `display_visible` references remain in production code (`grep -r display_visible src/ src-tauri/ supabase/`), confirms no `display:` channel literals remain outside test fixtures (`grep -rn "'display'" src/ supabase/functions/ scripts/`), confirms `getGymChannelName` is used everywhere, confirms migrations apply cleanly to a fresh DB, confirms `bun run build` passes, confirms `bun run test` passes, confirms `bun run lint` passes, confirms `cargo check` passes from `src-tauri/`. Reports a checklist with pass/fail per assertion.
  - **Assigned:** validator
  - **Depends:** M9
  - **Parallel:** false

- [ ] S031: Manual smoke test (operator). Apply migrations to a snapshot of the dev database. Read the new Home gym ID from the migration `raise notice` log. Open `/display/gym/<that_id>` in a browser. On a phone (or a second browser), sign in, tap Start Workout, pick the Home gym, confirm a set, observe the TV update. Switch the picker to Private, start a new workout, confirm a set, observe the TV does NOT update. Mark complete when both observations match. Maps to [TA13].
  - **Assigned:** validator
  - **Depends:** S030

🏁 **FINAL MILESTONE:** Feature complete -- verify all assertions, full drift check.

---

### Phase 11: PR review remediation (post-merge)

Tasks captured during the PR #91 review (`Context/Reviews/0014-pr91-gym-scoped-displays-review.md`).
The high-leverage fixes landed inline; this phase tracks the test gaps,
behavior gaps, and follow-ups that warrant their own tasks rather than
inline patches.

- [ ] S032: Add `onTerminalFailure` callback to `display-subscriber` and surface terminal subscriber failures into `BootError`. The route's outer try/catch only sees synchronous throws; `TIMED_OUT`/`CHANNEL_ERROR` fire asynchronously inside `.subscribe()` and never reach the route. Add `onTerminalFailure?: (err: unknown, attempt: number) => void` to `DisplayEventHandlers`. After N retries (e.g. 5) the subscriber stops scheduling and invokes the callback. The route maps it to `BootError { kind: 'subscribe-failed', err }` so the existing Retry button path lights up.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-019, TA8

- [ ] S033: Add `parseGymIdFromChannel` drift test or shared module. The Edge Function at `supabase/functions/display-idle-snapshot/index.ts` duplicates the channel-prefix constant from `src/lib/gym-channel.ts`. No test enforces sync. Cheap option: drift test that reads the Edge Function file as text and asserts the prefix string matches. Better option: shared file at `supabase/functions/_shared/gym-channel.ts` that both sides import via path alias.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-021

- [ ] S034: Add idle snapshot dispatch tests to `display-subscriber.test.ts`. The deleted `use-idle-snapshot.test.ts` previously verified valid/invalid `idle_snapshot` payloads. The new `display-subscriber.test.ts` registers `onIdleSnapshot` as a `vi.fn()` but never fires the listener. Add three tests mirroring the `workout_snapshot` pattern: valid payload calls handler with parsed data; invalid payload is dropped with `console.error` (idle uses error severity, others use warn); idle event arrives on the gym-scoped channel.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-022, TA10

- [ ] S035: Pin `eq('user_id', ...)` assertions in `kickGymMember` and `leaveGym` tests. Both currently only test `expect(mockClient.from).toHaveBeenCalledWith('gym_members')` -- neither asserts the `eq('user_id', ...)` value. A bug that swapped user IDs (kick targeting `auth.uid()` instead of the kick target) would not fail any test. Capture the chain builder from `mockClient.from()` and assert `expect(builder.eq).toHaveBeenCalledWith('gym_id', 'gym-001')` and `expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-007')`.
  - **Assigned:** fe-ui
  - **Relates to:** P14-023, TA2

- [ ] S036: Add SQL trigger on-conflict idempotency test for `enroll_new_user_in_default_gym`. The trigger uses `on conflict do nothing` to be retry-safe but the test never fires it twice for the same user. If the on-conflict clause were ever removed, the trigger would raise a unique-violation and fail the auth.users insert itself, silently breaking signups in production. Add Section 3 to `supabase/tests/018_trigger.sql` that pre-inserts a `gym_members` row using superuser bypass, then inserts the user, and asserts exactly one membership row exists.
  - **Assigned:** db-supabase
  - **Relates to:** P14-024, TA20

- [ ] S037: Add publisher↔subscriber wire-format Zod safeParse guard. The publisher tests use a `const SNAPSHOT_FIXTURE: DisplaySnapshot` cast -- TypeScript catches shape changes but not Zod-only refinements (length bounds, format checks). Add `expect(displaySnapshotSchema.safeParse(SNAPSHOT_FIXTURE).success).toBe(true)` to the publisher test files. Cheap insurance against fixture rot.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-025, Context/Backlog/e2e-display-broadcast-roundtrip.md

- [ ] S038: Mirror subscriber's reconnect-with-backoff in publisher. The subscriber has full reconnect with exponential backoff at `display-subscriber.ts:138-159`. The publisher just nulls the channel on terminal status and waits for the next lazy `ensureChannel()` call. After a network blip, the next set creates a fresh channel and synchronously fires the broadcast send before the new channel is `SUBSCRIBED` -- Supabase Realtime queues or drops pre-subscribe sends depending on version. This is a regression in delivery reliability vs. the legacy single-channel design.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-026

- [ ] S039: Add `useDisplayBroadcast` unmount cleanup test. The hook's effect at `src/hooks/use-display-broadcast.ts:59-73` registers a `setHelloResponder`, calls `initDisplayPublisher`, and cleanup calls `setHelloResponder(null)`, `setSnapshotContext(null)`, and `destroyDisplayPublisher()`. The current test asserts the init path but never unmounts the hook. Add a cleanup test using `renderHook` + `unmount()` and assert all three functions were called.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-027

- [ ] S040: Add `useGymPicker` unmount-mid-pick cleanup test. The hook at `src/hooks/use-gym-picker.tsx:84-95` resolves any in-flight promise with `null` on unmount. The "double-open" test exercises the replace path but never unmounts the harness mid-pick. Add a test that opens the picker, unmounts, and asserts the in-flight promise resolves with `null`.
  - **Assigned:** fe-ui
  - **Relates to:** P14-028

- [ ] S041: Add tests for the three `BootError` kinds in `gym-route.test.tsx`. The route component defines `config-load`, `client-create`, `subscribe-failed` -- each with a different recovery story (only `subscribe-failed` has a Retry button). The test exercises the success path and the invalid-UUID path but none of the three error paths. Add at least one test per BootError kind asserting visible error copy and Retry button presence/absence.
  - **Assigned:** fe-broadcast
  - **Relates to:** P14-029

- [ ] S042: Add Edge Function "all gyms failing" test. The current "broadcast POST fails for one gym" test asserts `summary.published === false` when ONE gym fails. There's no test that exercises all gyms failing at broadcast level. A regression that short-circuits on the first failure (`if (!result.ok) break`) would miss the second gym entirely. Add a test that fails both gyms and asserts `spy.calls.length === 2` and HTTP 502 (or 200 if both share a permanent error code per P14-040).
  - **Assigned:** db-supabase
  - **Relates to:** P14-030

- [ ] S043: Add negative-space "no UPDATE policy on gym_members" SQL assertion. The migration installs no UPDATE policy on `gym_members` (correct: nothing to update on a join row). A future migration that accidentally adds `create policy gym_members_update_self ... using (true)` would pass the test suite. Add `select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_members' and cmd = 'UPDATE'` and assert it equals zero.
  - **Assigned:** db-supabase
  - **Relates to:** P14-031

- [ ] S044: Add SQL RPC overlapping membership test (user in two gyms). `supabase/tests/018_idle_rpc.sql` creates two users in two disjoint gyms but does not cover the overlapping case. A bug that filtered by `distinct user_id` instead of `(user_id, gym_id)` would silently break the multi-gym case. Enroll a third user in both gyms with a scheduled session for today, assert the user appears in `get_display_idle_sessions(gym_a_id)` AND `get_display_idle_sessions(gym_b_id)`.
  - **Assigned:** db-supabase
  - **Relates to:** P14-032

- [ ] S045: Add per-test error-log assertions to mutation hooks. The "surfaces isError when the adapter throws" tests for `useCreateGym`, `useUpdateGym`, `useDeleteGym`, `useJoinGym`, `useLeaveGym`, `useKickGymMember` mock `console.error` but never assert that the `[gyms]` / `[gym-members]` prefixed error was logged. A refactor that removed the prefixes would not fail any test. Add `expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[gyms]'), expect.any(Error))` to each.
  - **Assigned:** fe-ui
  - **Relates to:** P14-033

- [ ] S046: Project-wide migration of `entityId` from `z.string().min(1)` to `z.string().uuid()`. The current `entityId` helper is laxer than reality -- Postgres enforces UUID format on every entity ID column, so `'foo'` parses successfully through Zod even though the DB rejects it. Add `entityIdUuid = z.string().uuid()` and migrate consumers. Out of scope for this PR (touches every domain type).
  - **Assigned:** fe-ui
  - **Relates to:** P14-044

> **Deferred until ADR-013:** P14-020 (Centralize `'private' → null` conversion). The branded GymId / discriminated `GymPickerChoice` work in ADR-013 will force every consumer through one entry point, making this fix part of the larger type-safety overhaul. Re-evaluate after ADR-013 lands.

🏁 **MILESTONE M11:** Review remediation tasks complete -- silent-failure surface area, test gaps, and behavior gaps closed.

---

## Acceptance Criteria

- [ ] All 21 testable assertions from Spec.md verified
- [ ] All Vitest tests passing (`bun run test`)
- [ ] All Rust tests passing (`cargo test` from `src-tauri/`)
- [ ] All RLS tests passing
- [ ] Edge Function Deno test passing
- [ ] `bun run build` passes (TypeScript check + Vite build)
- [ ] `bun run lint` passes
- [ ] `grep -rn display_visible src/ src-tauri/ supabase/` returns zero matches
- [ ] `grep -rn "channel('display'" src/ supabase/functions/ scripts/` returns zero matches (use `getGymChannelName` instead)
- [ ] Security audit (S028) reports no blockers
- [ ] ADR-012 written and merged to `Context/Decisions/`
- [ ] Manual smoke test (S031) passes on dev DB snapshot

## Validation Commands

```bash
# Build & lint
bun run build
bun run lint

# Tests
bun run test
cd src-tauri && cargo test
cd ../supabase && deno test functions/display-idle-snapshot/index_test.ts

# Migration apply (against local Supabase)
npx supabase db reset
npx supabase db push

# Cleanup checks
grep -rn display_visible src/ src-tauri/ supabase/
grep -rn "channel('display'" src/ supabase/functions/ scripts/
grep -rn "'display'" src/lib/display-publisher.ts src/lib/display-subscriber.ts
```

---

## Notes on execution

- **Recommended runner:** `/impl 018` (hub-and-spoke). The waves are sequential enough that contract handoffs at milestones are sufficient -- agents do not need real-time peer-to-peer coordination. `/team-impl` would be over-orchestrated for this shape of work.
- **Parallelism opportunities:** Phase 1 (S001-S003) is fully parallel; Phases 3, 4, and 5 can run concurrently as soon as M2 is complete; within Phase 7, S020/S022/S023 are file-disjoint and run in parallel.
- **Critical sequential edges:** S004 → S005 → S007 (DB layer is strictly ordered); S008 → S009 → S010/S011 (adapter layer); S013/S014 → S015 (route move depends on subscriber update); S023 → S024 (profile route consumes the section); S021 + S024 → S025 (start-workout integration is the funnel for the whole UI side).
- **Resume protocol:** db-supabase, rust-tauri, fe-broadcast, and fe-ui all have `Resume: true` so each task in their queue inherits prior context. Security and adr-author are one-shot and start fresh.
