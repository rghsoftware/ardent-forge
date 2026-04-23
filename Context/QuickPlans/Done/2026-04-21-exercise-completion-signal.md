# Quick Plan: Exercise Completion Signal

**Created:** 2026-04-21
**Source:** Backlog -- "Exercise completion signal" (Ideas.md)

---

## Task

Resolve two related UX gaps in the strength workout logger:

1. **"Done with this exercise" affordance** -- Users need a discoverable way to mark an exercise block finished before all planned sets are complete.
2. **Trailing set ambiguity** -- The auto-populated pending input row looks identical to a confirmed set row. Users can't tell if exiting/finishing will save or discard it.

---

## Context (from code exploration)

| Finding | Detail |
|---|---|
| Done button | `ExerciseBlock` already renders a "Done" button when `onSkipExercise` prop is provided (`exercise-block.tsx:208-228`). `StrengthWorkoutView` wires `handleMarkDone` → `skipActivity` which adds the activity ID to `skippedActivityIds`. Block then collapses. Users can re-expand via expand button. |
| Pending row rendering | A pending input row renders in `strength-workout-view.tsx:331-376` when (a) no confirmed sets exist yet, OR (b) `pendingInputs[activity.id]` is `true` (set by "Add set" button). |
| Trailing row on finish | `handleFinish` (log.$workoutId.tsx:280-338) clears `pendingInputs` before calling `finishWorkout()`. The unconfirmed row is discarded -- never persisted. No DB overcounting. |
| Discoverability gap | The "Done" button is at the bottom of an expanded exercise block. On a long exercise block with many sets, it may be below the fold on mobile. No visual cue distinguishes a pending (unconfirmed) input row from confirmed set rows except that it has editable fields. |

**Net scope:** Gap 1 is largely solved at the code level -- the wiring exists. The work is UX polish: ensure the Done button is discoverable. Gap 2 needs a pending-row visual indicator and/or a finish-time guard when the user has typed values into a pending row.

---

## Goal

- Done button is clearly discoverable and accessible without scrolling on typical exercise blocks.
- Pending input rows are visually distinct from confirmed set rows so users know they are "not yet logged."
- If a user hits Finish with a non-empty pending row (weight or reps typed), surface a confirmation or auto-discard notice so nothing is silently lost.

---

## Approach

### 1. Pending row visual indicator (`exercise-block.tsx` + `set-row.tsx`)

Add a visual "PENDING" or "UNLOGGED" state to the pending input row:

- Add an `isPending?: boolean` prop to `SetRow`.
- When `isPending` is true, render the row with a muted/dimmed style (e.g., `opacity-60` or `bg-surface-pit/40`) and a small ALL-CAPS label (`PENDING` or `IN PROGRESS`) in the status column instead of the confirm checkmark column.
- Pass `isPending={true}` to the `SetRow` rendered for the pending input in `strength-workout-view.tsx:370-376`.

This makes it immediately obvious which row is "not yet logged."

### 2. Finish-time guard for non-empty pending rows (`strength-workout-view.tsx` + `log.$workoutId.tsx`)

In `handleFinish` (log.$workoutId.tsx:280), before clearing `pendingInputs`, check if any activity has a pending row with non-empty weight or reps. If so, surface a brief confirmation dialog or toast: "You have an unconfirmed set -- it won't be saved. Finish anyway?"

Implementation detail:
- `pendingInputs` is a `Record<activityId, boolean>` -- it only tracks whether to show the row, not the current input values.
- The actual weight/reps input values live in local state inside each `SetRow` component, making them inaccessible from `handleFinish`.
- **Simpler approach:** Lift a `pendingSetValues` map (activityId → `{weight, reps}`) up to `StrengthWorkoutView` state, updated on every input change via a callback prop on `SetRow`. Then `handleFinish` can inspect it.
- If lifting state is too invasive, use a ref-based approach: a `pendingHasValues` Set stored in a ref, updated via an `onPendingChange` callback from `SetRow`.

### 3. Done button discoverability (`exercise-block.tsx`)

The "Done" button is already rendered at block bottom (line 208-228). Evaluate if it needs a sticky or pinned position when the block is long. Options:
- Keep current position (bottom of block) -- acceptable if most blocks have ≤ 5 sets.
- Add a secondary collapsed-header affordance: a small "DONE" badge/button in the exercise block header row that dismisses without scrolling.

Recommendation: Start with option A (no change to position, verify in app). Only add header affordance if gym-floor testing shows it's hard to reach.

---

## Files to Touch

| File | Change |
|---|---|
| `src/components/workout/set-row.tsx` | Add `isPending?: boolean` prop; conditional dim + PENDING label in status column |
| `src/components/workout/exercise-block.tsx` | Pass `isPending` to the pending `SetRow`; optionally expose `onPendingChange` callback |
| `src/routes/_authenticated/log.$workoutId/strength-workout-view.tsx` | Track `pendingSetValues` state; pass `isPending` and `onPendingChange` to relevant rows |
| `src/routes/_authenticated/log.$workoutId.tsx` | Guard in `handleFinish`: if any pending row has values, show confirmation before finishing |

---

## Verification

- [ ] Pending input row is visually distinct from confirmed rows (muted styling + PENDING label visible)
- [ ] Confirming a set clears the PENDING state and shows the row as confirmed
- [ ] Finishing with a non-empty pending row shows a confirmation prompt
- [ ] Finishing with an empty pending row finishes immediately (no false positive prompt)
- [ ] Done button collapses the exercise block and it appears in collapsed/done state
- [ ] Collapsed block can be re-expanded to add more sets
- [ ] No regressions in set confirmation or workout finish flow

---

## Risks

- **Lifting pending values state** could be moderately invasive if `SetRow` doesn't currently support callbacks for every keystroke. Check current `SetRow` props and local state before deciding between lifted state vs ref approach.
- **False positive guard triggers** if the empty pending row pre-fills with prescribed weight/reps. Guard should check if values differ from the initial pre-filled defaults, OR check if the user has actually interacted with the row (dirty flag).

---

## Execution

`/impl` -- moderate scope, 3-4 files, no cross-stack coordination needed.
