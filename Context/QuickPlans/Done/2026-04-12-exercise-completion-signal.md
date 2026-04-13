# Quick Plan: Exercise Completion Signal

**Branch:** `feat/exercise-completion-signal`
**Date:** 2026-04-12
**Source:** Backlog -- Ideas.md "Exercise completion signal during active workout"

---

## Task

Two related UX gaps in the workout logger (strength path only):

1. No way to explicitly mark an exercise block as done when stopping short of planned sets.
2. The trailing auto-populated set row looks identical to a confirmed set, so users can't tell it won't be saved until they act.

---

## Goal

- Athlete can tap "DONE" on an exercise block to skip remaining sets and advance focus to the next exercise.
- Trailing unconfirmed set row is visually distinct (dimmed/ghosted) so its "not yet saved" state is unambiguous.

---

## Approach

### 1. Store: `skippedActivityIds` set

**File:** `src/stores/active-workout-store.ts`

Add `skippedActivityIds: Set<string>` to store state (default: empty).
Add `skipActivity(activityId: string): void` action that adds the id to the set.
Reset `skippedActivityIds` on `clearWorkout` / `discardWorkout`.

> Keep this purely local (no persistence to Supabase). A skipped exercise
> advances focus; the sets that were logged before skipping are still saved.

### 2. `activeFocusId` respects skipped activities

**File:** `src/routes/_authenticated/log.$workoutId.tsx`

Pull `skippedActivityIds` from the store alongside `loggedGroups`.

In the `activeFocusId` useMemo (line 250), treat a skipped activity the same as
one with all sets completed:

```ts
const skipped = useActiveWorkoutStore((s) => s.skippedActivityIds)
// In activeFocusId memo:
if (skippedActivityIds.has(activity.id)) continue  // treat as done
```

Also guard ExerciseBlock rendering: if `skippedActivityIds.has(activity.id)`
return null (don't render the block at all).

### 3. `ExerciseBlock` -- "DONE" footer button

**File:** `src/components/workout/exercise-block.tsx`

Add optional prop: `onSkipExercise?: () => void`.

When provided (and `isActive` is true), render a secondary action row below the
set list:

```tsx
{onSkipExercise && (
  <div className="px-4 pb-3 pt-1">
    <button
      onClick={onSkipExercise}
      className="w-full py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60
                 transition-colors hover:text-warm-ash active:text-ember"
    >
      Done with this exercise
    </button>
  </div>
)}
```

Iron & Ember rules: no border, no rounding, small secondary text -- does not
compete with the confirm-set CTA.

### 4. Wire `onSkipExercise` in route

**File:** `src/routes/_authenticated/log.$workoutId.tsx`

```tsx
const { skipActivity } = useActiveWorkoutStore()

<ExerciseBlock
  ...
  onSkipExercise={
    // Only show for strength blocks that have at least one confirmed set
    // (prevents accidental skip before any work is done)
    confirmedSets.length > 0 ? () => skipActivity(activity.id) : undefined
  }
/>
```

Guard with `confirmedSets.length > 0` so the button only appears after at least
one set is confirmed. This prevents a fat-finger skip before any work begins.

### 5. Trailing row visual treatment

**File:** `src/components/workout/set-row.tsx`

The route passes `id: 'pending-{activityId}-{n}'` for the trailing row. Add a
`isPending?: boolean` prop to `SetRow` and `SetRowData`.

When `isPending` is true:
- Dim the entire row: `opacity-40`
- No status icon in the STATUS column (or a faint dashed placeholder)

In `exercise-block.tsx`, mark the last row as pending when `!set.confirmed`:
```tsx
isPending={!set.confirmed && set.id.startsWith('pending-')}
```

This makes the intent obvious: the row exists as input affordance, not a logged set.

---

## Files Touched

| File | Change |
|------|--------|
| `src/stores/active-workout-store.ts` | Add `skippedActivityIds` + `skipActivity` + reset on clear |
| `src/components/workout/exercise-block.tsx` | Add `onSkipExercise` prop + DONE button |
| `src/components/workout/set-row.tsx` | Add `isPending` prop + opacity treatment |
| `src/routes/_authenticated/log.$workoutId.tsx` | Wire `onSkipExercise`, pull `skippedActivityIds`, update `activeFocusId` memo |

---

## Verification

- [ ] Tapping "DONE" on a strength block with >= 1 confirmed set advances focus to the next exercise.
- [ ] "DONE" button does not appear before any sets are confirmed on the block.
- [ ] Skipped activities do not re-render after being skipped.
- [ ] Trailing empty set row is visually dimmed vs. a confirmed row.
- [ ] Finishing the workout after a skip still saves all confirmed sets correctly.
- [ ] Cardio, ruck, and circuit blocks are unaffected (no `onSkipExercise` wired to them).
- [ ] Store resets on discard/finish -- no stale `skippedActivityIds` on next workout.
- [ ] `bun run build` passes with no TypeScript errors.

---

## Risks

- **Accidental skip guard**: The `confirmedSets.length > 0` guard mitigates fat-finger skips, but a user who logs one bad set and skips is harder to recover from. The undo affordance (already present) covers single-set rollback.
- **Programmed workouts**: For programmed workouts, skipping an exercise means the prescribed sets won't be logged. This is intentional -- athletes should be able to cut sets for injury/RPE reasons. No advancement-failure side effect because advancement is triggered by `finishWorkout`, not per-exercise completion.
- **`skippedActivityIds` type**: Using `Set<string>` in Zustand state requires care with persistence/devtools serialization. Since we are not persisting this to storage, a plain `Set` is fine. Alternatively use `string[]` + `.includes()` for simpler serialization.
