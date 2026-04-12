# ADR-021-04: Extract `ExercisePickerPanel` for reuse

**Status:** Proposed
**Date:** 2026-04-11
**Feature:** 021 -- Template Builder Route

## Context

`AddExerciseSheet` is used in four places. Only one is in scope (the activity editor inside the template form). The other three are in the live workout logging flow and the program builder's session edit sheet. The new `ExercisePickerDrawer` needs the same search/selection UX without duplicating the component or disturbing existing consumers.

## Decision

Extract the headless inner UI into `src/components/workout/exercise-picker-panel.tsx`. Both `AddExerciseSheet` (existing, untouched consumers) and `ExercisePickerDrawer` (new, template route) render the same panel.

## Alternatives Considered

- Duplicate the picker logic into the new drawer component. Rejected: two copies of the same search/filter/selection code guarantees divergence.
- Refactor every `AddExerciseSheet` consumer to the new drawer in one pass. Rejected: out of scope for F021 and carries regression risk for `log.$workoutId.tsx`, `manual-workout-form.tsx`, and `program-builder/session-edit-sheet.tsx`.

## Consequences

- Consistent search UX across every exercise-picking surface.
- No regression risk for `log.$workoutId.tsx`, `manual-workout-form.tsx`, or `program-builder/session-edit-sheet.tsx`.
- The extraction is mechanical: move the JSX body and state into the panel, keep the sheet as a thin wrapper.
