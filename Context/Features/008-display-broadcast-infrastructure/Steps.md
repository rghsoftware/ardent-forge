# Steps: Display Broadcast Infrastructure (Step 27)

**Feature:** 008-display-broadcast-infrastructure
**Status:** Complete
**Created:** 2026-04-03

---

## Team Composition

| Role | Agent | Scope |
|------|-------|-------|
| `backend-specialist` | backend-specialist | Migrations (Postgres + SQLite), Rust model/command changes, data mapper |
| `frontend-specialist` | frontend-specialist | Zod schema, snapshot builder, publisher module, hook, Settings UI, Push to Display button |
| `quality-engineer` | quality-engineer | Unit tests for schema, builder, and publisher; integration validation |

---

## Wave 1: Domain + Database (backend-specialist + frontend-specialist, parallel)

### S001: DisplaySnapshot Zod schema and types

**Agent:** frontend-specialist
**Files:** `src/domain/types/display-snapshot.ts`, `src/domain/types/index.ts`
**Depends on:** Nothing
**Parallel:** Yes (independent of S002-S004)

Define the `DisplaySnapshot` Zod schema and related types:

- [ ] `restTimerStateSchema` -- discriminated union: `{ state: 'idle' }` or `{ state: 'running', started_at: isoDateTime, total_seconds: z.number().positive() }`
- [ ] `displaySetSchema` -- `{ set_number: z.number().int().min(1), prescribed: z.object({ reps, weight }).optional(), actual: z.object({ reps, weight }).optional(), completed: z.boolean() }`
- [ ] `displaySnapshotSchema` -- all 11 fields from PRD "What Gets Pushed" table: `user_id`, `display_name`, `session_name`, `workout_started_at` (isoDateTime), `current_exercise` (string), `exercise_index` (non-negative int), `total_exercises` (positive int), `sets` (array of `displaySetSchema`), `rest_timer` (`restTimerStateSchema`), `session_type` (sessionTypeSchema), `is_visible` (literal `true` -- only visible users get here)
- [ ] `displayEventTypeSchema` -- enum: `'workout_snapshot'`, `'session_ended'`, `'focus'`, `'unfocus'`
- [ ] Export all types from `src/domain/types/index.ts` barrel

**Acceptance:** `displaySnapshotSchema.parse(validPayload)` succeeds; `.parse(incompletePayload)` throws. (TA1, TA2)

---

### S002: Add `displayVisible` to UserProfile domain type

**Agent:** frontend-specialist
**Files:** `src/domain/types/user.ts`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001, S003, S004)

- [ ] Add `displayVisible: z.boolean().optional()` to `userProfileSchema`
- [ ] Default behavior: `undefined` treated as `true` (visible) by publisher

**Acceptance:** `UserProfile` type accepts `displayVisible: true`, `displayVisible: false`, and `undefined`. (TA5 partial)

---

### S003: Postgres migration for `display_visible`

**Agent:** backend-specialist
**Files:** `supabase/migrations/20260404000001_add_display_visible.sql`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001, S002, S004)

- [ ] `ALTER TABLE user_profiles ADD COLUMN display_visible boolean NOT NULL DEFAULT true;`
- [ ] Add column comment explaining purpose

**Acceptance:** Migration applies cleanly to local Supabase; `SELECT display_visible FROM user_profiles` returns `true` for existing rows.

---

### S004: SQLite migration + Rust model/command changes for `display_visible`

**Agent:** backend-specialist
**Files:** `src-tauri/migrations/008_add_display_visible.sql`, `src-tauri/src/models.rs`, `src-tauri/src/commands/user_profile.rs`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001-S003)

- [ ] SQLite migration: `ALTER TABLE user_profiles ADD COLUMN display_visible INTEGER NOT NULL DEFAULT 1;`
- [ ] Add `pub display_visible: Option<i32>` to `UserProfileRow` in `models.rs`
- [ ] Add `pub display_visible: Option<bool>` to `UpdateUserProfileInput` struct
- [ ] Add `display_visible` to `get_user_profile` SELECT column list and result mapping
- [ ] Add `display_visible` to `update_user_profile` UPSERT column list, SET clause, and `.bind()` with bool-to-int conversion

**Acceptance:** `tauri dev` -- update profile with `display_visible: false` -- read back -- value persists as `0` in SQLite and round-trips correctly through the command.

---

### S005: Data mapper + Tauri adapter for `display_visible`

**Agent:** backend-specialist
**Files:** `src/lib/data-mapper.ts`, `src/lib/tauri-adapter.ts`
**Depends on:** S002 (type must exist), S004 (Rust command must accept the field)
**Parallel:** No (sequential after S002 and S004)

- [ ] `toUserProfile`: add `displayVisible: row.display_visible ?? undefined` (Postgres) / `displayVisible: row.display_visible === 1 ? true : row.display_visible === 0 ? false : undefined` (SQLite via Rust)
- [ ] `fromUserProfile`: add `if (profile.displayVisible !== undefined) row.display_visible = profile.displayVisible`
- [ ] Tauri adapter `updateUserProfile`: add `display_visible: partial.display_visible ?? null` to the input object passed to `invoke('update_user_profile')`

**Acceptance:** Round-trip test: set `displayVisible: false` via adapter, read back, value is `false`. Set `displayVisible: true`, read back, value is `true`.

---

## Wave 2: Publisher Infrastructure (frontend-specialist, depends on Wave 1)

### S006: Snapshot builder pure function

**Agent:** frontend-specialist
**Files:** `src/lib/display-snapshot.ts`
**Depends on:** S001 (schema), S002 (UserProfile type)
**Parallel:** Yes (parallel with S007)

Implement `buildDisplaySnapshot()`:

- [ ] Function signature: `(state: ActiveWorkoutState, context: SnapshotContext) => DisplaySnapshot`
- [ ] `SnapshotContext` type: `{ userId: string, displayName: string, exerciseNameMap: Record<string, string>, sessionType: SessionType }`
- [ ] Map `state.workoutLog.title ?? 'Ad Hoc Workout'` to `session_name`
- [ ] Map `state.workoutLog.startedAt` to `workout_started_at`
- [ ] Derive `current_exercise` from last activity in last group, resolved via `exerciseNameMap[exerciseId]` with fallback to `'Unknown Exercise'`
- [ ] Derive `exercise_index` and `total_exercises` by flattening all activities across all groups
- [ ] Map current exercise's `sets` array to `DisplaySet[]` format (set_number, prescribed, actual, completed)
- [ ] Build `rest_timer` state: if `state.restTimer` is null -> `{ state: 'idle' }`; if present -> `{ state: 'running', started_at: new Date(Date.now() - (restTimer.total - restTimer.remaining) * 1000).toISOString(), total_seconds: restTimer.total }`
- [ ] Set `is_visible: true` (publisher already gates on visibility)

**Acceptance:** Pure function with known inputs produces expected `DisplaySnapshot`. Timer state mapping correct for both running and idle cases. (TA1, TA8, TA9)

---

### S007: Display publisher module

**Agent:** frontend-specialist
**Files:** `src/lib/display-publisher.ts`
**Depends on:** S001 (schema for type safety)
**Parallel:** Yes (parallel with S006)

Implement the publisher module with module-scope state:

- [ ] `_channel: RealtimeChannel | null` -- lazy-created on first publish
- [ ] `_userId: string | null` and `_displayVisible: boolean` -- set by `configureDisplayPublisher()`
- [ ] `initDisplayPublisher(client: SupabaseClient)` -- stores client reference, does NOT create channel yet
- [ ] `configureDisplayPublisher({ userId, displayVisible })` -- sets module-level flags
- [ ] `publishDisplaySnapshot(snapshot: DisplaySnapshot)` -- guards: client initialized, `_displayVisible` is true. Lazy-creates channel with `client.channel('display', { broadcast: { ack: false, self: false } })`. Calls `channel.send({ type: 'broadcast', event: 'workout_snapshot', payload: snapshot })`. Fire-and-forget: `.catch(console.error)`.
- [ ] `publishSessionEnded(userId: string)` -- same guards. Event: `session_ended`, payload: `{ user_id: userId }`.
- [ ] `publishFocusEvent(userId: string)` -- event: `focus`, payload: `{ user_id: userId }`.
- [ ] `publishUnfocusEvent()` -- event: `unfocus`, payload: `{}`.
- [ ] `destroyDisplayPublisher()` -- unsubscribes channel, nulls all module-scope state.
- [ ] All publish functions return `void` (not Promise) -- fire-and-forget pattern.

**Acceptance:** With mocked Supabase client: `publishDisplaySnapshot` calls `channel.send` with correct event/payload. With `_displayVisible = false`: zero `channel.send` calls. (TA3 partial, TA5, TA10)

---

## Wave 3: Store Integration + UI (frontend-specialist, depends on Wave 2)

### S008: Wire publisher into active workout store

**Agent:** frontend-specialist
**Files:** `src/stores/active-workout-store.ts`
**Depends on:** S006 (builder), S007 (publisher)
**Parallel:** No (depends on both Wave 2 tasks)

Add fire-and-forget publish calls to store actions. The publisher context (userId, displayName, exerciseNameMap, sessionType) is set externally by the `useDisplayBroadcast` hook (S009) via a module-level setter.

- [ ] Add module-scope `_snapshotContext: SnapshotContext | null = null`
- [ ] Add exported `setSnapshotContext(ctx: SnapshotContext | null)` setter
- [ ] Add internal `_publishCurrentState()` helper: if `_snapshotContext` is null, no-op. Otherwise calls `publishDisplaySnapshot(buildDisplaySnapshot(get(), _snapshotContext))`.
- [ ] `startWorkout`: call `_publishCurrentState()` after `set()`
- [ ] `startProgrammedWorkout`: call `_publishCurrentState()` after `set()`
- [ ] `addExerciseToWorkout`: call `_publishCurrentState()` after `set()`
- [ ] `confirmSet`: call `_publishCurrentState()` after `set()`
- [ ] `startRestTimer`: call `_publishCurrentState()` after `set({ restTimer: ... })`
- [ ] `skipRest`: call `_publishCurrentState()` after clearing timer
- [ ] `adjustRest`: call `_publishCurrentState()` after update
- [ ] Rest timer expiry (both Tauri `timer_expired` handler and browser `tickRest` when remaining hits 0): call `_publishCurrentState()` after `set({ restTimer: null })`
- [ ] `finishWorkout`: call `publishSessionEnded(_snapshotContext.userId)` BEFORE `set({ ...initialState })` (state is wiped by set)
- [ ] `discardWorkout`: call `publishSessionEnded(_snapshotContext.userId)` BEFORE `set({ ...initialState })`

**Acceptance:** Each action triggers exactly one Broadcast event of the correct type. `finishWorkout` and `discardWorkout` emit `session_ended` before state reset. (TA3, TA4)

---

### S009: `useDisplayBroadcast` hook

**Agent:** frontend-specialist
**Files:** `src/hooks/use-display-broadcast.ts`
**Depends on:** S007 (publisher), S008 (store context setter)
**Parallel:** No (sequential after S008)

React hook that wires the publisher lifecycle to the active workout:

- [ ] Call `initDisplayPublisher(getSupabaseClient())` on mount (no-op if client is null)
- [ ] Read `displayVisible` from `useUserProfile(userId)` query cache
- [ ] Call `configureDisplayPublisher({ userId, displayVisible: profile?.displayVisible ?? true })` when profile data changes
- [ ] Build `exerciseNameMap` from `useExercises()` query cache (or a lightweight lookup)
- [ ] Derive `sessionType` from workout log's program context (if available) or default `'STRENGTH'`
- [ ] Call `setSnapshotContext({ userId, displayName, exerciseNameMap, sessionType })` when workout is active; call `setSnapshotContext(null)` when not
- [ ] Call `destroyDisplayPublisher()` on unmount
- [ ] Return `{ publishFocus, publishUnfocus, isBroadcasting }` for UI consumption

**Acceptance:** Hook initializes publisher on mount, configures visibility from profile, sets snapshot context when workout is active, cleans up on unmount.

---

### S010: Settings UI -- Remote Display section

**Agent:** frontend-specialist
**Files:** `src/routes/_authenticated/profile.tsx`
**Depends on:** S002 (type), S005 (adapter)
**Parallel:** Yes (parallel with S008, S009)

Add "Remote Display" section to the profile/settings page:

- [ ] New section after "Notifications", using the existing section pattern (border-t, uppercase heading, content)
- [ ] `useState<boolean | null>(null)` for local draft state
- [ ] Effective value: `displayVisible ?? profile?.displayVisible ?? true`
- [ ] Use the existing `ToggleRow` sub-component pattern from notification-settings (label + `<Switch>` in a 48px flex row)
- [ ] Label: "Display visibility" / Description: "Show your active workout on the gym display"
- [ ] Include `displayVisible` in the `handleSaveSettings` updates object
- [ ] Save persists to both Supabase and local profile cache via `useUpdateUserProfile`

**Acceptance:** Toggle visible in Settings under "Remote Display". Toggling off and saving persists `display_visible = false`. Toggling on persists `true`.

---

### S011: "Push to Display" button component

**Agent:** frontend-specialist
**Files:** `src/components/workout/push-to-display-button.tsx`
**Depends on:** S007 (publisher focus/unfocus functions)
**Parallel:** Yes (parallel with S008, S009, S010)

- [ ] Local `isFocused` state (boolean, default false)
- [ ] On tap when not focused: call `publishFocusEvent(userId)`, set `isFocused = true`
- [ ] On tap when focused: call `publishUnfocusEvent()`, set `isFocused = false`
- [ ] Icon: `cast` Material Symbol (or `tv`); toggles between active (`ember`) and inactive (`text-secondary`) states
- [ ] Label: "Push to Display" when not focused, "Return to Board" when focused
- [ ] Render only when `isBroadcasting` is true (from `useDisplayBroadcast` hook)
- [ ] 48px touch target minimum

**Acceptance:** Button renders during active workout. Tap publishes `focus` event with correct `user_id`. Tap again publishes `unfocus` event with empty payload. (TA6, TA7)

---

### S012: Mount hook and button in active workout route

**Agent:** frontend-specialist
**Files:** `src/routes/_authenticated/tracker.tsx` (or whichever route hosts the active workout)
**Depends on:** S009 (hook), S011 (button)
**Parallel:** No (sequential after S009 and S011)

- [ ] Call `useDisplayBroadcast(userId)` in the active workout route component
- [ ] Render `<PushToDisplayButton>` in the workout header/action area, passing `publishFocus`, `publishUnfocus`, `isBroadcasting` from the hook
- [ ] Verify the hook cleans up on route exit (unmount)

**Acceptance:** Active workout publishes snapshots to the `display` Broadcast channel. Push to Display button is visible and functional. Exiting the workout route cleans up the publisher.

---

## Wave 4: Validation (quality-engineer, depends on Waves 1-3)

### S013-T: Unit tests -- Zod schema and snapshot builder

**Agent:** quality-engineer
**Files:** `src/domain/types/__tests__/display-snapshot.test.ts`, `src/lib/__tests__/display-snapshot.test.ts`
**Depends on:** S001, S006
**Parallel:** Yes (parallel with S014-T)

- [ ] Schema: valid complete snapshot passes parse
- [ ] Schema: missing `user_id` throws
- [ ] Schema: missing `current_exercise` throws
- [ ] Schema: `rest_timer` with `state: 'running'` requires `started_at` and `total_seconds`
- [ ] Schema: `rest_timer` with `state: 'idle'` requires no extra fields
- [ ] Builder: known state input produces correct `session_name`, `current_exercise`, `exercise_index`, `total_exercises`
- [ ] Builder: sets array maps prescribed and actual correctly
- [ ] Builder: null rest timer -> `{ state: 'idle' }`
- [ ] Builder: active rest timer -> `{ state: 'running', started_at: <ISO>, total_seconds: <number> }`
- [ ] Builder: exercise name fallback to 'Unknown Exercise' when ID not in map

**Acceptance:** All assertions pass. (TA1, TA2, TA8, TA9)

---

### S014-T: Unit tests -- publisher guards and event emission

**Agent:** quality-engineer
**Files:** `src/lib/__tests__/display-publisher.test.ts`
**Depends on:** S007
**Parallel:** Yes (parallel with S013-T)

- [ ] Not initialized: `publishDisplaySnapshot` is a no-op (zero `channel.send` calls)
- [ ] Initialized but `displayVisible = false`: `publishDisplaySnapshot` is a no-op
- [ ] Initialized and `displayVisible = true`: `publishDisplaySnapshot` calls `channel.send` with `event: 'workout_snapshot'`
- [ ] `publishSessionEnded` sends `event: 'session_ended'` with `{ user_id }`
- [ ] `publishFocusEvent` sends `event: 'focus'` with `{ user_id }`
- [ ] `publishUnfocusEvent` sends `event: 'unfocus'` with `{}`
- [ ] `destroyDisplayPublisher` calls `channel.unsubscribe`
- [ ] Publish does not throw on `channel.send` rejection (fire-and-forget)

**Acceptance:** All assertions pass. (TA3, TA4, TA5, TA6, TA7, TA10)

---

## Milestone Summary

| Wave | Tasks | Parallel | Description |
|------|-------|----------|-------------|
| Wave 1 | S001-S005 | S001-S004 parallel; S005 sequential after S002+S004 | Domain types, migrations, data mapper |
| Wave 2 | S006-S007 | Both parallel | Snapshot builder + publisher module |
| Wave 3 | S008-S012 | S010+S011 parallel with S008+S009; S012 sequential last | Store wiring, hook, Settings UI, button |
| Wave 4 | S013-T, S014-T | Both parallel | Unit tests for schema, builder, publisher |

**Totals:** 12 implementation tasks + 2 validation tasks = 14 tasks
**Agents:** 1 frontend specialist + 1 backend specialist + 1 quality engineer = 3 agents
**Execution mode:** `/build` (agents work on isolated vertical slices; frontend-specialist owns most tasks sequentially through Waves 1-3)

**Parallel execution strategy:** Wave 1 runs 4 tasks in parallel (S001-S004), with S005 gated on S002+S004. Wave 2 runs 2 tasks in parallel. Wave 3 runs S010+S011 in parallel with the sequential S008->S009->S012 chain. Wave 4 runs both test tasks in parallel after all implementation is complete. The backend-specialist finishes after Wave 1 (S003, S004, S005) and is released. The frontend-specialist carries the bulk of work through Waves 1-3. The quality-engineer activates only in Wave 4.

---

## Contract: Shared Interfaces

### SnapshotContext (frontend-specialist builds in S006, consumed by store in S008 and hook in S009)

```typescript
interface SnapshotContext {
  userId: string
  displayName: string
  exerciseNameMap: Record<string, string>
  sessionType: SessionType
}
```

### DisplaySnapshot (frontend-specialist builds in S001, consumed by publisher in S007 and builder in S006)

```typescript
// Zod-inferred type from displaySnapshotSchema
interface DisplaySnapshot {
  user_id: string
  display_name: string
  session_name: string
  workout_started_at: string        // ISO 8601
  current_exercise: string
  exercise_index: number
  total_exercises: number
  sets: DisplaySet[]
  rest_timer: RestTimerState
  session_type: SessionType
  is_visible: true
}

interface DisplaySet {
  set_number: number
  prescribed?: { reps?: number; weight?: { value: number; unit: string } }
  actual?: { reps?: number; weight?: { value: number; unit: string } }
  completed: boolean
}

type RestTimerState =
  | { state: 'idle' }
  | { state: 'running'; started_at: string; total_seconds: number }
```

### DisplayPublisher API (frontend-specialist builds in S007, consumed by store in S008, hook in S009, button in S011)

```typescript
function initDisplayPublisher(client: SupabaseClient): void
function configureDisplayPublisher(opts: { userId: string; displayVisible: boolean }): void
function publishDisplaySnapshot(snapshot: DisplaySnapshot): void
function publishSessionEnded(userId: string): void
function publishFocusEvent(userId: string): void
function publishUnfocusEvent(): void
function destroyDisplayPublisher(): void
```

### Store Context Setter (frontend-specialist builds in S008, consumed by hook in S009)

```typescript
function setSnapshotContext(ctx: SnapshotContext | null): void
```

### useDisplayBroadcast Return (frontend-specialist builds in S009, consumed by route in S012 and button in S011)

```typescript
interface UseDisplayBroadcastReturn {
  publishFocus: () => void
  publishUnfocus: () => void
  isBroadcasting: boolean
}
```
