# Tech Plan: Exercise Completion Signal During Active Workout

**Spec:** Context/Features/023-Exercise-Completion-Signal/Spec.md
**Stacks involved:** React/TypeScript (frontend only -- no backend, no Rust/Tauri, no DB changes)

## Architecture Overview

This feature is entirely UI and local state. No adapter, database, or Rust changes
are needed. The key building blocks already exist:

- `skippedActivityIds: Set<string>` in `ActiveWorkoutState` -- persisted for the
  lifetime of the active workout, reset on finish/discard
- `skipActivity(activityId)` in `ActiveWorkoutActions` -- already unguarded in the
  store (the `confirmedSets.length > 0` gate lives only in the route)
- `pendingInputs: Record<string, boolean>` -- local `useState` in
  `log.$workoutId.tsx`, controls the trailing input row per activity
- `ExerciseBlock` -- receives `onSkipExercise` prop today; needs a `isDone` and
  `onExpandToggle` prop for collapsed rendering

The feature adds two new concerns:
1. **Collapsed exercise UI** -- `ExerciseBlock` renders a single-row summary when
   `isDone=true`, expandable back to full set UI via a local expand override
2. **Pending row discard** -- clearing `pendingInputs` on mark-done and before
   `finishWorkout()`

---

## Key Decisions

### Decision 1: Where does "done/collapsed" state live?

**Options considered:**

- **Option A: `skippedActivityIds` (store) drives done; local `expandedActivityIds`
  overrides collapse in the route.**
  The store already carries "this activity has been explicitly moved past" semantics.
  A local `Set<string>` in the route tracks which done activities are currently
  expanded for re-editing. Clicking the expand chevron adds to the local set;
  tapping done removes from it and calls `skipActivity`. No new store state or
  actions needed.

- **Option B: New `doneActivityIds` store field, separate from `skippedActivityIds`.**
  Cleaner semantic split -- "skip from focus" vs "user-declared done" -- but
  doubles the Set fields, requires new store action, and the two sets would always
  contain the same members in practice.

- **Option C: Move all collapse state into `ExerciseBlock` local state.**
  Self-contained but the route needs to know which activities are done to derive
  `allActivitiesDone` for the banner. Requires lifting state or a callback, making
  the component harder to test in isolation.

**Chosen:** Option A

**Rationale:** `skippedActivityIds` already means "user has decided to move past
this exercise" -- that is exactly the done signal. Adding a local expand-override
Set in the route is the minimal surface for ephemeral collapse UI (the spec
explicitly says collapsed state is not persisted). No new store state or actions
required; the existing `skipActivity` is called with the gate removed.

**Related ADRs:** None directly. The `skippedActivityIds` field was introduced in
F018 (PR #109) as part of the gym-picker / UX overhaul.

---

### Decision 2: Pending row discard -- where does it live?

**Options considered:**

- **Option A: Clear `pendingInputs` in `handleMarkDone` and `handleFinish` in the
  route.** `pendingInputs` is already local `useState` in `log.$workoutId.tsx`.
  Mark-done clears the entry for that activity; finish clears all entries before
  calling `finishWorkout()`. No store changes.

- **Option B: Move `pendingInputs` into the store** so discard is co-located with
  `finishWorkout` / `discardWorkout` store actions.
  More atomic but `pendingInputs` is purely transient UI state (it controls
  whether an input row renders). Moving it to the store couples UI render decisions
  to the store, which the existing architecture deliberately avoids.

**Chosen:** Option A

**Rationale:** The spec classifies pending-row discard as a UI correctness fix, not
a data-integrity concern. The pending row is never persisted; it is purely a
"show the next input row" toggle. Clearing local React state in `handleMarkDone`
and `handleFinish` is the minimal, correct fix. Consistent with how pause UI state
(`restMinimized`) is handled in the same file.

---

### Decision 3: ExerciseBlock prop shape for done/collapsed

**Options considered:**

- **Option A: Add `isDone` + `onExpandToggle` props; keep `onSkipExercise` for
  the mark-done action.** The existing `onSkipExercise` prop is already wired
  end-to-end. Augmenting with `isDone: boolean` (collapsed render flag) and
  `onExpandToggle: () => void` (chevron tap) keeps the surface minimal and avoids
  a rename refactor.

- **Option B: Replace `onSkipExercise` with `onMarkDone`.** More semantically
  accurate name but a rename refactor with no functional benefit; the existing
  name is not publicly exported.

- **Option C: Merge done/expand into a single `doneState: 'active' | 'done-collapsed' | 'done-expanded'` prop.** Over-engineered for two boolean states.

**Chosen:** Option A

**Rationale:** Minimal API surface change. `isDone` is the collapsed render
trigger (derived from `skippedActivityIds` in the route). `onExpandToggle` is
called when the chevron is tapped. `onSkipExercise` continues to fire the
mark-done action. No rename, no interface churn.

---

## Stack-Specific Details

### React/TypeScript

**Files to create:**
- None

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/workout/exercise-block.tsx` | Add `isDone?: boolean` and `onExpandToggle?: () => void` props. When `isDone && !expanded`, render collapsed single-row summary (exercise name + confirmed-set-count badge + expand chevron). |
| `src/routes/_authenticated/log.$workoutId.tsx` | (1) Remove `confirmedSets.length > 0` gate on `onSkipExercise`. (2) Add `expandedDoneActivityIds: Set<string>` local state. (3) Pass `isDone` and `onExpandToggle` to `ExerciseBlock`. (4) Clear `pendingInputs[activity.id]` in mark-done handler. (5) Clear all `pendingInputs` in `handleFinish` before `finishWorkout()`. (6) Add `allActivitiesDone` derivation and persistent banner. |
| `src/components/workout/__tests__/exercise-block.test.tsx` | New or extended: tests for collapsed render, expand toggle, done state with 0 / N confirmed sets. |

**Patterns to follow:**
- `.claude/rules/react-typescript.md` -- functional components, no class components
- `.claude/rules/error-handling.md` -- guard clauses, `[module-name]` prefix on errors
- `.claude/rules/layout-conventions.md` -- tonal depth (no border dividers), Iron & Ember design system
- `.claude/rules/state-management.md` -- `useState` initializer for one-time store reads; store outside React via `getState()`

**Dependencies:** No new packages.

---

## Integration Points

No cross-stack integration. All state flows within the React layer:

```
route (log.$workoutId.tsx)
  └─ reads skippedActivityIds from useActiveWorkoutStore
  └─ calls skipActivity(activityId) on mark-done
  └─ owns expandedDoneActivityIds: Set<string> (local useState)
  └─ owns pendingInputs: Record<string, boolean> (existing local useState)
  └─ derives allActivitiesDone: boolean
  └─ renders ExerciseBlock per activity
       └─ receives isDone, onExpandToggle, onSkipExercise
       └─ renders collapsed row or full set UI
```

---

## Collapsed Row Layout

Single row inside a `<section>` wrapper (maintains existing `aria-label`):

```
[ EXERCISE NAME ]   [ N sets ]   [ ▸ ]
```

- **Exercise name:** existing heading style, truncated if needed
- **Set count badge:** number of confirmed sets, using existing badge/pill patterns
  from the Iron & Ember system (ALL-CAPS label, hard edges, no border-radius)
- **Expand chevron:** `ChevronRight` icon (Lucide), 48px touch target (gym-floor
  usability requirement from CLAUDE.md)
- Background: `bg-surface-pit/40` or `bg-surface-gunmetal/60` to signal "inactive/done"
  -- tonal shift, no border divider (layout-conventions.md constraint)

---

## All-Activities-Done Banner

Derived in the route:

```ts
const allActivitiesDone =
  loggedGroups.length > 0 &&
  loggedGroups.flatMap((g) => g.activities).every((a) => skippedActivityIds.has(a.id))
```

Rendered as a persistent banner in the sticky footer, above the FINISH WORKOUT
button. Uses existing `program-context-banner.tsx` or `error-banner.tsx` styling
as a reference -- amber/forge-orange tone to draw attention without overriding
the primary CTA. Dismissed only by the user finishing or discarding the workout.

---

## Risks & Unknowns

- **Risk:** Removing the `confirmedSets.length > 0` gate changes behavior for
  exercises with zero confirmed sets. Previously, skip was not available; now
  mark-done is always available, collapsing the block to "0 sets". Athletes who
  accidentally tap done on an empty exercise may be confused. Mitigated by: the
  re-expand affordance (A-005) allows correction without data loss.

- **Risk:** `activeFocusId` derivation already skips `skippedActivityIds` members.
  If an athlete marks all exercises done and then re-expands one to add a set,
  that exercise is still in `skippedActivityIds` and will not regain focus
  highlight. Acceptable per spec (Won't Have: auto-completion inference). The
  athlete can confirm sets normally; focus just stays on the last non-skipped
  activity.

- **Unknown:** Whether `ExerciseBlock` tests exist today and their coverage of
  the `onSkipExercise` prop path.
  - **Resolution:** Check `src/components/workout/__tests__/` during Phase 3
    task sizing.

---

## Testing Strategy

- **`exercise-block.test.tsx`:** Unit tests for collapsed render (`isDone=true`),
  expand toggle, done affordance visible with 0 and N confirmed sets (A-001,
  A-002, A-004, A-005).
- **`log.$workoutId` integration / route tests:** If route-level tests exist,
  add: pending row discarded on mark-done (A-003), pending rows discarded on
  FINISH (A-006), confirmed sets unaffected by mark-done (A-007).
- **`active-workout-store.test.ts`:** `skippedActivityIds` membership after
  mark-done (A-008) -- the store action is already tested; verify the gate
  removal does not break existing tests.

---

## Revision History

| Date       | Change      | ADR |
|------------|-------------|-----|
| 2026-04-15 | Initial     | --  |
