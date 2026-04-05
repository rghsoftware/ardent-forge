# Implementation Steps: Per-Instance Scheduled Session Editing

**Spec:** Context/Features/013-Session-Instance-Editing/Spec.md
**Tech:** Context/Features/013-Session-Instance-Editing/Tech.md

## Progress

- **Status:** Complete
- **Current task:** None -- all phases done
- **Last milestone:** Review findings addressed

## Team Orchestration

### Team Members

- **schema-eng**
  - Role: Database migrations and Rust model/command updates
  - Agent Type: general-purpose
  - Resume: false
- **domain-eng**
  - Role: TypeScript domain types, builder state, data adapters, override merger
  - Agent Type: general-purpose
  - Resume: false
- **ui-eng**
  - Role: Session edit sheet, click routing, visual indicators, builder page wiring
  - Agent Type: general-purpose
  - Resume: false
- **integration-eng**
  - Role: Workout-start override merge, today page wiring
  - Agent Type: general-purpose
  - Resume: false
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: Schema & Domain Foundation

- [ ] S001: Add `overrides TEXT` column to `scheduled_sessions` in Tauri SQLite migration (`src-tauri/migrations/010_session_overrides.sql`). Update `ScheduledSessionRow` in `src-tauri/src/models.rs` to add `pub overrides: Option<String>`. Update `CreateScheduledSessionInput` in `src-tauri/src/commands/programs.rs` to add `overrides: Option<String>`. Update both INSERT queries (create and update paths) and SELECT column lists in `programs.rs` to include the `overrides` column.
  - **Assigned:** schema-eng
  - **Depends:** none
  - **Parallel:** true

- [ ] S002: Create Supabase migration `supabase/migrations/YYYYMMDDHHMMSS_add_session_overrides.sql` adding `overrides JSONB` column to `scheduled_sessions` with appropriate comment. No RLS changes needed.
  - **Assigned:** schema-eng
  - **Depends:** none
  - **Parallel:** true

- [ ] S003: Add `activityOverrideSchema`, `sessionOverridesSchema`, `ActivityOverride`, and `SessionOverrides` Zod types to `src/domain/types/program.ts`. Add optional `overrides` field to `scheduledSessionSchema`. Export new types from the domain barrel.
  - **Assigned:** domain-eng
  - **Depends:** none
  - **Parallel:** true

- [ ] S004: Update `SessionDraft` type in `src/components/program-builder/builder-state.ts` to add `notes?: string` and `overrides?: SessionOverrides` fields. Update `hydrateDraft` to map `ScheduledSession.notes` and `ScheduledSession.overrides` into `SessionDraft`. Update `assignSession` to clear overrides when assigning a new template (fresh start). Update `buildSessionsPayload` to include `notes` and serialize `overrides` (JSON stringify for Tauri, object for Supabase). Update `copyWeek` to propagate `notes` and `overrides` with copied sessions.
  - **Assigned:** domain-eng
  - **Depends:** S003
  - **Parallel:** false

- [ ] S004-T: Test builder-state changes (hydrateDraft maps notes + overrides correctly, assignSession clears overrides on template change, buildSessionsPayload includes notes + serialized overrides, copyWeek propagates notes + overrides, assignSession on same day preserves notes if same template)
  - **Assigned:** domain-eng
  - **Depends:** S004
  - **Parallel:** false

- [ ] S005: Update `TauriScheduledSessionResponse` in `src/lib/tauri-adapter.ts` to add `overrides: string | null`. Update `toScheduledSessionRowFromTauri` (or equivalent mapper) to pass through overrides. Update `toScheduledSession` in `src/lib/data-mapper.ts` to parse overrides JSON string into `SessionOverrides` using the Zod schema. Update `fromScheduledSession` to serialize `SessionOverrides` back to JSON string for persistence.
  - **Assigned:** domain-eng
  - **Depends:** S003
  - **Parallel:** true

🏁 MILESTONE: Phase 1 complete -- Schema and domain layer ready. Verify: overrides column exists in both SQLite and Postgres, domain types compile, builder state handles notes + overrides, adapter round-trips overrides correctly.
**Contracts:**

- `src/domain/types/program.ts` -- SessionOverrides, ActivityOverride types and scheduledSessionSchema with overrides field
- `src/components/program-builder/builder-state.ts` -- SessionDraft with notes + overrides, updated pure functions
- `src/lib/tauri-adapter.ts` -- TauriScheduledSessionResponse with overrides field
- `src/lib/data-mapper.ts` -- Mapper functions handling overrides serialization

### Phase 2: Override Merger & Workout Integration

- [ ] S006: Create `src/lib/override-merger.ts` with pure function `applyOverrides(prefilledGroups: PrefilledGroup[], overrides: SessionOverrides | undefined): PrefilledGroup[]`. Walk resolved groups, match activities by original activity ID (from template), swap `exerciseId` and/or re-resolve `setScheme` when override exists. Return modified groups. Silently skip orphaned override keys. No-op when overrides is null/undefined/empty.
  - **Assigned:** integration-eng
  - **Depends:** S003
  - **Parallel:** true

- [ ] S006-T: Test override merger (exercise swap applies correctly, setScheme swap applies correctly, combined exercise + setScheme override, orphaned activity ID silently skipped, null/undefined overrides is no-op, empty activityOverrides is no-op)
  - **Assigned:** integration-eng
  - **Depends:** S006
  - **Parallel:** false

- [ ] S007: Update `startProgrammedWorkout` in `src/hooks/use-active-workout.ts` to accept an optional `overrides?: SessionOverrides` parameter. After `resolveSessionTemplate()` returns `prefilledGroups`, call `applyOverrides(prefilledGroups, overrides)` before persisting to DB. Update `handleStartProgrammedSession` in `src/routes/_authenticated/index.tsx` to pass `todayContext.session.overrides` to `startProgrammedWorkout`.
  - **Assigned:** integration-eng
  - **Depends:** S006, S003
  - **Parallel:** false

🏁 MILESTONE: Phase 2 complete -- Override merger and workout-start integration ready. Verify against A-008 (overrides persist and apply at workout start), A-009 (partial overrides inherit from template).
**Contracts:**

- `src/lib/override-merger.ts` -- applyOverrides function signature and behavior

### Phase 3: UI -- Click Routing & Edit Sheet

- [ ] S008: Update `SessionSlot` in `src/components/program-builder/session-slot.tsx`: add `onEditSession` callback prop. Branch `handleClick`: if `session` exists, call `onEditSession(weekClientId, session)`; if empty, call `onPickSession(weekClientId, dayOfWeek)` (existing behavior). Add visual indicator (small icon or dot) when `session.notes` or `session.overrides?.activityOverrides` has content.
  - **Assigned:** ui-eng
  - **Depends:** S004
  - **Parallel:** true

- [ ] S009: Update `MobileDayRow` in `src/components/program-builder/mobile-block-editor.tsx`: add `onEditSession` callback prop, same branching logic as S008. Thread `onEditSession` through `MobileBlockEditor` -> `MobileBlockCard` -> `MobileWeekSection` -> `MobileDayRow` prop chain.
  - **Assigned:** ui-eng
  - **Depends:** S004
  - **Parallel:** true

- [ ] S010: Create `src/components/program-builder/session-edit-sheet.tsx` -- `SessionEditSheet` component using shadcn Sheet (follow `SessionPickerSheet` pattern). Props: `open`, `onOpenChange`, `session: SessionDraft`, `weekClientId: string`, `userId: string`, `onUpdate: (session: SessionDraft) => void`, `onRemove: () => void`, `onChangeTemplate: () => void`. Content sections: (1) Header with template name + session type badge, (2) Notes textarea bound to `session.notes`, (3) Activity list loaded from `useSessionTemplatesFull` showing each activity's exercise name, set scheme, and load -- with per-activity edit capability for exercise picker and set scheme editor, (4) Footer with "Change template" and "Remove session" action buttons. Activity overrides update `session.overrides.activityOverrides[activityId]` with changed fields. Reuse existing `SetSchemeEditor` for set scheme editing. Include "Reset to template" per-activity action (S-1).
  - **Assigned:** ui-eng
  - **Depends:** S004, S005
  - **Parallel:** false

- [ ] S011: Wire `SessionEditSheet` into `BuilderPage` (`src/routes/_authenticated/builder.tsx`). Add `editState` (selected `SessionDraft` + `weekClientId`, or null). Add `handleEditSession(weekClientId, session)` callback that sets `editState`. Add `handleEditUpdate(updatedSession)` that patches the draft via a new `updateSession` pure function in builder-state. Add `handleEditRemove` that calls existing `removeSession` + undo toast. Add `handleEditChangeTemplate` that closes edit sheet and opens picker for the same slot. Pass `onEditSession` to `BlockList` and `MobileBlockEditor`. Render `SessionEditSheet` conditionally.
  - **Assigned:** ui-eng
  - **Depends:** S008, S009, S010
  - **Parallel:** false

- [ ] S011-T: Test click routing and edit sheet wiring (clicking empty slot opens picker -- A-002, clicking filled slot opens edit sheet -- A-001, edit sheet displays template info -- A-003, notes persist in draft -- A-004, "Change template" opens picker -- A-005, "Remove session" clears slot with undo -- A-006, large screen and mobile both route correctly -- A-007, visual indicator appears on customized slots -- A-010)
  - **Assigned:** ui-eng
  - **Depends:** S011
  - **Parallel:** false

🏁 MILESTONE: Phase 3 complete -- Full UI functional. Verify against A-001 through A-007, A-010. All builder interactions working on large screen and mobile.
**Contracts:**

- `src/components/program-builder/session-edit-sheet.tsx` -- SessionEditSheet component
- `src/components/program-builder/session-slot.tsx` -- Updated with onEditSession and visual indicator
- `src/routes/_authenticated/builder.tsx` -- Full wiring of edit sheet state

### Phase 4: Validation & Polish

- [ ] S012: Full feature validation -- read-only inspection of all modified/created files against Spec.md testable assertions A-001 through A-011. Verify: click routing branches correctly, edit sheet renders template data, notes field persists through save/reload cycle, activity overrides stored as partial diffs, override merger handles all cases, visual indicator logic, large screen and mobile parity, workout-start merges overrides.
  - **Assigned:** validator
  - **Depends:** S007, S011
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- verify all assertions, full drift check

### Phase 5: Review Findings

- [x] S013: Add data-mapper override tests -- valid JSON string (Tauri path), valid pre-parsed object (Supabase path), malformed JSON, schema-invalid JSON, and `fromScheduledSession` round-trip test for overrides. Currently tests only cover `overrides: null`.
  - **Assigned:** domain-eng
  - **Depends:** S005
  - **Parallel:** true
  - **Source:** PR review P10-010

- [x] S014: Add typed Rust validation for SessionOverrides JSON structure in `create_program_full` and `update_program_full` (`src-tauri/src/commands/programs.rs`). Currently validates JSON syntax but not schema conformance -- a payload like `{"garbage": true}` is accepted. Deserialize to a typed Rust struct for defense-in-depth.
  - **Assigned:** schema-eng
  - **Depends:** S001
  - **Parallel:** true
  - **Source:** PR review P10-011

- [x] S015-T: Add test for `applyOverrides` behavior when setScheme override exists but `resolutionCtx` is omitted -- verify the override is skipped and the original sets are preserved.
  - **Assigned:** integration-eng
  - **Depends:** S006
  - **Parallel:** true
  - **Source:** PR review P10-012

🏁 MILESTONE: Review findings addressed

## Acceptance Criteria

- [ ] All testable assertions from Spec.md verified (A-001 through A-011)
- [ ] All tests passing (`bun run test`)
- [ ] No TODO/FIXME stubs remaining
- [ ] TypeScript compiles cleanly (`bun run build`)
- [ ] Lint passes (`bun run lint`)

## Validation Commands

```bash
bun run build        # TypeScript check + Vite build
bun run test         # Vitest (all tests)
bun run lint         # ESLint
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint
```
