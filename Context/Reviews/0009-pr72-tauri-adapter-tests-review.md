# PR Review: worktree-fix+testing -> develop

**Date:** 2026-04-04
**Feature:** Context/Features/012-TauriAdapter-Tests/
**Branch:** worktree-fix+testing
**PR:** #72
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, comment-analyzer
**Status:** :yellow_circle: Partially resolved

## Summary

4 agents reviewed 11 changed files (+5,248/-171). No critical issues were introduced by this PR. 11 findings total: 3 FIX (pre-existing issues surfaced by review), 5 TASK (test coverage gaps and doc updates), 1 ADR (type sync concern), 2 RULE (no new rules needed -- convention gaps are minor). The PR is merge-ready; findings are improvements, not blockers.

## Findings

### Fix-Now

#### [FIX] P9-001: Spec.md and Steps.md still marked Status: Draft

- **File:** Context/Features/012-TauriAdapter-Tests/Spec.md:3, Steps.md:3
- **Severity:** Low
- **Detail:** Both documents are marked `Status: Draft` but the feature is fully implemented and in PR. Status should be `Done`.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated Status to Done in Spec.md, Steps.md, and Tech.md

#### [FIX] P9-002: Tech.md KD5 reads as open question but is resolved

- **File:** Context/Features/012-TauriAdapter-Tests/Tech.md (KD5, ~line 105)
- **Severity:** Low
- **Detail:** KD5 states "We need to verify whether they are exported" but the implementation has resolved this -- `getMonday` and `formatWeekLabel` are NOT exported and ARE tested indirectly through `getWeeklyVolume`. Update to be definitive.
- **Status:** :white_check_mark: Fixed
- **Resolution:** Updated KD5 heading and text to be definitive: "Are Not Exported"

#### [FIX] P9-003: Tech.md KD3 overstates invokeCommand coverage

- **File:** Context/Features/012-TauriAdapter-Tests/Tech.md (KD3, ~line 55)
- **Severity:** Low
- **Detail:** KD3 claims `invokeCommand` is exercised through "every adapter method" but not-implemented stubs throw errors without going through `invokeCommand`. Should clarify: "every adapter method that delegates to Rust."
- **Status:** :white_check_mark: Fixed
- **Resolution:** Clarified KD3 to say "every adapter method that delegates to Rust"

### Missing Tasks

#### [TASK] P9-004: Add malformed JSON handling tests for parseJson

- **File:** src/lib/**tests**/tauri-adapter.test.ts
- **Severity:** Medium
- **Detail:** No tests verify what happens when Rust returns malformed JSON in fields like `aliases`, `muscle_groups`, `equipment_required`. A test with `aliases: "not-valid-json{"` would catch regressions in the conversion layer and prevent silent `undefined` propagation.
- **Relates to:** TauriAdapter conversion layer (tauri-adapter.ts:530)
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S010 in Steps.md

#### [TASK] P9-005: Add DATABASE and INTERNAL error kind tests

- **File:** src/lib/**tests**/tauri-adapter.test.ts (error handling section, ~lines 3510-3567)
- **Severity:** Medium
- **Detail:** Error handling tests only cover NOT_FOUND, VALIDATION, non-TauriAppError, and string errors. Missing DATABASE (most common production IPC failure) and INTERNAL error kinds. These are the error shapes most likely to surface in production.
- **Relates to:** tauri-adapter.ts invokeCommand error wrapping
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S011 in Steps.md

#### [TASK] P9-006: Add Supabase getUnreadCounts happy path test

- **File:** src/lib/**tests**/supabase-adapter.test.ts
- **Severity:** Low
- **Detail:** `getUnreadCounts` only tests the empty/error case. The happy path where participations exist with actual unread messages is not tested on the Supabase adapter side (though the Rust side covers it well).
- **Relates to:** Supabase adapter chat methods
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S012 in Steps.md

#### [TASK] P9-007: Add isoToUnixSeconds edge case tests

- **File:** src/lib/**tests**/tauri-adapter.test.ts
- **Severity:** Low
- **Detail:** Timestamp conversion `isoToUnixSeconds` is only tested indirectly via `createWorkoutLog`. No tests for invalid ISO strings, empty strings, or null timestamps. Silent `NaN` propagation could cause data corruption.
- **Relates to:** tauri-adapter.ts timestamp conversion helpers
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S013 in Steps.md

#### [TASK] P9-008: Restore .bind() position comments in chat.rs INSERT OR REPLACE

- **File:** src-tauri/src/commands/chat.rs (~line 640 area)
- **Severity:** Low
- **Detail:** The refactor removed bind-parameter comments that explained which SQL parameter each `.bind()` corresponded to in a complex INSERT OR REPLACE query. Without them, developers must mentally count positions against the SQL string. Consider restoring position-numbered comments.
- **Status:** :white_check_mark: Task created
- **Resolution:** Added as S014 in Steps.md

### Architectural Concerns

#### [ADR] P9-009: TypeScript TauriAppError kind union out of sync with Rust ErrorKind

- **File:** src/lib/tauri-adapter.ts:476-480, src-tauri/src/error.rs
- **Severity:** Medium
- **Detail:** Rust `ErrorKind` enum includes `Unauthorized`, `Sync`, and `Network` variants. TypeScript `TauriAppError['kind']` only lists `NOT_FOUND | CONFLICT | VALIDATION | DATABASE | INTERNAL`. If Rust returns UNAUTHORIZED or SYNC, TypeScript code doing exhaustive switch/case will miss them. This is pre-existing but relevant since this PR adds tests exercising the error wrapping. Warrants a decision on whether to sync the types or handle unknown kinds with a fallback.
- **Relates to:** Error handling architecture across Rust/TS boundary
- **Status:** :white_check_mark: ADR created
- **Resolution:** ADR-008-tauri-error-kind-sync.md

### Convention Gaps

#### [RULE] P9-010: invokeCommand should log before re-throwing (pre-existing)

- **Files:** src/lib/tauri-adapter.ts:504-512
- **Severity:** High
- **Detail:** The `invokeCommand` catch block wraps errors in `AdapterError` and re-throws but never logs. Per `error-handling.md`, catch blocks must log with a bracketed module prefix. No `[tauri-adapter]` log entry appears for IPC failures. This was surfaced because the new tests exercise error paths without verifying any logging occurs.
- **Suggested rule:** Already covered by `.claude/rules/error-handling.md` -- this is a violation, not a gap. Track as backlog item.
- **Status:** :yellow_circle: Deferred
- **Resolution:** Added as B001 in Context/Backlog/Bugs.md

#### [RULE] P9-011: intToBool silent null coercion (pre-existing)

- **Files:** src/lib/tauri-adapter.ts:558-561
- **Severity:** Medium
- **Detail:** `intToBool` silently coerces `null` to `false` (or fallback) without logging. If Rust returns null for a non-nullable field like `completed`, all sets appear incomplete with zero diagnostic info. This could be a convention addition: "safety-net coercions at adapter boundaries should log when the fallback triggers."
- **Suggested rule:** Consider adding to `.claude/rules/error-handling.md`: "Adapter boundary fallbacks (null coercion, default values) should log at warn level when the safety net triggers for fields expected to be non-nullable."
- **Status:** :white_check_mark: Rule updated
- **Resolution:** Added "Adapter Boundary Fallbacks" section to .claude/rules/error-handling.md

## Resolution Summary

**Resolved at:** 2026-04-04
**Session:** PR #72 review resolution

| Category  | Total  | Fixed | Tasks | ADRs  | Rules | Deferred | Discarded |
| --------- | ------ | ----- | ----- | ----- | ----- | -------- | --------- |
| [FIX]     | 3      | 3     | --    | --    | --    | --       | --        |
| [TASK]    | 5      | --    | 5     | --    | --    | --       | --        |
| [ADR]     | 1      | --    | --    | 1     | --    | --       | --        |
| [RULE]    | 2      | --    | --    | --    | 1     | 1        | --        |
| **Total** | **11** | **3** | **5** | **1** | **1** | **1**    | **0**     |

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to Steps.md or backlog
- [x] All [ADR] findings have ADRs created or dismissed
- [x] All [RULE] findings applied or dismissed
- [ ] Review verified by review-verify agent
