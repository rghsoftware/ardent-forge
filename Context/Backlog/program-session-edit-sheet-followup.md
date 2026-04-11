# Program-builder session edit sheet follow-up

**Source:** Feature 021 -- Template Builder Route (S017-D)
**Date:** 2026-04-11
**Status:** Backlog

## Context

Feature 021 promoted session- and event-template editing from a bottom sheet
in `library.tsx` to dedicated routes (`/templates/new`, `/templates/$id/edit`)
and broke the sheet-inside-sheet anti-pattern by replacing the stacked
`AddExerciseSheet` with a route-local `ExercisePickerDrawer`.

The program builder (`src/routes/_authenticated/builder.tsx`) still opens
session template editing in-place via
`src/components/program-builder/session-edit-sheet.tsx`. When a user opens
that sheet and then picks an exercise, the legacy `AddExerciseSheet` wrapper
still stacks a second sheet on top -- the same anti-pattern we removed from
the library flow, now scoped to program building.

This was explicitly out of scope for Feature 021 (non-scope guardrail in
Spec.md: "Not a broader sheet audit -- other sheets remain as-is"), but the
program-builder flow is the last remaining caller of the template form
inside a sheet and should be migrated for consistency.

## Proposed work

Two viable directions:

1. **Inline within builder route.** Replace `session-edit-sheet.tsx` with an
   inline expanding panel on the program-builder route, so session editing
   happens without ever opening a sheet. Matches the block-editor pattern
   already in `builder.tsx`.
2. **Navigate to template route.** From the program builder, clicking "edit
   session" navigates to `/templates/$id/edit` with a return-to-builder
   search param, then navigates back on save. Reuses Feature 021
   infrastructure fully; no new UI code.

Option 2 is lighter touch but introduces cross-route state carry (unsaved
program draft in builder while editing a template). Option 1 is more work
but keeps the program draft intact in memory.

## Acceptance

- No `<Sheet>` inside `<Sheet>` in any program-builder interaction path.
- Exercise picker in program-session editing uses the same
  `ExercisePickerDrawer` or `ExercisePickerPanel` as the template route.
- Program draft is not lost if the user navigates to edit a session and back.
