# PR Review: feat/p17-adapter-test-coverage → main

**Date:** 2026-04-15
**Feature:** Context/QuickPlans/Done/2026-04-15-p17-adapter-test-coverage.md
**Branch:** feat/p17-adapter-test-coverage
**Reviewers:** pr-test-analyzer, code-reviewer, silent-failure-hunter
**Status:** ✅ Resolved

## Summary

6 findings total across 2 source files. The test additions are accurate and well-structured,
but the production error handling in `mapScheduledSession` has a critical silent-failure design
problem: a single catch block conflates JSON parse errors and Zod schema errors, causing valid
overrides data to be silently dropped on schema mismatch. 4 fix-now items and 1 missing task.

## Findings

### Fix-Now

#### [FIX] P19-001: `mapScheduledSession` catch conflates `SyntaxError` and `ZodError`
- **File:** `src/lib/supabase-adapter.ts:486-495`
- **Severity:** Critical
- **Detail:** The single `catch` block traps both `JSON.parse` failures (malformed data, expected)
  and `sessionOverridesSchema.parse()` failures (Zod schema mismatch, a data integrity signal).
  Both receive `console.warn` + `overrides = undefined`, silently dropping a user's valid
  per-session overrides after any schema change or migration regression. Zod failures should
  `console.error` and be treated as an integrity event, not a graceful degradation.
  Split the catch:
  ```typescript
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.warn(`[supabase-adapter] Failed to parse overrides JSON for session ${r.id as string}, falling back to undefined:`, err)
    } else {
      console.error(`[supabase-adapter] overrides schema validation failed for session ${r.id as string}. Data integrity issue:`, err)
    }
    overrides = undefined
  }
  ```
- **Status:** ✅ Fixed
- **Resolution:** Split catch block: `z.ZodError` → `console.error` (integrity event), other errors → `console.warn` (expected bad input). Combined with P19-002 fix.

#### [FIX] P19-002: `mapScheduledSession` uses inline `JSON.parse` instead of `parseJsonOrValue`
- **File:** `src/lib/supabase-adapter.ts:487`
- **Severity:** High
- **Detail:** Every other JSONB column in `supabase-adapter.ts` (lines 344-411: `restBetweenGroups`,
  `timeCap`, `eventMetadata`, `restBetweenRounds`, `setScheme`) uses the shared `parseJsonOrValue`
  utility. The `overrides` field uses a hand-rolled `typeof r.overrides === 'string' ? JSON.parse(r.overrides) : r.overrides`
  inline. If `parseJsonOrValue` is updated (logging, error format, Sentry hooks), `overrides`
  silently stays on the old path. Replace with `parseJsonOrValue(r.overrides as string | object, 'overrides')`.
- **Status:** ✅ Fixed
- **Resolution:** Replaced inline JSON.parse with `parseJsonOrValue(r.overrides as string | object, 'overrides')`. Combined with P19-001 catch-split fix.

#### [FIX] P19-004: Warn spy doesn't assert session ID in the message
- **File:** `src/lib/__tests__/supabase-adapter.test.ts:1162`
- **Severity:** Medium
- **Detail:** The malformed-JSON test asserts `expect.stringContaining('[supabase-adapter]')` but
  not that the session ID appears in the warn message. The production code includes the session ID
  for production debuggability (`Failed to parse overrides for scheduled session ${r.id}`). If a
  future refactor strips the ID, the test still passes. Add a second
  `expect.stringContaining('<session-id>')` matcher.
- **Status:** ✅ Fixed
- **Resolution:** Added second `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ss-001'), ...)` assertion.

#### [FIX] P19-005: Warn spy cleanup is fragile if an assertion throws before `mockRestore()`
- **File:** `src/lib/__tests__/supabase-adapter.test.ts:1151-1167`
- **Severity:** Low
- **Detail:** `warnSpy.mockRestore()` is called at the end of the test body. If either
  `expect(result!.scheduledSessions[0].overrides).toBeUndefined()` or the `warnSpy`
  assertion throws, the spy leaks into subsequent tests. Vitest does not auto-restore spies
  unless `restoreMocks: true` is configured. Wrap spy setup/restore in `try/finally`, or
  move the spy to a scoped `afterEach`.
- **Status:** ✅ Fixed
- **Resolution:** Wrapped all assertions in `try/finally { warnSpy.mockRestore() }` to guarantee cleanup.

#### [FIX] P19-006: Outer catch wraps error with `new Error(msg)` losing original error type
- **File:** `src/lib/supabase-adapter.ts:507-510`
- **Severity:** Low
- **Detail:** The outer catch block in `mapScheduledSession` uses
  `throw new Error(`Failed to map scheduled session (${r.id}): ${err.message}`)` which
  discards the original error's type and stack chain. Use `{ cause: err }` to preserve it:
  ```typescript
  throw new Error(`Failed to map scheduled session (${r.id as string})`, { cause: err })
  ```
- **Status:** ✅ Fixed
- **Resolution:** Replaced multi-argument `new Error(msg: ${err.message})` with `new Error(msg, { cause: err })`.

### Missing Tasks

#### [TASK] P19-003: Overrides happy-path not covered by any test
- **File:** `src/lib/__tests__/supabase-adapter.test.ts`
- **Severity:** Medium
- **Detail:** `scheduledSessionRow.overrides` is `null` in all existing fixtures, so the
  `if (r.overrides != null)` block in `mapScheduledSession` is never entered in any passing
  test. Neither the string-parse branch (Tauri/SQLite path) nor the object-passthrough branch
  (Supabase PostgREST path) has a green assertion. Add two tests: one with
  `overrides: JSON.stringify({ ... })` asserting parsed output, one with a pre-parsed object
  asserting direct passthrough.
- **Relates to:** P17-009 (fixture branch coverage)
- **Status:** ✅ Task created
- **Resolution:** Added as B009 in Context/Backlog/Bugs.md (no active Steps.md for this completed QuickPlan).

## Resolution Checklist
- [x] All [FIX] findings resolved (P19-001, P19-002, P19-004, P19-005, P19-006)
- [x] All [TASK] findings added to backlog (P19-003 → B009)
- [x] Review verified by review-verify agent

## Resolution Summary
**Resolved at:** 2026-04-15
**Session:** resolve-review 0019

| Category | Total | Resolved |
|---|---|---|
| [FIX] | 5 | 5 |
| [TASK] | 1 | 1 |
| **Total** | **6** | **6** |
