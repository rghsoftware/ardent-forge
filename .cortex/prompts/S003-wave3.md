You are builder-ui, the Frontend Specialist on this team. You are continuing from Wave 2 where you wired mark-done into the workout route.

FEATURE CONTEXT:
Read these files before starting work:
- Context/Features/023-Exercise-Completion-Signal/Spec.md
- Context/Features/023-Exercise-Completion-Signal/Tech.md
- CLAUDE.md
- .claude/rules/layout-conventions.md (CRITICAL: no border dividers)
- .claude/rules/typescript-conventions.md

YOUR TASKS (Wave 3):

**S003:** In `src/routes/_authenticated/log.$workoutId.tsx`:

1. In `handleFinish`, add `setPendingInputs({})` as the FIRST statement (before the `finishWorkout()` call) to discard all trailing pending input rows before the workout is persisted.

2. Derive `allActivitiesDone` via useMemo:
   ```ts
   const allActivitiesDone = useMemo(
     () =>
       loggedGroups.length > 0 &&
       loggedGroups.flatMap((g) => g.activities).every((a) => skippedActivityIds.has(a.id)),
     [loggedGroups, skippedActivityIds],
   )
   ```

3. In the sticky footer (non-programmed workout footer -- the section with the FINISH WORKOUT button), render a PERSISTENT banner ABOVE the FINISH WORKOUT button when `allActivitiesDone` is true:
   - Banner copy: "ALL EXERCISES DONE -- READY TO FINISH?" (em-dash written as two hyphens with spaces: " -- ")
   - Style: ALL-CAPS text in forge-orange/ember tone, Iron & Ember aesthetic
   - Must be PERSISTENT (not dismissible) -- disappears only when workout is finished or discarded
   - Use tonal background shift (bg-surface-pit/40 or similar) -- NO border dividers

**S003-T:** Write tests for finish handling and all-done banner:
- All pending input rows absent from saved workout after FINISH [A-006]
- All-done banner visible when every activity is in `skippedActivityIds`
- All-done banner hidden when at least one activity is not done
- Banner absent when `loggedGroups` is empty

FILES YOU OWN (only modify these):
- `src/routes/_authenticated/log.$workoutId.tsx`
- Test file(s) for log.$workoutId (create new test file for S003-T assertions if cleaner)

UPSTREAM CONTRACT (from M2):
The route already has:
- `expandedDoneActivityIds` state
- `handleMarkDone` / `handleExpandDone` handlers
- `isDone` and `onExpandToggle` wired to each `ExerciseBlock`
- `confirmedSets.length > 0` gate removed from `onSkipExercise`

CONTRACTS YOU MUST PRODUCE:
None for downstream agents -- you are the final implementation wave.

COORDINATION (event log):
- When you finish S003:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type task_done --task S003
- When you finish S003-T:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type task_done --task S003-T
- After all tasks done:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type milestone_reached --note "M3: All production changes done"
- If blocked:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type error --note "<short reason>"

TASK LIST:
- S003 = task ID 5
- S003-T = task ID 6
Use TaskUpdate to mark in_progress then completed.

IMPORTANT:
- Read log.$workoutId.tsx (use wc -l first, then offset/limit) before modifying
- Find the exact `handleFinish` function and the sticky footer JSX location
- Do NOT introduce em dashes (use " -- " double-hyphen with spaces instead)
- Run `bun run test` after writing tests to verify they pass
