# Feature 018: Workout Session UX -- Technical Plan

## Architecture Overview

This feature touches three layers: the Supabase schema (new pause columns), the Zustand store + hook layer (timer lifecycle, pause state), and the UI layer (preview modal, circuit rendering, bodyweight inputs, paused session card). No new tables are needed -- all changes are additive columns on `workout_logs` and new/modified React components.

## Key Decisions

### D-1: Timer Lifecycle -- Move interval ownership to the workout log page

**Problem:** `useActiveWorkout` hook runs a cleanup effect that calls `store.cleanup()` on unmount, killing `_elapsedInterval`. Since `startWorkout` is called on the Forge page and then the user navigates away, the interval dies before the log page mounts.

**Options considered:**

1. Remove the cleanup effect from `useActiveWorkout` entirely -- risky, the cleanup also clears rest timer intervals
2. Split cleanup: only clear rest timer on unmount, let elapsed timer persist -- fragile coupling
3. **Move elapsed timer to a `useEffect` on the workout log page** -- the page starts/stops the interval based on store state

**Decision: Option 3.** The workout log page owns the elapsed timer interval via a `useEffect` that:

- Starts a 1-second interval when `workoutLog` exists and `pausedAt` is null
- Clears the interval when the component unmounts, the workout finishes, or the session is paused
- On mount, recalculates `elapsedSeconds` from `startedAt` + `totalPausedMs` (handles page refresh, crash recovery)

The store's `_elapsedInterval` field and the `startElapsedTimer`/`tickElapsed` actions are replaced by a simpler `setElapsedSeconds(n)` setter. The rest timer interval stays in the store since it is only used on the log page.

### D-2: Pause/Resume -- Add `pausedAt` and `totalPausedMs` to WorkoutLog

**Problem:** No pause mechanism exists. Need to track when a session is paused and total accumulated pause time.

**Schema changes:**

- `pausedAt: z.string().datetime().optional()` -- ISO timestamp when paused, null when running
- `totalPausedMs: z.number().int().nonneg().default(0)` -- cumulative milliseconds spent paused

**DB migration:** Add two nullable columns to `workout_logs`:

```sql
ALTER TABLE workout_logs ADD COLUMN paused_at TIMESTAMPTZ;
ALTER TABLE workout_logs ADD COLUMN total_paused_ms BIGINT NOT NULL DEFAULT 0;
```

**State machine:**

```
RUNNING (pausedAt=null) --[pause]--> PAUSED (pausedAt=now)
PAUSED --[resume]--> RUNNING (totalPausedMs += now - pausedAt, pausedAt=null)
PAUSED --[discard]--> DELETED
PAUSED --[finish]--> COMPLETED (totalPausedMs += now - pausedAt if still paused)
RUNNING --[finish]--> COMPLETED
RUNNING --[discard]--> DELETED
```

**Elapsed time formula:** `elapsed = (referenceTime - startedAt) - totalPausedMs - (pausedAt ? referenceTime - pausedAt : 0)`

Where `referenceTime` is `Date.now()` during the session or `completedAt` after finishing.

### D-3: Crash Recovery -- Qualify "incomplete" sessions

**Problem:** Any `WorkoutLog` without `completedAt` triggers the crash-recovery dialog, including freshly created sessions that never had a set confirmed.

**Decision:** Add two filters to the incomplete-session detection:

1. Session has at least one confirmed set, OR
2. Session was started more than 60 seconds ago

This prevents the dialog from firing for sessions that were created and immediately abandoned (navigation race, double-tap, etc.) while still catching legitimate crash-orphaned sessions.

**Additionally:** Intentionally paused sessions (`pausedAt != null`) should show the **paused session card** on the Forge page, not the crash-recovery dialog. The crash-recovery dialog only triggers for sessions where `pausedAt` is null (the user never intentionally paused -- the app crashed/closed).

### D-4: Circuit Rendering -- Lift CircuitPanel to group level

**Problem:** `CircuitPanel` is rendered inside `group.activities.map(...)`, producing N duplicate panels for a circuit with N activities.

**Decision:** Restructure the rendering loop in `log.$workoutId.tsx` to check group type before iterating activities:

```tsx
loggedGroups.map((group) => {
  // Group-level components (circuit, future: superset header)
  if (group.groupType === 'CIRCUIT') {
    return <CircuitPanel key={group.id} ... />
  }
  // Activity-level components
  return group.activities.map((activity) => {
    // cardio, ruck, standard exercise blocks
  })
})
```

This is a straightforward structural fix with no architectural implications.

### D-5: Bodyweight Exercise Inputs -- Pass exercise category to SetRow

**Problem:** `ExerciseBlock` and `SetRow` are category-agnostic. Bodyweight exercises show an irrelevant weight input.

**Decision:** Thread exercise category through the component chain:

1. `log.$workoutId.tsx` already has access to the `Exercise` object (via `exerciseNames` lookup and the exercises query). Add a `exerciseCategory` lookup alongside `exerciseNames`.
2. Pass `isBodyweight: boolean` prop to `ExerciseBlock`.
3. `ExerciseBlock` passes `isBodyweight` to `SetRow` and adjusts column headers (replace WEIGHT with BW indicator).
4. `SetRow` hides the weight input when `isBodyweight` is true. The confirm button only requires reps.

**No changes to the data layer** -- the exercise category is already available from the exercises query.

### D-6: Workout Preview Modal -- New component using existing data utilities

**Problem:** No way to preview a workout before starting it.

**Decision:** Create a `WorkoutPreviewSheet` component (bottom sheet on mobile, dialog on desktop) that:

1. Receives a `sessionTemplateId`
2. Fetches `SessionTemplateFull` via existing `useSessionTemplateFull(id)` hook
3. Resolves exercise names via existing exercise query
4. Resolves prescriptions via `resolveSessionTemplate()` (same as workout start, but read-only)
5. Renders groups with exercises, set counts, and prescribed weight/reps
6. Has a "Start Workout" CTA at the bottom

**Reuse:** The program builder's `session-detail-utils.ts` already has formatting utilities for set schemes. The preview can reuse these.

**Integration points:**

- **Forge page:** `ProgramSessionCard` gets an `onPreview` callback. Tapping the card body opens the preview. The existing "Start" button remains separate.
- **Program builder:** Clicking a filled session slot in `session-slot.tsx` opens the preview sheet. Currently filled slots have no click handler -- add one.

### D-7: Paused Session Card on Forge Page

**Problem:** When a workout is paused, the user navigates to the Forge page and sees either nothing or the crash-recovery dialog.

**Decision:** Add a `PausedSessionCard` component to the Forge page that:

1. Detects a paused workout from recent logs (`pausedAt != null && !completedAt`)
2. Displays: session name/title, elapsed time (excluding paused duration), "PAUSED" badge, paused-since timestamp
3. Has two CTAs: "Resume" (navigates to `/log/$workoutId` and unpauses) and "Discard" (with confirmation)
4. Renders above the program session card in visual hierarchy (it's the most urgent action)

**Relationship to crash recovery:** The paused-session card handles intentionally paused sessions. The crash-recovery dialog handles unintentionally abandoned sessions (no `pausedAt`). They are mutually exclusive.

## Schema Changes

### WorkoutLog Zod Schema (`src/domain/types/workout-log.ts`)

Add two fields to `workoutLogSchema`:

```typescript
pausedAt: z.string().datetime().optional(),
totalPausedMs: z.number().int().nonneg().default(0),
```

### Supabase Migration

New migration file: `YYYYMMDDHHMMSS_add_workout_pause_fields.sql`

```sql
ALTER TABLE workout_logs ADD COLUMN paused_at TIMESTAMPTZ;
ALTER TABLE workout_logs ADD COLUMN total_paused_ms BIGINT NOT NULL DEFAULT 0;
```

### Data Adapter Row Mappers

Update `toWorkoutLog` and `fromWorkoutLog` in `supabase-adapter.ts` to map the new columns.

## Component Changes

| Component                   | Change                                                                     | New Props                         |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------- |
| `workout-header.tsx`        | Add pause/resume button next to timer                                      | `isPaused`, `onPause`, `onResume` |
| `log.$workoutId.tsx`        | Own elapsed timer interval via useEffect; restructure group rendering loop | --                                |
| `exercise-block.tsx`        | Accept `isBodyweight` prop, adjust headers                                 | `isBodyweight`                    |
| `set-row.tsx`               | Hide weight input when `isBodyweight`, show "BW" indicator                 | `isBodyweight`                    |
| `crash-recovery-dialog.tsx` | Filter out freshly abandoned sessions and intentionally paused sessions    | --                                |
| `program-session-card.tsx`  | Add `onPreview` callback for card body tap                                 | `onPreview`                       |
| `session-slot.tsx`          | Add onClick for filled slots to open preview                               | `onPreview`                       |
| `index.tsx` (Forge)         | Add PausedSessionCard, integrate preview sheet                             | --                                |

## New Components

| Component             | Purpose                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `WorkoutPreviewSheet` | Bottom sheet/dialog showing session template preview with exercises, sets, loads, and Start CTA |
| `PausedSessionCard`   | Forge page card for paused workout with resume/discard actions                                  |

## Integration Points

- **Prescription resolver**: Already used for programmed workout start. Preview reuses same resolver in read-only mode for accurate load display.
- **Program position**: Pause/resume does not affect program advancement. Only `finishWorkout` advances position (existing behavior preserved).
- **Sync engine**: New columns are additive. Existing sync pull/push handles schema changes via the adapter layer.
- **Tauri timer**: The Rust-backed rest timer is unaffected. The elapsed timer moves to a React-owned interval, which works identically in browser and Tauri WebView.

## Risks and Mitigations

| Risk                                                                          | Impact                                     | Mitigation                                                                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Existing incomplete WorkoutLogs in production lack `pausedAt`/`totalPausedMs` | Crash recovery must handle null gracefully | Default `totalPausedMs` to 0, treat null `pausedAt` as "not paused" -- both already the schema defaults         |
| Preview modal fetches full template data on every open                        | Slow preview on weak connections           | TanStack Query caching handles this -- templates are read-heavy, write-rare                                     |
| Circuit rendering restructure breaks superset/straight-set rendering          | Regression in non-circuit groups           | The group-type check only intercepts CIRCUIT; all other types fall through to existing activity-level rendering |

## File Impact Summary

**Modified files (11):**

- `src/domain/types/workout-log.ts` -- add pausedAt, totalPausedMs
- `src/stores/active-workout-store.ts` -- replace elapsed timer with setter, add pause/resume actions
- `src/hooks/use-active-workout.ts` -- remove cleanup effect for elapsed timer, add pause/resume mutations
- `src/routes/_authenticated/log.$workoutId.tsx` -- own elapsed timer, fix circuit rendering, pass bodyweight flag
- `src/routes/_authenticated/index.tsx` -- add PausedSessionCard, integrate preview sheet
- `src/components/workout/workout-header.tsx` -- add pause/resume button
- `src/components/workout/exercise-block.tsx` -- accept isBodyweight
- `src/components/workout/set-row.tsx` -- hide weight when bodyweight
- `src/components/workout/crash-recovery-dialog.tsx` -- filter stale/paused sessions
- `src/components/program-builder/session-slot.tsx` -- add preview click handler
- `src/lib/supabase-adapter.ts` -- update row mappers
- `src/components/today/program-session-card.tsx` -- add onPreview prop

**New files (3):**

- `supabase/migrations/YYYYMMDDHHMMSS_add_workout_pause_fields.sql`
- `src/components/workout/workout-preview-sheet.tsx`
- `src/components/today/paused-session-card.tsx`

## Revision History

| Date       | Change        | ADR |
| ---------- | ------------- | --- |
| 2026-04-06 | Initial draft | --  |
