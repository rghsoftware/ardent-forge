# Template Creation: Out of the Sidebar

**Date:** 2026-04-11

## Task
Move "Create new template" and "Create new event" flows out of the `SessionPickerSheet` sidebar and into full-screen dialogs.

## Goal
Template/event creation currently renders inline inside the narrow `SessionPickerSheet` (a right-side drawer, max-w-md). The constrained width makes it a terrible UX for building a template with exercises, sets, reps, etc. Creation should happen in a proper full-width `<Dialog>` that overlays the builder canvas.

## Current State

`session-picker-sheet.tsx` manages two booleans (`showCreate`, `showCreateEvent`) that swap the sheet content to display `SessionTemplateForm` or `EventTemplateForm` inline. The sheet is 448px wide -- terrible for form-heavy workflows. There's even an escape hatch ("Want more options? Create in the Library") that signals the UX was already known to be inadequate.

## Approach

### 1. Create two new dialog wrappers (new files)

**`src/components/program-builder/create-template-dialog.tsx`**
- Props: `open: boolean`, `onOpenChange`, `onCreated: (template: SessionTemplate) => void`
- Renders `<Dialog>` with `<DialogContent className="max-w-3xl">` (or similar generous width)
- Mounts `<SessionTemplateForm onSave={onCreated} onCancel={() => onOpenChange(false)} />`

**`src/components/program-builder/create-event-dialog.tsx`**
- Same pattern but for `<EventTemplateForm />`

### 2. Update `SessionPickerSheet`

- Remove `showCreate` and `showCreateEvent` states
- Remove the two inline form branches from the sheet JSX
- Remove the "Want more options? Create in the Library" escape hatches
- Add `onCreateTemplate: () => void` and `onCreateEvent: () => void` props OR lift dialogs fully outside the sheet
- Replace "Create new template" / "Create new event" buttons to call the new dialog open handlers directly
- Sheet stays open (or closes) while the dialog takes over -- simplest: close sheet, open dialog

### 3. Lift dialog state to `BuilderPage` (builder.tsx)

- Add `showCreateTemplate` and `showCreateEvent` booleans to `BuilderPage` state
- Pass `onCreateTemplate` / `onCreateEvent` callbacks down to `SessionPickerSheet`
- Render `<CreateTemplateDialog>` and `<CreateEventDialog>` at the `BuilderPage` level alongside `<SessionPickerSheet>`
- `handleCreated` / `handleEventCreated` callbacks: auto-select the new template (same logic as before), close the dialog, leave the picker sheet closed

## Files to touch

| File | Change |
|------|--------|
| `src/components/program-builder/session-picker-sheet.tsx` | Remove inline form branches, add `onCreateTemplate`/`onCreateEvent` props |
| `src/routes/_authenticated/builder.tsx` | Add dialog state + `<CreateTemplateDialog>` + `<CreateEventDialog>` |
| `src/components/program-builder/create-template-dialog.tsx` | **New** -- Dialog wrapper for `SessionTemplateForm` |
| `src/components/program-builder/create-event-dialog.tsx` | **New** -- Dialog wrapper for `EventTemplateForm` |

## Verification

- Clicking "Create new template" in the picker sheet closes the sheet and opens a full-width dialog
- Submitting the form auto-selects the new template and dismisses the dialog
- Cancelling the form closes the dialog (no navigation side-effect)
- "Create new event" follows the same path
- No regression: selecting an existing template from the picker still works
- The Library's own template creation flow is unaffected

## Risks

- `SessionTemplateForm` may have internal state that assumes it's embedded in the sheet (scroll behavior, button layout) -- verify it renders cleanly in a dialog without scroll issues
- Dialog `max-w` needs to be wide enough to comfortably host the exercise builder rows; `max-w-3xl` (768px) is a reasonable starting point, `max-w-4xl` if content feels cramped

## Execution

`/impl`
