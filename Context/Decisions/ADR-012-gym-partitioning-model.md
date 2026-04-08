# ADR-012: Gym Partitioning Model for the Remote Display

**Date:** 2026-04-06
**Status:** Accepted
**Feature:** 018-Gym-Scoped-Displays

## Context

F008 / F009 shipped the remote display as a single-venue system: one broadcast channel (`display`), one opt-in flag (`user_profiles.display_visible`), one TV URL (`/display`). That model assumes a Supabase instance is a physical place, which holds for a single-location gym but breaks for a friends-and-family deployment whose members train at multiple physical locations.

In the current model, a member doing a garage workout publishes to the same channel as a member lifting at the host's home gym, so workouts pollute the wrong TV. Conversely, a member who installs a TV at their own location has nowhere to point it -- they would just re-receive the same mixed feed. The fix is to partition every node of the pipeline along the boundary that already exists in the physical world.

The F008 / F009 constraints must continue to hold: the display never writes to the database, never authenticates, and holds only ephemeral state. Any fix has to preserve the passive-subscriber posture of the display route.

## Decision

Introduce a first-class `Gym` entity and partition the broadcast pipeline along it. Four coupled decisions, adopted together:

1. **Gyms as a first-class entity with self-service membership.** Two tables: `gyms` (entity, with `owner_user_id` as a scalar column and an `is_default` boolean) and `gym_members` (M:N join with composite PK `(gym_id, user_id)`). No role hierarchy beyond owner / member. Any authenticated user can create a gym or join any gym on the instance.

2. **Per-gym broadcast channels.** The global `display` channel is replaced by `display:gym:{gym_id}`. The publisher captures the chosen gym at workout start (via a pre-start picker with sticky localStorage default) and holds it for the lifetime of the workout. The display subscriber takes its gym from the route param `/display/gym/$gymId`. The wire format -- `DisplaySnapshot`, `IdleSnapshot`, the four event types -- is unchanged. Only the channel name carries the new dimension.

3. **`auth.users` trigger for new-user enrollment.** A `security definer` Postgres function (`public.enroll_new_user_in_default_gym`) fires on every insert into `auth.users` and enrolls the new user in the gym where `is_default = true`, if any. `on conflict do nothing` makes it idempotent against retries. This is the first `auth.users` trigger in the codebase and is worth recording as architectural precedent.

4. **Anon column-level GRANT loosening.** The `anon` role receives `grant select (id, name) on gyms` (paired with a `revoke all` baseline and a permissive `gyms_select_anon` RLS policy) so the unauthenticated display can resolve its route UUID into a human gym name once at boot for the operator label. Memberships, ownership, `is_default`, and timestamps remain RLS-locked. This is a deliberate, narrowly-scoped loosening of the anon read posture.

## Rationale

- **Single source of truth for the partition.** The gym column replaces a scatter of per-user flags and would-be per-user overrides with one dimension that naturally matches the physical layout. "Publish to gym X but not gym Y" is expressible in the model without adding a per-channel opt-out surface.
- **Self-service M:N membership matches the friends-and-family scale.** Role hierarchies (coach, admin, guest) are future work; v1 collapses them into owner + member and lets the scalar `owner_user_id` column carry every owner-only right (rename, delete, kick).
- **Per-gym channels are the minimum-blast-radius change.** Publisher, subscriber, and Edge Function all gain a `gymId` argument; every wire format stays the same. Existing tests can be reused with a channel-name substitution.
- **The `auth.users` trigger covers every sign-up path uniformly.** Email, OAuth, admin tools, and any future auth flow all land on the same `auth.users` insert. App-level post-signup callbacks miss at least some of these paths.
- **The anon column GRANT is the smallest possible loosening to make the operator UX not-ugly.** Gym names are operator labels -- less revealing than the user display names already rendered on the board view -- and scoping the grant to `(id, name)` guarantees that ownership and membership stay locked.

## Alternatives Considered

- **Soft fallback / global kill switch on `user_profiles.display_visible`.** Rejected (RD-7). Keeping the old flag alongside a gym picker would double the mental model and still leave the model unable to express "publish to gym X but not gym Y." Hard cutover produces a cleaner end state and lower long-term maintenance.
- **Geolocation / Wifi BSSID auto-pick.** Deferred (W1, W2, RD-14). Friends-and-family scale does not earn the GPS / BSSID permission prompts and platform quirks. Manual picker with sticky default is a single tap 90% of the time.
- **Post-signup app callback instead of an `auth.users` trigger** (D7 option (b)). Rejected because OAuth callbacks, admin-tools user creation, and seed scripts all bypass the app callback. A DB-level trigger fires for every `auth.users` insert regardless of the originating code path.
- **Lazy creation when the user opens the picker** (D7 option (c)). Rejected because it defeats the "no thinking required" goal of the first-workout experience -- the picker would still show "Private" as the only option on first open.
- **One cron job per gym for the idle Edge Function** (D6 option (a)). Rejected as too operationally heavy. Dynamic cron management when gyms are created or deleted would add an orchestration layer for no benefit. Chosen instead: one cron, one function, an internal loop over `select id from gyms`, one broadcast per gym per tick.
- **Per-gym programs / templates / exercises.** Out of scope (W4). F016 Public Visibility already handles instance-wide sharing; per-gym content is an orthogonal future scope.

## Consequences

**Positive:**

- Workout broadcasts partition along the boundary that already exists in the physical world. A garage lift no longer pollutes the home gym TV; a member at a new venue can point a TV there without touching code.
- A single Supabase instance hosts arbitrarily many gyms without code or config changes per gym. Adding a gym is a row in `gyms` plus one membership.
- The display stays passive, unauthenticated, and database-quiet. Its only new interaction with Postgres is a one-shot anon read of `(id, name)` for the operator label.
- The `auth.users` trigger handles enrollment uniformly across email, OAuth, admin tools, and seed scripts -- there is no code path that creates a user without landing in the default gym (if one exists).
- The per-workout "Private (don't publish)" option is strictly more expressive than the old global `display_visible` flag: users can opt out one session at a time without leaving a gym.

**Negative / risks:**

- The `auth.users` trigger is a new pattern in this codebase. No prior triggers exist on the auth schema, and the one-line precedent for cross-table consistency is the `enforce_user_id_match_*` triggers on app tables. Future contributors changing the trigger should test against a local Supabase (create a user via `auth.admin.createUser`, query `gym_members`) and keep the `security definer` + locked `search_path` + `on conflict do nothing` posture. The integration test at `supabase/tests/018_trigger.sql` is the pattern to copy.
- The anon column-level GRANT on `gyms.(id, name)` is a meaningful precedent. It is the first time an unauthenticated client can read non-trivial entity data from the database. The privacy delta is small (gym names are operator labels, less revealing than the user display names already on the board view), but the precedent is worth recording: any future anon grants should be scoped equally narrowly and justified in the same way.
- Idle Edge Function broadcast count grows linearly with gym count (one broadcast per gym per cron tick). Acceptable at friends-and-family scale; revisit if it bites at 50+ gyms.
- If the default gym is deleted, new sign-ups stop being auto-enrolled until another gym is marked `is_default = true`. The v1 UI does not expose a "mark another as default" action; the gym deletion confirmation modal warns the operator instead. Future iterations can add a default-swap UI.
- Operators must update their TV URL after the migration (from `/display` to `/display/gym/<home_gym_id>`). The migration's `raise notice` logs the exact new URL so the operator does not have to hunt for the ID.

## Migration impact

The F018 migration (`20260407000001_create_gyms.sql`) performs, in one transaction:

1. Creates the `gyms` and `gym_members` tables, their indices, and the RLS policies.
2. Installs the `is_gym_member` / `is_gym_owner` SECURITY DEFINER helpers (to break the self-recursion that naive `gym_members` policies would otherwise hit) and the `enroll_new_user_in_default_gym` trigger function.
3. Runs a set-based data migration that creates a single `Home` gym owned by the oldest `auth.users` row and enrolls every user who is not already in any gym. Guarded by short-circuits for empty `auth.users` and for any pre-existing default gym, so re-running the migration is a natural no-op.
4. Drops the legacy `user_profiles.display_visible` column and the RLS policy that referenced it, replacing it with a simpler authenticated-read policy on `user_profiles.display_name` (matching the operator-label posture of gym names).

A sibling migration (`20260407000002_replace_idle_sessions_rpc.sql`) replaces the no-arg `get_display_idle_sessions()` RPC with `get_display_idle_sessions(p_gym_id uuid)` that joins `gym_members` to filter to that gym. The Edge Function `display-idle-snapshot` loops over all gyms, calls the new RPC per gym, and broadcasts one `idle_snapshot` payload per gym to its dedicated channel.

Operator action after deploy: update the TV URL from `/display` to `/display/gym/<home_gym_id>` (the ID is logged by the migration's `raise notice`). No data loss; the legacy `/display` route renders a friendly "Display not configured" page for any operator who misses the URL update.

## Related

- F008 Display Broadcast Infrastructure
- F009 Display Route + Idle Mode
- `Context/Features/018-Gym-Scoped-Displays/Spec.md`
- `Context/Features/018-Gym-Scoped-Displays/Tech.md` (D1, D2, D6, D7, D9)
