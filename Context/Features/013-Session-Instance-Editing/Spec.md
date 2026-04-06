# Feature 013: Per-Instance Scheduled Session Editing

## Overview

When a user clicks an already-assigned session in the program builder, open an edit sheet for that specific scheduled session instead of re-opening the template picker. This allows per-instance customization -- such as substituting an exercise or adding notes for a single day -- without altering the underlying session template that other scheduled sessions reference.

## Problem Statement

Today, clicking a filled session slot in the program builder re-opens the template picker, which only lets the user replace the entire template reference. There is no way to make day-specific adjustments (e.g., "swap barbell bench for dumbbell bench on Week 3 Day 1 because of a shoulder tweak"). Users who need per-instance changes must either create an entirely new template variant or make the change at workout time, losing the ability to plan ahead inside the builder.

## User Stories

- As a lifter building a multi-week program, I want to substitute a single exercise on a specific day so that I can accommodate injuries or equipment availability without creating a whole new template.
- As a coach, I want to add notes to a specific scheduled session (e.g., "deload set 3") so that the athlete sees context when they start the workout.
- As a user editing a program, I want clicking an assigned session to show me what's in it and let me tweak it, so the builder feels like a real editing tool rather than just a slot-assignment grid.
- As a user, I want empty slots to still open the template picker so that assigning new sessions remains quick and intuitive.

## Requirements

### Must Have

- **M-1**: Clicking a filled session slot opens a session edit sheet/modal instead of the template picker.
- **M-2**: Clicking an empty session slot continues to open the template picker (current behavior preserved).
- **M-3**: The edit sheet displays the session's template name, session type, and a read-only preview of the template's exercises/activities.
- **M-4**: The edit sheet exposes a notes field that the user can fill in per-instance. Notes persist through save and reload.
- **M-5**: The edit sheet provides a "Change template" action that opens the template picker to replace the session's underlying template.
- **M-6**: The edit sheet provides a "Remove session" action that clears the slot (returning it to a rest day).
- **M-7**: Both large screen (BlockList/WeekGrid) and mobile (MobileBlockEditor/MobileDayRow) views route clicks through the same conditional logic.

- **M-8**: Per-instance activity overrides -- the user can override any combination of exercise, sets, reps, and load on individual activities within a specific scheduled session. Overrides are stored on the `SessionDraft`/`ScheduledSession` and applied when the workout is started from this program slot. Only changed fields are stored; unchanged fields inherit from the base template.
- **M-9**: Visual indicator on a session slot when it has per-instance customizations (notes or activity overrides), so the user can tell at a glance which days deviate from the base template.

### Should Have

- **S-1**: "Reset to template" action per-activity in the edit sheet -- lets the user clear overrides on a single activity and revert to the base template values.

### Won't Have (this iteration)

- **W-1**: Inline editing directly in the grid cells -- all editing happens in the sheet/modal.
- **W-3**: Template-level editing from the builder -- this feature is about instance overrides, not modifying the source template.
- **W-4**: Undo history for individual field changes inside the edit sheet -- only the remove-session action gets undo (existing toast behavior).

## Testable Assertions

| ID    | Assertion                                                                                                               | Verification                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A-001 | Clicking a filled session slot opens the session edit sheet, not the template picker.                                   | Manual: click a filled slot on large screen and mobile, verify edit sheet opens.                     |
| A-002 | Clicking an empty session slot still opens the template picker.                                                         | Manual: click an empty slot, verify template picker opens as before.                                 |
| A-003 | The edit sheet shows the template name, session type badge, and a read-only exercise list.                              | Manual: open edit sheet, compare displayed info against the template's actual content.               |
| A-004 | User can enter/edit notes in the edit sheet and the value persists after saving and reloading the program.              | Manual: add notes, save program, navigate away, reopen program in builder, verify notes are present. |
| A-005 | "Change template" in the edit sheet opens the template picker; selecting a new template updates the slot.               | Manual: use change template, pick a different template, verify slot updates.                         |
| A-006 | "Remove session" in the edit sheet clears the slot and shows an undo toast.                                             | Manual: remove session, verify slot becomes empty rest day, verify undo toast appears and works.     |
| A-007 | Large screen and mobile views both open the edit sheet for filled slots.                                                | Manual: test on both large screen and mobile-width viewports.                                        |
| A-008 | User can override exercise, sets, reps, and/or load on an individual activity; overrides persist after save and reload. | Manual: change exercise + reps on one activity, save, reload, verify overrides are shown.            |
| A-009 | Only changed fields are stored as overrides; unchanged fields still inherit from the base template.                     | Manual: override only reps, verify exercise name and load still come from template.                  |
| A-010 | Session slots with per-instance customizations show a visual indicator (icon/badge).                                    | Manual: add a note or activity override, verify a visual cue appears on the slot in the grid.        |
| A-011 | (Should) "Reset to template" on an overridden activity clears that activity's overrides.                                | Manual: override an activity, reset it, verify it reverts to base template values.                   |

## Open Questions

- [x] ~~Storage model~~ -- Decided: JSON column (`overrides jsonb`) on `scheduled_sessions`. Overrides are tightly coupled to a single session, simple structure, no joins needed.
- [x] ~~Override scope~~ -- Decided: Full per-activity overrides (exercise, sets, reps, load). 1:1 substitution only, no reordering. Only changed fields stored; unchanged inherit from template.
- [x] ~~Workout-start merge~~ -- Decided: Apply overrides at workout creation time via map lookup. The workout log stores final values, so the override is baked in after creation.
- [ ] What is the exact shape of the `activityOverrides` JSON? Needs to key by activity index or ID and support partial field overrides. To be finalized in Tech.md.

## Revision History

| Date       | Change                                                             | ADR |
| ---------- | ------------------------------------------------------------------ | --- |
| 2026-04-04 | Initial spec                                                       | --  |
| 2026-04-04 | Promoted activity overrides (exercise/sets/reps/load) to Must Have | --  |
