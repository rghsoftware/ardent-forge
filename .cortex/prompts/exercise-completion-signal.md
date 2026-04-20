# Task: Exercise Completion Signal

You are **builder**, a frontend specialist implementing the exercise completion signal feature for the Ardent Forge workout logger. This is a moderate, 4-file change with a clear spec. Read all context carefully before writing any code.

---

## Feature Context

Two UX gaps in the workout logger (strength path only):

1. No way to explicitly mark an exercise block as done when stopping short of planned sets.
2. The trailing auto-populated set row looks identical to a confirmed set -- users can't tell it won't be saved until they act.

**Goals:**
- Athlete can tap "DONE" on an exercise block to skip remaining sets and advance focus to the next exercise.
- Trailing unconfirmed set row is visually distinct (dimmed/ghosted) so its "not yet saved" state is unambiguous.

**Constraints:**
- Skip is purely local (no Supabase persistence). Sets logged before skipping are still saved.
- `confirmedSets.length > 0` guard: button only appears after at least one set is confirmed -- prevents fat-finger skip before any work begins.
- Strength path only -- cardio, ruck, circuit blocks are unaffected (no `onSkipExercise` prop passed).
- Iron & Ember design rules: no border-radius, no dividers, secondary text style for DONE button.

---

## Project Conventions (critical, from CLAUDE.md + rules)

- **Error handling:** Never use bare `catch {}`. Always `catch (err)` with `console.error('[module-name] ...')`.
- **State management:** Zustand stores validate at their own boundary; log on invalid input rather than silently ignoring.
- **TypeScript:** Use `satisfies` not explicit annotations for Record constants. No `any`.
- **Styling:** Tailwind only, Dark-only Iron & Ember. No border-radius (`rounded-*`). No divider lines (`border-t/b/l/r border-surface-*`). Tonal depth for separation. ALL-CAPS for badges/nav/labels (not headings/buttons/copy).
- **No em dashes ever.** Use regular dashes.

---

## File 1: `src/stores/active-workout-store.ts`

**Current state** (646 lines):
- `ActiveWorkoutState` interface at line ~56
- `ActiveWorkoutActions` interface at line ~110
- `initialState` const at line ~155
- `finishWorkout` at line ~218 -- calls `set({ ...initialState })`
- `discardWorkout` at line ~245 -- calls `set({ ...initialState })`

**Changes required:**

### 1a. Add to `ActiveWorkoutState` interface (after `pauseTimingError`):
```ts
skippedActivityIds: Set<string>
```

### 1b. Add to `ActiveWorkoutActions` interface (in Exercise management section):
```ts
skipActivity(activityId: string): void
```

### 1c. Add to `initialState`:
```ts
skippedActivityIds: new Set<string>(),
```

### 1d. Add `skipActivity` implementation in the store (place it in the Exercise management section, after `addExerciseToWorkout`):
```ts
skipActivity(activityId: string) {
  if (!activityId) {
    console.warn('[active-workout] skipActivity called with empty activityId')
    return
  }
  set((state) => ({
    skippedActivityIds: new Set([...state.skippedActivityIds, activityId]),
  }))
},
```

### 1e. `finishWorkout` and `discardWorkout` both reset via `set({ ...initialState })` -- since `initialState` now has `skippedActivityIds: new Set()`, this reset is automatic. No additional change needed in those two functions.

---

## File 2: `src/components/workout/exercise-block.tsx`

**Current state** (151 lines):
- `SetRowData` interface (lines 10-18)
- `ExerciseBlockProps` interface (lines 20-36)
- `ExerciseBlock` function component (lines 38-151)
- Footer of the component is the `<div className="flex flex-col gap-[0.4rem]">` set list, then the closing `</section>`

**Changes required:**

### 2a. Add to `ExerciseBlockProps`:
```ts
onSkipExercise?: () => void
```

### 2b. Add `onSkipExercise` to the destructured props of `ExerciseBlock`.

### 2c. Add the DONE button AFTER the `<div className="flex flex-col gap-[0.4rem]">` set list div, BEFORE the closing `</section>`:
```tsx
{onSkipExercise && isActive && (
  <div className="px-4 pb-3 pt-1">
    <button
      type="button"
      onClick={onSkipExercise}
      className="w-full py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60 transition-colors hover:text-warm-ash active:text-ember"
    >
      Done with this exercise
    </button>
  </div>
)}
```

Iron & Ember: no border, no rounding. This is a secondary affordance that must not compete with the confirm-set CTA.

### 2d. Pass `isPending` to SetRow. In the `sets.map((set) => ...)` call, add the prop:
```tsx
isPending={!set.confirmed && set.id.startsWith('pending-')}
```

**Note:** `SetRow` currently does not accept `isPending`. You will add it in File 3 first. The prop flow is: route builds `setRows` with `id: 'pending-{activityId}-{n}'` for the trailing row, ExerciseBlock passes `isPending` down to SetRow.

---

## File 3: `src/components/workout/set-row.tsx`

**Current state** (275 lines):
- `SetRowProps` interface (lines 11-27)
- `SetRow` function (lines 29-275)
- The outermost element is `<div className="flex items-center gap-2 px-4 py-1">`

**Changes required:**

### 3a. Add to `SetRowProps` (with the existing JSDoc-style comment pattern):
```ts
/**
 * When true, the row represents an unconfirmed placeholder (the auto-populated
 * next-set row). Renders dimmed to distinguish it from confirmed sets.
 */
isPending?: boolean
```

### 3b. Add `isPending = false` to the destructured props of `SetRow`.

### 3c. Wrap the outermost `<div>` with an `opacity-40` class when `isPending` is true. The cleanest way: use the `cn()` utility (already imported via `@/lib/utils`... actually check imports -- if `cn` is not imported, add it). Change the outermost div to:
```tsx
<div className={cn('flex items-center gap-2 px-4 py-1', isPending && 'opacity-40')}>
```

**Note:** `cn` is not currently imported in set-row.tsx. Add the import: `import { cn } from '@/lib/utils'`

### 3d. In the STATUS column (the last `<div className="flex w-14 shrink-0 items-center justify-center">`) -- when `isPending` is true, render nothing (or a very faint dash) instead of the confirm button. This makes the intent clear: no action available on the pending row:
```tsx
<div className="flex w-14 shrink-0 items-center justify-center">
  {isPending ? (
    <span className="text-warm-ash/20 text-xs">--</span>
  ) : confirmed ? (
    variance === 'met' ? (
      <Icon name="check_circle" size={22} className="text-green-500" />
    ) : variance === 'under' ? (
      <Icon name="arrow_downward" size={22} className="text-amber-500" />
    ) : (
      <Badge variant="complete">DONE</Badge>
    )
  ) : (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={
        isConfirming ||
        confirmed ||
        (isBodyweight ? !reps.trim() : !weight.trim() && !reps.trim())
      }
      className="flex min-h-12 min-w-12 items-center justify-center text-ember transition-colors hover:text-forge disabled:opacity-40"
      aria-label={`Confirm set ${setNumber}`}
    >
      {isConfirming ? (
        <span className="text-xs uppercase tracking-wider text-warm-ash">...</span>
      ) : (
        <Icon name="check" size={24} />
      )}
    </button>
  )}
</div>
```

---

## File 4: `src/routes/_authenticated/log.$workoutId.tsx`

**Current state** (773 lines):
- `skippedActivityIds` is NOT yet pulled from the store
- `activeFocusId` useMemo at line ~250 -- loops `loggedGroups`, returns first activity with incomplete sets
- ExerciseBlock render at line ~640 -- currently always renders when `activity.id === activeFocusId`
- `setRows.push(...)` for the trailing pending row at line ~685

**Changes required:**

### 4a. Pull `skipActivity` from the store (add alongside the existing store destructures near the top of `ActiveWorkoutPage`):
```ts
const skipActivity = useActiveWorkoutStore((s) => s.skipActivity)
const skippedActivityIds = useActiveWorkoutStore((s) => s.skippedActivityIds)
```

### 4b. Update the `activeFocusId` useMemo to treat skipped activities as done. Change the dependency array to include `skippedActivityIds`, and add a skip check in the inner loop:

Current inner loop (non-circuit path):
```ts
for (const activity of group.activities) {
  lastId = activity.id
  if (activity.sets.length === 0 || activity.sets.some((s) => !s.completed)) {
    return activity.id
  }
}
```

New inner loop:
```ts
for (const activity of group.activities) {
  lastId = activity.id
  if (skippedActivityIds.has(activity.id)) continue  // treat as done
  if (activity.sets.length === 0 || activity.sets.some((s) => !s.completed)) {
    return activity.id
  }
}
```

Update the dependency array: `}, [loggedGroups, skippedActivityIds])`

### 4c. In the strength path ExerciseBlock render section, add a guard before the `if (activity.id !== activeFocusId) return null` check:
```tsx
// Guard: skipped activities never render
if (skippedActivityIds.has(activity.id)) return null
// Hard focus: only render the active activity in SET mode.
if (activity.id !== activeFocusId) return null
```

### 4d. Wire `onSkipExercise` on the `<ExerciseBlock>` component. The ExerciseBlock is rendered at the bottom of the strength path. Add the prop:
```tsx
onSkipExercise={
  confirmedSets.length > 0 ? () => skipActivity(activity.id) : undefined
}
```

`confirmedSets` is already computed just above the ExerciseBlock render:
```ts
const confirmedSets = activity.sets.filter((s) => s.completed)
```

### 4e. The trailing pending row already uses `id: \`pending-${activity.id}-${nextSetNumber}\`` -- no change needed to `setRows.push(...)` for the id. However, `SetRowData` interface (exported from `exercise-block.tsx`) needs a `isPending?: boolean` field added to it so the route can pass it.

Add `isPending?: boolean` to the `SetRowData` interface in `exercise-block.tsx`.

Then in the route's `setRows.push(...)` call, add `isPending: true` to the trailing row object:
```ts
setRows.push({
  id: `pending-${activity.id}-${nextSetNumber}`,
  setNumber: nextSetNumber,
  weight: ...,
  reps: ...,
  confirmed: false,
  prescribedWeight: nextPrescribedWeight,
  prescribedReps: nextPrescribedReps,
  isPending: true,
})
```

---

## Coordination

When you finish ALL tasks, run:
```bash
bun run .claude/hooks/event-log/event-log.ts append --source builder --type task_done --task all
```

Then run `bun run build` and report TypeScript errors if any.

Mark all 4 Cortex tasks (IDs 1-4) as completed via TaskUpdate when done.

---

## Verification Checklist

After implementing, confirm:
- [ ] `bun run build` passes with no TypeScript errors
- [ ] `skippedActivityIds` initializes as `new Set()` and resets on finish/discard
- [ ] `onSkipExercise` only passes when `confirmedSets.length > 0`
- [ ] DONE button renders below the set list, only when `isActive && onSkipExercise`
- [ ] Trailing set row has `opacity-40` and `--` placeholder in STATUS column
- [ ] Cardio, ruck, circuit blocks have no `onSkipExercise` prop (check their renders)
- [ ] `activeFocusId` memo includes `skippedActivityIds` in its dep array

Think carefully before editing. Read each file section again before modifying. Use the Edit tool for targeted changes, not full rewrites.
