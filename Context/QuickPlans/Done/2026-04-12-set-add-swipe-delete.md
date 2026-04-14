# Quick Plan: Explicit ADD SET + Swipe-to-Delete

**Branch:** `feat/exercise-completion-signal` (extend current branch)
**Date:** 2026-04-12
**Source:** UX feedback on exercise completion signal

---

## Task

Two UX improvements to the strength exercise block:

1. Replace the ambiguous auto-trailing row with an explicit **ADD SET** button. Users tap it to reveal an input row; intent is unambiguous.
2. Add **swipe-to-delete** on set rows so athletes can remove a set without using Undo.

Keep the existing "Done with this exercise" skip functionality.

---

## Goal

- No set row appears automatically. User explicitly taps ADD SET to get an input row.
- Swipe left on any set row to reveal a DELETE button. Works for both confirmed and pending rows.
- Footer: ADD SET on the left, DONE on the right (only when `confirmedSets.length > 0`).

---

## Approach

### 1. Store: `deleteSet` action

**File:** `src/stores/active-workout-store.ts`

Add to `ActiveWorkoutActions`:
```ts
deleteSet(loggedActivityId: string, setId: string): void
```

Implementation -- remove the set from the activity, clear undoAction if it references the deleted set:
```ts
deleteSet(loggedActivityId: string, setId: string) {
  if (!loggedActivityId || !setId) {
    console.warn('[active-workout] deleteSet called with missing ids')
    return
  }
  set((state) => ({
    loggedGroups: state.loggedGroups.map((group) => ({
      ...group,
      activities: group.activities.map((activity) => {
        if (activity.id !== loggedActivityId) return activity
        return { ...activity, sets: activity.sets.filter((s) => s.id !== setId) }
      }),
    })),
    undoAction: state.undoAction?.setId === setId ? null : state.undoAction,
  }))
},
```

### 2. Route: remove auto-trailing row, track pending input rows

**File:** `src/routes/_authenticated/log.$workoutId.tsx`

Add local state:
```ts
const [pendingInputs, setPendingInputs] = useState<Record<string, boolean>>({})
```

`pendingInputs[activityId] = true` means "show one input row for this activity".

Remove the entire `setRows.push({ id: 'pending-...', ... })` block.

Instead, when rendering setRows, append a pending row only if `pendingInputs[activity.id]`:
```ts
if (pendingInputs[activity.id]) {
  setRows.push({
    id: `pending-${activity.id}-${nextSetNumber}`,
    setNumber: nextSetNumber,
    weight: lastConfirmedSet?.actualWeight?.value?.toString()
      ?? nextPrescribedWeight?.value?.toString(),
    reps: lastConfirmedSet?.actualReps?.toString()
      ?? (nextPrescribedReps != null ? String(nextPrescribedReps) : undefined),
    confirmed: false,
    prescribedWeight: nextPrescribedWeight,
    prescribedReps: nextPrescribedReps,
    isPending: true,
  })
}
```

When a set is confirmed (`handleConfirmSet`), clear `pendingInputs[activityId]`:
```ts
setPendingInputs((prev) => ({ ...prev, [loggedActivityId]: false }))
```

Wire `onAddSet`:
```tsx
onAddSet={() => setPendingInputs((prev) => ({ ...prev, [activity.id]: true }))}
```

Wire `onDeleteSet`:
```tsx
onDeleteSet={(setId) => deleteSet(activity.id, setId)}
```

Pull `deleteSet` from the store alongside `skipActivity`.

### 3. `ExerciseBlock`: ADD SET + DONE footer

**File:** `src/components/workout/exercise-block.tsx`

Add props:
```ts
onAddSet?: () => void
onDeleteSet?: (setId: string) => void
```

Pass `onDeleteSet` down to each `SetRow`:
```tsx
onDelete={onDeleteSet ? () => onDeleteSet(set.id) : undefined}
```

Replace the current single-button footer with a two-button row:
```tsx
{isActive && (onAddSet || onSkipExercise) && (
  <div className="flex px-4 pb-3 pt-1">
    {onAddSet && (
      <button
        type="button"
        onClick={onAddSet}
        className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60
                   transition-colors hover:text-warm-ash active:text-ember"
      >
        Add set
      </button>
    )}
    {onSkipExercise && (
      <button
        type="button"
        onClick={onSkipExercise}
        className="flex-1 py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60
                   transition-colors hover:text-warm-ash active:text-ember"
      >
        Done
      </button>
    )}
  </div>
)}
```

Iron & Ember: no border between them, no rounding -- tonal separation via spacing only.

### 4. `SetRow`: swipe-to-delete

**File:** `src/components/workout/set-row.tsx`

Add prop: `onDelete?: () => void`

Track swipe state:
```ts
const [swipeX, setSwipeX] = useState(0)
const [isSwiping, setIsSwiping] = useState(false)
const touchStartX = useRef(0)
const SWIPE_THRESHOLD = 64 // px
```

Touch handlers on the outermost div:
```ts
onTouchStart={(e) => {
  touchStartX.current = e.touches[0].clientX
  setIsSwiping(false)
}}
onTouchMove={(e) => {
  const delta = touchStartX.current - e.touches[0].clientX
  if (delta > 0) {
    setSwipeX(Math.min(delta, SWIPE_THRESHOLD))
    setIsSwiping(true)
  }
}}
onTouchEnd={() => {
  if (swipeX >= SWIPE_THRESHOLD) {
    // hold open -- don't snap back, show DELETE
  } else {
    setSwipeX(0)
    setIsSwiping(false)
  }
}}
```

Layout: wrap the existing row content in a relative container with a DELETE button revealed by translateX:
```tsx
<div className="relative overflow-hidden">
  {/* Delete button behind the row */}
  {onDelete && (
    <button
      onClick={() => { onDelete(); setSwipeX(0) }}
      className="absolute right-0 top-0 h-full w-16 bg-red-700 text-xs font-bold
                 uppercase tracking-widest text-bone-white"
      aria-label="Delete set"
    >
      DEL
    </button>
  )}
  {/* Row slides left to reveal delete */}
  <div
    style={{ transform: `translateX(-${swipeX}px)`, transition: isSwiping ? 'none' : 'transform 200ms' }}
    className={cn('flex items-center gap-2 px-4 py-1', isPending && 'opacity-40')}
    onTouchStart={...}
    onTouchMove={...}
    onTouchEnd={...}
  >
    {/* existing row content */}
  </div>
</div>
```

Tapping anywhere outside the DELETE button (or swiping back right) snaps the row closed.

---

## Files Touched

| File | Change |
|------|--------|
| `src/stores/active-workout-store.ts` | Add `deleteSet` action |
| `src/components/workout/exercise-block.tsx` | Add `onAddSet`, `onDeleteSet` props; two-button footer |
| `src/components/workout/set-row.tsx` | Add `onDelete` prop + swipe-to-reveal gesture |
| `src/routes/_authenticated/log.$workoutId.tsx` | Track `pendingInputs`, wire `onAddSet`/`onDeleteSet`, clear pending on confirm |

---

## Verification

- [ ] No input row shown on exercise load -- requires explicit ADD SET tap.
- [ ] Tapping ADD SET reveals one input row with carry-forward values.
- [ ] Confirming a set clears the input row (user must tap ADD SET again for next set).
- [ ] Footer shows ADD SET + DONE side by side when `confirmedSets.length > 0`.
- [ ] Footer shows ADD SET only (no DONE) before any sets are confirmed.
- [ ] Swipe left on any set row reveals DEL button.
- [ ] Tapping DEL removes the set; confirmed sets removed from store.
- [ ] Swipe right (or release before threshold) snaps row back closed.
- [ ] `bun run build` passes with no TypeScript errors.

---

## Risks

- **Programmed workouts with initial prescription**: The first time the exercise loads there is no confirmed set, so ADD SET carries no pre-filled weight/reps. User sees empty inputs. This is acceptable -- they see the prescribed values in the PRESCRIBED column.
- **Delete + Undo interaction**: Deleting a confirmed set clears the undoAction if it matches. The Undo banner disappears. This is correct -- undo was for that set.
- **Multiple pending rows**: Design limits to one pending row per activity (`pendingInputs` is boolean). A second ADD SET tap while a pending row is already visible is a no-op (already true). This prevents stacking empty rows.
