# Quick Plan: Undo "Done" Status on a Set

**Date:** 2026-04-12
**Branch:** feat/workout-set-ux

---

## Task

Allow users to un-confirm (undo "done") a set at any time during an active workout -- not just within the 10-second undo window.

## Goal

Tapping the done indicator on a confirmed `SetRow` removes the set from the logged activity, restores the row to its editable state with the previously entered values, and deletes the persisted record from the database.

## Context

- `SetRow` (`src/components/workout/set-row.tsx:29`): `confirmed` prop drives read-only state; done indicator is currently a static badge/icon -- not interactive.
- `ExerciseBlock` (`src/components/workout/exercise-block.tsx:36`): renders `SetRow` per set, owns the `onConfirmSet` wiring.
- Store (`src/stores/active-workout-store.ts`): `confirmSet` appends to `activity.sets`; `undoLastSet` removes the last set but only within a 10s window via `UndoAction`. No persistent un-confirm action exists.
- Route (`src/routes/_authenticated/log.$workoutId.tsx`): handles `onConfirmSet` and likely calls the DB adapter. Un-confirm will need a parallel path to delete the persisted set.

## Approach

### 1. Store -- add `unconfirmSet`

Add `unconfirmSet(loggedActivityId: string, setId: string): void` to `ActiveWorkoutActions`:

```ts
unconfirmSet(loggedActivityId: string, setId: string) {
  set((prev) => ({
    loggedGroups: prev.loggedGroups.map((group) => ({
      ...group,
      activities: group.activities.map((activity) => {
        if (activity.id !== loggedActivityId) return activity
        return { ...activity, sets: activity.sets.filter((s) => s.id !== setId) }
      }),
    })),
  }))
  _publishCurrentState()
}
```

### 2. SetRow -- make the done indicator tappable

Add `onUnconfirm?: () => void` to `SetRowProps`. Replace the static done indicator with a tappable button:

```tsx
<button
  type="button"
  onClick={onUnconfirm}
  className="flex min-h-12 min-w-12 items-center justify-center ..."
  aria-label={`Undo set ${setNumber}`}
>
  {/* existing variance icon / DONE badge */}
</button>
```

Keep the visual appearance identical -- only the wrapping element changes.

### 3. ExerciseBlock -- wire `onUnconfirm`

Add `onUnconfirmSet?: (loggedActivityId: string, setId: string) => void` to `ExerciseBlockProps`. Pass it through to each `SetRow` as `onUnconfirm`.

### 4. Route -- handle `onUnconfirmSet`

In `log.$workoutId.tsx`, add a handler alongside `handleConfirmSet`:

```ts
const handleUnconfirmSet = async (loggedActivityId: string, setId: string) => {
  useActiveWorkoutStore.getState().unconfirmSet(loggedActivityId, setId)
  await db.deleteLoggedSet(setId)  // adapter call -- mirrors existing delete path
}
```

Pass `handleUnconfirmSet` down to `ExerciseBlock`.

## Verification

- [ ] Tapping a done indicator on any set (not just the last one) restores it to editable state
- [ ] Previously entered weight/reps values are pre-filled after un-confirm (from `initialWeight`/`initialReps` props -- these come from the set's stored data and remain populated since we filter the set out rather than modify it; the parent will re-derive a fresh empty row or carry-forward)
- [ ] The database record is deleted (adapter call succeeds; no orphaned row)
- [ ] The existing 10-second undo toast / `undoLastSet` flow is unaffected
- [ ] Touch target is >= 48px (gym-floor usability)
- [ ] Works correctly for bodyweight sets (no weight field)

## Risks

- **Pre-fill state after un-confirm**: SetRow initializes weight/reps from `initialWeight`/`initialReps`. Once the set is removed from the store, the parent renders a fresh row with carry-forward values from the *previous* set (or empty). Verify this matches expected behavior -- users may want to see their prior values back. If not, carry-forward from the deleted set's data before filtering it out.
- **DB adapter `deleteLoggedSet`**: Confirm this exists in both `supabase-adapter.ts` and `tauri-adapter.ts`. If it doesn't, it needs to be added to `DatabaseAdapter` interface and both implementations.
- **Exercise completion signal**: The branch already has exercise completion signal work (`feat/workout-set-ux`). Un-confirming the last set of an exercise should re-open the exercise as incomplete -- confirm the completion signal reactivity handles this automatically.
