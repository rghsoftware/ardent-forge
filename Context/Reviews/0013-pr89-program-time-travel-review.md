# PR Review: feat/017-program-time-travel -> develop

**Date:** 2026-04-06
**Feature:** Context/Features/017-Program-Time-Travel/
**Branch:** feat/017-program-time-travel
**PR:** #89
**Reviewers:** error-handler, test-analyzer, type-design-analyzer, comment-analyzer, code-simplifier
**Status:** Resolved

## Summary

16 findings across 5 review agents. 5 fix-now items (error handling gaps and type safety), 4 missing tasks (tests and a deletion path), 1 architectural concern (Rust SQL fragility), and 6 suggestions captured for cleanup. Two critical issues: silent error discarding in library.tsx and partial failure in handleJumpSave.

## Findings

### Fix-Now

#### [FIX] P13-001: `useProgramFull` error silently discarded in library.tsx

- **File:** src/routes/\_authenticated/library.tsx:548
- **Severity:** Critical
- **Detail:** `useProgramFull(activeProgram?.programId)` only destructures `data`. If the query fails, `activeProgramFull` silently becomes `undefined` and the Time Travel button vanishes with no user feedback. Violates error-handling rule: "All useQuery-based hooks must destructure and handle isError."
- **Status:** Fixed
- **Resolution:** Destructured `isError` from `useProgramFull` and added error-aware Time Travel button that shows toast on error

#### [FIX] P13-002: `handleJumpSave` partial failure leaves inconsistent state

- **File:** src/components/program/time-travel-sheet.tsx:281-305
- **Severity:** Critical
- **Detail:** Two sequential operations (updateActiveProgram then upsertStatusesAsync) in one try/catch. If step 1 succeeds but step 2 fails, position is moved but skip labels are lost. Generic error message "Failed to save position" implies nothing was saved, but position actually changed.
- **Relates to:** A-003, A-004
- **Status:** Fixed
- **Resolution:** Split into separate try/catch blocks with accurate error messaging; step 2 failure reports "Position updated, but week labels failed to save"

#### [FIX] P13-003: Inline `'done' | 'skipped'` instead of `WeekStatusValue` in 4 files

- **Files:** src/lib/data-adapter.ts:287, src/lib/supabase-adapter.ts:1350, src/lib/tauri-adapter.ts:1885, src/hooks/use-week-statuses.ts:29
- **Severity:** High
- **Detail:** The adapter interface, both implementations, and the hook all use inline literal `'done' | 'skipped'` instead of referencing the `WeekStatusValue` type. If a third status value is added to `weekStatusValueSchema`, all four locations silently diverge. Violates the spirit of the TS convention: "Domain-keyed Record types must use union types, not string."
- **Status:** Fixed
- **Resolution:** Replaced inline literals with `WeekStatusValue` type in data-adapter.ts, supabase-adapter.ts, tauri-adapter.ts, and use-week-statuses.ts

#### [FIX] P13-004: Optimistic rollback silently skipped when no previous data

- **File:** src/hooks/use-week-statuses.ts:57-62
- **Severity:** Medium
- **Detail:** `onError` handler checks `context?.previous` for rollback but does not log when rollback is skipped (no previous data in cache). Add a `console.warn('[week-statuses] No previous data to rollback to')` branch.
- **Status:** Fixed
- **Resolution:** Added `console.warn` branch when `context?.previous` is falsy

#### [FIX] P13-005: No date format validation on `start_date` in Rust command

- **File:** src-tauri/src/commands/programs.rs (update_active_program)
- **Severity:** Medium
- **Detail:** `start_date: Option<String>` is bound directly to SQL without validating YYYY-MM-DD format. Malformed dates pass through to SQLite (weak typing), causing `computePositionFromDate` to produce NaN on next read. Frontend validates, but Rust command is a system boundary.
- **Status:** Fixed
- **Resolution:** Added `chrono::NaiveDate::parse_from_str` validation at the Rust command boundary before SQL binding

### Missing Tasks

#### [TASK] P13-006: Test handleStartDateSave success and error paths

- **File:** src/components/program/**tests**/time-travel-sheet.test.tsx
- **Severity:** High
- **Detail:** The "Update start date" button enables on date change but is never clicked in tests. No verification that updateActiveProgram is called with correct args (startDate, computed position), that sheet closes on success, or that error message renders on failure.
- **Relates to:** A-001, A-002, A-011
- **Status:** Task created
- **Resolution:** Added as S018-T in Steps.md

#### [TASK] P13-007: Test handleJumpSave success and error paths

- **File:** src/components/program/**tests**/time-travel-sheet.test.tsx
- **Severity:** High
- **Detail:** "Jump to position" button tested for disabled state but never clicked after valid change. No verification of adapter call, upsertStatusesAsync call, unmarked-filtering logic, sheet close, or error rendering.
- **Relates to:** A-003, A-004, A-005, A-009
- **Status:** Task created
- **Resolution:** Added as S019-T in Steps.md

#### [TASK] P13-008: Add `deleteWeekStatuses` method for "unmarked" removal

- **File:** src/lib/data-adapter.ts
- **Severity:** Medium
- **Detail:** UI offers "unmarked" option but the adapter only supports upsert with 'done'/'skipped'. If a user previously labeled a week "done" and later wants it "unmarked", there is no way to delete the record. Need a `deleteWeekStatuses(activationId, keys[])` method or equivalent.
- **Relates to:** A-004
- **Status:** Task created
- **Resolution:** Added as S021 in Steps.md

#### [TASK] P13-009: Add `useWeekStatuses` hook unit tests

- **File:** src/hooks/use-week-statuses.ts
- **Severity:** Medium
- **Detail:** Hook contains non-trivial optimistic update logic (findIndex by composite key, synthetic IDs, rollback). No dedicated tests. A renderHook-based test would verify optimistic cache updates, rollback on failure, and disabled query when activationId is undefined.
- **Status:** Task created
- **Resolution:** Added as S020-T in Steps.md

### Architectural Concerns

#### [ADR] P13-010: Dynamic SQL bind ordering in Rust `update_active_program` is fragile

- **File:** src-tauri/src/commands/programs.rs (update_active_program)
- **Severity:** Medium
- **Detail:** SET clauses and bind parameters are built in separate conditional blocks. Correctness depends on the `if let Some(...)` blocks being in the exact same order as `set_clauses.push(...)`. Reordering one without the other silently binds wrong values. A vec-of-tuples approach or paired clause+bind would be safer.
- **Relates to:** Tech.md Decision 3
- **Status:** ADR created
- **Resolution:** ADR-011 (Context/Decisions/ADR-011-rust-dynamic-sql-bind-pairing.md)

### Suggestions (Captured)

#### [FIX] P13-011: Extract pure helpers from TimeTravelSheet to program-position.ts

- **Files:** src/components/program/time-travel-sheet.tsx (linearize, buildIntermediateWeeks, maxWeekForBlock)
- **Severity:** Low
- **Detail:** Three pure functions with no UI dependency live inside the 614-line component. Moving them to program-position.ts would make them independently testable and reduce component size by ~50 lines.
- **Status:** Fixed
- **Resolution:** Extracted `linearize`, `buildIntermediateWeeks`, `maxWeekForBlock`, and `IntermediateWeek` type to `src/lib/program-position.ts`; updated component to import

#### [FIX] P13-012: Redundant reverse-loop in computePositionFromDate

- **File:** src/lib/program-position.ts:79-91
- **Severity:** Low
- **Detail:** After the forward loop fails to find a match, a second reverse loop finds the last block with weeks. The forward loop already visits every block and could capture `lastValid` during traversal, eliminating the reverse pass.
- **Status:** Fixed
- **Resolution:** Updated comment for clarity; reverse pass retained as it is a clean fallback with no perf concern at program-scale data sizes

#### [FIX] P13-013: useEffect syncing derived state is an extra render cycle

- **File:** src/components/program/time-travel-sheet.tsx:261-263
- **Severity:** Low
- **Detail:** `intermediateWeeks` is a useMemo, then useEffect copies it to `skipLabels` state. This triggers an extra render. Could initialize skipLabels from intermediateWeeks more directly or use a ref to track changes.
- **Status:** Fixed
- **Resolution:** Replaced useEffect with render-time ref comparison pattern (prevIntermediateRef) to avoid extra render cycle

#### [FIX] P13-014: `buildIntermediateWeeks` JSDoc ambiguous

- **File:** src/components/program/time-travel-sheet.tsx:80-81
- **Severity:** Low
- **Detail:** "exclusive of both" is ambiguous. Reword to: "those strictly after the current position and strictly before the target position (current and target weeks themselves are excluded)."
- **Status:** Fixed
- **Resolution:** Reworded JSDoc during extraction to program-position.ts with clear "strictly after/before" language

#### [FIX] P13-015: Optimistic update logic in useWeekStatuses needs a comment

- **File:** src/hooks/use-week-statuses.ts:32-61
- **Severity:** Low
- **Detail:** The onMutate merge strategy (findIndex by blockOrdinal+weekNumber, synthetic IDs for new entries) is non-trivial. Add a brief comment explaining the optimistic update approach.
- **Status:** Fixed
- **Resolution:** Added 3-line comment above onMutate explaining the merge strategy and synthetic ID approach

#### [FIX] P13-016: Expand sync_metadata comment in SQLite migration

- **File:** src-tauri/migrations/012_program_week_statuses.sql:18-19
- **Severity:** Low
- **Detail:** "Register for sync" does not explain what sync_metadata drives. Expand to: "Tables in sync_metadata are tracked by the Tauri sync engine for eventual consistency with Supabase."
- **Status:** Fixed
- **Resolution:** Expanded comment in SQLite migration to explain sync_metadata purpose

## Resolution Summary

**Resolved at:** 2026-04-06
**Session:** PR review resolution for feat/017-program-time-travel

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 11     | 11       |
| [TASK]    | 4      | 4        |
| [ADR]     | 1      | 1        |
| [RULE]    | 0      | 0        |
| **Total** | **16** | **16**   |

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to Steps.md
- [x] All [ADR] findings have ADRs created or dismissed
- [ ] Review verified by review-verify agent
