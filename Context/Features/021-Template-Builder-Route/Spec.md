# Feature 021 -- Template Builder Route

## Overview

Promote session-template and event-template editing from a bottom sheet modal
(`library.tsx` → `Sheet side="bottom" max-h-[95vh]`) to dedicated full-page
routes that match the pattern already used by `builder.tsx` for program
editing. Template building is structurally as deep as program building --
category, scoring, time cap, multiple activity groups, nested exercises with
set schemes, rest intervals -- and deserves the same affordances: URL
deep-linking, back-button semantics, reload recovery, and the full viewport
on desktop. It also eliminates the sheet-inside-sheet anti-pattern created
when the `AddExerciseSheet` opens on top of the template form sheet.

## Problem Statement

`library.tsx` currently opens a bottom sheet clamped to 95vh to host
`SessionTemplateForm` (481 LOC) or `EventTemplateForm` (632 LOC). Inside
that sheet:

- A two-column grid (`lg:grid-cols-[320px_1fr]`) tries to give desktop users
  a sticky metadata column next to a scrollable groups column, but the
  available height is capped at ~95vh of the viewport rather than the full
  page.
- `ActivityGroupEditor` → `ActivityEditor` → `AddExerciseSheet` stacks a
  second sheet on top of the first when the user picks an exercise, which
  the Iron & Ember design language explicitly calls out as an anti-pattern
  ("Sheets are for shallow tasks -- picking a value, confirming an action,
  reading a quick detail").
- Closing the outer sheet (Escape, scrim click, accidental swipe on mobile)
  discards the entire in-progress draft with no confirmation and no recovery.
- The URL never changes, so the user cannot bookmark a draft, share a link
  to "the thing I'm editing", or recover by reloading the page. Browser
  back goes to the previous route, not out of the editor.
- Templates and programs are structurally peers (programs reference
  templates), yet programs already have a dedicated `/builder` route while
  templates are trapped in a modal. This asymmetry is visible to users and
  creates contradictory mental models inside the same product.

The bug label for this work is "Deep work trapped in a bottom sheet."

## User Stories

- **As an athlete programming a CrossFit Hero WOD**, I want the template
  editor to open as a full page so I can use the whole desktop viewport to
  lay out four activity groups, twelve exercises, scoring rules, and rest
  intervals without fighting a 95vh height cap.
- **As a coach mid-edit**, I want the browser back button to take me back
  to the library list, not jump me two routes away, so my editing session
  has sane navigation semantics.
- **As a user on mobile**, I want reloading the page to return me to the
  template I was editing (via URL), not drop me back on an empty library
  list with my draft gone.
- **As a user picking an exercise**, I want the exercise picker to appear
  inline or in a side panel within the template route rather than stacking
  a second sheet on top of the one I am already inside.
- **As an iOS user**, I want to share a link to "the template I am
  currently editing" with a teammate so they can pick up where I left off.

## Requirements

### Must

- M1. Introduce two new file-based routes under `src/routes/_authenticated/`:
  - `templates/new.tsx` -- create flow (session or event, disambiguated by
    search param `mode=session|event`)
  - `templates/$templateId/edit.tsx` -- edit flow (session or event, kind
    resolved from the fetched template or by `mode` search param)
- M2. Both routes render the corresponding form component
  (`SessionTemplateForm` or `EventTemplateForm`) using a full-page layout
  matching `builder.tsx` (header bar with title + save button, two-column
  grid on `lg:`, stacked on mobile, `mx-auto max-w-5xl` wrapper per
  `layout-conventions.md`).
- M3. Remove the template-form `<Sheet>` wrapper from `library.tsx`. The
  library list and its `+ New session / + New event / Edit` actions must
  navigate to the new routes instead of opening the sheet.
- M4. The exercise picker (currently `AddExerciseSheet` stacked on top of
  the template sheet) must render as an inline panel or a route-local side
  drawer inside the template route. **No sheet-inside-sheet** under any
  interaction path reachable from the new routes.
- M5. Drafts are URL-addressable: reloading `/templates/{id}/edit` must
  refetch the template and resume editing. The create route
  (`/templates/new`) may use local component state for unsaved drafts --
  persistence of unsaved creation drafts is explicitly out of scope.
- M6. Successful save navigates back to `/library` with the templates tab
  active, matching the behavior of `builder.tsx` on program save.
- M7. Cancel returns to `/library` (templates tab) without saving.
- M8. Existing tests in `session-template-form.test.tsx` must continue to
  pass unchanged. The form component's props surface
  (`initial`, `onSave`, `onCancel`) must not change.
- M9. All new routes must live inside the authenticated layout (prefixed
  `_authenticated`) and be covered by TanStack Router codegen.
- M10. Both the `events.$templateId.tsx` route (existing event-detail view)
  and the new edit route must coexist without collision. Routing layout
  must distinguish `templates/$templateId/edit` cleanly.

### Should

- S1. When the user triggers "edit" from a row in the templates list, the
  library list scroll position should be preserved so that returning via
  save/cancel lands the user back where they were.
- S2. The new routes should adopt the same sticky left-column metadata
  pattern from `builder.tsx` so metadata (name, category, scoring, time
  cap) stays visible while the user scrolls through activity groups.
- S3. Breadcrumb / back affordance in the header: a visible "← Library"
  link or icon button that navigates back to `/library`.
- S4. `AddExerciseSheet` should be refactored into a reusable inline
  `ExercisePicker` panel that renders either as a route drawer (new
  template route) or as a sheet (legacy callers in `log.$workoutId.tsx`
  and `manual-workout-form.tsx` that are out of scope for this feature).
  The existing sheet wrapper may remain as a thin adapter over the shared
  panel for those callers.

### Won't

- W1. Will not persist unsaved create drafts to local storage or IndexedDB.
- W2. Will not rework `SessionTemplateForm` or `EventTemplateForm` internal
  layouts beyond what is required to host them at full-page scale.
- W3. Will not migrate the other existing sheet consumers
  (`AddExerciseSheet` in the live-workout logging flow,
  `WorkoutPreviewSheet`, `SessionPickerSheet`, etc.). Only the
  template-editor flow is in scope.
- W4. Will not change database schema, domain types, adapters, or server
  mutations. This is a pure frontend routing/layout refactor.
- W5. Will not redesign the library templates list itself beyond wiring
  the create/edit actions to the new routes.

## Testable Assertions

- **A1.** Navigating to `/templates/new?mode=session` renders an empty
  `SessionTemplateForm` inside the authenticated shell with no
  `<Sheet>` ancestor in the DOM.
- **A2.** Navigating to `/templates/{id}/edit` on an existing session
  template fetches via `useSessionTemplateFull`, hydrates the form, and
  does not render a `<Sheet>`.
- **A3.** Clicking "New session" in `library.tsx` calls
  `navigate({ to: '/templates/new', search: { mode: 'session' } })`.
- **A4.** Clicking "Edit" on a template row calls
  `navigate({ to: '/templates/$templateId/edit', params: { templateId: id } })`.
- **A5.** After a successful save on `/templates/new`, the user lands on
  `/library` with the templates tab active.
- **A6.** Opening the exercise picker from inside the template route does
  not create a nested `<Sheet>` subtree. Exactly zero `<Sheet>` instances
  are present in the DOM at the time the picker is visible.
- **A7.** Reloading `/templates/{id}/edit` returns the user to the edit
  view for that template (no back-to-library redirect, no blank state).
- **A8.** `library.tsx` no longer imports
  `Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription` for the
  template form path. (`CreateExerciseSheet` and any non-template sheet
  uses may remain.)
- **A9.** Existing `session-template-form.test.tsx` continues to pass with
  no modifications.
- **A10.** Running `bun run build` and `bun run lint` pass with no new
  errors or warnings.

## Open Questions

- **Q1.** Should the route be `/templates/new` + `/templates/$id/edit`,
  or `/builder/templates/new` + `/builder/templates/$id/edit` (nested
  under builder)? **Proposed answer:** top-level `/templates/*` -- it
  parallels `/builder` rather than nesting under it, matching the
  structural peer relationship programs-to-templates. Confirm with user.
- **Q2.** On the create route, if the user navigates away with unsaved
  changes, should we show a browser `beforeunload` warning? **Proposed
  answer:** yes for route-internal navigation (via a TanStack Router
  `onLeave` / `beforeLoad` guard) and yes for tab-close via
  `beforeunload`. Confirm.
- **Q3.** Should the exercise picker become an inline expanding panel
  (replacing the current activity row's edit surface) or a right-docked
  side drawer? **Proposed answer:** right-docked side drawer on desktop
  (`lg:`), full-width inline panel on mobile -- the same responsive
  pattern `builder.tsx` uses for its block editors. Confirm.
- **Q4.** Does `EventTemplateForm` need the same full-page treatment, or
  should we keep events in the sheet for this iteration? **Proposed
  answer:** both. Event editing has the same depth concerns and the same
  nested-sheet anti-pattern risk via its own item editors. Handle both in
  one pass. Confirm.

## Dependencies

- **Internal:**
  - `src/components/session-builder/session-template-form.tsx` (481 LOC)
  - `src/components/session-builder/activity-group-editor.tsx` (293 LOC)
  - `src/components/session-builder/activity-editor.tsx` (168 LOC)
  - `src/components/event-builder/event-template-form.tsx` (632 LOC)
  - `src/components/workout/add-exercise-sheet.tsx` (136 LOC) -- consumed
    here and elsewhere; refactoring must preserve existing callers
  - `src/routes/_authenticated/library.tsx` (1201 LOC)
  - `src/routes/_authenticated/builder.tsx` (437 LOC) -- reference pattern
  - `src/hooks/use-session-templates.ts` (`useSessionTemplateFull`,
    `useCreateSessionTemplate`, `useUpdateSessionTemplate`)
- **External:** TanStack Router file-based route codegen
  (`routeTree.gen.ts` will need regeneration via `bun run dev` or the
  router's generator).
- **Design system:** Iron & Ember, enforced via
  `.claude/rules/layout-conventions.md` (no divider lines, max-w-5xl,
  responsive padding).

## Anti-goals / Non-scope Guardrails

- Not a rewrite of `SessionTemplateForm` / `EventTemplateForm` internals.
- Not a broader sheet audit -- other sheets remain as-is.
- Not a change to the library list layout, filtering, or data-fetch
  hooks.
- Not a change to `useSessionTemplateFull` or any mutation hooks.
