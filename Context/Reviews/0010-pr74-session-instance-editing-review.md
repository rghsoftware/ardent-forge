# PR Review: feat/013-session-instance-editing -> develop

**Date:** 2026-04-05
**Feature:** Context/Features/013-Session-Instance-Editing/
**Branch:** feat/013-session-instance-editing
**PR:** #74
**Reviewers:** code-reviewer, test-analyzer, silent-failure-hunter, type-design-analyzer, comment-analyzer
**Status:** :green_circle: Resolved

## Summary

15 findings total across 5 review agents: 9 [FIX], 3 [TASK], 2 [ADR], 1 [RULE]. One critical issue (fabricated activity IDs causing silent override corruption), four high-severity fixes, and several medium/low improvements. The PR is architecturally sound with excellent test coverage on pure functions, but has error-handling gaps in the UI layer and a type design ambiguity worth formalizing.

## Findings

### Fix-Now

#### [FIX] P10-001: `findActivityId` returns fabricated ID causing silent override corruption

- **File:** src/components/program-builder/session-edit-sheet.tsx:393-415
- **Severity:** Critical
- **Detail:** When `findActivityId` can't match a flat index to an actual activity (template data inconsistency), it returns `unknown-${flatIndex}`. This fake ID becomes a key in the override map, which will never match a real activity in the override merger. User customizations are saved to the database but silently do nothing at workout time. Return `null` instead and filter out unresolvable entries, or show a warning banner.
- **Relates to:** S010 (session edit sheet)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Changed `findActivityId` to return `null` instead of fabricated ID; filtered out null entries in `templateActivities` memo

#### [FIX] P10-002: Stale closure in `handleEditRemove` Undo loses edits

- **File:** src/routes/\_authenticated/builder.tsx:197-213
- **Severity:** High
- **Detail:** `previousDraft` captures the draft at callback creation time via `[draft]` dependency. If the user makes other edits during the 5-second undo window, clicking Undo silently discards those edits. Use a ref (`draftRef.current`) to capture draft at invocation time, similar to the existing `editStateRef` pattern.
- **Relates to:** S011 (builder page wiring)
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `draftRef` to capture draft at invocation time instead of closure time; removed `[draft]` dependency

#### [FIX] P10-003: Guard clauses in builder.tsx lack user-facing error state (x3)

- **File:** src/routes/\_authenticated/builder.tsx:189, 199, 217
- **Severity:** High
- **Detail:** `handleEditUpdate`, `handleEditRemove`, and `handleEditChangeTemplate` all log `console.error` but set no user-facing error state. Per `.claude/rules/error-handling.md`, user-action guards must show a toast or error banner. Add `toast.error(...)` to each guard clause. The page already imports `toast` from `sonner`.
- **Relates to:** S011
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `toast.error(...)` to all three guard clauses in `handleEditUpdate`, `handleEditRemove`, and `handleEditChangeTemplate`

#### [FIX] P10-004: Template fetch error not handled in SessionEditSheet

- **File:** src/components/program-builder/session-edit-sheet.tsx:50
- **Severity:** High
- **Detail:** `useSessionTemplateFull` destructures `data` and `isLoading` but ignores `isError`. A network failure shows "No activities in this template" instead of an error message. Destructure and handle `isError` with an appropriate error UI.
- **Relates to:** S010
- **Status:** :white_check_mark: Fixed
- **Resolution:** Destructured `isError` from `useSessionTemplateFull` and added error UI state between loading and empty states

#### [FIX] P10-005: `applyOverrides` silently drops setScheme overrides without `resolutionCtx`

- **File:** src/lib/override-merger.ts:66
- **Severity:** Medium
- **Detail:** If a caller passes overrides with `setScheme` data but no `resolutionCtx`, the set scheme override is silently ignored while exercise swaps still apply. Add a `console.warn('[override-merger] ...')` when a setScheme override exists but no resolution context is available.
- **Relates to:** S006
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added `console.warn` when setScheme override exists but no `resolutionCtx` is provided

#### [FIX] P10-006: Orphaned section header in session-detail.tsx

- **File:** src/components/program-builder/session-detail.tsx:16-18
- **Severity:** Low
- **Detail:** The `SESSION_TYPE_BADGE` constant was moved to `constants.ts`, but its section separator comment ("Inline session type badge styles") was left behind as an empty block. Remove the orphaned section separator.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed orphaned section separator comment

#### [FIX] P10-007: JSDoc inaccuracy in `applyOverrides` -- "Returns a new array"

- **File:** src/lib/override-merger.ts:28
- **Severity:** Low
- **Detail:** JSDoc states "Returns a new array (does not mutate input)" but returns the same reference when no overrides apply. Tests explicitly verify this referential identity. Reword to: "Returns the original array when no overrides apply; returns a new array otherwise (never mutates input)."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Reworded JSDoc to accurately describe referential identity behavior

#### [FIX] P10-008: File path comment is noise

- **File:** src/lib/override-merger.ts:1
- **Severity:** Low
- **Detail:** `// src/lib/override-merger.ts` restates the file path visible in any editor. The descriptive comment on lines 2-4 provides actual value. Remove the path comment.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Removed file path comment from line 1

#### [FIX] P10-009: SQLite migration lacks comment unlike Supabase counterpart

- **File:** src-tauri/migrations/010_session_overrides.sql
- **Severity:** Low
- **Detail:** The SQLite migration is a bare `ALTER TABLE` with no comment. The Supabase migration has both a SQL comment and a `COMMENT ON COLUMN` statement. Add a brief comment for parity: `-- Add per-instance activity overrides (exercise swaps, set scheme changes). NULL = no overrides.`
- **Status:** :white_check_mark: Fixed
- **Resolution:** Added descriptive comment to SQLite migration

### Missing Tasks

#### [TASK] P10-010: Data-mapper tests only cover `overrides: null`

- **File:** src/lib/**tests**/data-mapper.test.ts
- **Severity:** High
- **Detail:** `toScheduledSession` has 13 lines of JSON parsing + Zod validation for overrides, but tests only add `overrides: null` to fixtures. Missing scenarios: valid JSON string (Tauri path), valid pre-parsed object (Supabase path), malformed JSON, schema-invalid JSON. Also missing: `fromScheduledSession` round-trip test for overrides.
- **Relates to:** S005
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S013 in Steps.md

#### [TASK] P10-011: Rust backend validates JSON syntax but not SessionOverrides structure

- **File:** src-tauri/src/commands/programs.rs
- **Severity:** Medium
- **Detail:** `create_program_full` and `update_program_full` validate overrides is parseable JSON (`serde_json::from_str::<serde_json::Value>`), but do not validate the JSON conforms to the `SessionOverrides` shape. A payload like `{"garbage": true}` would be accepted. Consider deserializing to a typed Rust struct for defense-in-depth.
- **Relates to:** S001
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S014 in Steps.md

#### [TASK] P10-012: Missing test for setScheme override without resolutionCtx

- **File:** src/lib/**tests**/override-merger.test.ts
- **Severity:** Low
- **Detail:** The `applyOverrides` function silently skips setScheme overrides when `resolutionCtx` is omitted. This defensive code path should have a test verifying the behavior so future changes don't accidentally break it.
- **Relates to:** S006-T
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S015-T in Steps.md

### Architectural Concerns

#### [ADR] P10-013: Triple/quadruple null representation for "no overrides"

- **File:** src/domain/types/program.ts, src/lib/override-merger.ts, src/lib/data-mapper.ts
- **Severity:** Medium
- **Detail:** `ScheduledSession.overrides` accepts `undefined`, `null`, `{}`, and `{ activityOverrides: {} }` as representations of "no overrides." Every consumer must defensively handle all variants. Recommended: add a `normalizeOverrides()` utility and consider narrowing the domain type from `.optional().nullable()` to just `.optional()`, letting the adapter layer handle `null` conversion. This would also simplify `override-merger.ts` lines 41-43.
- **Relates to:** S003, Tech.md type design
- **Status:** :white_check_mark: ADR created
- **Resolution:** ADR-009 (normalize-no-overrides-representation)

#### [ADR] P10-014: Orphaned override keys silently skipped with no logging

- **File:** src/lib/override-merger.ts:46-50
- **Severity:** Medium
- **Detail:** When a template is modified (activities removed/reordered) after a user has saved overrides, those overrides become orphaned and are silently ignored. The user's customizations disappear without any indication. Add `console.warn('[override-merger] Orphaned override key: ...')` and consider whether the UI should surface this state to users.
- **Relates to:** S006
- **Status:** :white_check_mark: ADR created
- **Resolution:** ADR-009 (orphaned-override-key-handling); also added orphaned key warning to override-merger.ts

### Convention Gaps

#### [RULE] P10-015: `useQuery` error state destructuring convention

- **Files:** src/components/program-builder/session-edit-sheet.tsx:50-51
- **Severity:** Medium
- **Detail:** The `useSessionTemplateFull` and `useExercises` hooks destructure `data` and `isLoading` but ignore `isError`. This pattern appeared in both hooks in the same file. Current rules don't explicitly require destructuring error state from query hooks. Consider adding to `.claude/rules/` a convention that all `useQuery`-based hooks must destructure `isError` and render an error state, at minimum for user-facing components.
- **Suggested rule:** `.claude/rules/error-handling.md` -- add section: "Query hooks in user-facing components must destructure and handle `isError`/`error` states. Showing stale or empty UI on fetch failure is a silent failure."
- **Status:** :white_check_mark: Rule updated
- **Resolution:** Added "Query Hook Error States" section to `.claude/rules/error-handling.md`

## Resolution Summary

**Resolved at:** 2026-04-05
**Session:** Resolve PR review findings for Feature 013

| Category  | Total  | Fixed | Tasks | ADRs  | Rules | Deferred | Discarded |
| --------- | ------ | ----- | ----- | ----- | ----- | -------- | --------- |
| [FIX]     | 9      | 9     | --    | --    | --    | --       | --        |
| [TASK]    | 3      | --    | 3     | --    | --    | --       | --        |
| [ADR]     | 2      | --    | --    | 2     | --    | --       | --        |
| [RULE]    | 1      | --    | --    | --    | 1     | --       | --        |
| **Total** | **15** | **9** | **3** | **2** | **1** | **0**    | **0**     |

## Resolution Checklist

- [x] All [FIX] findings resolved (P10-001 through P10-009)
- [x] All [TASK] findings added to Steps.md (P10-010, P10-011, P10-012)
- [x] All [ADR] findings have ADRs created or dismissed (P10-013, P10-014)
- [x] All [RULE] findings applied or dismissed (P10-015)
- [ ] Review verified by review-verify agent
