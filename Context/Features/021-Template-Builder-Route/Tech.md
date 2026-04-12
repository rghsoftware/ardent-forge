# Feature 021 -- Template Builder Route: Tech Plan

## Overview

This document translates Spec.md into an implementation architecture. The
work is a focused frontend refactor: introduce two new TanStack Router
file-based routes, relocate `SessionTemplateForm` / `EventTemplateForm`
out of the `library.tsx` sheet, and break the sheet-inside-sheet
anti-pattern created by `AddExerciseSheet`.

No database, domain, adapter, or server-side changes are required. No
form-component internals change. The form props surface (`initial`,
`onSave`, `onCancel`) is preserved so existing tests pass unchanged.

## Architecture

### Current state

```
/library (library.tsx)
  └── <Sheet side="bottom" max-h=95vh>                ← OUTER SHEET
        └── SessionTemplateForm / EventTemplateForm
              └── ActivityGroupEditor
                    └── ActivityEditor
                          └── <Sheet side="bottom">   ← INNER SHEET (anti-pattern)
                                └── ExerciseSearchInput + results
```

- Library list and template editor share the same route, so the URL
  never reflects the editing state.
- Escape / scrim click on the outer sheet discards the draft silently.
- The inner `AddExerciseSheet` opens inside an already-open sheet.

### Target state

```
/library (library.tsx)
  ├── (templates tab renders list only)
  ├── "New session" → navigate to /templates/new?mode=session
  ├── "New event"   → navigate to /templates/new?mode=event
  └── "Edit"        → navigate to /templates/$id/edit

/templates/new (templates.new.tsx)
  └── TemplateEditorLayout
        ├── Header: title + back link + save button (mirrors builder.tsx)
        ├── Left column: sticky metadata (name, category, scoring, time cap)
        ├── Right column: SessionTemplateForm / EventTemplateForm body
        │     └── ActivityGroupEditor
        │           └── ActivityEditor
        │                 └── opens route-local ExercisePickerDrawer  ← no sheet-in-sheet
        └── ExercisePickerDrawer (right-docked on lg:, full-width on mobile)

/templates/$templateId/edit (templates.$templateId.edit.tsx)
  └── Same as above, hydrated from useSessionTemplateFull(templateId)
```

### Route decisions

**Route layout (Q1 → top-level confirmed):**

- `src/routes/_authenticated/templates.new.tsx`
  - TanStack Router file path: `/_authenticated/templates/new`
  - Search params: `{ mode: 'session' | 'event' }` (default `'session'`)
- `src/routes/_authenticated/templates.$templateId.edit.tsx`
  - TanStack Router file path: `/_authenticated/templates/$templateId/edit`
  - Params: `{ templateId: string }`
  - No search params; kind (session vs event) is derived from the fetched
    template record (e.g. `template.category === 'EVENT'` or whatever the
    domain flag is -- confirmed during Step 1 of implementation).

These will not collide with the existing
`events.$templateId.tsx` route, which lives under `/events/$templateId`
and is unchanged. Explicitly: `/templates/*` and `/events/*` are sibling
namespaces.

TanStack Router dot-notation convention: `templates.new.tsx` produces
`/templates/new`, and `templates.$templateId.edit.tsx` produces
`/templates/$templateId/edit`. The `routeTree.gen.ts` file regenerates on
next `bun run dev` (or via the explicit codegen command).

### Shared layout component

To keep the two new routes DRY and to isolate the pattern from a future
"duplicate template" / "clone template" route, extract a thin layout
primitive:

```
src/components/session-builder/template-editor-layout.tsx
```

Responsibilities:

- Render the full-page shell: `bg-surface-anvil`, `min-h-[100dvh]`,
  `mx-auto max-w-5xl`, responsive `px-4 md:px-6 lg:px-8`.
- Render header bar with:
  - Back link `← Library` (TanStack Router `Link`) -- navigates to
    `/library` with the templates tab preselected via a router state
    param (see "Library re-entry" below).
  - Title (`"New template"`, `"Edit template"`, `"New event"`, or
    `"Edit event"`).
  - Save button wired to the form's imperative save handler (see "Save
    button wiring" below).
- Accept `children` for the form body.
- Accept optional `onBack` override for the back action.

This component does not own form state -- it is purely presentational.

### Save button wiring

`SessionTemplateForm` currently renders its own "Save template" button
inside the form body. We have two options:

**Option A -- keep the save button inside the form.** Header save
becomes redundant. Pro: zero change to form internals; form-level save
button is already tested. Con: header has no action, which breaks
parallelism with `builder.tsx`.

**Option B -- lift save to the header via an imperative handle.** Use
`React.useImperativeHandle` on the form so the layout can call
`formRef.current?.save()`. Pro: matches `builder.tsx`. Con: touches form
internals.

**Option C -- keep both buttons.** Simplest, no form changes; header
save is a second visible action. Con: two buttons is clutter.

**Decision: Option A, but reposition the form's existing save/cancel
footer to appear full-bleed at the bottom of the column.** This
preserves the form internals and keeps the header as a purely
navigational element ("← Library" + title). Save/cancel remain where the
form already owns them, and no imperative handle is introduced.

If the user later wants header-level save, that is a cheap follow-up and
is captured as a backlog item, not a blocker for this feature.

### Exercise picker refactor

Spec.md M4 requires no sheet-inside-sheet inside the new routes, and S4
requires a reusable picker. Approach:

1. **Extract a headless inner panel** from `AddExerciseSheet`:

   ```
   src/components/workout/exercise-picker-panel.tsx
   ```

   Contains the search input, recently-used list, results list, and
   selection callback. **No routing, no sheet, no dialog -- pure UI.**

2. **Keep `AddExerciseSheet` as a thin wrapper** around the panel so
   existing consumers (`log.$workoutId.tsx`, `manual-workout-form.tsx`,
   `program-builder/session-edit-sheet.tsx`) continue to work unchanged.
   The sheet wrapper becomes ~20 LOC around
   `<ExercisePickerPanel />`. Their tests
   (`manual-workout-form.test.tsx`) must continue to pass.

3. **Create a new drawer variant** for the template routes:

   ```
   src/components/session-builder/exercise-picker-drawer.tsx
   ```

   Renders as a right-docked side drawer on `lg:` (fixed 400px width,
   full height, slide-in) and a full-width bottom panel on mobile.
   Internally composes `<ExercisePickerPanel />`.
   **Critical:** this drawer is NOT a `<Sheet>`. It is a plain
   conditionally-rendered `<aside>` with an `inset-y-0 right-0` fixed
   position on `lg:` and a bottom stack on mobile. No radix Dialog
   portal, no modal scrim on desktop.

4. **Update `activity-editor.tsx`** to accept a picker-render prop so
   that:
   - When used inside the template routes, it receives the drawer
     variant.
   - When used anywhere else (no current non-route callers), it falls
     back to the sheet variant for backwards compatibility.

   Simplest API:

   ```tsx
   <ActivityEditor
     {...existingProps}
     PickerComponent={ExercisePickerDrawer} // injected from route
   />
   ```

   With `PickerComponent` defaulting to `AddExerciseSheet` so existing
   callsites (none outside the template form today, but future-proof)
   continue to work.

   `ActivityGroupEditor` threads `PickerComponent` through to
   `ActivityEditor`. `SessionTemplateForm` accepts an optional
   `PickerComponent` prop (defaults to `AddExerciseSheet`) and threads
   it to `ActivityGroupEditor`. Same for `EventTemplateForm` if its
   activity editor reuses the same chain (confirmed during Step 2 of
   implementation).

### Library re-entry and scroll preservation

Spec.md S1 asks for library scroll preservation. TanStack Router
preserves scroll by default when navigating back via `router.history`
actions. We rely on that default plus two precautions:

- Navigate from library to the new routes using
  `navigate({ to: '/templates/new', search: { mode: 'session' } })`
  (forward navigation -- library scroll position is pushed onto history).
- On save/cancel, navigate via `router.history.back()` when the previous
  entry is `/library`, falling back to `navigate({ to: '/library' })`.
  This ensures browser back semantics remain consistent.
- Library's active tab is stored in URL state (search param) so that
  returning via history preserves the selected tab. Today it uses
  `useState`; upgrading to a `useSearch` param is a small, self-contained
  change in `library.tsx`. Spec.md M6 and S1 both benefit from this.

### Dirty-state guard (Q2 → confirmed yes)

Spec.md acceptance includes "reload recovery" for edit, but for create
we need a user-visible warning before dropping an in-progress draft.

**Implementation:**

- Track a `dirty` boolean in the form (derived from `name`, `description`,
  `groups`, etc.).
- Route-internal navigation guard: TanStack Router
  `beforeLoad` on a parent route, or a more idiomatic
  `useBlocker` pattern (TanStack Router v1.x exposes
  `useBlocker({ shouldBlockFn })`). Confirm the exact API during
  implementation.
- Tab-close guard: standard `beforeunload` event listener inside the
  form component (or a hook `use-unsaved-changes-warning`), attached
  only when `dirty === true`, and detached on save / cancel.

If `useBlocker` is not available in the version in use, fall back to a
lightweight confirmation dialog triggered by a custom navigate wrapper
on the back link + form cancel button. The `beforeunload` listener
handles the tab-close case regardless.

### Data flow for edit route

```
/templates/$templateId/edit
  └── useSessionTemplateFull(templateId)
        ├── isLoading → <Skeleton />
        ├── error     → inline error + back link
        ├── data      → hydrate form via `initial` prop
```

This mirrors the existing `EditTemplateFormLoader` in `library.tsx`
(lines 1113-1156), which will be **moved** into the route file
(`templates.$templateId.edit.tsx`) and deleted from `library.tsx`.
Same treatment for `EditEventFormLoader`.

### Library cleanup

After the refactor, `library.tsx` loses:

- `sheetOpen`, `editingId`, `sheetMode`, `handleSaved`, `handleCancel` state
- `handleCreate`, `handleCreateEvent`, `handleEdit`, `handleEditEvent`
  become `navigate(...)` calls
- `<Sheet>`, `<SheetContent>`, `<SheetHeader>`, `<SheetTitle>`,
  `<SheetDescription>` imports for the template form path
- `SessionTemplateForm`, `EventTemplateForm`, `EditTemplateFormLoader`,
  `EditEventFormLoader` imports and definitions

Expected LOC reduction in `library.tsx`: ~120 lines.

`CreateExerciseSheet` (exercise creation -- different flow) stays as-is.

## Key Decisions

### ADR-021-01: Top-level `/templates/*` namespace

**Status:** Proposed
**Context:** Spec Q1 -- where should the new routes live?
**Decision:** Top-level `/templates/new` and `/templates/$templateId/edit`,
parallel to `/builder`.
**Alternatives considered:**

- `/builder/templates/*` -- nests templates under builder. Rejected
  because programs and templates are structural peers (a program
  references templates, not the other way around), and nesting would
  suggest templates are a sub-feature of programs.
- `/library/templates/*` -- nests editor under library. Rejected
  because the library is a list-view concept and the editor is a
  distinct long-lived destination.

**Consequences:**

- `/events/$templateId` (existing) and `/templates/$templateId/edit`
  (new) coexist as sibling namespaces. No route collision risk.
- Deep links can be shared as `/templates/{uuid}/edit`.

### ADR-021-02: Keep save/cancel inside the form body

**Status:** Proposed
**Context:** Should the header "save" button be hoisted out of
`SessionTemplateForm` / `EventTemplateForm`?
**Decision:** No. The form owns its save/cancel buttons. The route-level
header is purely navigational.
**Alternatives considered:**

- `useImperativeHandle` to expose `save()` from the form and render a
  header-level save button. Rejected because it adds coupling between
  layout and form internals and requires touching form code + tests for
  no functional gain.
- Duplicate save buttons in header and form body. Rejected as clutter.

**Consequences:**

- `TemplateEditorLayout` has no save-button slot; the header renders
  `← Library` + title only.
- Form internals, props, and tests remain unchanged.
- A future iteration can lift save into the header if needed (tracked
  as backlog, not a blocker).

### ADR-021-03: Drawer vs sheet for the exercise picker

**Status:** Proposed
**Context:** Spec Q3 + M4 -- how to render the exercise picker without
nesting sheets?
**Decision:** A route-local `ExercisePickerDrawer` component that is a
plain `<aside>` with fixed positioning (`lg:inset-y-0 lg:right-0
lg:w-[400px]`) on desktop and a full-width inline panel on mobile. Not
a radix `Dialog` / `Sheet` portal.
**Alternatives considered:**

- Inline-expanding panel that replaces the activity row during
  selection. Rejected because it loses search context when the user is
  building a long group and obscures the group's other rows.
- A true `<Sheet side="right">` instead of `side="bottom"`. Rejected
  because a sheet is still a modal portal; layering it over a sheet-less
  route is fine, but the point is to avoid the modal pattern entirely
  for sustained creative work.

**Consequences:**

- A small amount of CSS work to get the drawer transition right on
  mobile (full-width slide-up) and desktop (slide-in from right).
- The drawer can be dismissed via: (a) Escape key, (b) a dedicated close
  button, (c) tapping outside on mobile. On desktop, tapping outside
  does **not** dismiss because the drawer is not modal -- the main form
  remains interactive behind/beside it. This is intentional: the user
  can continue editing while the drawer is open.

### ADR-021-04: Extract `ExercisePickerPanel` for reuse

**Status:** Proposed
**Context:** `AddExerciseSheet` is used in four places. Only one is in
scope (the activity editor inside the template form). The other three
are in the live workout logging flow and the program builder's session
edit sheet.
**Decision:** Extract the headless inner UI into
`src/components/workout/exercise-picker-panel.tsx`. Both
`AddExerciseSheet` (existing, untouched consumers) and
`ExercisePickerDrawer` (new, template route) render the same panel.
**Consequences:**

- Consistent search UX across every exercise-picking surface.
- No regression risk for `log.$workoutId.tsx`,
  `manual-workout-form.tsx`, or
  `program-builder/session-edit-sheet.tsx`.
- The extraction is mechanical: move the JSX body and state into the
  panel, keep the sheet as a thin wrapper.

### ADR-021-05: Dirty-state guard via `useBlocker` + `beforeunload`

**Status:** Proposed
**Context:** Spec Q2 -- guard against losing unsaved work.
**Decision:** Use TanStack Router `useBlocker` for in-app navigation and
a `beforeunload` listener for tab close / reload. Both attach only when
the form is dirty and detach on save.
**Alternatives considered:**

- LocalStorage autosave. Rejected (Spec W1 -- explicitly out of scope
  for this feature).
- No guard at all. Rejected because one of the motivating user stories
  is "reloading the page should not lose my draft."

**Consequences:**

- Dependency on `useBlocker` API availability in the installed
  TanStack Router version. If unavailable, fall back to a custom
  navigate wrapper on form cancel + back link (covers in-app navigation
  minimally) and the `beforeunload` listener (covers tab close). Confirm
  during Step 1 of implementation.

## Risks and Unknowns

| Risk                                                                                                                                            | Likelihood | Mitigation                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| TanStack Router `useBlocker` API differs from expectation                                                                                       | Medium     | Verify API during Step 1 implementation; fall back to manual confirm on cancel/back + `beforeunload` for tab close      |
| `EventTemplateForm` (632 LOC) has different internal structure from `SessionTemplateForm`, requires different `PickerComponent` plumbing        | Medium     | Audit `EventTemplateForm` during Step 2; if the picker chain differs, add a matching prop or render a separate drawer   |
| Route codegen (`routeTree.gen.ts`) doesn't pick up the new files                                                                                | Low        | Run `bun run dev` once to trigger regeneration; inspect `routeTree.gen.ts` for the new routes                           |
| Library scroll preservation fails because current templates tab state is in `useState`, not URL                                                 | Low        | Promote `activeTab` to a search param in `library.tsx`; small self-contained change                                     |
| Back button lands user on `/library` with the wrong tab active                                                                                  | Medium     | Ensure save/cancel navigate with `search: { tab: 'templates' }` and that `library.tsx` reads the tab from search params |
| `AddExerciseSheet` consumers depend on behavior that leaks via the sheet wrapper (e.g. focus management, portal timing)                         | Low        | Keep the sheet wrapper's outer behavior identical; only the inner content moves into the panel                          |
| `session-edit-sheet.tsx` (program builder) is itself inside a sheet and uses `AddExerciseSheet` -- another sheet-in-sheet, but out of scope now | Noted      | Add a line to Follow-up: migrate this site to `ExercisePickerDrawer` in a future pass                                   |
| Draft-guard blocker fires on save/cancel and traps the user                                                                                     | Medium     | Clear `dirty` flag synchronously before `navigate` in save/cancel handlers                                              |
| Mobile viewport drawer transition causes jank on low-end devices                                                                                | Low        | Use CSS transforms only; respect `prefers-reduced-motion`                                                               |

## Stack-specific Notes

**React / TanStack Router:**

- File-based routing via dot notation:
  `templates.new.tsx` → `/templates/new`;
  `templates.$templateId.edit.tsx` → `/templates/$templateId/edit`.
- Use `createFileRoute(...)` with `validateSearch` for `templates.new`
  and typed `useParams()` for the edit route.
- Navigate with the typed `useNavigate()` hook.
- `routeTree.gen.ts` regenerates automatically under `bun run dev`.

**Zustand / React Query:**

- No store changes.
- `useSessionTemplateFull` is a query hook; already supports
  `id | undefined` passthrough. Edit route passes the param directly.

**Tailwind / Iron & Ember:**

- `max-w-5xl` wrapper per `layout-conventions.md`.
- No divider lines; tonal surfaces only (`bg-surface-gunmetal/60` for
  the drawer background on desktop, `bg-surface-pit/40` for row
  separators inside the panel).
- 48px minimum touch targets on drawer close button, exercise rows,
  save/cancel.
- ALL-CAPS tracking for nav/badges only; the "← Library" link uses
  mixed-case per `feedback-typography-uppercase` guidance.

**Testing:**

- `session-template-form.test.tsx` must pass unchanged (Spec A9).
- New route-level tests are not required (the routes are thin layout
  wrappers). Optional smoke test: render the route with a mocked
  `useSessionTemplateFull` and assert absence of `<Sheet>` in the DOM
  tree (Spec A6 mechanized).
- `manual-workout-form.test.tsx` mocks `AddExerciseSheet`; the
  extraction of `ExercisePickerPanel` must not change the exported
  `AddExerciseSheet` name or props surface, or the mock will break.

## Integration Points

- **`library.tsx`** -- consumer only; navigates to the new routes.
- **`routeTree.gen.ts`** -- codegen artifact; regenerates on dev server
  startup.
- **`AddExerciseSheet` consumers** -- unchanged API; consume the new
  panel transparently.
- **Tauri mobile shell** -- no change; TanStack Router handles routing
  inside the webview.
- **Supabase** -- no change; the same mutation hooks are used.

## Follow-ups / Backlog

- Migrate `program-builder/session-edit-sheet.tsx` off the
  sheet-inside-sheet pattern (it uses `AddExerciseSheet` while already
  inside a sheet -- same anti-pattern, different surface, out of scope
  here).
- Consider hoisting save into the route header via imperative handle if
  the in-form save button ever becomes awkward at full-page scale.
- Consider localStorage autosave for unsaved create drafts (Spec W1 --
  explicitly deferred).
- Audit other bottom sheets for the same anti-pattern (program builder,
  workout preview, session picker).

## ADR Summary (created in this phase)

- ADR-021-01: Top-level `/templates/*` namespace
- ADR-021-02: Keep save/cancel inside the form body
- ADR-021-03: Drawer, not sheet, for the exercise picker on the new
  routes
- ADR-021-04: Extract `ExercisePickerPanel` for reuse across all
  exercise-pick surfaces
- ADR-021-05: Dirty-state guard via `useBlocker` + `beforeunload`

ADRs will be materialized as individual files in `Context/Decisions/`
during Step 1 of implementation (before any code is written), so they
are reviewable as standalone records.
