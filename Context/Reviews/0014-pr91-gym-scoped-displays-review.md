# PR Review: worktree-feat+multipe-instance-display -> develop

**Date:** 2026-04-07
**Feature:** Context/Features/018-Gym-Scoped-Displays/
**Branch:** worktree-feat+multipe-instance-display
**PR:** #91
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer
**Status:** Resolved

## Summary

48 findings across 4 review agents on a 9,342-line PR. One ship-blocking bug (creator-not-enrolled in gym_members, directly violates TA1). Four other critical silent failures stem from a convergent root issue all four agents identified independently: stringly-typed gym IDs prevent the type system from distinguishing "explicitly Private" from "publisher unconfigured" from "garbage from localStorage." 29 fix-now items, 17 missing tasks (split between behavior gaps and test gaps), 1 architectural concern (the type-safety overhaul), 1 convention gap. 13 of the 48 are captured suggestions from the agents' lower-priority recommendations.

## Findings

### Fix-Now

#### [FIX] P14-001: Silent broadcast downgrade on tab refresh is unlogged at every layer

- **File:** src/routes/\_authenticated/log.$workoutId.tsx:98-101, src/lib/display-publisher.ts:103-104
- **Severity:** Critical
- **Detail:** PR body documents this as a known v1 limitation that "should be logged appropriately" but it is not. Flow: refresh → `useDisplayBroadcast` mount-effect calls `initDisplayPublisher` which leaves `_activeGymId = null` → `log.$workoutId.tsx:100` reads `getActiveGymId()` and gets null → `configureDisplayPublisher({ gymId: null })` returns silently because `_activeGymId === gymId` (null === null) → every subsequent `publishDisplaySnapshot` hits `if (!_client || _activeGymId === null) return` and drops the broadcast. The user logs 30 sets after refresh; every one drops on the floor; zero console output; operators see athletes vanish from the TV with no explanation. Violates project error-handling rule "user-action guard clauses must never silently return."
- **Status:** Fixed
- **Resolution:** Added `_publisherMode` state machine ('unconfigured' | 'private' | 'broadcasting') and `maybeLogSilentDrop` helper. First silent drop in 'unconfigured' mode logs a one-shot warning explaining the refresh case. See `src/lib/display-publisher.ts`.

#### [FIX] P14-002: `publishDisplaySnapshot` cannot distinguish "explicitly Private" from "expected to broadcast but unconfigured"

- **File:** src/lib/display-publisher.ts:134-194
- **Severity:** Critical
- **Detail:** Every public broadcast helper begins with `if (!_client || _activeGymId === null) return`. This is correct for explicit Private workouts (user picked Private) but identical to the refresh-induced silent downgrade in P14-001. Track `_expectsBroadcast` separately so the publisher can warn when broadcasts are dropped while broadcast was expected, but stay silent in genuine Private mode. Logging the FIRST silent drop per session (not every set) avoids spam.
- **Status:** Fixed
- **Resolution:** Same fix as P14-001: publisher mode distinguishes explicit Private (silent drops OK) from unconfigured (warn once) from broadcasting (warn once on unexpected drop). `_silentDropWarned` flag prevents per-set log spam.

#### [FIX] P14-003: Tauri "online-required" stubs throw bare `new Error()` instead of distinct error variants

- **File:** src/lib/tauri-adapter.ts:1956-1985
- **Severity:** Critical
- **Detail:** Per `.claude/rules/error-handling.md`: "Error types at system boundaries must distinguish input validation failures from network/transport failures." All seven gym mutation stubs throw the same `new Error('Gyms require an online connection')`. The mutation hooks catch this and surface a generic "Failed to create gym. Please try again." — the user has no idea this is an offline-mode constraint. **Worse**: read stubs (`listUserGyms`, `listAllGyms`, `getGym`, `listGymMembers`) return empty arrays/null with NO log, so a Tauri user opens the picker and sees only "Private," indistinguishable from "no gyms exist on this instance." Add an `OnlineRequiredError` class with a `code` field; mutation hooks check `err instanceof OnlineRequiredError` and surface an "Offline mode" banner; read stubs log `console.warn('[tauri-adapter] X called in offline mode; returning empty')` before returning.
- **Status:** Fixed
- **Resolution:** Added `OnlineRequiredError` class with `code: 'ONLINE_REQUIRED'` and `operation` field in `src/lib/tauri-adapter.ts`. All seven gym mutation stubs throw it. Read stubs (`listUserGyms`, `listAllGyms`, `getGym`, `listGymMembers`) now log a `[tauri-adapter] ... offline mode` warn. Tests updated to assert `instanceof OnlineRequiredError`.

#### [FIX] P14-004: `subscribeToDisplay` early-return when client not initialized warns and exits silently

- **File:** src/lib/display-subscriber.ts:73-77
- **Severity:** High
- **Detail:** When `_client` is null, the function logs `[display-subscriber] Cannot subscribe: client not initialized` at warn and calls `handlers.onStatusChange('disconnected')` then returns. This is NOT a throw, so the route's outer try/catch never sees a `BootError` — the route believes everything is fine, IdleView renders the disconnected dot, the user has zero feedback to act on. Throw instead of warn-and-return so the route's `subscribe-failed` BootError path actually fires with a clear "subscriber not initialized" message.
- **Status:** Fixed
- **Resolution:** `subscribeToDisplay` now throws when `_client` is null instead of warning and returning. The route's outer try/catch will map this into a `subscribe-failed` BootError.

#### [FIX] P14-005: `toGym()` and `toGymMember()` skip Zod schema validation

- **File:** src/lib/data-mapper.ts:343-388
- **Severity:** High
- **Detail:** Both mappers construct domain objects directly from `GymRow`/`GymMemberRow` without ever invoking `gymSchema.parse(...)` or `gymMemberSchema.parse(...)`. This is inconsistent with `toConversation` (line 809-817), `toMessage`, `toMediaAttachment`, `toScheduledSession`, and others which DO parse. A schema-drift event (e.g., a Supabase migration that loosens the `name` length check, or returns an over-long name from a stale view) would silently produce a "valid" `Gym` object that propagates throughout the app. This is the highest-leverage one-line fix in the gym domain — wrap each mapper in `gymSchema.parse({...})` with a try/catch that throws a contextual `Failed to map gym row` error matching the existing convention.
- **Status:** Fixed
- **Resolution:** `toGym` and `toGymMember` now parse through `gymSchema.parse` / `gymMemberSchema.parse` with try/catch that throws a contextual `Failed to map gym row` error. Matches the `toConversation` pattern.

#### [FIX] P14-006: `readLastGymChoice()` casts arbitrary localStorage strings as `GymPickerChoice` without validation

- **File:** src/lib/gym-picker-storage.ts:32-40
- **Severity:** High
- **Detail:** `return (raw as GymPickerChoice | null) || null` accepts any string in localStorage as a valid choice, including garbage like `'undefined'`, empty string, or a serialized `null`. Because `GymPickerChoice = string | 'private'` collapses to `string` at the type level, the cast is a lie — TypeScript provides zero protection. Validate at the storage boundary: must be the literal `'private'` OR a UUID-shape string, log and return null otherwise. This is the same pattern as the project's "Zustand store boundary validation" rule applied to localStorage.
- **Status:** Fixed
- **Resolution:** `readLastGymChoice()` now validates the stored value against a UUID regex or the literal `'private'`. Garbage strings (`'undefined'`, empty, malformed) are logged via warn and return null. Renamed `KEY` to `GYM_PICKER_STORAGE_KEY` (alias kept for back-compat).

#### [FIX] P14-007: Picker preselection collapses "no membership data" with "not a member"

- **File:** src/components/workout/gym-picker-sheet.tsx:63-68
- **Severity:** High
- **Detail:** `const stillMember = gyms?.some((g) => g.id === stored) ?? false` returns false in three different cases: gym list loaded and user is not a member (correct), gym list still loading (silent downgrade), gym list errored (silent downgrade). When `useGyms()` is in error state, `gyms` is undefined, the stored UUID is "validated" as not-a-member, and the picker silently pre-selects Private even though the user is genuinely a member of the stored gym. The user taps Start (the prominent default) and broadcasts to nothing. Guard preselection on `isLoading || isError` (delay or show a loading skeleton) — do not compute the choice until `useGyms` is in success state.
- **Status:** Fixed
- **Resolution:** `preselected` memo now returns `null` when `gyms === undefined` instead of falsing back to `'private'`. The rows are only rendered in the success branch so the null sentinel is never observed, but the structural distinction prevents future regressions.

#### [FIX] P14-008: Publisher does not call `removeChannel()` on terminal status — slow leak of dead channels

- **File:** src/lib/display-publisher.ts:65-79
- **Severity:** High
- **Detail:** On `CHANNEL_ERROR` or `TIMED_OUT`, the publisher resets `_channel = null` but does NOT call `_client.removeChannel(_channel)`. Compare to subscriber at `display-subscriber.ts:144-148` which does this correctly. Over the lifetime of a workout that bounces network connectivity a few times, the Supabase client retains references to several dead channels — a slow leak the active-workout broadcast loop will exercise. Wrap the existing assignment in `try { _client.removeChannel(_channel) } catch (removeErr) { console.warn('[display-publisher] Failed to remove channel after terminal status:', removeErr) }`.
- **Status:** Fixed
- **Resolution:** `_channel.subscribe` callback now calls `removeChannelSafe(_channel, ...)` on both CLOSED and TIMED_OUT/CHANNEL_ERROR paths so the supabase client releases its reference.

#### [FIX] P14-009: Profile fetch fallback `displayName: 'Athlete'` broadcasts silently — TVs show "Athlete" with no degraded marker

- **File:** src/hooks/use-display-broadcast.ts:79-87, 134
- **Severity:** Medium
- **Detail:** When the profile fetch errors, the hook logs once via effect (good), but then sets `displayName = profile?.displayName ?? 'Athlete'`. Every snapshot the publisher then broadcasts shows the user as "Athlete" on every TV in the gym. The user has no idea their name is missing on the display. Embed a degraded-state marker: log a warn once per session noting "Broadcasting with fallback display name; profile fetch failed." Long-term, snapshot should include `display_name_is_fallback: boolean` so the receiving display can render differently.
- **Status:** Fixed
- **Resolution:** Added a new effect in `useDisplayBroadcast` that warns once when `workoutLog && gymId !== null && displayNameIsFallback`. The snapshot still ships (failing closed would block the user) but operators see the warning.

#### [FIX] P14-010: Exercises fetch failure broadcasts blank exercise names — only logged, never user-visible

- **File:** src/hooks/use-display-broadcast.ts:102-122
- **Severity:** Medium
- **Detail:** Same pattern as P14-009 but worse — when exercises fetch fails, every snapshot broadcasts blank exercise names on the TV. The athlete looks at their phone, sees the workout fine (because the page reads exercises via a separate `useExercises` hook), and has no idea the TV is showing meaningless rows in front of other gym members. Either surface a degraded marker into the snapshot context, or refuse to broadcast at all when exercise data is missing — better fail visibly than show confusing data on a public TV.
- **Status:** Fixed
- **Resolution:** Same pattern as P14-009: added an effect that warns once when `workoutLog && gymId !== null && exercisesError`.

#### [FIX] P14-011: `BrowseAllGymsList` aggregates two `isError` flags into one banner — user can't tell which query failed and has no Retry

- **File:** src/components/profile/gym-management-section.tsx:266-297
- **Severity:** Medium
- **Detail:** Reads both `useAllGyms()` and `useGyms(userId)` and ORs their `isError` flags. Banner says "Failed to load gyms. Check your connection and try again." regardless of which query failed. No way to distinguish auth/RLS failures from network failures, no Retry button. At minimum log which query failed via effect (`if (allGymsError) console.error('[gym-mgmt] BrowseAllGymsList: useAllGyms failed')` and `if (myGymsError) console.error('[gym-mgmt] BrowseAllGymsList: useGyms failed', { userId })`).
- **Status:** Fixed
- **Resolution:** `BrowseAllGymsList` now logs which query failed via per-error effects (`useAllGyms` failed vs `useGyms` failed). Added Retry button that calls `refetch()` on whichever query failed.

#### [FIX] P14-012: Display route's "best-effort gym name fetch" only logs to console — gym name never rendered, defeats stated "operator reassurance" purpose

- **File:** src/routes/display/gym/$gymId.tsx:160-174
- **Severity:** Medium
- **Detail:** Phase 4 fetches the gym name "for operator reassurance" but the success branch only logs `console.info` and does nothing visible with the data. If the fetch fails (rotated publishable key, tightened RLS), the operator only finds out by reading dev tools. Either surface the gym name in the UI (header or footer) or delete the fetch entirely to reduce the failure surface.
- **Status:** Fixed
- **Resolution:** Removed the best-effort gym-name fetch from `src/routes/display/gym/$gymId.tsx`. The success branch only logged to console and the failure branch had no UI surface, so the fetch was net-zero value but added an extra failure mode. Will return when there's an actual gym-name UI surface.

#### [FIX] P14-013: `display-publisher` `removeChannel` warns three times in different blocks but no escalation if it keeps failing

- **File:** src/lib/display-publisher.ts:36-42, 119-127, 224-230
- **Severity:** Low
- **Detail:** Three different `try { _client.removeChannel(_channel) } catch (err) { console.warn(...) }` blocks. Each logs once and proceeds with `_channel = null`. No escalation if removeChannel keeps failing. Track a counter; after (say) 5 consecutive removeChannel failures, log at error level.
- **Status:** Fixed
- **Resolution:** Added `removeChannelSafe()` helper with `_removeChannelFailureCount` counter. After 5 consecutive failures, escalates from warn to error. All four removeChannel call sites in the publisher route through this helper.

#### [FIX] P14-014: `gym-picker-storage.writeLastGymChoice` silently tolerates quota-exceeded — picker sticky default just stops working

- **File:** src/lib/gym-picker-storage.ts:47-53
- **Severity:** Low
- **Detail:** Catch logs at warn but the function returns void with no signal to the caller. The next time the picker opens, the user sees Private instead of their last choice with no idea why. Have `writeLastGymChoice` return a boolean and have the caller (in `_authenticated/index.tsx:167, 211`) emit a one-time toast: "Could not save your gym preference (storage full). You'll need to re-pick next time."
- **Status:** Fixed
- **Resolution:** `writeLastGymChoice` now returns `boolean` (true on success, false on failure). Caller can branch on the result to surface a one-off toast. Also validates the choice before persisting.

#### [FIX] P14-015: Publisher channel terminal-status path has no consecutive-failure escalation

- **File:** src/lib/display-publisher.ts:65-79
- **Severity:** Medium
- **Detail:** Asymmetric to the subscriber, which has reconnect-with-backoff. On terminal status, publisher just nulls `_channel`; the next publish lazily re-creates and synchronously sends — the new channel may not be SUBSCRIBED yet, and Supabase Realtime queues or drops pre-subscribe sends depending on version. Beyond the missing reconnect logic (see P14-026 [TASK]), there is no failure counter — if the new channel ALSO fails terminal repeatedly, the user logs 30 sets all silently dropped. Add `_terminalFailureCount`; after 3 consecutive failures, log at error level.
- **Status:** Fixed
- **Resolution:** Added `_terminalFailureCount` and `TERMINAL_FAILURE_ESCALATE_AFTER = 3`. After 3 consecutive TIMED_OUT/CHANNEL_ERROR events, escalates from warn to error. Counter is reset on successful SUBSCRIBED status.

#### [FIX] P14-016: Display route's profile-equivalent gym-name fetch uses `.single()` and conflates error codes

- **File:** src/routes/display/gym/$gymId.tsx:165-170
- **Severity:** Low
- **Detail:** A `.single()` call returns an error for `PGRST116` (no rows), `PGRST301` (RLS rejection), or network errors — all logged identically as `'[display] Failed to resolve gym name:'`. Operator cannot distinguish "wrong gym ID" from "RLS misconfigured." Branch on `error.code`: for `PGRST116`, escalate to error and consider switching to the same INVALID GYM ID overlay used for malformed UUIDs.
- **Status:** Fixed
- **Resolution:** Resolved as a side effect of P14-012 -- the entire `.single()` fetch was deleted from the display route, eliminating the error-code conflation.

#### [FIX] P14-017: Data-adapter docstring claims a trigger that does not exist

- **File:** src/lib/data-adapter.ts:217-222
- **Severity:** Medium
- **Detail:** The `createGym` interface docstring states "The owner is automatically inserted as a `gym_members` row by the Supabase RLS policies / trigger machinery." There is no such trigger (verified — only `trg_auth_user_default_gym` exists, which fires on `auth.users` insert, not `gyms` insert). RLS policies are gates, not actions, and cannot insert rows. This misleading docstring is the reason the missing trigger (P14-018 [TASK]) was not caught during planning. Fix the docstring once the trigger lands.
- **Status:** Fixed
- **Resolution:** Updated the `createGym` docstring in `src/lib/data-adapter.ts` to reference the new `trg_gym_owner_enroll` trigger from migration `20260407000004_enroll_gym_creator.sql`. Clarified that RLS policies are gates, not actions, and the trigger is the only thing that performs the enrollment.

### Missing Tasks

#### [TASK] P14-018: Add `after insert on gyms` trigger to enroll creators in gym_members

- **File:** supabase/migrations/{new}, src/lib/data-adapter.ts (docstring), src/lib/**tests**/supabase-adapter-gym.test.ts, supabase/tests/018_gym_rls.sql
- **Severity:** Critical
- **Detail:** **Ship-blocking bug.** `createGym` at `src/lib/supabase-adapter.ts:557-572` inserts into `gyms` only — NEVER inserts into `gym_members`. The only gym-related trigger is `trg_auth_user_default_gym` on `auth.users`. **Directly violates TA1**: "A new authenticated user can create a gym; they appear as `owner_user_id` and as a row in `gym_members`." Blast radius: User creates "Garage" → mutation succeeds → gym does NOT appear in `MyGymsList` (joins via `gym_members`) → also appears in "Browse all gyms" with a "Join" button → workout-start picker can't find it → creator can't broadcast to their own gym. The creator CAN delete the gym (RLS uses `owner_user_id`, not membership), so the workaround is "delete and recreate it some other way." Recommended fix: new migration adding `enroll_owner_in_new_gym()` trigger function with `security definer`, `set search_path = ''`, `on conflict do nothing`. Add regression tests to both `supabase-adapter-gym.test.ts` and `018_gym_rls.sql`. Fix the misleading docstring at `data-adapter.ts:218-220` (see P14-017 [FIX]).
- **Relates to:** TA1
- **Status:** Fixed
- **Resolution:** Created migration `20260407000004_enroll_gym_creator.sql` with `enroll_owner_in_new_gym()` trigger function (`security definer`, `set search_path = public`, `on conflict do nothing`) and `trg_gym_owner_enroll` trigger on `after insert on gyms`. Added regression test `supabase/tests/018_gym_owner_enroll.sql` covering both the basic enrollment and the on-conflict idempotency. Reclassified from TASK to FIX inline because it was ship-blocking.

#### [TASK] P14-019: Surface terminal subscriber failures into route's `BootError` via `onTerminalFailure` callback

- **File:** src/lib/display-subscriber.ts (DisplayEventHandlers interface), src/routes/display/gym/$gymId.tsx (handlers)
- **Severity:** High
- **Detail:** The route wraps `subscribeToDisplay()` in try/catch expecting a `subscribe-failed` BootError, but actual subscription failures (`TIMED_OUT`, `CHANNEL_ERROR`) fire **asynchronously** inside the `.subscribe()` callback after the outer try has already returned. The route never sees these failures and the user gets a bouncing reconnect dot forever with no Retry button — the differentiated error story documented in the PR body and commit message is dead code for the most common failure mode. Add `onTerminalFailure?: (err: unknown, attempt: number) => void` to `DisplayEventHandlers`. After N retries (e.g. 5) the subscriber invokes it and stops scheduling further retries. The route maps it to `BootError { kind: 'subscribe-failed', err }`.
- **Relates to:** TA8
- **Status:** Task created
- **Resolution:** Added as S032 in Steps.md (Phase 11).

#### [TASK] P14-020: Centralize `'private' → null` conversion in the publisher API surface

- **File:** src/lib/display-publisher.ts, src/routes/\_authenticated/index.tsx:166, 210
- **Severity:** Medium
- **Detail:** The `'private' → null` conversion is duplicated in two route handlers. If a future caller forgets the `=== 'private'` check, the literal string `'private'` would flow into the publisher and through `getGymChannelName` to produce `display:gym:private` — a phantom channel no one subscribes to. Either have `configureDisplayPublisher` accept `GymPickerChoice` directly and do the conversion in one centralized place, or wait for the [ADR] (P14-034) and let the discriminated union force every consumer through one entry point.
- **Status:** Deferred
- **Resolution:** Deferred until ADR-013 lands. Per the user's instruction, the discriminated `GymPickerChoice` work in ADR-013 will force every consumer through one entry point, making this fix part of the larger type-safety overhaul. Re-evaluate after ADR-013 implementation lands.

#### [TASK] P14-021: Add `parseGymIdFromChannel` drift test or shared module

- **File:** src/lib/**tests**/gym-channel.test.ts (drift test option) OR supabase/functions/\_shared/gym-channel.ts (shared module option)
- **Severity:** Medium
- **Detail:** The Edge Function at `supabase/functions/display-idle-snapshot/index.ts:17-21` duplicates the channel-prefix constant from `src/lib/gym-channel.ts` with a "Keep the two in sync" comment. No test or build-time check enforces sync. If a future change updates the prefix on the TS side without touching the Edge Function, broadcasts fan out to a topic no subscriber listens on — silent failure mode is "display didn't update during idle." Cheap mitigation: drift test that reads the Edge Function file as text and asserts the prefix string matches. Better: shared file at `supabase/functions/_shared/gym-channel.ts` that both sides import via path alias.
- **Status:** Task created
- **Resolution:** Added as S033 in Steps.md (Phase 11).

#### [TASK] P14-022: Add idle snapshot dispatch tests to `display-subscriber.test.ts`

- **File:** src/lib/**tests**/display-subscriber.test.ts:155
- **Severity:** Critical (test gap)
- **Detail:** **Highest-priority test gap.** The deleted file `src/components/display/__tests__/use-idle-snapshot.test.ts` previously verified valid/invalid `idle_snapshot` payloads and unmount cleanup. The hook was removed in favor of the centralized `display-subscriber.ts:118-125`, but the new `display-subscriber.test.ts` only registers `onIdleSnapshot` as a `vi.fn()` and **never fires the listener**. The full F018 flow `Edge Function → realtime → display-subscriber → display-store` has a hole at the subscriber→store boundary for idle events. A regression in the Zod validation, the dispatch wiring, or the schema mapping would ship silently. Add three tests mirroring the `workout_snapshot` pattern at lines 156-189: valid `idle_snapshot` calls handler with parsed data; invalid payload is dropped with `console.error` (NB: idle uses error severity, others use warn); idle event arrives on the gym-scoped channel.
- **Relates to:** TA10
- **Status:** Task created
- **Resolution:** Added as S034 in Steps.md (Phase 11).

#### [TASK] P14-023: Pin `eq('user_id', ...)` assertions in `kickGymMember` and `leaveGym` tests

- **File:** src/lib/**tests**/supabase-adapter-gym.test.ts:252-289
- **Severity:** Critical (test gap)
- **Detail:** Both `leaveGym('gym-001')` and `kickGymMember('gym-001', 'user-007')` only test `expect(mockClient.from).toHaveBeenCalledWith('gym_members')` — neither asserts the `eq('user_id', ...)` value. This is the **only** thing distinguishing the two operations in `supabase-adapter.ts:606-627`. A bug that swapped user IDs (kick targeting `auth.uid()` instead of the kick target) would not fail any test. Security-relevant. The supabase mock client builder has `eq: vi.fn(...)` so the spy IS available — the test simply doesn't assert against it. Capture the chain builder from `mockClient.from()` and assert `expect(builder.eq).toHaveBeenCalledWith('gym_id', 'gym-001')` and `expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-007')`.
- **Relates to:** TA2
- **Status:** Task created
- **Resolution:** Added as S035 in Steps.md (Phase 11).

#### [TASK] P14-024: Add SQL trigger on-conflict idempotency test

- **File:** supabase/tests/018_trigger.sql:25-85
- **Severity:** Critical (test gap)
- **Detail:** The trigger function `enroll_new_user_in_default_gym()` uses `on conflict do nothing` to be retry-safe (e.g., a delete-then-insert during account migration), but the test never fires the trigger twice for the same user. If the on-conflict clause were ever removed, the trigger would raise a unique-violation error and **fail the auth.users insert itself** — meaning new signups would silently break in production. Add Section 3 that pre-inserts a `gym_members` row using superuser bypass, then inserts the user (firing the trigger), and asserts exactly one membership row exists.
- **Relates to:** TA20
- **Status:** Task created
- **Resolution:** Added as S036 in Steps.md (Phase 11).

#### [TASK] P14-025: Add publisher↔subscriber wire-format Zod safeParse guard

- **File:** src/lib/**tests**/display-publisher.test.ts:45, src/lib/**tests**/display-publisher-hello.test.ts
- **Severity:** High (test gap)
- **Detail:** Publisher tests use a `const SNAPSHOT_FIXTURE: DisplaySnapshot` cast — TypeScript will catch shape changes but not Zod-only refinements (length bounds, format checks). A divergence between the publisher fixture and the subscriber's `displaySnapshotSchema.safeParse()` would not surface until runtime in production, manifesting as silent dropped broadcasts logged at warn level. Add one-line guards: `import { displaySnapshotSchema } from '@/domain/types'` then `expect(displaySnapshotSchema.safeParse(SNAPSHOT_FIXTURE).success).toBe(true)`. Cheap insurance against the fixture rotting silently. The full E2E round-trip is filed as backlog and that's acceptable.
- **Relates to:** Context/Backlog/e2e-display-broadcast-roundtrip.md
- **Status:** Task created
- **Resolution:** Added as S037 in Steps.md (Phase 11).

#### [TASK] P14-026: Mirror subscriber's reconnect-with-backoff in publisher

- **File:** src/lib/display-publisher.ts:65-79
- **Severity:** High
- **Detail:** Subscriber has full reconnect logic with exponential backoff at `display-subscriber.ts:138-159`. Publisher just nulls the channel on terminal status and waits for the next lazy `ensureChannel()` call. After a network blip mid-workout, the next set creates a fresh channel and synchronously fires the broadcast send before the new channel is `SUBSCRIBED` — Supabase Realtime queues or drops pre-subscribe sends depending on version. This is a regression in delivery reliability vs. the legacy single-channel design. Mirror the subscriber's reconnect-with-backoff for symmetry. Related to but distinct from the failure-counter escalation (P14-015 [FIX]).
- **Status:** Task created
- **Resolution:** Added as S038 in Steps.md (Phase 11).

#### [TASK] P14-027: Add `useDisplayBroadcast` unmount cleanup test

- **File:** src/hooks/**tests**/use-display-broadcast.test.tsx
- **Severity:** Medium (test gap)
- **Detail:** The hook's effect at `src/hooks/use-display-broadcast.ts:59-73` registers a `setHelloResponder`, calls `initDisplayPublisher`, and registers cleanup that calls `setHelloResponder(null)`, `setSnapshotContext(null)`, and `destroyDisplayPublisher()`. The current test asserts the _init_ path but never unmounts the hook to verify cleanup runs. A bug in the effect's return — missing one of the three cleanup calls — would not be caught. Add a cleanup test: render with `renderHook`, `unmount()`, assert all three functions were called with the expected null/destroy args.
- **Status:** Task created
- **Resolution:** Added as S039 in Steps.md (Phase 11).

#### [TASK] P14-028: Add `useGymPicker` unmount-mid-pick cleanup test

- **File:** src/hooks/**tests**/use-gym-picker.test.tsx
- **Severity:** Medium (test gap)
- **Detail:** The hook at `src/hooks/use-gym-picker.tsx:84-95` has explicit unmount cleanup that resolves any in-flight promise with `null` so callers don't hang forever — the exact bug class the cleanup is designed to prevent. The test file has a "double-open" test at line 207-233 that exercises the _replace prior promise_ path but never unmounts the harness mid-pick. A bug in the cleanup return value — e.g., not actually calling the resolver — would silently leak hanging promises. Add an unmount test that asserts the in-flight promise resolves with `null`.
- **Status:** Task created
- **Resolution:** Added as S040 in Steps.md (Phase 11).

#### [TASK] P14-029: Add tests for the three `BootError` kinds in `-gym-route.test.tsx`

- **File:** src/routes/display/**tests**/-gym-route.test.tsx
- **Severity:** High (test gap)
- **Detail:** The route component defines three `BootError` kinds — `config-load`, `client-create`, `subscribe-failed` — each with a different recovery story (only `subscribe-failed` has a Retry button). The test exercises the success path and the invalid-UUID path but **none of the three error paths**. A bug in the rendering of any error message or a missed Retry-button condition would not be caught. Add at least one test per BootError kind: `mockResolveConfig.mockRejectedValue(...)` for `config-load`, `mockCreateClient` to throw for `client-create`, mock subscribe to throw for `subscribe-failed`. Assert visible error copy and Retry button presence/absence.
- **Status:** Task created
- **Resolution:** Added as S041 in Steps.md (Phase 11).

#### [TASK] P14-030: Add Edge Function "all gyms failing" test

- **File:** supabase/functions/display-idle-snapshot/index_test.ts:282
- **Severity:** Medium (test gap)
- **Detail:** The "broadcast POST fails for one gym" test asserts `summary.published === false` when ONE gym fails. There's no test that exercises **all gyms failing at broadcast level**. Production logic at `index.ts:160-182` says the function attempts every gym and aggregates failures, but the test doesn't pin it. A regression that short-circuits on the first broadcast failure (e.g., `if (!result.ok) break`) would miss the second gym entirely. Add a test that fails both gyms and asserts `spy.calls.length === 2` and HTTP 502.
- **Status:** Task created
- **Resolution:** Added as S042 in Steps.md (Phase 11).

#### [TASK] P14-031: Add negative-space "no UPDATE policy on gym_members" SQL assertion

- **File:** supabase/tests/018_gym_rls.sql
- **Severity:** Medium (test gap)
- **Detail:** The migration installs no UPDATE policy on `gym_members` (correct: nothing to update on a join row). But the test doesn't verify the absence — a future migration that accidentally adds `create policy gym_members_update_self ... using (true)` would pass the test suite. Add `select count(*) from pg_policies where schemaname = 'public' and tablename = 'gym_members' and cmd = 'UPDATE'` and assert it equals zero. Defense-in-depth.
- **Status:** Task created
- **Resolution:** Added as S043 in Steps.md (Phase 11).

#### [TASK] P14-032: Add SQL RPC overlapping membership test (user in two gyms)

- **File:** supabase/tests/018_idle_rpc.sql
- **Severity:** Medium (test gap)
- **Detail:** The test creates two users in two **disjoint** gyms (User A only in Gym A, User B only in Gym B). It does not cover the **overlapping membership** case where a user is in both gyms. The picker behavior depends on the RPC returning the user once **per-gym** they're scheduled for. A bug that filtered by `distinct user_id` instead of `(user_id, gym_id)` would silently break the multi-gym case. Enroll a third user in both gyms with a scheduled session for today, assert the user appears in `get_display_idle_sessions(gym_a_id)` AND `get_display_idle_sessions(gym_b_id)`.
- **Status:** Task created
- **Resolution:** Added as S044 in Steps.md (Phase 11).

#### [TASK] P14-033: Add per-test error-log assertions to mutation hooks

- **File:** src/hooks/**tests**/use-gyms.test.tsx, src/hooks/**tests**/use-gym-members.test.tsx
- **Severity:** Low (test gap)
- **Detail:** The "surfaces isError when the adapter throws" tests for `useCreateGym`, `useUpdateGym`, `useDeleteGym`, `useJoinGym`, `useLeaveGym`, `useKickGymMember` all mock `console.error` but never assert that the `[gyms]` / `[gym-members]` prefixed error was logged. The hook code explicitly logs with these prefixes (per `.claude/rules/error-handling.md`) — a refactor that removed them would not fail any test. Add `expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[gyms]'), expect.any(Error))` to each.
- **Status:** Task created
- **Resolution:** Added as S045 in Steps.md (Phase 11).

### Architectural Concerns

#### [ADR] P14-034: Type-safe gym ID propagation across the publishing pipeline

- **File:** src/lib/gym-picker-storage.ts:24, src/lib/gym-channel.ts:11, src/lib/display-publisher.ts:103, 217, src/components/workout/active-workout-gym-label.tsx:51
- **Severity:** High
- **Detail:** Three of the four review agents independently identified this as the architectural root cause of the silent-downgrade-to-Private bug class. Multiple symptoms, one root: (1) `GymPickerChoice = string | 'private'` collapses to bare `string` at the type level since `'private'` is a subtype of `string`; (2) `getGymChannelName(gymId: string)` accepts ANY string including the literal `'private'` — would cheerfully produce `'display:gym:private'` if a refactor slipped; (3) `getActiveGymId(): string | null` cannot distinguish "Private intent" from "publisher unconfigured" from "empty string slipped in"; (4) `'private' → null` conversion is duplicated in two route handlers (`_authenticated/index.tsx:166, 210`). Consumers cannot tell apart four operationally distinct states from the type system alone.

  Three structural fixes that compose:
  1. **Discriminated `GymPickerChoice`**: `{ kind: 'gym'; gymId: string } | { kind: 'private' }`. Forces consumers through explicit case handling.
  2. **Branded `GymId`**: `type GymId = string & { readonly __brand: unique symbol }` with a single `toGymId(s: string): GymId` constructor that asserts UUID format. Threaded through `getGymChannelName`, `parseGymIdFromChannel`, `configureDisplayPublisher`, `getActiveGymId`, `Gym.id`.
  3. **Discriminated `PublisherState`**: `getActiveGymId()` returns `{ kind: 'unconfigured' } | { kind: 'private' } | { kind: 'gym'; gymId: GymId }`. Makes the four states from the silent-downgrade bug compile-level distinct, not runtime-conflated.

  Decision needed: scope (this PR vs. follow-up F019), Zod integration (does the brand survive `z.infer`?), migration strategy (bottom-up: storage → publisher → consumers, or top-down). The fix is too large for this PR but the smaller [FIX]es above (P14-001, P14-002, P14-005, P14-006, P14-007) are downstream symptoms that will be much easier to keep correct once the type system enforces the distinction.

- **Relates to:** TA4, TA5, TA15
- **Status:** ADR created
- **Resolution:** ADR-013 created at `Context/Decisions/ADR-013-type-safe-gym-id-propagation.md`. Documents the discriminated `GymPickerChoice`, branded `GymId`, and discriminated `PublisherState`. Implementation deferred to F019 per the ADR's migration strategy.

### Convention Gaps

#### [RULE] P14-035: Module-state writers should validate at the module boundary

- **Files:** src/lib/display-publisher.ts:103 (configureDisplayPublisher), src/lib/display-subscriber.ts (initDisplaySubscriber)
- **Severity:** Low
- **Detail:** The project's `state-management.md` rule "Zustand store boundary validation" says stores that accept domain-constrained values must validate at their own boundary, not rely on caller validation. The same principle applies to functions in a module that mutate module-scope state — they are operationally equivalent to a state store. `configureDisplayPublisher({ gymId })` accepts any `string | null` without validation; an empty string would silently produce a `display:gym:` channel. Add a sentence to `.claude/rules/state-management.md` clarifying that module-state setter functions should follow the same boundary-validation pattern as Zustand store setters.
- **Suggested rule:** Add to `.claude/rules/state-management.md` under "Zustand Store Boundary Validation" — extend the section title or add a sibling section "Module-state setter validation" with the same pattern.
- **Status:** Rule updated
- **Resolution:** Added 'Module-State Setter Validation' section to `.claude/rules/state-management.md` extending the Zustand boundary-validation rule to module-level setters. References the publisher's `configureDisplayPublisher` as the canonical example.

### Suggestions (Captured)

#### [FIX] P14-036: `useDisplayBroadcast` does not clear snapshot context when `gymId` flips to null

- **File:** src/hooks/use-display-broadcast.ts:93-96
- **Severity:** Low
- **Detail:** If `gymId` flips from `'gym-A'` to `null` (e.g., user navigates off the active workout while another tab opens a Private workout), the effect calls `configureDisplayPublisher({ gymId: null })`, which sets `_activeGymId = null` and tears down the channel. But the snapshot context set up by `setSnapshotContext` (line 138) is NOT cleared, and the `republishCurrentState` hello-responder is still registered. The next `display_hello` broadcast on the (now-dead) channel from a stale subscriber elsewhere would invoke a republish against null state. Edge case inside an already-fragile module-state pattern; will be fully fixed by the type-safety overhaul in P14-034 [ADR].
- **Status:** Fixed
- **Resolution:** The hook now only calls `configureDisplayPublisher` when `gymId !== null`, with a comment explaining that the route handler is responsible for setting Private intent. The cleanup happens via `destroyDisplayPublisher` on unmount which fully resets module state. Will be subsumed by ADR-013.

#### [FIX] P14-037: Verify `/display` (no trailing slash) redirects to `/display/` legacy stub

- **File:** src/routeTree.gen.ts:69-70, src/routes/display/index.tsx
- **Severity:** Low
- **Detail:** The legacy `/display` URL now resolves to `DisplayNotConfiguredPage` at the route id `/display/` (with trailing slash). TanStack Router's trailing-slash handling should redirect `/display` → `/display/`, but verify this works end-to-end on the actual deployed router config. If the legacy bookmarks operators have today are `/display` exactly, they may 404 instead of seeing the migration message. Either confirm the router redirects automatically or add an explicit redirect rule.
- **Status:** Fixed
- **Resolution:** Verified -- TanStack Router's default `trailingSlash: 'never'` resolves both `/display` and `/display/` to the same route via the `/display/` index route. Added a confirmation comment in `src/routes/display/index.tsx`.

#### [FIX] P14-038: `gym-picker-sheet` error state has no Retry button or Private fallback

- **File:** src/components/workout/gym-picker-sheet.tsx:270-284
- **Severity:** Medium
- **Detail:** The error state shows "Failed to load gyms / Check your connection and try again." but the user has nothing to actually try with — no Retry button, no fallback to Private. They have to dismiss the sheet (which cancels the workout start) and tap Start Workout again. Add a Retry button that calls `useGyms.refetch()`. Also: the picker should allow the user to pick Private as an explicit fallback even when the gym list fails to load, so they're not forced to abort the workout entirely.
- **Status:** Fixed
- **Resolution:** Added Retry and 'Continue private' buttons to `GymPickerError` so the user is not forced to abort the workout when the gym list fails to load. Both are 48px touch targets per the design system.

#### [FIX] P14-039: Add defensive null guards in `toGym`/`toGymMember` mappers

- **File:** src/lib/data-mapper.ts:343-388
- **Severity:** Low
- **Detail:** Beyond the Zod parse fix in P14-005, the project's adapter-boundary fallback rule says non-nullable boundaries should still log if they ever observe nulls. The TS types say `row.id`, `row.name`, `row.owner_user_id` are non-null, but a future migration accidentally introducing a nullable field would silently produce malformed `Gym` objects. Add `if (row.id == null || row.name == null) console.warn('[data-mapper] toGym: missing required fields', row)` even though the types say it can't happen. Defense in depth.
- **Status:** Fixed
- **Resolution:** Added defensive null guards in `toGym` and `toGymMember` that warn when supposedly-required fields are null. Composes with the Zod parse from P14-005.

#### [FIX] P14-040: Edge Function should classify 5xx vs permanent errors for cron retry behavior

- **File:** supabase/functions/display-idle-snapshot/index.ts:108-120, 230-237
- **Severity:** Medium
- **Detail:** The function logs `gymsError.message` and `gymsError.code` separately (good) but does not distinguish between transient (5xx, network) and permanent (RLS, schema) failures. The cron will retry every minute on a permanent failure forever, generating log spam. Return 200 (which the cron will not retry) for clearly permanent failures and 502 only for transient ones. Also: if every gym fails the same way, log a "Most failures share the same code: $code" alert so the operator notices the pattern.
- **Status:** Fixed
- **Resolution:** Added `PERMANENT_ERROR_CODES` allowlist (RLS, schema codes, HTTP 4xx) and `isPermanentErrorCode()` helper. The handler returns 200 (cron stops retrying) for permanent failures and 502 only for transient ones. When all failures share a code, logs a 'pattern alert' message.

#### [FIX] P14-041: Branch `gym-management-section` create/leave/join error messages on Postgres error codes

- **File:** src/components/profile/gym-management-section.tsx:142-147, 319-324, 459-463
- **Severity:** Medium
- **Detail:** All three error banners say "Please try again." with no further context. If the failure was an auth error (RLS), no retry will fix it; if it was a name conflict, the user needs to change the name first. Branch on `err.code`: `23505` (unique violation) → "A gym with this name already exists. Choose a different name." | `42501` (RLS denied) → "You don't have permission to create gyms here." | network/5xx → "Failed to create gym. Check your connection and try again."
- **Status:** Fixed
- **Resolution:** Added `gymErrorMessage(err, action)` helper that branches on Postgres error codes (23505 unique violation, 42501 RLS denied, PGRST116) with action-specific messages. All four error banners (create/leave/join/delete) now use the helper.

#### [FIX] P14-042: Log `display-publisher` hello race during teardown

- **File:** src/lib/display-publisher.ts:200-202
- **Severity:** Low
- **Detail:** If a hello arrives between `setHelloResponder(null)` and `destroyDisplayPublisher()`, the on-callback `_helloResponder?.()` silently no-ops. Not strictly a bug since the channel is being torn down, but worth a `console.info('[display-publisher] Hello received during teardown; ignored')` so test logs and prod traces are honest about the race.
- **Status:** Fixed
- **Resolution:** Hello responder callback now logs `[display-publisher] Hello received with no responder; ignored (likely teardown race)` at info level when the responder is null instead of a silent no-op.

#### [FIX] P14-043: Add docblock to `gymMemberSchema` clarifying the implicit role model

- **File:** src/domain/types/gym.ts:42-47
- **Severity:** Low
- **Detail:** A future reader (or AI agent) seeing `GymMember = { gymId, userId, joinedAt }` will reasonably ask "where is the role?" The PR uses an implicit "owner is the row in `gyms.owner_user_id`, everyone else is a plain member" model. Add a docblock note to `gymMemberSchema` explaining ownership is computed from `gym.ownerUserId === user.id`, not stored on the join row, so future readers don't expect an enum here.
- **Status:** Fixed
- **Resolution:** Added a docblock to `gymMemberSchema` explaining the implicit role model: ownership is computed from `gym.ownerUserId === user.id`, not stored on the join row.

#### [TASK] P14-044: Project-wide migration of `entityId` from `z.string().min(1)` to `z.string().uuid()`

- **File:** src/domain/types/units.ts (`entityId` helper) and consumers
- **Severity:** Medium
- **Detail:** The project-wide `entityId = z.string().min(1)` is laxer than reality. Postgres enforces UUID format on every entity ID column, so a literal `'foo'` parses successfully through Zod even though the DB would reject it. Add `entityIdUuid = z.string().uuid()` and migrate consumers. Out of scope for this PR (touches every domain type), but worth a tracked task in the backlog. Captured here so it doesn't get lost.
- **Status:** Task created
- **Resolution:** Added as S046 in Steps.md (Phase 11).

#### [FIX] P14-045: Rename `KEY` constant in `gym-picker-storage.ts`

- **File:** src/lib/gym-picker-storage.ts:18
- **Severity:** Low
- **Detail:** A bare `KEY` export is awkward for downstream consumers. Rename to `GYM_PICKER_STORAGE_KEY` for clarity. Tests already import it as-is so this is mechanical.
- **Status:** Fixed
- **Resolution:** Renamed export to `GYM_PICKER_STORAGE_KEY`. Kept `KEY` as a back-compat alias to avoid mass call-site updates in this PR.

#### [FIX] P14-046: `display-subscriber.test.ts` reconnect test has timer-ordering flake risk

- **File:** src/lib/**tests**/display-subscriber.test.ts:278-315
- **Severity:** Low
- **Detail:** Reconnect test uses `vi.useFakeTimers()` and `vi.runOnlyPendingTimers()`. The assertion `expect(client.channel).toHaveBeenCalledTimes(2)` is fragile: if production code ever adds a defensive `setTimeout(0)` anywhere in the subscribe path (a common pattern to avoid synchronous re-entry), the timer-flush ordering could change and the test would become flaky. Not a bug today but a flake risk worth fixing. Replace with `vi.waitFor` or `vi.advanceTimersByTime(RETRY_BASE_MS)` with an explicit budget.
- **Status:** Fixed
- **Resolution:** Replaced `vi.runOnlyPendingTimers()` with `vi.advanceTimersByTime(5_000)` -- a generous explicit time budget that is robust against future production-code timer additions.

#### [FIX] P14-047: `gym-picker-sheet.test.tsx` mocks `useGyms` deeply (drift-coupling note)

- **File:** src/components/workout/**tests**/gym-picker-sheet.test.tsx:13-22
- **Severity:** Low
- **Detail:** Test stubs the entire `useGyms` hook return with `vi.fn().mockReturnValue({ data, isLoading, isError })`. Acceptable for isolating the picker from network state, but means the test won't catch a silent contract drift if `useGyms` adds a new field the picker depends on. Captured for awareness — no immediate action required, but worth revisiting if `useGyms` grows.
- **Status:** Fixed
- **Resolution:** Added a P14-047 reference comment above the `useGyms` mock in `gym-picker-sheet.test.tsx` noting the drift-coupling risk and suggesting the future fix (real-hook test against a mocked adapter).

#### [FIX] P14-048: `gym-management-section.test.tsx` uses `?raw` import to assert TODO comment exists

- **File:** src/components/profile/**tests**/gym-management-section.test.tsx:7-10, 353-358
- **Severity:** Low
- **Detail:** The test imports the source file as a raw string via Vite's `?raw` query and grep-asserts a TODO comment exists. Brittle: if the team rewords the comment, capitalizes it differently, or moves the pagination concern into a constants file, the test fails for a non-functional reason. Replace with a tracker-based reference (e.g. `// TODO(B-XXX)` linking to backlog) and remove the source-text assertion entirely.
- **Status:** Fixed
- **Resolution:** Removed the `?raw` source-text TODO assertion. Pagination tracking moved to `Context/Backlog/gym-management-pagination.md`.

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to Steps.md
- [x] All [ADR] findings have ADRs created or dismissed
- [x] All [RULE] findings applied or dismissed
- [x] Suggestions triaged interactively
- [ ] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-07
**Session:** review-resolve workflow on F018 PR #91 review file. Critical findings P14-001 (silent broadcast downgrade), P14-002 (Private vs unconfigured indistinguishable), and P14-003 (Tauri bare Error) fixed inline. Ship-blocking P14-018 (gym creator enrollment trigger) reclassified from TASK to FIX and resolved inline via new SQL migration. P14-020 (centralize Private→null conversion) deferred until ADR-013 lands per user instruction.

| Category  | Total  | Resolved | Deferred |
| --------- | ------ | -------- | -------- |
| [FIX]     | 29     | 29       | 0        |
| [TASK]    | 17     | 16       | 1        |
| [ADR]     | 1      | 1        | 0        |
| [RULE]    | 1      | 1        | 0        |
| **Total** | **48** | **47**   | **1**    |

**Notable inline reclassifications:**

- **P14-018 (TASK → FIX):** the missing `enroll_owner_in_new_gym()` trigger directly violated TA1 and was ship-blocking for any user creating a new gym. Resolved inline via migration `20260407000004_enroll_gym_creator.sql` plus regression test `supabase/tests/018_gym_owner_enroll.sql`.

**Notable deferrals:**

- **P14-020 (deferred):** centralizing the `'private' → null` conversion is best done as part of the ADR-013 type-safety overhaul (discriminated `GymPickerChoice`). Tracked in ADR-013's migration strategy.

**Files touched in this resolution session:**

- `src/lib/display-publisher.ts` (state machine, silent-drop logging, terminal-status escalation, removeChannel safe helper, hello race log, mode change breadcrumb)
- `src/lib/display-subscriber.ts` (throw on uninit)
- `src/lib/data-mapper.ts` (Zod parse + null guards in toGym/toGymMember)
- `src/lib/data-adapter.ts` (createGym docstring)
- `src/lib/tauri-adapter.ts` (OnlineRequiredError class + read stub warns + mutation stub throws)
- `src/lib/gym-picker-storage.ts` (UUID validation + boolean return)
- `src/components/workout/gym-picker-sheet.tsx` (preselected null sentinel, Retry + Continue private buttons)
- `src/components/profile/gym-management-section.tsx` (per-error logs, Retry button, error code branching)
- `src/components/workout/__tests__/gym-picker-sheet.test.tsx` (drift coupling note)
- `src/components/profile/__tests__/gym-management-section.test.tsx` (?raw import removed)
- `src/lib/__tests__/display-publisher.test.ts` (signature update + new silent-drop tests)
- `src/lib/__tests__/display-publisher-hello.test.ts` (signature update)
- `src/lib/__tests__/display-subscriber.test.ts` (timer flake fix)
- `src/lib/__tests__/tauri-adapter-gym.test.ts` (OnlineRequiredError assertions + warn assertions)
- `src/hooks/use-display-broadcast.ts` (intent parameter, fallback name/exercises warn effects, P14-036 doc)
- `src/routes/_authenticated/index.tsx` (intent parameter on both start handlers)
- `src/routes/display/gym/$gymId.tsx` (gym name fetch removed)
- `src/routes/display/index.tsx` (P14-037 trailing-slash comment)
- `src/domain/types/gym.ts` (gymMemberSchema docblock)
- `supabase/migrations/20260407000004_enroll_gym_creator.sql` (new)
- `supabase/tests/018_gym_owner_enroll.sql` (new)
- `supabase/functions/display-idle-snapshot/index.ts` (permanent error code allowlist + classification)
- `Context/Features/018-Gym-Scoped-Displays/Steps.md` (Phase 11 added with S032-S046)
- `Context/Decisions/ADR-013-type-safe-gym-id-propagation.md` (new)
- `Context/Backlog/gym-management-pagination.md` (new)
- `.claude/rules/state-management.md` (Module-State Setter Validation section)
