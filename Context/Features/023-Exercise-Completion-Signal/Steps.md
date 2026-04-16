# Implementation Steps: Exercise Completion Signal During Active Workout

**Spec:** Context/Features/023-Exercise-Completion-Signal/Spec.md
**Tech:** Context/Features/023-Exercise-Completion-Signal/Tech.md

## Progress
- **Status:** Complete
- **Current task:** --
- **Last milestone:** M4 (Feature complete -- all assertions A-001 through A-008 verified)

## Team Orchestration

### Team Members
- **builder-ui**
  - Role: Frontend implementation -- ExerciseBlock component and workout route
  - Agent Type: frontend-specialist
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

---

## Tasks

### Phase 1: ExerciseBlock Component

- [ ] S001: Add `isDone?: boolean` and `onExpandToggle?: () => void` props to
  `ExerciseBlockProps`. When `isDone=true` and the block is not locally
  expanded, render a collapsed single-row summary: exercise name (truncated),
  confirmed-set-count badge (e.g. "3 SETS"), and an expand chevron
  (`ChevronRight`, 48px touch target). When `isDone=false` (or locally
  expanded), render the existing full set UI unchanged. The "done" affordance
  (tap target that calls `onSkipExercise`) must be visible regardless of how
  many sets are confirmed -- remove any internal guard that hides it when
  `sets.every(s => !s.confirmed)`. Collapsed row background uses tonal shift
  (`bg-surface-pit/40`) -- no border divider. Badge style: ALL-CAPS, hard
  edges, Iron & Ember palette.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** false

- [ ] S001-T: Test `ExerciseBlock` -- collapsed/expanded render and done
  affordance visibility (done affordance present with 0 confirmed sets [A-001];
  done affordance present with N confirmed sets [A-002]; `isDone=true` renders
  single-row summary not full set list [A-004]; tapping chevron calls
  `onExpandToggle` [A-005 partial]; `isDone=false` renders full set UI)
  - **Assigned:** builder-ui
  - **Depends:** S001
  - **Parallel:** false

🏁 MILESTONE: ExerciseBlock done -- verify A-001, A-002, A-004
  **Contracts:**
  - `src/components/workout/exercise-block.tsx` -- Updated interface with `isDone` and `onExpandToggle` props; collapsed render path

---

### Phase 2: Route -- Mark-Done Wiring

- [ ] S002: In `log.$workoutId.tsx`:
  1. Add `expandedDoneActivityIds` local state: `useState<Set<string>>(new Set())`.
  2. Remove the `confirmedSets.length > 0` gate on `onSkipExercise` (line ~797).
     The mark-done handler now always calls `skipActivity(activity.id)`.
  3. Add a `handleMarkDone(activityId)` handler (or inline) that:
     - Calls `skipActivity(activityId)` (store action)
     - Calls `setPendingInputs(prev => ({ ...prev, [activityId]: false }))` to
       discard the trailing pending input row
     - Removes `activityId` from `expandedDoneActivityIds`
  4. Add a `handleExpandDone(activityId)` handler that adds `activityId` to
     `expandedDoneActivityIds`.
  5. Pass `isDone={skippedActivityIds.has(activity.id) && !expandedDoneActivityIds.has(activity.id)}`
     and `onExpandToggle={() => handleExpandDone(activity.id)}` to each
     `ExerciseBlock`. Wire `onSkipExercise` to `handleMarkDone`.
  - **Assigned:** builder-ui
  - **Depends:** S001
  - **Parallel:** false

- [ ] S002-T: Test mark-done wiring in the route (pending input row cleared
  when mark-done fires [A-003]; confirmed sets on activity untouched after
  mark-done [A-007]; `skippedActivityIds` contains activityId after mark-done
  [A-008]; block renders collapsed after mark-done; block re-expands on chevron
  tap [A-005])
  - **Assigned:** builder-ui
  - **Depends:** S002
  - **Parallel:** false

🏁 MILESTONE: Mark-done wiring done -- verify A-003, A-005, A-007, A-008
  **Contracts:**
  - `src/routes/_authenticated/log.$workoutId.tsx` -- Route with mark-done handler and expandedDoneActivityIds state; ready for finish-handling additions

---

### Phase 3: Route -- Finish Handling and All-Done Banner

- [ ] S003: In `log.$workoutId.tsx`:
  1. In `handleFinish`, add `setPendingInputs({})` as the first statement
     (before the `finishWorkout()` call) to discard all trailing pending input
     rows before the workout is persisted.
  2. Derive `allActivitiesDone`:
     ```ts
     const allActivitiesDone = useMemo(
       () =>
         loggedGroups.length > 0 &&
         loggedGroups.flatMap((g) => g.activities).every((a) => skippedActivityIds.has(a.id)),
       [loggedGroups, skippedActivityIds],
     )
     ```
  3. In the sticky footer (non-programmed workout footer block), render a
     persistent banner above the FINISH WORKOUT button when `allActivitiesDone`
     is true. Banner copy: "ALL EXERCISES DONE -- READY TO FINISH?" (ALL-CAPS,
     Iron & Ember forge-orange tone). Banner must not be dismissible -- it
     disappears only when the workout is finished or discarded.
  - **Assigned:** builder-ui
  - **Depends:** S002
  - **Parallel:** false

- [ ] S003-T: Test finish handling and all-done banner (all pending input rows
  absent from saved workout after FINISH [A-006]; all-done banner visible when
  every activity is in `skippedActivityIds`; all-done banner hidden when at
  least one activity is not done; banner absent when `loggedGroups` is empty)
  - **Assigned:** builder-ui
  - **Depends:** S003
  - **Parallel:** false

🏁 MILESTONE: All production changes done -- verify A-001 through A-008 in full

---

### Phase 4: Validation

- [ ] S004: Quality validation -- read-only inspection of all changed files.
  Verify: no border dividers introduced (layout-conventions.md), touch targets
  are 48px+, `[workout-log]` / `[workout-page]` error prefixes consistent,
  `allActivitiesDone` derivation handles empty `loggedGroups`, no silent
  returns in new handlers, all Spec.md Must Have requirements traceable to code.
  - **Assigned:** validator
  - **Depends:** S001-T, S002-T, S003-T
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- verify all assertions (A-001 through A-008), full drift check

---

## Acceptance Criteria

- [ ] All 8 testable assertions from Spec.md verified (A-001 through A-008)
- [ ] All tests passing (`bun run test`)
- [ ] No TODO/FIXME stubs remaining
- [ ] No border dividers in new UI (tonal depth only)
- [ ] All touch targets 48px minimum

## Validation Commands

```bash
bun run test                          # full test suite
bun run lint                          # ESLint
bun run build                         # TypeScript check + Vite build
```
