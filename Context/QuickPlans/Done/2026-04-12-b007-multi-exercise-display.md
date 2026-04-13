# Quick Plan: B007 — Active Workout Shows Only One Exercise

**Task:** Fix active workout showing only one exercise at a time; add support for repeated exercises and per-exercise deletion.

**Goal:** All exercises in the workout are visible simultaneously. The active exercise is visually foregrounded (already handled by `isActive` styling in `ExerciseBlock`). Completed exercises are shown in a dimmed read-only state. Repeated instances of the same exercise work naturally. Any exercise can be deleted at any time.

---

## Root Cause

`src/routes/_authenticated/log.$workoutId.tsx:607` — hard focus filter inside the `loggedGroups.map` render loop:

```tsx
// Hard focus: only render the active activity in SET mode.
if (activity.id !== activeFocusId) return null
```

This deliberately hides all non-active exercises. The `ExerciseBlock` component already has `isActive` prop support with visual differentiation (bg-surface-iron vs bg-surface-pit, ember vs ember/40), so the component is ready — the page is just not using it.

## Approach

**Three surgical edits in `log.$workoutId.tsx` only. No store changes needed.**

### Edit 1 — Remove hard focus filter (line 607)
```diff
- // Hard focus: only render the active activity in SET mode.
- if (activity.id !== activeFocusId) return null
```

### Edit 2 — Pass `isActive` correctly (currently hardcoded `true`)
```diff
- isActive={true}
+ isActive={activity.id === activeFocusId}
```

### Edit 3 — Gate pending input row to active exercise only
Currently adds a pending row whenever `confirmedSets.length === 0`. Without the filter, every future exercise (which has 0 confirmed sets) would get a pending input row.

```diff
- if (confirmedSets.length === 0 || pendingInputs[activity.id]) {
+ if (activity.id === activeFocusId && (confirmedSets.length === 0 || pendingInputs[activity.id])) {
```

## Out of scope

- **CIRCUIT groups**: The circuit path has a separate focus filter (`if (group.id !== activeFocusId) return null`). Leave that untouched — B007 describes strength blocks only.
- **Store changes**: `addExerciseToWorkout` already creates distinct groups per add-call, so repeated exercises already get unique IDs. The display fix alone is sufficient.
- **`onRemoveExercise`**: Already passed to `ExerciseBlock` for all activities. Once the filter is removed, delete is accessible for any exercise automatically.
- **`onAddSet` / `onSkipExercise`**: `ExerciseBlock` already gates these inside `{isActive && ...}`, so they auto-hide for non-active blocks. No change needed.
- **`onConfirmSet`**: Safe to pass to all blocks; non-active blocks have no pending row so confirm never fires for them.

## Verification

1. Start a free-form workout, add 3 different exercises → all 3 visible, first one active (ember title, bg-surface-iron)
2. Confirm all sets on exercise 1 → exercise 2 becomes active; exercise 1 remains visible in dimmed state (bg-surface-pit)
3. Add the same exercise twice → both instances visible, stacked one after the other
4. Delete button (trash icon) visible and functional on any exercise, not just the active one
5. Pending input row appears only under the active exercise
6. Add Set / Done buttons appear only under the active exercise

## Risks

- None material. The `ExerciseBlock` component was already designed for multi-state display; `isActive` styling was already wired. The hard focus filter was the only thing blocking it.
