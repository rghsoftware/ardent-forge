# Feature 023: Exercise Completion Signal During Active Workout

## Overview

Athletes sometimes finish an exercise before all programmed sets are complete --
due to injury, hitting an RPE ceiling, or time constraints. Currently the workout
logger provides no explicit "done with this exercise" affordance, and trailing
auto-populated set rows create ambiguity about whether empty sets will be counted
or discarded when the workout is saved. This feature addresses both gaps.

## Problem Statement

**Gap 1 -- No completion affordance:** The only mechanism for moving past an
exercise is `skipActivity`, which requires at least one confirmed set and only
removes the exercise from the active-focus algorithm. It does not visually
collapse the block or surface any "marked done" state to the user. An athlete
who wants to signal "I'm finished with squats, move on" has no way to do so
clearly -- they can only remove the exercise entirely (losing the logged sets)
or ignore it and scroll past.

**Gap 2 -- Trailing set row ambiguity:** When the logger auto-populates the next
set input row, there is no visual distinction between an "incomplete" (pending)
row and a "confirmed" row. When the user exits the exercise block, navigates
away, or taps FINISH WORKOUT, it is unclear whether the empty pending row will
be silently discarded or saved as a zero-rep set. This causes volume uncertainty
on the gym floor where athletes cannot afford to second-guess their logs.

## User Stories

- As an athlete, I want to mark an exercise as done mid-workout so that I can
  clearly signal I am finished without removing my logged sets.
- As an athlete, I want the workout logger to automatically discard empty
  trailing set rows when I finish a workout so that I never accidentally log
  zero-rep sets.
- As an athlete, I want to see a distinct visual state on a completed exercise
  block so that I can confirm at a glance which exercises I have moved past.
- As an athlete with zero confirmed sets on an exercise, I want to mark it as
  done (or skip it entirely) so that I can move on even before logging a
  single set.

## Requirements

### Must Have

- A per-exercise "done" action that collapses the exercise block and marks it
  visually as completed, distinct from the active/pending state.
- The "done" action must be available regardless of how many sets have been
  confirmed (including zero confirmed sets), superseding the current gate on
  `skipActivity`.
- Marking an exercise done must discard any trailing pending (unconfirmed)
  input row for that exercise.
- Finishing the workout (FINISH WORKOUT) must automatically discard all
  trailing pending input rows across all exercises before saving.
- A completed exercise block must remain visible in the workout log (not
  hidden), collapsed to a compact summary showing the confirmed set count and
  exercise name.
- A completed exercise block must be expandable/re-openable so the athlete can
  add more sets if they change their mind.

### Should Have

- A brief haptic or visual tap-feedback on the "done" action to confirm the
  gesture registered (gym-floor usability).
- When all exercises in a workout are marked done, offer a prompt or visual
  nudge suggesting the athlete finish the workout.
- The completed state (collapsed block) is preserved if the athlete scrolls
  away and back within the same session.

### Won't Have (this iteration)

- Persisting the collapsed/expanded UI state across app restarts or page
  reloads -- collapsed state is ephemeral session UI only.
- Automatic exercise completion inference (e.g., auto-collapsing after N sets
  confirmed without user action).
- Partial-set logging (logging a set with zero reps as intentional) -- empty
  pending rows are always discarded.
- Circuit/AMRAP group-level "done" actions -- only straight-set activities in
  scope for this iteration.

## Testable Assertions

| ID    | Assertion                                                                                        | Verification                                                                              |
|-------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| A-001 | The "done" action is visible on an exercise block with zero confirmed sets.                      | Render ExerciseBlock with empty sets array; assert the done affordance is present.        |
| A-002 | The "done" action is visible on an exercise block with one or more confirmed sets.               | Render ExerciseBlock with one completed set; assert the done affordance is present.       |
| A-003 | Tapping "done" on an exercise with a trailing pending row removes the pending row immediately.   | Confirm one set, observe pending row auto-appended, tap done, assert pending row gone.    |
| A-004 | After tapping "done", the exercise block renders in a collapsed/completed visual state.          | Tap done; assert block collapses to summary view (set count + name visible).              |
| A-005 | A collapsed exercise block can be re-expanded to add further sets.                               | Tap done, then tap the collapsed block; assert full set input UI re-appears.              |
| A-006 | FINISH WORKOUT discards all pending (unconfirmed empty) rows before persisting.                  | Add exercise, auto-populate pending row, tap FINISH WORKOUT; assert no zero-rep sets saved. |
| A-007 | Confirmed sets on an exercise are not affected when tapping "done".                              | Confirm 2 sets, tap done; assert both confirmed sets are still present in the log.        |
| A-008 | `skippedActivityIds` in the store includes the activity ID after tapping "done".                 | Unit test: dispatch done action, assert `skippedActivityIds.has(activityId)`.             |

## Open Questions

- [x] Should the "done" affordance for zero-confirmed-set exercises behave like
  skip (remove from focus) or like remove (delete the activity entirely)?
  **Decision:** Keep the activity. Show "0 sets" in the collapsed summary so
  the athlete can treat it as a missed/failed exercise and choose to delete it
  manually if desired.
- [x] What is the exact collapsed layout?
  **Decision:** Single row -- exercise name + set count badge + expand chevron.
- [x] For the "all exercises done" nudge (Should Have): is a toast sufficient,
  or should it be a persistent banner above the FINISH WORKOUT button?
  **Decision:** Persistent banner above FINISH WORKOUT.

## Revision History

| Date       | Change       | ADR |
|------------|--------------|-----|
| 2026-04-15 | Initial spec | --  |
