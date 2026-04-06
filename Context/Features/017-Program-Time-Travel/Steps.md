# Implementation Steps: Program Time Travel

**Spec:** Context/Features/017-Program-Time-Travel/Spec.md
**Tech:** Context/Features/017-Program-Time-Travel/Tech.md

## Progress

- **Status:** Not started
- **Current task:** --
- **Last milestone:** --

## Team Orchestration

### Team Members

- **builder-domain**
  - Role: Domain types, pure functions, data mappers, adapter interfaces
  - Agent Type: general-purpose
  - Resume: true
- **builder-rust**
  - Role: Rust/Tauri commands, models, SQLite schema
  - Agent Type: general-purpose
  - Resume: true
- **builder-db**
  - Role: Supabase migrations, RLS policies
  - Agent Type: general-purpose
  - Resume: false
- **builder-adapters**
  - Role: Supabase and Tauri adapter implementations
  - Agent Type: general-purpose
  - Resume: true
- **builder-ui**
  - Role: React components, hooks, page integration
  - Agent Type: general-purpose
  - Resume: true
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: Domain Types & Pure Functions

- [ ] S001: Add `WeekStatus` domain type to `src/domain/types/program.ts` -- add `weekStatusValueSchema` (`'done' | 'skipped'`), `weekStatusSchema` (id, activationId, blockOrdinal, weekNumber, status, createdAt), and exported types. Add barrel export in `src/domain/types/index.ts`.
  - **Assigned:** builder-domain
  - **Depends:** none
  - **Parallel:** false
- [ ] S001-T: Test WeekStatus Zod schema validation (valid status values accepted, invalid rejected, required fields enforced, date format validated)
  - **Assigned:** builder-domain
  - **Depends:** S001
  - **Parallel:** false
- [ ] S002: Create `src/lib/program-position.ts` with two pure functions: (1) `computePositionFromDate(startDate, today, blocks, blockWeeks)` -- computes globalWeek from date diff, walks blocks in ordinal order to find blockOrdinal + weekNumber, clamps to last position if past program end. (2) `validateProgramPosition(blockOrdinal, weekNumber, blocks, blockWeeks)` -- returns boolean for whether the position exists in the program structure.
  - **Assigned:** builder-domain
  - **Depends:** none
  - **Parallel:** true
- [ ] S002-T: Test `computePositionFromDate` and `validateProgramPosition` (same-day start returns week 1 block 1, 7 days later returns week 2, block boundary crossing, past-program-end clamps to last week, multi-block programs, single-week blocks, invalid block ordinal rejected, invalid week number for block rejected, empty blocks array edge case)
  - **Assigned:** builder-domain
  - **Depends:** S002
  - **Parallel:** false
- [ ] S003: Extend `DataAdapter` interface in `src/lib/data-adapter.ts` -- add `startDate?: string` to `updateActiveProgram` updates parameter. Add `getWeekStatuses(activationId: string): Promise<WeekStatus[]>` and `upsertWeekStatuses(activationId: string, statuses: Array<{blockOrdinal: number, weekNumber: number, status: 'done' | 'skipped'}>): Promise<WeekStatus[]>` methods.
  - **Assigned:** builder-domain
  - **Depends:** S001
  - **Parallel:** true
- [ ] S004: Add `ProgramWeekStatusRow` type to `src/lib/database.types.ts`. Add `toWeekStatus` and `fromWeekStatus` mapper functions in `src/lib/data-mapper.ts`.
  - **Assigned:** builder-domain
  - **Depends:** S001
  - **Parallel:** true
- [ ] S004-T: Test `toWeekStatus` and `fromWeekStatus` data mappers (round-trip conversion, field name snake_case to camelCase mapping)
  - **Assigned:** builder-domain
  - **Depends:** S004
  - **Parallel:** false

🏁 MILESTONE: Phase 1 complete -- domain layer ready. Verify against A-006, A-008.
**Contracts:**

- `src/domain/types/program.ts` -- WeekStatus and WeekStatusValue types
- `src/domain/types/index.ts` -- Barrel export including new types
- `src/lib/data-adapter.ts` -- Updated DataAdapter interface with new methods
- `src/lib/program-position.ts` -- Pure functions for position computation and validation
- `src/lib/database.types.ts` -- ProgramWeekStatusRow type
- `src/lib/data-mapper.ts` -- toWeekStatus/fromWeekStatus mappers

### Phase 2: Database & Rust Backend

- [ ] S005: Create Supabase migration for `program_week_statuses` table with RLS policies. Table: id (uuid PK), activation_id (FK to program_activations ON DELETE CASCADE), block_ordinal (integer), week_number (integer), status (text CHECK IN done/skipped), created_at (timestamptz). UNIQUE constraint on (activation_id, block_ordinal, week_number). RLS: separate SELECT/INSERT/UPDATE/DELETE policies joining through program_activations.user_id = auth.uid().
  - **Assigned:** builder-db
  - **Depends:** none
  - **Parallel:** true
- [ ] S006: Add `ProgramWeekStatusRow` struct to `src-tauri/src/models.rs`. Add `program_week_statuses` table to SQLite schema in `src-tauri/src/schema.sql` (or equivalent migration file). Fields mirror Supabase schema with SQLite types (TEXT for id, INTEGER for timestamps).
  - **Assigned:** builder-rust
  - **Depends:** none
  - **Parallel:** true
- [ ] S007: Create `update_active_program` Rust command in `src-tauri/src/commands/programs.rs`. Accept optional `current_block_ordinal`, `current_week_number`, and `start_date` parameters. Build dynamic SQL UPDATE that only sets provided fields. Return updated `ProgramActivationRow`. Register command in `src-tauri/src/lib.rs`.
  - **Assigned:** builder-rust
  - **Depends:** S006
  - **Parallel:** false
- [ ] S007-T: Test `update_active_program` Rust command (update only start_date, update only position, update both, no-op when no fields provided, verify updated_at changes)
  - **Assigned:** builder-rust
  - **Depends:** S007
  - **Parallel:** false
- [ ] S008: Create `get_week_statuses` and `upsert_week_statuses` Rust commands in `src-tauri/src/commands/programs.rs`. `get_week_statuses` accepts activation_id, returns Vec<ProgramWeekStatusRow>. `upsert_week_statuses` accepts activation_id + Vec of status inputs, uses INSERT OR REPLACE with UNIQUE constraint. Register both commands in `src-tauri/src/lib.rs`.
  - **Assigned:** builder-rust
  - **Depends:** S006
  - **Parallel:** true
- [ ] S008-T: Test week status Rust commands (insert new statuses, upsert overwrites existing, get returns correct statuses for activation, empty result for no statuses, cascade delete when activation removed)
  - **Assigned:** builder-rust
  - **Depends:** S008
  - **Parallel:** false

🏁 MILESTONE: Phase 2 complete -- database and Rust backend ready. Verify against A-007 (backend half).
**Contracts:**

- `supabase/migrations/*_program_week_statuses.sql` -- Migration file with table + RLS
- `src-tauri/src/commands/programs.rs` -- update_active_program, get_week_statuses, upsert_week_statuses commands
- `src-tauri/src/models.rs` -- ProgramWeekStatusRow struct
- `src-tauri/src/lib.rs` -- Command registration

### Phase 3: Adapter Implementations

- [ ] S009: Implement `updateActiveProgram` with `startDate` support in `src/lib/supabase-adapter.ts`. Follow existing pattern: conditionally add `start_date` to the update row when provided.
  - **Assigned:** builder-adapters
  - **Depends:** S003, S005
  - **Parallel:** true
- [ ] S010: Implement `getWeekStatuses` and `upsertWeekStatuses` in `src/lib/supabase-adapter.ts`. `getWeekStatuses`: SELECT from program_week_statuses WHERE activation_id, map with `toWeekStatus`. `upsertWeekStatuses`: UPSERT using ON CONFLICT (activation_id, block_ordinal, week_number) DO UPDATE.
  - **Assigned:** builder-adapters
  - **Depends:** S003, S004, S005
  - **Parallel:** true
- [ ] S011: Implement `updateActiveProgram` with `startDate` support in `src/lib/tauri-adapter.ts`. Pass `start_date` to the `update_active_program` Tauri command.
  - **Assigned:** builder-adapters
  - **Depends:** S003, S007
  - **Parallel:** true
- [ ] S012: Implement `getWeekStatuses` and `upsertWeekStatuses` in `src/lib/tauri-adapter.ts`. Call the corresponding Tauri commands, map responses through `toProgramActivationRowFromTauri`-style mappers using `toWeekStatus`.
  - **Assigned:** builder-adapters
  - **Depends:** S003, S004, S008
  - **Parallel:** true
- [ ] S009-T: Test Supabase adapter -- updateActiveProgram with startDate, getWeekStatuses, upsertWeekStatuses (mock Supabase client, verify correct SQL shape, verify mapper usage, verify A-001 persistence, verify A-004 unmarked weeks create no records)
  - **Assigned:** builder-adapters
  - **Depends:** S009, S010
  - **Parallel:** false
- [ ] S011-T: Test Tauri adapter -- updateActiveProgram with startDate, getWeekStatuses, upsertWeekStatuses (mock invokeCommand, verify correct args passed, verify mapper usage)
  - **Assigned:** builder-adapters
  - **Depends:** S011, S012
  - **Parallel:** false

🏁 MILESTONE: Phase 3 complete -- full data layer operational. Verify against A-001, A-004, A-007, A-008, A-009.
**Contracts:**

- `src/lib/supabase-adapter.ts` -- Implemented adapter methods
- `src/lib/tauri-adapter.ts` -- Implemented adapter methods

### Phase 4: Hooks & UI Components

- [ ] S013: Create `src/hooks/use-week-statuses.ts` -- TanStack Query hook wrapping `getWeekStatuses` (query) and `upsertWeekStatuses` (mutation with optimistic update and query invalidation). Follow existing hook patterns in the codebase.
  - **Assigned:** builder-ui
  - **Depends:** S009, S010
  - **Parallel:** false
- [ ] S014: Create `src/components/program/time-travel-sheet.tsx` -- bottom sheet component with two sections: (1) **Start Date Edit**: date picker bound to activation.startDate, on change calls `computePositionFromDate` to preview new position, save button calls `updateActiveProgram` with new startDate + computed position. (2) **Position Jump**: block/week selector populated from program structure (validated via `validateProgramPosition`), shows current vs target position. On forward jump, renders skip label UI for intermediate weeks (each week row with done/skipped/unmarked toggle, bulk "mark all" option). Confirmation step shows summary before applying. Save calls `updateActiveProgram` for position + `upsertWeekStatuses` for any labeled weeks.
  - **Assigned:** builder-ui
  - **Depends:** S002, S003, S013
  - **Parallel:** false
- [ ] S014-T: Test TimeTravelSheet component (renders current start date and position, date change shows new computed position preview, forward jump shows skip label UI for intermediate weeks, backward jump hides skip label UI, confirmation shows before/after summary, invalid position prevented by selector constraints, bulk "mark all" applies to all intermediate weeks)
  - **Assigned:** builder-ui
  - **Depends:** S014
  - **Parallel:** false

🏁 MILESTONE: Phase 4 complete -- UI components ready. Verify against A-002, A-003, A-005, A-010, A-011.
**Contracts:**

- `src/components/program/time-travel-sheet.tsx` -- Complete sheet component
- `src/hooks/use-week-statuses.ts` -- Query hook for week statuses

### Phase 5: Integration & Wiring

- [ ] S015: Wire TimeTravelSheet into `src/components/today/program-session-card.tsx` -- add a settings/gear action button that opens the sheet. Pass activation, programFull, and callbacks. Ensure the sheet triggers query invalidation on save so the Today page re-renders with updated position.
  - **Assigned:** builder-ui
  - **Depends:** S014
  - **Parallel:** true
- [ ] S016: Wire TimeTravelSheet into `src/routes/_authenticated/library.tsx` -- add a "Manage" or settings action to the active program's card/menu that opens the sheet. Pass the same props as the Today page integration.
  - **Assigned:** builder-ui
  - **Depends:** S014
  - **Parallel:** true
- [ ] S015-T: Test Today page integration (settings button visible on program card, sheet opens with correct activation data, after save the Today page reflects new position)
  - **Assigned:** builder-ui
  - **Depends:** S015
  - **Parallel:** false
- [ ] S016-T: Test Library page integration (manage action visible on active program card, sheet opens with correct data)
  - **Assigned:** builder-ui
  - **Depends:** S016
  - **Parallel:** false

🏁 MILESTONE: Phase 5 complete -- feature fully integrated. Verify against A-002, A-005, A-006, A-010.

### Phase 6: Validation

- [ ] S017: Full feature validation -- verify all testable assertions A-001 through A-011. Run full test suite (`bun run test`). Check TypeScript compilation (`bun run build`). Run linter (`bun run lint`). Verify Rust compilation (`cd src-tauri && cargo check`). Manual walkthrough: activate program, edit start date to 7 days ago, confirm Today shows Week 2 session. Jump forward, verify skip label UI, confirm labels persist.
  - **Assigned:** validator
  - **Depends:** S015, S016, S015-T, S016-T
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- verify all assertions, full drift check.

## Acceptance Criteria

- [ ] All testable assertions A-001 through A-011 verified
- [ ] All tests passing (`bun run test`)
- [ ] TypeScript compiles (`bun run build`)
- [ ] Linter passes (`bun run lint`)
- [ ] Rust compiles (`cargo check` in src-tauri/)
- [ ] No TODO/FIXME stubs remaining

## Validation Commands

```bash
bun run test               # All Vitest tests pass
bun run build              # TypeScript compiles cleanly
bun run lint               # ESLint passes
cd src-tauri && cargo check # Rust compiles
cd src-tauri && cargo clippy -- -D warnings  # Clippy clean
```
