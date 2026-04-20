You are builder-ui, the Frontend Specialist on this team. You are continuing from Wave 1 where you completed the ExerciseBlock collapsed UI.

FEATURE CONTEXT:
Read these files before starting work:
- Context/Features/023-Exercise-Completion-Signal/Spec.md
- Context/Features/023-Exercise-Completion-Signal/Tech.md
- CLAUDE.md
- .claude/rules/layout-conventions.md
- .claude/rules/typescript-conventions.md
- .claude/rules/error-handling.md

YOUR TASKS (Wave 2):

**S002:** In `src/routes/_authenticated/log.$workoutId.tsx`:
1. Add `expandedDoneActivityIds` local state: `useState<Set<string>>(new Set())`
2. Remove the `confirmedSets.length > 0` gate on `onSkipExercise` (look around line ~797). The mark-done handler must now ALWAYS call `skipActivity(activity.id)` regardless of confirmed set count.
3. Add a `handleMarkDone(activityId: string)` handler that:
   - Calls `skipActivity(activityId)` (store action)
   - Calls `setPendingInputs(prev => ({ ...prev, [activityId]: false }))` to discard the trailing pending input row
   - Removes `activityId` from `expandedDoneActivityIds`
4. Add a `handleExpandDone(activityId: string)` handler that adds `activityId` to `expandedDoneActivityIds` (using functional update to avoid stale closure)
5. Pass to each `ExerciseBlock`:
   - `isDone={skippedActivityIds.has(activity.id) && !expandedDoneActivityIds.has(activity.id)}`
   - `onExpandToggle={() => handleExpandDone(activity.id)}`
   - Wire `onSkipExercise` to `() => handleMarkDone(activity.id)`

**S002-T:** Write tests for the mark-done route wiring:
- Pending input row cleared when mark-done fires [A-003]
- Confirmed sets on activity untouched after mark-done [A-007]
- `skippedActivityIds` contains activityId after mark-done [A-008]
- Block renders collapsed after mark-done (isDone=true)
- Block re-expands on chevron tap [A-005]

FILES YOU OWN (only modify these):
- `src/routes/_authenticated/log.$workoutId.tsx`
- Test file for log.$workoutId (check if one exists; create if needed in src/routes/_authenticated/__tests__/ or similar)

UPSTREAM CONTRACT (from M1):
src/components/workout/exercise-block.tsx now accepts:
- `isDone?: boolean` -- when true and not locally expanded, renders collapsed single-row
- `onExpandToggle?: () => void` -- called when user taps the expand chevron
- `onSkipExercise` is always available (guard removed)

CONTRACTS YOU MUST PRODUCE (for next wave):
- `src/routes/_authenticated/log.$workoutId.tsx` -- Route with mark-done handler and expandedDoneActivityIds state; ready for finish-handling additions

COORDINATION (event log):
- When you finish S002:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type task_done --task S002
- When you finish S002-T:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type task_done --task S002-T
- When the route contract is ready:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type contract_ready --contract src/routes/_authenticated/log.$workoutId.tsx
- After all tasks done:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type milestone_reached --note "M2: Mark-done wiring done"
- If blocked:
    bun run .claude/hooks/event-log/event-log.ts append --source builder-ui --type error --note "<short reason>"

TASK LIST:
- S002 = task ID 3
- S002-T = task ID 4
Use TaskUpdate to mark in_progress then completed.

IMPORTANT: Read log.$workoutId.tsx fully (run `wc -l` first, use offset/limit if over 2000 lines) before modifying it. Understand the existing state shape, how `setPendingInputs`, `skipActivity`, and `skippedActivityIds` work, and where ExerciseBlock is rendered. Do not introduce em dashes.

Run `bun run test` after writing tests to verify they pass.
