# Feature 021 -- Template Builder Route: Implementation Steps

## Team Composition

| Role             | Agent               | Responsibility                                                                            |
| ---------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Frontend Lead    | frontend-specialist | All route/component/layout work, form refactor threading, dirty-state guard               |
| Quality Engineer | quality-engineer    | Validation of acceptance assertions, sheet-absence checks, existing-test regression guard |
| Documentation    | content-writer      | ADR file creation, backlog follow-up entry                                                |

Single-stack feature (React/TypeScript only). No backend, no mobile-shell, no database work. `/impl` is the appropriate execution command -- this is isolated frontend work with clear task boundaries, no cross-domain coordination needed.

## Wave Structure

```
Wave 1 (setup + ADRs)    →  Wave 2 (extract picker) →  Wave 3 (routes + layout)
                                                       →  Wave 4 (library cleanup)
                                                                   →  Wave 5 (validation + polish)
```

Wave 2, 3, and 4 have linear dependencies because each consumes the previous wave's output. Within each wave, tasks may run in parallel where marked.

## Tasks

### Wave 1: Setup and ADRs

#### S001 — Materialize ADRs as files

**Owner:** content-writer
**Parallel:** yes (with S002)
**Blocks:** S010
**Acceptance:**

- Five files created in `Context/Decisions/`:
  - `ADR-021-01-top-level-templates-namespace.md`
  - `ADR-021-02-save-stays-in-form-body.md`
  - `ADR-021-03-drawer-not-sheet-for-picker.md`
  - `ADR-021-04-extract-exercise-picker-panel.md`
  - `ADR-021-05-dirty-state-guard.md`
- Each follows existing ADR template (Status, Context, Decision, Alternatives, Consequences). Reference `Context/Decisions/` for the convention.
- Content mirrors Tech.md "Key Decisions" section verbatim.

#### S002 — Verify TanStack Router `useBlocker` API

**Owner:** frontend-specialist
**Parallel:** yes (with S001)
**Blocks:** S014
**Acceptance:**

- Read the installed `@tanstack/react-router` version from `package.json`.
- Confirm `useBlocker` is exported and its signature (`useBlocker({ shouldBlockFn })` vs positional args vs deprecated alternative).
- Document findings inline in the task note on the plan file.
- If `useBlocker` is unavailable, record the fallback plan (manual confirm on cancel/back button + `beforeunload` only) and update S014 accordingly.

### Wave 2: Extract exercise picker panel

#### S003 — Extract `ExercisePickerPanel`

**Owner:** frontend-specialist
**Parallel:** no
**Blocks:** S004, S011
**Dependencies:** none
**Acceptance:**

- New file `src/components/workout/exercise-picker-panel.tsx`.
- Contains the search input, recently-used list, filtered results, and `onExerciseSelected` callback logic moved verbatim from `AddExerciseSheet`.
- Props: `{ userId?: string; onExerciseSelected: (ex, groupType) => void; autoFocus?: boolean }`.
- No `<Sheet>`, `<Dialog>`, or portal ancestors inside the panel.
- Pure UI; no routing concerns.

#### S004 — Convert `AddExerciseSheet` to a thin wrapper

**Owner:** frontend-specialist
**Parallel:** no
**Blocks:** S011, S015
**Dependencies:** S003
**Acceptance:**

- `AddExerciseSheet` now renders `<Sheet>...<ExercisePickerPanel/>...</Sheet>`.
- Exported name and props surface (`open`, `onOpenChange`, `onExerciseSelected`, `userId`) are unchanged.
- LOC reduced by roughly the size of the extracted panel.
- No consumer file (`log.$workoutId.tsx`, `manual-workout-form.tsx`, `session-edit-sheet.tsx`, `activity-editor.tsx`) needs any change yet.

#### S005-T — Regression test: existing `AddExerciseSheet` consumers

**Owner:** quality-engineer
**Parallel:** no
**Dependencies:** S004
**Blocks:** S006
**Acceptance:**

- Run `bun run test src/components/workout/__tests__/manual-workout-form.test.tsx`. All tests pass.
- Mock in `manual-workout-form.test.tsx` continues to work (the mock replaces `AddExerciseSheet` by name; extraction must not change the export name).
- If any test fails, escalate to S003/S004 owner for fix before proceeding.

### Wave 3: Routes and layout

#### S006 — Create `TemplateEditorLayout` component

**Owner:** frontend-specialist
**Parallel:** yes (with S007)
**Blocks:** S008, S009
**Dependencies:** S005-T
**Acceptance:**

- New file `src/components/session-builder/template-editor-layout.tsx`.
- Renders full-page shell: `min-h-[100dvh] bg-surface-anvil`, `mx-auto max-w-5xl`, `px-4 md:px-6 lg:px-8`.
- Header with: `← Library` link (TanStack Router `Link` to `/library?tab=templates`), title text, optional back override.
- Props: `{ title: string; children: ReactNode; onBack?: () => void }`.
- No save button in header (per ADR-021-02).
- No `border-t`/`border-b` dividers; tonal separation only.

#### S007 — Create `ExercisePickerDrawer` component

**Owner:** frontend-specialist
**Parallel:** yes (with S006)
**Blocks:** S008, S009
**Dependencies:** S003
**Acceptance:**

- New file `src/components/session-builder/exercise-picker-drawer.tsx`.
- Renders a plain `<aside>` -- **not** a `<Sheet>`, `<Dialog>`, or radix portal.
- Desktop (`lg:`): fixed `lg:inset-y-0 lg:right-0 lg:w-[400px] lg:z-40`, slide-in transform.
- Mobile: full-width bottom panel slide-up transform.
- Props mirror `AddExerciseSheet`: `{ open; onOpenChange; onExerciseSelected; userId }`.
- Close affordances: dedicated close button, Escape key listener. Desktop does NOT close on outside click (main form remains interactive).
- Respects `prefers-reduced-motion` on transitions.
- Internally renders `<ExercisePickerPanel />`.

#### S008 — Thread `PickerComponent` prop through form chain

**Owner:** frontend-specialist
**Parallel:** no
**Dependencies:** S006, S007
**Blocks:** S009, S012
**Acceptance:**

- `ActivityEditor` accepts `PickerComponent?: ComponentType<AddExerciseSheetProps>` prop, defaults to `AddExerciseSheet`. Uses `PickerComponent` instead of the hardcoded `AddExerciseSheet` JSX.
- `ActivityGroupEditor` accepts and forwards the same prop.
- `SessionTemplateForm` accepts and forwards the same prop.
- `EventTemplateForm` audited: if its activity editing path also reaches `AddExerciseSheet`, same prop threading applied. If it uses a different picker chain, note the deviation and handle appropriately (may require a second drawer component or a shared interface).
- No existing callsite breaks (default `PickerComponent` preserves old behavior).
- `bun run build` passes.

#### S009 — Create `/templates/new` route

**Owner:** frontend-specialist
**Parallel:** yes (with S010)
**Dependencies:** S008
**Blocks:** S012, S014
**Acceptance:**

- New file `src/routes/_authenticated/templates.new.tsx`.
- `createFileRoute('/_authenticated/templates/new')` with `validateSearch` for `{ mode: 'session' | 'event' }` (default `'session'`).
- Renders `<TemplateEditorLayout title={...}>` wrapping either `<SessionTemplateForm />` or `<EventTemplateForm />` based on `mode`.
- Passes `PickerComponent={ExercisePickerDrawer}` into the form.
- `onSave` and `onCancel` navigate to `/library?tab=templates` (or `router.history.back()` when previous entry is library).
- Title reads `"New template"` or `"New event"` based on mode.
- Route imports confirmed via `bun run build`.

#### S010 — Create `/templates/$templateId/edit` route

**Owner:** frontend-specialist
**Parallel:** yes (with S009)
**Dependencies:** S008, S001
**Blocks:** S012, S014
**Acceptance:**

- New file `src/routes/_authenticated/templates.$templateId.edit.tsx`.
- `createFileRoute('/_authenticated/templates/$templateId/edit')`.
- Move `EditTemplateFormLoader` and `EditEventFormLoader` logic from `library.tsx` into this route file (not re-imported from library).
- Hydrates via `useSessionTemplateFull(templateId)`.
- Renders correct form (session or event) based on the fetched template record. Audit how session vs event is distinguished in the domain (field on `SessionTemplate` or separate schema); use that as the switch.
- Loading / error / not-found states render inside `<TemplateEditorLayout>`.
- Passes `PickerComponent={ExercisePickerDrawer}` into the form.
- `onSave` / `onCancel` navigate back to `/library?tab=templates`.
- Route imports confirmed via `bun run build`.

**Milestone M1 -- Routes render forms outside a sheet** (maps to Spec A1, A2, A6)

### Wave 4: Library cleanup

#### S011 — Promote library `activeTab` to URL search param

**Owner:** frontend-specialist
**Parallel:** no
**Dependencies:** none (can start anytime, scheduled here for logical grouping)
**Blocks:** S012
**Acceptance:**

- `library.tsx` reads `tab` from `useSearch({ from: '/_authenticated/library' })` with values `'templates' | 'programs' | 'exercises'`.
- `setActiveTab` calls `navigate({ search: { tab: newTab } })`.
- Default tab when param missing: `'templates'`.
- Back-navigation to `/library?tab=templates` selects templates tab automatically.
- `bun run build` passes.

#### S012 — Remove template sheet from `library.tsx`

**Owner:** frontend-specialist
**Parallel:** no
**Dependencies:** S009, S010, S011
**Blocks:** S013, S015
**Acceptance:**

- Remove state: `sheetOpen`, `editingId`, `sheetMode`, `handleSaved`, `handleCancel`.
- Remove handlers: replace `handleCreate`, `handleCreateEvent`, `handleEdit`, `handleEditEvent` with `navigate({ to: '/templates/new', search: { mode: 'session'|'event' } })` / `navigate({ to: '/templates/$templateId/edit', params: { templateId } })`.
- Remove JSX: `<Sheet>...<SessionTemplateForm/>...</Sheet>` block (lines ~466-518 in current file).
- Remove imports: `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` (only if no other sheet in the file needs them -- `CreateExerciseSheet` is a wrapper, may or may not import these).
- Remove imports: `SessionTemplateForm`, `EventTemplateForm`, `useSessionTemplateFull` (if no longer used in this file), `Skeleton` (if no longer used).
- Delete `EditTemplateFormLoader` and `EditEventFormLoader` function definitions (moved to edit route in S010).
- `bun run build` passes. `bun run lint` passes with no new warnings.
- Expected LOC reduction: ~120 lines.

#### S013-T — Library regression smoke

**Owner:** quality-engineer
**Parallel:** no
**Dependencies:** S012
**Blocks:** S015
**Acceptance:**

- Click "New session" in library → lands on `/templates/new?mode=session` with empty form (Spec A3).
- Click "New event" → lands on `/templates/new?mode=event` (Spec A3 variant).
- Click "Edit" on a template row → lands on `/templates/$templateId/edit` with form hydrated (Spec A4).
- Save on new route → lands on `/library?tab=templates` (Spec A5).
- Cancel on new route → lands on `/library?tab=templates`.
- Library list data still renders correctly (no regression from removing state/handlers).

**Milestone M2 -- Library navigates to routes** (maps to Spec A3, A4, A5)

### Wave 5: Dirty-state guard, validation, polish

#### S014 — Dirty-state guard

**Owner:** frontend-specialist
**Parallel:** no
**Dependencies:** S002, S009, S010
**Blocks:** S016
**Acceptance:**

- Either a new hook `use-unsaved-changes-warning.ts` or inline logic in the route files.
- Tracks a `dirty` flag derived from form state (compare current values to `initial` for edit; any non-empty change for create).
- In-app navigation: uses TanStack Router `useBlocker` (per S002 findings). If unavailable, implement manual confirm on the back link and form cancel button.
- Tab-close / reload: `window.addEventListener('beforeunload', handler)` attached when `dirty === true`, detached on unmount or save.
- Blocker must be cleared synchronously before `navigate()` in save/cancel handlers to avoid trapping the user.
- Prompt copy: brief mixed-case "Discard unsaved changes?" -- no ALL-CAPS (per typography feedback memory).

#### S015 — Verify no sheet-inside-sheet

**Owner:** quality-engineer
**Parallel:** yes (with S014)
**Dependencies:** S012, S004
**Blocks:** S016
**Acceptance:**

- Manually open `/templates/new?mode=session`. Add a group. Click "Add exercise". Confirm the picker appears as a side drawer on desktop (`lg:`) and a bottom panel on mobile.
- Inspect DOM: at the time the drawer is visible, count `[data-slot="sheet-content"]` (or equivalent radix sheet marker) -- must be exactly zero for the template path (Spec A6).
- Confirm library's `CreateExerciseSheet` still works independently.
- Confirm `log.$workoutId.tsx`, `manual-workout-form.tsx`, `session-edit-sheet.tsx` picker flows still work (they use `AddExerciseSheet`, which now wraps the extracted panel).

#### S016 — Full validation pass

**Owner:** quality-engineer
**Parallel:** no
**Dependencies:** S013-T, S014, S015
**Blocks:** S017-D
**Acceptance:**

- All Spec.md testable assertions (A1-A10) verified:
  - A1. `/templates/new?mode=session` renders form without `<Sheet>` ancestor. ✓
  - A2. `/templates/$id/edit` hydrates and renders without `<Sheet>`. ✓
  - A3. Library "New session" navigates correctly. ✓
  - A4. Library "Edit" navigates correctly. ✓
  - A5. Save on new route lands on `/library?tab=templates`. ✓
  - A6. Exercise picker opens with zero `<Sheet>` instances. ✓
  - A7. Reloading `/templates/$id/edit` restores edit view. ✓
  - A8. `library.tsx` no longer imports template-form sheet primitives. ✓
  - A9. `bun run test src/components/session-builder/__tests__/session-template-form.test.tsx` passes unmodified. ✓
  - A10. `bun run build` and `bun run lint` clean. ✓
- Report result on the plan file. Fail fast if any assertion fails.

#### S017-D — Backlog entry for session-edit-sheet follow-up

**Owner:** content-writer
**Parallel:** yes (with S018-D)
**Dependencies:** S016
**Blocks:** none
**Acceptance:**

- New entry added to `Context/Backlog/` for migrating `src/components/program-builder/session-edit-sheet.tsx` off the sheet-inside-sheet pattern (it uses `AddExerciseSheet` while already inside its own sheet). Reference: Feature 021, ADR-021-03, Tech.md follow-ups.

#### S018-D — Mark feature done in backlog / feature index

**Owner:** content-writer
**Parallel:** yes (with S017-D)
**Dependencies:** S016
**Blocks:** none
**Acceptance:**

- Update `Context/Features/021-Template-Builder-Route/` with a final `Status: COMPLETE` note (or equivalent convention used in recent features -- check 018, 019, 020 for the pattern).
- Memory index updated if any non-obvious learnings emerged.

**Milestone M3 -- Feature accepted** (maps to Spec A7-A10)

## Contract Declarations

At milestone boundaries, the following contracts are locked:

**After Milestone M1 (end of Wave 3):**

- Public API of `SessionTemplateForm` and `EventTemplateForm` extended with optional `PickerComponent` prop; default preserves old behavior. No other prop changes.
- `ExercisePickerPanel` exports a stable headless component consumed by both `AddExerciseSheet` and `ExercisePickerDrawer`.
- New route paths `/templates/new` and `/templates/$templateId/edit` are locked.

**After Milestone M2 (end of Wave 4):**

- `library.tsx` no longer owns template-editor state or `<Sheet>` for the template form path.
- Library reads `tab` from URL search param.

**After Milestone M3 (end of Wave 5):**

- All Spec.md assertions green.
- No sheet-inside-sheet on the template-editor path.
- Existing tests pass unchanged.

## Execution Summary

- **18 tasks** (13 implementation, 3 test/regression, 2 documentation).
- **3 milestones** (routes live, library cleaned, feature accepted).
- **Recommended execution command:** `/impl 021` -- isolated frontend work, clear task boundaries, hub-and-spoke orchestration is sufficient.

## Next Command

```
/impl 021
```
