# Tech: Display Broadcast Infrastructure (Step 27)

**Feature:** 008-display-broadcast-infrastructure
**Status:** Draft
**Created:** 2026-04-03

---

## Architecture Overview

The display broadcast pipeline has four layers:

```
Active Workout Store (state changes)
        |
        v
Snapshot Builder (pure function: state -> DisplaySnapshot)
        |
        v
Display Publisher (side-effect module: snapshot -> Broadcast channel)
        |
        v
Supabase Realtime Broadcast (channel: "display")
```

The phone is the only publisher. The display route (Step 28) is the only subscriber. Snapshots are ephemeral -- never persisted to any database.

---

## Key Decisions

### D1: Publisher as a standalone module, not inline in the store

**Decision:** Create `src/lib/display-publisher.ts` as a standalone module with a `publishDisplaySnapshot()` function. Store actions call into the publisher after state mutations.

**Options considered:**
- **(a) Zustand `subscribe` middleware**: Watch the store for changes and publish automatically. Rejected because the elapsed timer ticks every second, and there is no clean way to distinguish "meaningful" changes (set confirmed) from "noise" (elapsed tick) without maintaining shadow state to diff against. The filtering logic would be fragile and hard to test.
- **(b) Inline Supabase calls in store actions**: Rejected because the store currently has zero Supabase imports, and adding them would violate the existing separation. The only non-Zustand side effects in the store are timer management (module-scope intervals and Tauri invoke/listen).
- **(c) Standalone publisher module called from store actions**: Selected. Follows the same pattern as the Tauri timer invocations already present in the store -- the store already performs side effects, but delegates the implementation to external modules. The publisher import is lightweight and the calls are fire-and-forget.

**Why (c) wins:** Explicit control over which actions trigger a publish. Testable in isolation (mock the publisher, assert calls). The store gains one new import but no new architectural pattern -- it already calls `invoke()` and `listen()` from `@tauri-apps/api`.

### D2: Snapshot builder as a pure function

**Decision:** `buildDisplaySnapshot(state, profile)` is a pure function in `src/lib/display-snapshot.ts` that takes the active workout state and the user profile, and returns a `DisplaySnapshot`. No Supabase client, no side effects.

**Rationale:** Separation of snapshot construction (deterministic, unit-testable) from snapshot delivery (network I/O, fire-and-forget). The builder can be tested with plain objects; the publisher can be tested by mocking the Supabase channel.

### D3: Single `display` Broadcast channel, independent from chat RealtimeManager

**Decision:** The display publisher creates and manages its own Supabase Realtime channel named `display`. It does not use the existing `RealtimeManager` (which is scoped to chat `chat:{conversationId}` channels).

**Rationale:** The chat `RealtimeManager` has subscribe/unsubscribe lifecycle, typing debounce, catch-up queries, and foreground/background handling -- none of which apply to the display publisher. The display publisher is fire-and-forget: get channel, send event, done. Creating a separate channel avoids coupling and keeps both systems independently evolvable.

**Channel configuration:**
```ts
client.channel('display', { broadcast: { ack: false, self: false } })
```
- `ack: false` -- no delivery confirmation needed (fire-and-forget)
- `self: false` -- the publishing phone does not need to receive its own snapshots

### D4: `display_visible` passed in from caller, not fetched by publisher

**Decision:** The publisher receives `displayVisible: boolean` as a parameter. The calling code reads this from the TanStack Query cache (`useUserProfile`). The publisher does not fetch the user profile.

**Options considered:**
- **(a) Publisher fetches profile on every publish**: Rejected. Adds an async DB read to every set confirmation -- unacceptable latency for what should be fire-and-forget.
- **(b) Publisher reads from a Zustand store**: Rejected. No profile Zustand store exists; profile is managed via TanStack Query. Creating a new store just for one boolean is over-engineering.
- **(c) Caller passes `displayVisible` from cached profile**: Selected. The active workout screen already has the profile in its TanStack Query cache. Passing a boolean is zero-cost.

**How the wire-up works:** A `useDisplayBroadcast` hook (or inline effect in the active workout route component) reads `displayVisible` from the cached profile and passes it to the publisher. The store actions call the publisher module directly; the hook ensures the publisher is initialized with the correct visibility state.

Actually, refined approach: The store actions don't know about `displayVisible`. Instead, the publisher module holds a module-level `_displayVisible` flag, set once at workout start by the hook. The store actions call `publishDisplaySnapshot(state)` unconditionally; the publisher checks the flag internally and no-ops if false. This keeps the store completely unaware of display concerns.

### D5: Timer snapshot includes `started_at` for client-side interpolation

**Decision:** When the rest timer is running, the snapshot includes `rest_timer: { state: 'running', started_at: ISO8601, total_seconds: number }`. When idle, it includes `rest_timer: { state: 'idle' }`. No `remaining` field -- the display calculates remaining time from `started_at` and `total_seconds`.

**Rationale:** This is the timer interpolation pattern from the PRD (RD-5). It avoids per-second Broadcast traffic. The display runs a local `setInterval` or `requestAnimationFrame` countdown between the `running` and `idle` snapshots.

**Implementation note:** The store's `restTimer` has `{ remaining, total }` but no `started_at`. The snapshot builder must compute `started_at` from `Date.now() - (total - remaining) * 1000` at snapshot construction time. This is approximate but sufficient for +/- 1 second accuracy (NFR-D4).

### D6: Focus/unfocus as explicit publish calls, not store actions

**Decision:** The "Push to Display" button calls `publishFocusEvent(userId)` and `publishUnfocusEvent()` directly on the publisher module. These are not Zustand store actions because they don't modify workout state.

**Rationale:** Focus/unfocus is a display concern, not a workout state concern. Adding them to the workout store would pollute its API surface. The button component calls the publisher directly.

---

## File Plan

### New Files

| File | Purpose |
|------|---------|
| `src/domain/types/display-snapshot.ts` | `DisplaySnapshot` Zod schema, `RestTimerState` union type, type exports |
| `src/lib/display-snapshot.ts` | `buildDisplaySnapshot()` pure function |
| `src/lib/display-publisher.ts` | `initDisplayPublisher()`, `publishDisplaySnapshot()`, `publishSessionEnded()`, `publishFocusEvent()`, `publishUnfocusEvent()`, `destroyDisplayPublisher()` |
| `src/hooks/use-display-broadcast.ts` | React hook that wires publisher lifecycle to active workout state |
| `src/components/workout/push-to-display-button.tsx` | "Push to Display" / "Return to Board" toggle button |
| `supabase/migrations/20260404000001_add_display_visible.sql` | Postgres `ALTER TABLE user_profiles ADD COLUMN display_visible` |
| `src-tauri/migrations/008_add_display_visible.sql` | SQLite `ALTER TABLE user_profiles ADD COLUMN display_visible` |
| `src/domain/types/__tests__/display-snapshot.test.ts` | Unit tests for Zod schema |
| `src/lib/__tests__/display-snapshot.test.ts` | Unit tests for snapshot builder |
| `src/lib/__tests__/display-publisher.test.ts` | Unit tests for publisher (mocked channel) |

### Modified Files

| File | Change |
|------|--------|
| `src/domain/types/user.ts` | Add `displayVisible: z.boolean().optional()` to `userProfileSchema` |
| `src/domain/types/index.ts` | Re-export `DisplaySnapshot` and related types |
| `src/lib/data-mapper.ts` | Add `display_visible` to `toUserProfile` and `fromUserProfile` |
| `src/lib/tauri-adapter.ts` | Add `display_visible` to `UpdateUserProfileInput` field list |
| `src-tauri/src/models.rs` | Add `display_visible: Option<i32>` to `UserProfileRow` |
| `src-tauri/src/commands/user_profile.rs` | Add `display_visible` to `UpdateUserProfileInput` struct and UPSERT query |
| `src/stores/active-workout-store.ts` | Add `publishDisplaySnapshot()` calls in `confirmSet`, `startWorkout`, `startProgrammedWorkout`, `addExerciseToWorkout`, `startRestTimer`, `finishWorkout`, `discardWorkout`, and rest timer expiry handler |
| `src/routes/_authenticated/profile.tsx` | Add "Remote Display" section with `display_visible` toggle |
| `src/routes/_authenticated/tracker.tsx` (or active workout route) | Mount `useDisplayBroadcast` hook, render `PushToDisplayButton` |

---

## Data Flow Detail

### Snapshot Construction

```
ActiveWorkoutState                UserProfile
{                                 {
  workoutLog,                       id,
  loggedGroups,                     displayName,
  elapsedSeconds,                   displayVisible,
  restTimer,                        ...
}                                 }
        \                         /
         v                       v
    buildDisplaySnapshot(state, profile)
                |
                v
        DisplaySnapshot {
          user_id:            profile.id,
          display_name:       profile.displayName ?? 'Athlete',
          session_name:       state.workoutLog.title ?? 'Ad Hoc Workout',
          workout_started_at: state.workoutLog.startedAt,
          current_exercise:   currentExerciseName(state),
          exercise_index:     currentExerciseIndex(state),
          total_exercises:    totalExerciseCount(state),
          sets:               currentExerciseSets(state),
          rest_timer:         buildRestTimerState(state.restTimer),
          session_type:       deriveSessionType(state.workoutLog),
          is_visible:         true  // always true at this point; invisible users never reach here
        }
```

### Helper Functions in Snapshot Builder

| Function | Logic |
|----------|-------|
| `currentExerciseName(state)` | Find the last group's last activity, look up exercise name from the activity. Since the store doesn't hold exercise names (only `exerciseId`), the publisher hook must pass in an exercise name map from the query cache. |
| `currentExerciseIndex(state)` | Flatten all activities across all groups, find index of the last one with sets being actively logged. |
| `totalExerciseCount(state)` | Count all unique activities across all groups. |
| `currentExerciseSets(state)` | Return the sets array for the current activity, mapped to the display format (set_number, prescribed, actual, completed). |
| `buildRestTimerState(restTimer)` | If null: `{ state: 'idle' }`. If present: `{ state: 'running', started_at: computed, total_seconds: restTimer.total }`. |
| `deriveSessionType(workoutLog)` | If `programContext` exists, derive from the session template's category. Otherwise default to `'STRENGTH'`. |

**Exercise name resolution:** The store holds `exerciseId` on `LoggedActivity`, not the exercise name. The snapshot needs the name string. Solution: the `useDisplayBroadcast` hook builds an `exerciseNameMap: Record<string, string>` from the TanStack Query exercise cache (`useExercises`) and passes it to `buildDisplaySnapshot`. This avoids adding exercise names to the Zustand store.

### Publish Triggers (wired in store actions)

| Store Action | Event | Payload |
|-------------|-------|---------|
| `startWorkout` | `workout_snapshot` | Initial snapshot, no sets yet |
| `startProgrammedWorkout` | `workout_snapshot` | Initial snapshot with pre-filled sets |
| `addExerciseToWorkout` | `workout_snapshot` | New exercise added, sets empty |
| `confirmSet` | `workout_snapshot` | Updated set completion |
| `startRestTimer` | `workout_snapshot` | Timer state: running |
| `tickRest` (when remaining hits 0) | `workout_snapshot` | Timer state: idle |
| `skipRest` | `workout_snapshot` | Timer state: idle |
| `adjustRest` | `workout_snapshot` | Timer state: running, updated total |
| `finishWorkout` | `session_ended` | `{ user_id }` |
| `discardWorkout` | `session_ended` | `{ user_id }` |

### Publisher Module API

```ts
// display-publisher.ts

/** Initialize the publisher with a Supabase client. Call once at app startup. */
export function initDisplayPublisher(client: SupabaseClient): void

/** Configure display visibility and user context. Call when profile loads/changes. */
export function configureDisplayPublisher(opts: {
  userId: string
  displayVisible: boolean
}): void

/** Publish a workout snapshot. No-op if not visible or not initialized. */
export function publishDisplaySnapshot(snapshot: DisplaySnapshot): void

/** Publish session_ended event. No-op if not visible or not initialized. */
export function publishSessionEnded(userId: string): void

/** Publish focus event. */
export function publishFocusEvent(userId: string): void

/** Publish unfocus event. */
export function publishUnfocusEvent(): void

/** Tear down channel subscription. */
export function destroyDisplayPublisher(): void
```

All publish functions are synchronous (fire-and-forget). The actual `channel.send()` returns a Promise that is intentionally not awaited -- errors are logged to console but never propagated.

---

## Database Changes

### Postgres Migration

```sql
-- 20260404000001_add_display_visible.sql
alter table user_profiles
    add column display_visible boolean not null default true;

comment on column user_profiles.display_visible is
    'Whether the user''s active workout appears on the remote gym display. Default: visible.';
```

No RLS changes needed -- the existing `user_profiles_all` policy covers all columns.

### SQLite Migration

```sql
-- 008_add_display_visible.sql
ALTER TABLE user_profiles ADD COLUMN display_visible INTEGER NOT NULL DEFAULT 1;
```

### Rust Changes

**`src-tauri/src/models.rs`:** Add `pub display_visible: Option<i32>` to `UserProfileRow`.

**`src-tauri/src/commands/user_profile.rs`:** Add `pub display_visible: Option<bool>` to `UpdateUserProfileInput`. Add to UPSERT column list and bind with `input.display_visible.map(|b| if b { 1i64 } else { 0i64 })`.

---

## Integration Points

### With Active Workout Store

The store gains import of `publishDisplaySnapshot` and `publishSessionEnded` from `display-publisher.ts`. Each relevant action appends a fire-and-forget call after the `set()` mutation:

```ts
// Example: confirmSet
confirmSet(loggedActivityId: string, newSet: LoggedSet) {
  set((state) => {
    // ... existing immutable update logic ...
  })
  // Fire-and-forget display publish
  publishDisplaySnapshot(buildDisplaySnapshot(get(), _publisherContext))
},
```

The `_publisherContext` (profile info, exercise name map) is set by the `useDisplayBroadcast` hook via a module-level setter, following the same pattern as the module-scope timer handles.

### With Settings Screen

A new "Remote Display" section in the profile page, positioned after "Notifications":

```tsx
<section className="pb-8">
  <div className="border-t border-surface-steel pb-2 pt-4">
    <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
      Remote Display
    </h2>
  </div>
  <ToggleRow
    label="Display visibility"
    description="Show your active workout on the gym display"
    checked={effectiveDisplayVisible}
    onCheckedChange={(v) => setDisplayVisible(v)}
  />
</section>
```

### With Active Workout UI

The `PushToDisplayButton` component renders in the active workout header. It tracks local `isFocused` state and calls `publishFocusEvent` / `publishUnfocusEvent` directly.

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Broadcast channel not available (no Supabase client in Tauri offline mode) | Medium | Publisher no-ops silently | Publisher checks `getSupabaseClient() !== null` before attempting channel creation; all publishes are guarded |
| Exercise name not in TanStack Query cache when snapshot is built | Low | Snapshot shows exercise ID instead of name | Fallback to `exerciseId` string; the display can show "Unknown Exercise" |
| `rest_timer.started_at` calculation drift | Low | Display timer off by 1-2 seconds | Acceptable per NFR-D4 (+/- 1 second); recalibrated on every snapshot |
| Broadcast publish blocks UI thread | Low | Set confirmation > 100ms | All publishes are `void` (Promise not awaited); channel.send() is non-blocking in Supabase JS client |
| Multiple tabs/windows publishing simultaneously | Low | Display receives duplicate snapshots per user | Display upserts by `user_id` -- duplicates overwrite harmlessly |

---

## ADR Candidates

No new ADRs needed. The key decisions (D1-D6) are implementation-level choices that follow established patterns in the codebase. The architectural decisions about transport layer, snapshot model, and channel topology are already resolved in `13-prd-remote-display.md` (RD-1 through RD-13).

---

## Testing Strategy

### Unit Tests

| Test | File | What |
|------|------|------|
| Schema validation | `display-snapshot.test.ts` | Valid/invalid payloads against Zod schema |
| Snapshot builder | `display-snapshot.test.ts` | Pure function with known inputs, assert all output fields |
| Timer state mapping | `display-snapshot.test.ts` | Running timer -> `{ state: 'running', started_at, total_seconds }`; null -> `{ state: 'idle' }` |
| Publisher guards | `display-publisher.test.ts` | Not initialized -> no-op; not visible -> no-op; initialized + visible -> channel.send called |

### Integration Tests

| Test | How |
|------|-----|
| End-to-end publish | Start dev server, open Supabase dashboard Broadcast inspector, confirm a set, verify event appears |
| Opt-out enforcement | Set `display_visible = false`, confirm a set, verify zero events on channel |
| Focus/unfocus | Tap Push to Display, verify `focus` event with correct `user_id`; tap again, verify `unfocus` event |
