# PR Review: worktree-chore+tests → main

**Date:** 2026-04-15
**Feature:** N/A (test-debt chore branch)
**Branch:** worktree-chore+tests
**Reviewers:** pr-test-analyzer, code-reviewer
**Status:** ✅ Resolved

## Summary

PR #110 adds 57 unit tests for `src/components/program-builder/session-detail-utils.ts`. The
code-reviewer found no errors, warnings, or convention violations. The test-coverage analysis
identified 4 gaps -- all missing test cases -- ranging from important (reachable code paths
with no coverage) to minor (defensive/edge cases). No architectural concerns or fix-now issues.

## Findings

### Fix-Now

_None._

### Missing Tasks

#### [TASK] P16-001: formatLoad emom and descendingReps without-load paths untested

- **File:** `src/components/program-builder/__tests__/session-detail-utils.test.ts`
- **Severity:** Medium
- **Detail:** `formatLoad` handles `fixedSets | emom | descendingReps` in a shared branch with
  an early `if (!load) return '--'` guard. The `fixedSets` no-load path is exercised indirectly
  (via an `unspecified` load that routes through `formatLoadSpec`), but the `!load` guard itself
  is never hit. Both `emomSchema` and `descendingRepsSchema` define `load` as `optional()`, so
  these are legitimate, reachable states that have no test pinning the `'--'` return.

  Tests to add:

  ```typescript
  it('returns -- for emom without load', () => {
    const scheme = { type: 'emom', repsPerMinute: 10, totalMinutes: 20 } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('--')
  })

  it('returns -- for descendingReps without load', () => {
    const scheme = { type: 'descendingReps', repLadder: [21, 15, 9] } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('--')
  })
  ```

- **Status:** ✅ Fixed
- **Resolution:** Added two tests to `formatLoad` describe block covering the `!load` guard for `emom` and `descendingReps`.

#### [TASK] P16-002: buildGroupedActivities orphan activity behavior undocumented

- **File:** `src/components/program-builder/__tests__/session-detail-utils.test.ts`
- **Severity:** Medium
- **Detail:** `buildGroupedActivities` iterates sorted groups and filters activities by group ID.
  Any activity whose `activityGroupId` references a group not in the `groups` array is silently
  dropped. This is the current behavior but no test pins it as the intended contract. Without a
  test, a future refactor could inadvertently change this behavior (e.g., surfacing orphans or
  throwing) with no failing test to catch it. Data from the adapter could theoretically contain
  stale group references.

  Test to add:

  ```typescript
  it('silently drops activities belonging to a non-existent group', () => {
    const tpl = makeTemplateFull(
      [{ id: 'g1', ordinal: 1 }],
      [
        { activityGroupId: 'g1', ordinal: 1, exerciseId: 'ex-1', setScheme: bwScheme },
        {
          activityGroupId: 'nonexistent',
          ordinal: 2,
          exerciseId: 'ex-orphan',
          setScheme: bwScheme,
        },
      ],
    )
    const result = buildGroupedActivities(tpl)
    expect(result).toHaveLength(1)
    expect(result[0].exerciseId).toBe('ex-1')
  })
  ```

- **Status:** ✅ Fixed
- **Resolution:** Added orphan-drop test to `buildGroupedActivities` describe block, pinning the drop-silently contract.

#### [TASK] P16-003: fixedSets mixed number/range combinations not tested

- **File:** `src/components/program-builder/__tests__/session-detail-utils.test.ts`
- **Severity:** Low
- **Detail:** `formatSetsReps` for `fixedSets` evaluates `sets` and `reps` independently via
  separate ternaries. Tests cover both-numeric (`3x5`) and both-range (`3-5x8-12`) but not the
  two mixed cases: numeric sets + range reps, or range sets + numeric reps. These are distinct
  code paths and the schema allows them (`sets` and `reps` are each `z.union([z.number(), numberRangeSchema])`).
- **Status:** ✅ Fixed
- **Resolution:** Added two tests to `formatSetsReps` describe block: numeric sets + range reps (`3x8-12`) and range sets + numeric reps (`3-5x5`).

#### [TASK] P16-004: Default fallthrough branches not tested

- **File:** `src/components/program-builder/__tests__/session-detail-utils.test.ts`
- **Severity:** Low
- **Detail:** Both `formatSetsReps` and `formatLoad` have a final `default`/trailing `return '--'`
  for unrecognized `scheme.type` values. These are unreachable in strict TypeScript but could be
  hit if the type system is bypassed (cast or unvalidated API response). The `formatLoadSpec`
  unknown-type case IS tested (line 100-102). Parity with the other two functions would be
  complete coverage. Low risk given strict TS enforcement.
- **Status:** ✅ Fixed
- **Resolution:** Added `returns -- for unrecognized scheme type` test to both `formatSetsReps` and `formatLoad` describe blocks using `as unknown as SetScheme` cast.

### Architectural Concerns

_None._

### Convention Gaps

_None._

---

## Resolution Checklist

- [x] All [FIX] findings resolved
- [x] All [TASK] findings added to test file or dismissed
- [x] All [ADR] findings have ADRs created or dismissed
- [x] All [RULE] findings applied or dismissed
- [x] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-15
**Session:** Implemented all 4 missing test cases directly in the test file (chore branch, no Steps.md)

| Category  | Total | Resolved |
| --------- | ----- | -------- |
| [TASK]    | 4     | 4        |
| **Total** | **4** | **4**    |
