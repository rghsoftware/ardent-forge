# Quick Plan: Inline Exercise Creation

**Date:** 2026-04-10

---

## Task

Allow users to create new exercises inline while adding an exercise to a workout or
template session -- without leaving the current context.

## Goal

When a user opens the exercise picker (`AddExerciseSheet`) and their search returns no
matches (or at any time), they can tap a "Create Exercise" CTA that opens the creation
form as a second sheet layer. On success, the newly created exercise is immediately
selected and added to the workout/template block -- no navigation required.

## Current State

- `CreateExerciseSheet` (`src/components/exercises/create-exercise-sheet.tsx`) exists
  but is only mounted in the Library (`library.tsx`) and Exercises index
  (`exercises/index.tsx`) routes.
- `AddExerciseSheet` (`src/components/workout/add-exercise-sheet.tsx`) is the exercise
  picker used in 4 contexts (workout logger, manual form, activity editor, session edit
  sheet). It has no path to creation.
- `CreateExerciseSheet` props: `{ open, onOpenChange }` -- no `onCreated` callback.

## Approach

### 1. Extend `CreateExerciseSheet` props

Add an optional `onCreated?: (exercise: Exercise) => void` callback.
In `onSubmit`, after `mutateAsync` resolves, call `onCreated(newExercise)` if provided.
`mutateAsync` must return the created `Exercise` -- verify `useCreateExercise` returns it;
if not, the hook needs a minor update.

**File:** `src/components/exercises/create-exercise-sheet.tsx`

### 2. Add inline creation to `AddExerciseSheet`

- Add local state: `createSheetOpen: boolean`
- Add a "Create exercise" footer button visible when:
  - Search query is non-empty AND results are empty ("No matches" state), **or**
  - Always visible as a secondary action at the bottom of the sheet
  - Preferred: show when query is non-empty and no results -- reduces noise, surfaces
    the option exactly when needed
- Mount `<CreateExerciseSheet>` inside the sheet with:
  - `open={createSheetOpen}`
  - `onOpenChange={setCreateSheetOpen}`
  - `onCreated={(exercise) => { onExerciseSelected(exercise, 'STRAIGHT_SETS'); onOpenChange(false) }}`
- Optionally pre-populate `name` from the current search query (good UX, saves retyping)
  -- pass `defaultName?: string` prop to `CreateExerciseSheet`.

**File:** `src/components/workout/add-exercise-sheet.tsx`

### 3. `useCreateExercise` return value check

Verify `src/hooks/use-exercises.ts::useCreateExercise` returns the created exercise from
`mutateAsync`. If it currently discards the return, update the mutation to pass it through.

**File:** `src/hooks/use-exercises.ts` (likely minor or no change needed)

## Files Changed

| File                                                                | Change                                         |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| `src/components/exercises/create-exercise-sheet.tsx`                | Add `onCreated` + optional `defaultName` props |
| `src/components/workout/add-exercise-sheet.tsx`                     | Embed `CreateExerciseSheet`, add "Create" CTA  |
| `src/hooks/use-exercises.ts`                                        | Verify/fix `mutateAsync` return type (minor)   |
| `src/components/exercises/__tests__/create-exercise-sheet.test.tsx` | Add test for `onCreated` callback              |

## Verification

- Search for an exercise that doesn't exist -> "No matches" state shows "Create exercise" button
- Tapping "Create exercise" opens the creation sheet; exercise name field is pre-filled
  with the search query
- Submitting the form closes both sheets and immediately adds the new exercise to the
  workout/block
- Existing Library flow still works (no regression: `onCreated` is optional)
- Works in all 4 `AddExerciseSheet` call sites: `activity-editor`, `manual-workout-form`,
  `session-edit-sheet`, `log.$workoutId`

## Risks

- `useCreateExercise` may not return the created exercise -- check the adapter layer
  (`supabase-adapter.ts::createExercise` and `tauri-adapter.ts::createExercise`) to
  confirm the return type matches `Exercise`
- Nested sheets (sheet-within-sheet) may have z-index or focus-trap conflicts on Android
  -- test on Tauri mobile after implementation
- If `CreateExerciseSheet` is stacked on top of `AddExerciseSheet`, the bottom sheet
  animation may look off; consider using a separate `Dialog` or `Sheet` that mounts at
  the root level (passed via portal) rather than nesting DOM elements
