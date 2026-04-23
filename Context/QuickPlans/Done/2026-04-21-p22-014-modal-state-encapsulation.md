# P22-014: Move View-Local Modal State into StrengthWorkoutView

**Date:** 2026-04-21
**Scope:** Refactor (2 files)
**Source:** P22 review finding from PR #115

---

## Task

Move `showAddExercise`, `showDiscardDialog`, and `pageError` state from the parent route
(`ActiveWorkoutPage`) into `StrengthWorkoutView`, where they are exclusively consumed.

---

## Goal

Reduce prop-threading in `ActiveWorkoutPage`. These three state pairs are UI concerns
internal to `StrengthWorkoutView` -- the parent has no reason to own or read them.
The component's prop interface shrinks from 43 to 37 props after removal.

---

## Approach

### 1. Add local state to `StrengthWorkoutView`

In `strength-workout-view.tsx`, add three `useState` declarations:

```tsx
const [showAddExercise, setShowAddExercise] = useState(false)
const [showDiscardDialog, setShowDiscardDialog] = useState(false)
const [pageError, setPageError] = useState<string | null>(null)
```

### 2. Remove the six props from `StrengthWorkoutViewProps`

Delete from the interface:
- `showAddExercise: boolean`
- `setShowAddExercise: (v: boolean) => void`
- `showDiscardDialog: boolean`
- `setShowDiscardDialog: (v: boolean) => void`
- `pageError: string | null`
- `setPageError: (v: string | null) => void`

### 3. Clean up `log.$workoutId.tsx`

- Remove the three `useState` declarations (lines 113-114, 116) from `ActiveWorkoutPage`
- Remove the six prop assignments from the `<StrengthWorkoutView ... />` JSX (lines 549-554)
- Verify `showSummary` and `restMinimized` are untouched (they remain at parent level)

---

## Verification

- `bun run build` passes (TypeScript confirms prop interface is clean)
- `bun run lint` passes
- Manual smoke test: open an active strength workout, add an exercise, trigger discard dialog, verify both modals open/close correctly and page errors surface as before

---

## Risks

- `pageError` is set in several places inside `StrengthWorkoutView` (lines 147, 292, 325, 410, 419) -- all internal, so no external setter call sites should remain after removal. Confirm with a grep for `setPageError` in `log.$workoutId.tsx` after the change.
- `restMinimized` is a candidate for the same treatment but has been intentionally deferred -- do not include it in this task.
