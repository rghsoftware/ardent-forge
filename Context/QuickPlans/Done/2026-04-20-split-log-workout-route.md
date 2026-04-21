# Quick Plan: Split log.$workoutId Route into Three Components

**Task:** Refactor `src/routes/_authenticated/log.$workoutId.tsx` (~914 lines) by extracting its two non-summary rendering paths into dedicated files.

**Goal:** Reduce the route file to a thin orchestrator that owns shared state/hooks and delegates rendering to `EventWorkoutView`, `StrengthWorkoutView`, and (already-extracted) `WorkoutSummary`. No behavior changes.

---

## Current Structure

`ActiveWorkoutPage` contains three rendering paths via conditional branches:

| Path | Trigger | Lines |
|------|---------|-------|
| Summary | `showSummary && summaryData?.workoutLog` | 485-497 |
| Event workout | `workoutLog.eventMetadata` | 509-567 |
| Strength/cardio/ruck | default return | 569-912 |

`WorkoutSummary` is already its own component. Two new files needed.

---

## Approach

### Step 1: Extract `EventWorkoutView`

Create `src/components/workout/event-workout-view.tsx`.

Props it receives from the orchestrator:
- `workoutLog` (id, eventMetadata)
- `elapsedSeconds`, `isPauseSupported`, `isPaused`
- `handlePause`, `handleResume`, `handleFinish`, `handleDiscard`
- `isBroadcasting`, `publishFocus`, `publishUnfocus`
- `isFinishing`, `isDiscarding`
- `pageError`, `setPageError`
- `showDiscardDialog`, `setShowDiscardDialog`

Move lines 509-567 verbatim. Define a `EventWorkoutViewProps` interface.

### Step 2: Extract `StrengthWorkoutView`

Create `src/components/workout/strength-workout-view.tsx`.

Props it receives (all remaining state and handlers used in lines 569-912). Define a `StrengthWorkoutViewProps` interface.

Key state threads to include:
- All exercise-block rendering logic (lines 636-851)
- Rest view / rest timer banner
- Add exercise sheet + discard dialog
- Footer button + onboarding hint
- Undo banner

### Step 3: Slim the route file

`log.$workoutId.tsx` becomes:
1. Route definition
2. All hooks + state declarations (unchanged)
3. Timer effect (unchanged)
4. Computed values and handlers (unchanged)
5. Three-branch conditional returning `WorkoutSummary`, `EventWorkoutView`, or `StrengthWorkoutView`

Target size: ~200-250 lines (down from ~914).

---

## File Changes

| File | Change |
|------|--------|
| `src/routes/_authenticated/log.$workoutId.tsx` | Remove extracted JSX, import two new components |
| `src/components/workout/event-workout-view.tsx` | New file: EventWorkoutView component |
| `src/components/workout/strength-workout-view.tsx` | New file: StrengthWorkoutView component |

---

## Verification

- `bun run build` passes (TypeScript clean)
- `bun run test` passes
- Manual smoke: start a strength workout, start an event workout, finish to summary -- all three paths render correctly
- No behavior change: all state, handlers, and effects remain in the route component

---

## Risks

- Props list for `StrengthWorkoutView` is large (~20 props). This is acceptable since it's a view component, not an abstraction; the state stays hoisted in the route. If prop count feels unwieldy, consider a single context-bag object type.
- The `SetType` and `LoggedActivityGroupWithActivities` imports move into the new files; verify they re-export correctly from their domain modules.
