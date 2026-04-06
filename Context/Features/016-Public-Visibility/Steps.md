# Implementation Steps: Public Visibility

**Spec:** Context/Features/016-Public-Visibility/Spec.md
**Tech:** Context/Features/016-Public-Visibility/Tech.md

## Progress

- **Status:** Complete
- **Current task:** --
- **Last milestone:** Feature complete (all 6 milestones passed)

## Team Orchestration

### Team Members

- **builder-db**
  - Role: Supabase migrations, RLS policies, RPCs, indexes
  - Agent Type: general-purpose
  - Resume: false
- **builder-rust**
  - Role: Tauri Rust models, commands, SQLite schema
  - Agent Type: general-purpose
  - Resume: false
- **builder-data**
  - Role: Domain types, data adapter, data mapper, query hooks
  - Agent Type: general-purpose
  - Resume: false
- **builder-ui**
  - Role: React components, route pages, UI integration
  - Agent Type: general-purpose
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: Database Layer

- [ ] S001: Supabase migration -- ALTER TABLE to add `is_public` column to
      `session_templates` and `exercises`. Add 8 new RLS SELECT policies for
      public visibility on `programs`, `blocks`, `block_weeks`,
      `scheduled_sessions`, `session_templates`, `activity_groups`, `activities`,
      and `exercises` (see Tech.md D1). Add partial indexes on
      `is_public = true` for `programs`, `session_templates`, and `exercises`.
  - **Assigned:** builder-db
  - **Depends:** none
  - **Parallel:** false
- [ ] S002: Supabase RPCs -- create `publish_program(p_program_id)` SECURITY
      DEFINER function that atomically sets `is_public = true` on the program,
      its referenced session templates, and their referenced custom exercises
      (see Tech.md D2). Create `publish_session_template(p_template_id)` that
      cascades to referenced custom exercises. Both verify ownership via
      `auth.uid()`.
  - **Assigned:** builder-db
  - **Depends:** S001
  - **Parallel:** false
- [ ] S003: Supabase RPC -- create `clone_session_template(p_template_id)`
      SECURITY DEFINER function that deep-copies a template with its activity
      groups and activities, assigns ownership to `auth.uid()`, sets
      `is_public = false` on the clone (see Tech.md D5).
  - **Assigned:** builder-db
  - **Depends:** S001
  - **Parallel:** true
- [ ] S002-T: Test publish RPCs (publish_program cascades to templates and
      exercises; publish_session_template cascades to exercises; non-owner
      publish raises exception; already-public items are idempotent)
  - **Assigned:** builder-db
  - **Depends:** S002
  - **Parallel:** false
- [ ] S003-T: Test clone_session_template RPC (cloned template has new ID and
      correct owner; activity groups and activities are deep-copied; clone
      is_public defaults to false; exercise references preserved)
  - **Assigned:** builder-db
  - **Depends:** S003
  - **Parallel:** true
- [ ] S001-T: Test RLS policies (non-owner can SELECT public program and its
      child rows; non-owner can SELECT public template and its child rows;
      non-owner can SELECT public custom exercise; non-owner CANNOT SELECT
      private content; existing owner and coach policies still work)
  - **Assigned:** builder-db
  - **Depends:** S002, S003
  - **Parallel:** false

🏁 MILESTONE: Database layer complete -- verify against A-004 through A-010,
A-021, A-022
**Contracts:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_public_visibility.sql` -- Schema
  changes, RLS policies, RPCs, and indexes for public visibility

### Phase 2: Domain Types, Adapters, and Rust

- [ ] S004: Update domain types -- add `isPublic: z.boolean()` to
      `exerciseSchema` in `src/domain/types/exercise.ts` and
      `sessionTemplateSchema` in `src/domain/types/session.ts`.
  - **Assigned:** builder-data
  - **Depends:** S001
  - **Parallel:** true
- [ ] S005: Update data mapper -- add `is_public` <-> `isPublic` mapping for
      exercises in `toExercise`/`fromExercise` and session templates in
      `toSessionTemplate`/`fromSessionTemplate` in `src/lib/data-mapper.ts`.
  - **Assigned:** builder-data
  - **Depends:** S004
  - **Parallel:** false
- [ ] S006: Update data adapter interface -- add `ProgramFilters` and
      `SessionTemplateFilters` interfaces to `src/lib/data-adapter.ts`. Add
      `scope?: 'mine' | 'public'` to existing `ExerciseFilters`. Update method
      signatures: `getPrograms(userId, filters?)`,
      `getSessionTemplates(userId, filters?)`. Add `publishProgram(programId)`,
      `publishSessionTemplate(templateId)`, `unpublishProgram(programId)`,
      `unpublishSessionTemplate(templateId)`, `unpublishExercise(exerciseId)`,
      `publishExercise(exerciseId)`,
      `cloneSessionTemplate(templateId)` to adapter interface.
  - **Assigned:** builder-data
  - **Depends:** S005
  - **Parallel:** false
- [ ] S007: Implement SupabaseAdapter -- implement filtered queries with scope
      logic for `getPrograms`, `getSessionTemplates`, and `getExercises`.
      Implement `publishProgram` (calls `publish_program` RPC),
      `publishSessionTemplate` (calls `publish_session_template` RPC),
      `unpublishProgram`/`unpublishSessionTemplate`/`unpublishExercise`
      (direct UPDATE `is_public = false`), `publishExercise`
      (direct UPDATE `is_public = true`),
      `cloneSessionTemplate` (calls `clone_session_template` RPC).
      Scope logic: `scope === 'public'` omits `user_id` filter and adds
      `.eq('is_public', true)`.
  - **Assigned:** builder-data
  - **Depends:** S006
  - **Parallel:** false
- [ ] S008: Implement TauriAdapter -- add `is_public` to local SQLite schema
      migration. Implement filtered queries for `getPrograms` and
      `getSessionTemplates`. For `scope === 'public'`, route to Supabase
      (online-only). Implement publish/unpublish/clone methods by delegating
      to Supabase (these are online-only operations).
  - **Assigned:** builder-rust
  - **Depends:** S006
  - **Parallel:** true
- [ ] S009: Update Rust models and commands -- add `is_public: Option<i32>` to
      `ExerciseRow` and `is_public: i64` to `SessionTemplateRow` in
      `src-tauri/src/models.rs`. Update INSERT/UPDATE SQL in
      `src-tauri/src/commands/exercises.rs` and
      `src-tauri/src/commands/session_templates.rs`. Add `is_public` to input
      structs.
  - **Assigned:** builder-rust
  - **Depends:** S004
  - **Parallel:** true
- [ ] S010: Update query hooks -- update `usePrograms` to accept
      `ProgramFilters`, `useSessionTemplates` to accept
      `SessionTemplateFilters`, and `useExercises` to include `scope` in
      `ExerciseFilters`. Add mutation hooks: `usePublishProgram`,
      `usePublishSessionTemplate`, `usePublishExercise`,
      `useUnpublishProgram`, `useUnpublishSessionTemplate`,
      `useUnpublishExercise`, `useCloneSessionTemplate`.
      Update `useCloneProgram` to set `source: 'MARKETPLACE'` instead of
      `'SHARED'` when cloning from public scope.
  - **Assigned:** builder-data
  - **Depends:** S007
  - **Parallel:** false

🏁 MILESTONE: Data layer complete -- verify against A-001 through A-003,
A-010, A-015 through A-017
**Contracts:**

- `src/domain/types/exercise.ts` -- Exercise schema with `isPublic`
- `src/domain/types/session.ts` -- SessionTemplate schema with `isPublic`
- `src/lib/data-adapter.ts` -- Filter interfaces, updated method signatures,
  new publish/clone methods
- `src/hooks/use-programs.ts` -- Program query and mutation hooks
- `src/hooks/use-session-templates.ts` -- Template query and mutation hooks
- `src/hooks/use-exercises.ts` -- Exercise query hook with scope

### Phase 3: Shared UI Components

- [ ] S011: Create `ScopeToggle` component -- "Mine / Public" segmented control
      at `src/components/shared/scope-toggle.tsx`. Accepts `value` and
      `onChange` props. Styled as a two-segment toggle matching the Iron & Ember
      design system (surface-charcoal background, ember highlight on active
      segment). Reusable across exercises, library programs, and library
      templates.
  - **Assigned:** builder-ui
  - **Depends:** S010
  - **Parallel:** true
- [ ] S012: Create shared `SearchInput` component at
      `src/components/shared/search-input.tsx`. Extract the pattern from
      `ExerciseSearchInput` -- controlled input with search icon, clear button,
      `border-b-2 border-surface-steel focus-within:border-ember` styling.
      Accepts `value`, `onChange`, and `placeholder` props.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] S013: Create `PublishDialog` component at
      `src/components/library/publish-dialog.tsx`. Three modes: program
      (cascading message: "Publishing this program will also make all its
      templates and exercises public"), template (cascading message about
      exercises), and exercise (simple toggle). Confirm/cancel actions. Uses
      existing dialog/sheet pattern.
  - **Assigned:** builder-ui
  - **Depends:** S010
  - **Parallel:** true
- [ ] S014: Create filter bar components -- `ProgramFilterBar` at
      `src/components/library/program-filter-bar.tsx` (source filter chips) and
      `TemplateFilterBar` at `src/components/library/template-filter-bar.tsx`
      (category filter chips). Follow `ExerciseFilterBar` pattern with
      horizontal scrolling chip rows.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** true

🏁 MILESTONE: Shared UI components complete -- verify against A-011, A-014
**Contracts:**

- `src/components/shared/scope-toggle.tsx` -- Reusable scope toggle component
- `src/components/shared/search-input.tsx` -- Reusable search input component
- `src/components/library/publish-dialog.tsx` -- Publish confirmation dialog
- `src/components/library/program-filter-bar.tsx` -- Program filter chips
- `src/components/library/template-filter-bar.tsx` -- Template filter chips

### Phase 4: List View Integration

- [ ] S015: Integrate search, filters, and scope toggle into the Library page
      programs tab. Add `useState` for search query, source filter, and scope.
      Wire `useDebouncedValue` for search. Pass filters to `usePrograms`. Add
      `ScopeToggle`, `SearchInput`, and `ProgramFilterBar` above the program
      list. When scope is "Public", show author display name on `ProgramCard`
      and a publish/unpublish toggle on owned programs. Add clone action on
      public programs (reuse `useCloneProgram` with `source: 'MARKETPLACE'`).
  - **Assigned:** builder-ui
  - **Depends:** S010, S011, S012, S013, S014
  - **Parallel:** true
- [ ] S016: Integrate search, filters, and scope toggle into the Library page
      templates tab. Same pattern as S015 but for session templates. Wire
      `SessionTemplateFilters` to `useSessionTemplates`. Add publish/unpublish
      and clone actions. When scope is "Public", show author display name.
  - **Assigned:** builder-ui
  - **Depends:** S010, S011, S012, S013, S014
  - **Parallel:** true
- [ ] S017: Integrate scope toggle into the Exercises page. Add `ScopeToggle`
      to the existing search/filter UI. Wire `scope` to `ExerciseFilters`.
      When scope is "Public", show author display name on exercise items. Add
      publish/unpublish toggle on owned custom exercises.
  - **Assigned:** builder-ui
  - **Depends:** S010, S011, S013
  - **Parallel:** true

🏁 MILESTONE: List views complete -- verify against A-012 through A-015,
A-018, A-020
**Contracts:**

- `src/routes/_authenticated/library.tsx` -- Library page with search, filters,
  scope toggle on both tabs
- `src/routes/_authenticated/exercises/index.tsx` -- Exercises page with scope
  toggle

### Phase 5: Detail Views and Author Attribution

- [ ] S018: Create read-only detail view for public programs at
      `src/components/library/public-program-detail.tsx`. Adapt
      `SharedProgramView` -- add author attribution header with display name
      (resolved via `useProfile` or inline query). Add "Clone to Library"
      button using `useCloneProgram`. Route: render within Library when a user
      taps a public program card.
  - **Assigned:** builder-ui
  - **Depends:** S015
  - **Parallel:** true
- [ ] S019: Create read-only detail view for public session templates at
      `src/components/library/public-template-detail.tsx`. Show template
      metadata, activity groups, activities with exercises. Add author
      attribution. Add "Clone to Library" button using
      `useCloneSessionTemplate`. Route: render within Library when a user taps
      a public template card.
  - **Assigned:** builder-ui
  - **Depends:** S016
  - **Parallel:** true
- [ ] S020: Author attribution hook -- create `useProfile(userId)` query hook
      (or reuse existing profile fetch) that returns `displayName` for a given
      user ID. Cache aggressively since the same author may appear on multiple
      items. Use in public list items and detail views.
  - **Assigned:** builder-data
  - **Depends:** S010
  - **Parallel:** true

🏁 MILESTONE: Detail views and attribution complete -- verify against A-016,
A-017, A-019, A-020

### Phase 6: Validation

- [ ] S021: Full feature validation -- read-only inspection of all completed
      work. Verify all 22 testable assertions from Spec.md. Check RLS policies
      with non-owner queries. Verify cascading publish and unpublish behavior.
      Verify clone flows for programs and templates. Verify search/filter
      infrastructure on all three list views. Verify author attribution.
      Verify Iron & Ember design compliance. Run `bun run build` and
      `bun run test` to confirm no regressions.
  - **Assigned:** validator
  - **Depends:** S015, S016, S017, S018, S019, S020
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- verify all assertions A-001 through A-022,
full drift check

## Acceptance Criteria

- [ ] All 22 testable assertions from Spec.md verified
- [ ] All tests passing (`bun run test`)
- [ ] Build succeeds (`bun run build`)
- [ ] No TODO/FIXME stubs remaining
- [ ] RLS policies tested with non-owner authenticated user
- [ ] Publish cascade is atomic (all-or-nothing)
- [ ] Clone produces fully independent copies
- [ ] "Public" scope is online-only; "Mine" works offline

## Validation Commands

- `bun run build` -- TypeScript check + Vite build
- `bun run test` -- Vitest test suite
- `bun run lint` -- ESLint
- `bunx supabase db push` -- Apply migration to local Supabase
