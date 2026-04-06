# Feature 017: Program Time Travel

## Overview

Allow users to edit their active program's start date and jump to a different position (week/block) within the program. This covers the common real-world scenario where a user starts a program in the gym before entering it into the app, as well as cases where a user wants to skip ahead or revisit a previous week.

## Problem Statement

Today, a program's start date and current position are set at activation time and can only advance linearly through workout completion. There is no way to:

1. **Backdate a start date** -- If a user starts a real-world program on Monday but doesn't enter it into the app until Thursday, the start date is locked to Thursday. The "today" view is then misaligned with their actual training week.
2. **Jump to a different position** -- If a user completed week 1 on paper/another app and wants to pick up at week 2, they must log dummy workouts to advance. Conversely, if they want to repeat a week, there's no way to move backward.

Both gaps force users into workarounds that erode trust in the program tracking system.

## User Stories

- As a lifter, I want to change my program's start date to last week so that the app's "today" view aligns with the training week I actually started.
- As a lifter, I want to jump my program position to week 3 because I completed weeks 1-2 on paper before discovering this app.
- As a lifter jumping forward, I want to choose whether each skipped week is labeled "done", "skipped", or left unmarked, so my training history reflects reality rather than an assumption.
- As a lifter, I want to move back to a previous week so I can repeat it after an illness or missed training.
- As a lifter, I want to jump to a different block entirely (e.g., skip the deload block) so I can customize my progression path.

## Requirements

### Must Have

- **M-1**: User can edit the start date of their active program to any past or present date.
- **M-2**: User can change the current position (block ordinal + week number) of their active program to any valid position within the program structure.
- **M-3**: When jumping forward past one or more weeks, the user is presented with a choice for each skipped week: mark sessions as "done", mark as "skipped", or leave unmarked. No automatic labeling occurs.
- **M-4**: When moving backward, no sessions are altered -- the position simply changes.
- **M-5**: After a position change, the Today page immediately reflects the new current week/block.
- **M-6**: The start date and position editing UI is accessible from the active program context (e.g., program detail page or Today page program card).
- **M-7**: Both Supabase and Tauri adapters support start date updates and position changes.
- **M-8**: Position changes validate against the actual program structure -- users cannot set a block ordinal or week number that doesn't exist in the program.

### Should Have

- **S-1**: Visual summary of the program timeline showing current position and where the user is jumping to, so the change is easy to understand before confirming.
- **S-2**: Confirmation step before applying position changes, showing what will change (current position, new position, number of weeks affected).

### Won't Have (this iteration)

- **W-1**: Per-session skip labeling -- skip labels apply at the week level, not individual sessions within a week. Per-session granularity can be added later.
- **W-2**: Automatic recalculation of start date when position changes -- start date and position are independent edits.
- **W-3**: Undo/revert for position changes -- users can manually move back if they made an error.
- **W-4**: Workout log backfill -- jumping forward and marking weeks "done" does not generate workout log entries. It only labels the weeks.

## Testable Assertions

| ID    | Assertion                                                                                                 | Verification       |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------ |
| A-001 | Editing start date to a past date persists across app reload and is reflected in the activation record.   | Unit + integration |
| A-002 | Setting start date to 7 days ago causes the Today page to show the Day 8 (Week 2) workout.                | E2E / manual       |
| A-003 | Jumping forward from week 1 to week 4 presents a choice UI for weeks 2-3 with options: done/skipped/none. | Component test     |
| A-004 | Selecting "leave unmarked" for a skipped week does not create or modify any records for that week.        | Unit test          |
| A-005 | Moving backward from week 4 to week 2 does not alter any session labels or workout logs.                  | Unit test          |
| A-006 | Setting position to a non-existent block ordinal or week number is rejected with a validation error.      | Unit test          |
| A-007 | Start date edit and position jump work on both Supabase and Tauri adapters.                               | Adapter tests      |
| A-008 | The updateActiveProgram adapter method accepts startDate as an optional field.                            | Type check + unit  |
| A-009 | After position change, program advancement (next week/block) continues correctly from the new position.   | Unit test          |
| A-010 | Position change UI shows current position and target position before user confirms.                       | Component test     |
| A-011 | Today session resolution computes current week/day from startDate + current date, not static position.    | Unit test          |

## Resolved Questions

- **UI entry point**: Both the Today page program card and the program detail page.
- **Skip label storage**: Best-fit approach -- free to add new tables or modify existing schema since the app is pre-deployment.
- **Start date and "today" resolution**: Start date is used for day-of-week alignment. Example: if today is Monday and the user sets start date to last Monday (7 days ago), the Today page should show the Day 8 workout (i.e., Week 2, Day 1). The `resolveTodaySession` logic must compute the current program day from `startDate` + today's date, not just rely on the static `currentWeekNumber`.

## Dependencies

- Existing: `ProgramActivation` schema, `DataAdapter` interface, `program-advancement.ts`
- Related: F013 (Session Instance Editing) -- no overlap, but shares the program builder domain

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-06 | Initial spec | --  |
