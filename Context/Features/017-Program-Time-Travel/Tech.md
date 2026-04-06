# Tech Plan: Program Time Travel

**Spec:** Context/Features/017-Program-Time-Travel/Spec.md
**Stacks involved:** React/TypeScript (frontend), Rust/Tauri (mobile shell), Supabase (backend)

## Architecture Overview

Two independent user actions -- **edit start date** and **jump position** -- that both modify the `program_activations` record and may create `program_week_statuses` records for skipped weeks.

The critical insight: **start date editing triggers position recomputation**. When the user changes `startDate`, the system derives the new `currentBlockOrdinal`/`currentWeekNumber` from `floor((today - newStartDate) / 7) + 1` mapped against the program's block/week structure. The Today page continues to read stored position fields for session resolution -- no change to `resolveTodaySession`'s core lookup logic, just a new pure function that computes position from dates.

```
User edits startDate
  -> computePositionFromDate(newStartDate, today, blocks, blockWeeks)
  -> returns { blockOrdinal, weekNumber }
  -> adapter.updateActiveProgram(userId, { startDate, currentBlockOrdinal, currentWeekNumber })

User jumps position
  -> user picks target block/week from program structure
  -> if forward: present skip label UI for intermediate weeks
  -> adapter.updateActiveProgram(userId, { currentBlockOrdinal, currentWeekNumber })
  -> if skip labels chosen: adapter.upsertWeekStatuses(activationId, statuses[])
```

## Key Decisions

### Decision 1: Position derivation strategy

**Options considered:**

- **A: Derive position at render time** -- Today page computes `(today - startDate)` on every render, ignoring stored position. Stored fields become redundant.
- **B: Derive position at edit time** -- When startDate changes, compute new position and persist it. Today page reads stored fields as before.

**Chosen:** Option B
**Rationale:** Preserves the existing `resolveTodaySession` contract and program advancement flow. Position fields remain the source of truth for "where am I in the program." Start date editing simply triggers a position update as a side effect. Manual position jumps remain independent of start date (per Spec W-2). This minimizes blast radius -- the Today page, program advancement, and workout completion flows are unchanged.

### Decision 2: Week skip label storage

**Options considered:**

- **A: JSON array on `program_activations`** -- e.g., `week_statuses: [{blockOrdinal, weekNumber, status}]`. Simple, no schema change.
- **B: New `program_week_statuses` table** -- Normalized, queryable, one row per labeled week.
- **C: Status field on `block_weeks`** -- Adds a column to the existing structural table.

**Chosen:** Option B -- new `program_week_statuses` table
**Rationale:** Skip labels are per-activation, not per-program-structure. Option C conflates structure with user state. Option A works but JSON arrays in SQLite/Postgres are harder to query and don't enforce referential integrity. A dedicated table is clean, normalized, and trivially queryable for future analytics (e.g., "how many weeks did the user skip across all programs").

**Schema:**

```sql
CREATE TABLE program_week_statuses (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  activation_id TEXT NOT NULL REFERENCES program_activations(id) ON DELETE CASCADE,
  block_ordinal INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activation_id, block_ordinal, week_number)
);
```

SQLite equivalent for Tauri uses `uuid()` from the existing UUID extension and `INTEGER` for timestamps.

### Decision 3: `update_active_program` Rust command

**Current state:** The Tauri adapter calls `invokeCommand('update_active_program', ...)` but this command does not exist in Rust. Only `set_active_program`, `get_active_program`, and `clear_active_program` are registered. This is a pre-existing gap -- program advancement via Tauri would fail at runtime.

**Decision:** Create the missing `update_active_program` Rust command and register it. Accept optional `current_block_ordinal`, `current_week_number`, and `start_date` parameters. Use a dynamic SQL UPDATE that only sets provided fields.

### Decision 4: UI surface -- sheet vs. route

**Options considered:**

- **A: New route** (`/program/settings` or `/program/$programId/manage`) -- dedicated page for program management.
- **B: Bottom sheet / drawer** -- triggered from both the Today page program card and library page. Keeps users in context.

**Chosen:** Option B -- bottom sheet
**Rationale:** Both entry points (Today page + library) benefit from in-context editing without navigation. A sheet containing a date picker for start date and a block/week selector for position is compact enough. Matches the existing pattern of session-edit sheets in the builder (F013). If the sheet becomes complex later, it can be promoted to a route.

### Decision 5: Position computation from start date

**Pure function:** `computePositionFromDate(startDate: string, today: string, blocks: Block[], blockWeeks: BlockWeek[])`

Logic:

1. `daysSinceStart = floor((today - startDate) / MS_PER_DAY)`
2. `globalWeek = floor(daysSinceStart / 7) + 1` (week 1 = days 0-6)
3. Walk blocks in ordinal order, accumulating each block's week count:
   - Block 1 has 4 weeks -> covers global weeks 1-4
   - Block 2 has 3 weeks -> covers global weeks 5-7
   - If `globalWeek` falls within a block's range, return `{ blockOrdinal, weekNumber: globalWeek - accumulated }`
4. If `globalWeek` exceeds total program weeks, clamp to last week of last block (program complete state handled separately)

This function lives in `src/lib/program-position.ts` alongside the existing `program-advancement.ts`.

### Decision 6: Position jump validation

Validation happens in a pure function: `validateProgramPosition(blockOrdinal: number, weekNumber: number, blocks: Block[], blockWeeks: BlockWeek[]): boolean`

Checks:

- Block with the given ordinal exists
- A BlockWeek with the given weekNumber exists for that block
- Returns false (with specific error) if either fails

This gates the UI -- the position selector only allows valid combinations. The adapter layer does NOT re-validate (UI is the boundary here since both values come from user selection against the program structure, not free-form input).

## Stack-Specific Details

### React/TypeScript (Frontend)

**Files to create:**

- `src/lib/program-position.ts` -- pure functions: `computePositionFromDate`, `validateProgramPosition`
- `src/lib/__tests__/program-position.test.ts` -- unit tests
- `src/components/program/time-travel-sheet.tsx` -- bottom sheet with start date picker + position selector + skip label UI
- `src/components/program/__tests__/time-travel-sheet.test.tsx` -- component tests
- `src/hooks/use-week-statuses.ts` -- TanStack Query hook for fetching/mutating week statuses
- `src/domain/types/program.ts` -- add `WeekStatus` type and schema

**Files to modify:**

- `src/lib/data-adapter.ts` -- extend `updateActiveProgram` signature with `startDate?`; add `upsertWeekStatuses` and `getWeekStatuses` methods
- `src/lib/supabase-adapter.ts` -- implement new/modified methods
- `src/lib/tauri-adapter.ts` -- implement new/modified methods
- `src/lib/database.types.ts` -- add `ProgramWeekStatusRow` type
- `src/lib/data-mapper.ts` -- add `toWeekStatus`/`fromWeekStatus` mappers
- `src/routes/_authenticated/index.tsx` -- add Time Travel sheet trigger to `ProgramSessionCard`
- `src/routes/_authenticated/library.tsx` -- add Time Travel sheet trigger to program card actions
- `src/components/today/program-session-card.tsx` -- add settings/edit action button

**Patterns to follow:**

- `.claude/rules/state-management.md` -- Zustand boundary validation if any store is involved
- `.claude/rules/error-handling.md` -- guard clauses with `[module]` prefix logging, query error states
- `.claude/rules/typescript-conventions.md` -- `satisfies Record<K, V>` for exhaustive maps
- `.claude/rules/layout-conventions.md` -- `max-w-5xl`, responsive padding

### Rust/Tauri (Mobile Shell)

**Files to create:**

- None (new function goes in existing file)

**Files to modify:**

- `src-tauri/src/commands/programs.rs` -- add `update_active_program` command, add `upsert_week_statuses` and `get_week_statuses` commands
- `src-tauri/src/models.rs` -- add `ProgramWeekStatusRow` struct
- `src-tauri/src/lib.rs` -- register new commands
- `src-tauri/src/schema.sql` (or migration) -- add `program_week_statuses` table

**Patterns to follow:**

- `.claude/rules/rust-tauri.md` -- existing Tauri command patterns, error handling via `AppError`
- Match existing `set_active_program` SQL pattern for the new UPDATE command

### Supabase (Backend)

**Files to create:**

- New migration file -- `program_week_statuses` table, RLS policies

**Files to modify:**

- None beyond the migration; no edge functions needed. All logic is client-side via the adapter.

**RLS policies:**

- `program_week_statuses`: Users can only read/write statuses for their own activations (join through `program_activations.user_id = auth.uid()`)

## Integration Points

### DataAdapter contract changes

```typescript
// Modified signature
updateActiveProgram(
  userId: string,
  updates: {
    currentBlockOrdinal?: number
    currentWeekNumber?: number
    startDate?: string  // NEW
  },
): Promise<ProgramActivation>

// New methods
getWeekStatuses(activationId: string): Promise<WeekStatus[]>
upsertWeekStatuses(
  activationId: string,
  statuses: Array<{ blockOrdinal: number; weekNumber: number; status: 'done' | 'skipped' }>
): Promise<WeekStatus[]>
```

### Rust IPC contract

```
update_active_program(user_id, current_block_ordinal?, current_week_number?, start_date?)
get_week_statuses(activation_id) -> Vec<ProgramWeekStatusRow>
upsert_week_statuses(activation_id, statuses: Vec<WeekStatusInput>) -> Vec<ProgramWeekStatusRow>
```

### Domain type addition

```typescript
// In src/domain/types/program.ts
export const weekStatusValueSchema = z.enum(['done', 'skipped'])
export type WeekStatusValue = z.infer<typeof weekStatusValueSchema>

export const weekStatusSchema = z.object({
  id: entityId,
  activationId: entityId,
  blockOrdinal: z.number().int().positive(),
  weekNumber: z.number().int().positive(),
  status: weekStatusValueSchema,
  createdAt: z.string(),
})
export type WeekStatus = z.infer<typeof weekStatusSchema>
```

## Risks & Unknowns

- **Risk:** Start date edit + position recomputation could put the user at a position past program completion (e.g., start date 6 months ago on a 4-week program).
  - **Mitigation:** Clamp to last week of last block. Show a notice that the program duration has been exceeded. Alternatively, surface "program complete" state.

- **Risk:** The pre-existing missing `update_active_program` Rust command means program advancement is broken on Tauri today.
  - **Mitigation:** Creating this command fixes both F017 and the pre-existing bug. Add a regression test.

- **Risk:** Skip label UI complexity -- presenting per-week choices for large jumps (e.g., skip 8 weeks) could be overwhelming.
  - **Mitigation:** Default all to "leave unmarked" with a bulk-select option ("mark all as skipped"). Individual overrides available but not required.

## Testing Strategy

- **Pure function unit tests:** `computePositionFromDate`, `validateProgramPosition` -- these are the core logic and must have thorough coverage including edge cases (same-day start, past-program-end, block boundaries).
- **Adapter integration tests:** Verify `updateActiveProgram` with `startDate` works on both Supabase and Tauri adapters. Verify `upsertWeekStatuses` creates/updates correctly.
- **Rust command tests:** Verify `update_active_program` SQL produces correct results, especially partial updates (only startDate, only position, both).
- **Component tests:** Time Travel sheet renders correct state, skip label UI appears only on forward jumps, confirmation shows before/after summary.
- **E2E/manual:** Full flow: activate program -> edit start date to 7 days ago -> verify Today page shows Week 2 session.
