# PR Review: feat/inline-exercise-creation → main

**Date:** 2026-04-11
**Feature:** Context/QuickPlans/2026-04-10-inline-exercise-creation.md
**Branch:** worktree-feat+inline-exercise-creation
**PR:** #98
**Reviewers:** pr-review-toolkit (code-reviewer, pr-test-analyzer, silent-failure-hunter)
**Status:** 🟢 Resolved

## Summary

8 findings total: 5 Fix-Now, 2 Missing Tasks, 0 Architectural Concerns, 1 Convention Gap.
No critical blockers. The most important items before merge are the `onCreated`
error attribution bug (P16-001), the isError silent failure now producing a UX-visible
duplicate-creation hazard (P16-003), and the missing AddExerciseSheet test file (P16-004).

## Findings

### Fix-Now

#### [FIX] P16-001: `onCreated` callback inside try block misattributes callback failures

- **File:** `src/components/exercises/create-exercise-sheet.tsx` ~line 118
- **Severity:** High
- **Detail:** `onCreated?.(created)` sits inside the same `try` block as `mutateAsync`.
  If the parent's `handleCreated` callback throws (e.g. `onExerciseSelected` throws),
  the catch block logs "Failed to create exercise" -- but the exercise was already persisted.
  The user sees both sheets close and the exercise vanish; the log blames the mutation.
  Fix: move `onCreated?.(created)` after the catch block, or wrap it in its own
  try-catch with a distinct `[create-exercise-sheet] onCreated callback threw:` prefix.
- **Status:** ✅ Resolved
- **Resolution:** —

#### [FIX] P16-002: `handleCreated` and `handleSelect` are byte-identical

- **File:** `src/components/workout/add-exercise-sheet.tsx` lines 45-61
- **Severity:** Medium
- **Detail:** Both callbacks execute the same three operations in the same order:
  `onExerciseSelected(exercise, 'STRAIGHT_SETS')` → `onOpenChange(false)` →
  `setSearchQuery('')`. Delete `handleCreated` and pass `handleSelect` as the `onCreated`
  prop. Divergence between the two copies in a future edit is a silent behavior split.
- **Status:** ✅ Resolved
- **Resolution:** —

#### [FIX] P16-003: `useExercises` / `useRecentlyUsedExercises` error states ignored

- **File:** `src/components/workout/add-exercise-sheet.tsx` lines 32-33
- **Severity:** High
- **Detail:** Neither query hook destructures `isError`, violating `error-handling.md`
  ("all useQuery-based hooks in user-facing components must handle isError"). This is
  pre-existing, but the new "Create exercise" CTA makes it a UX hazard: when the
  exercises fetch fails, `allExercises` defaults to `[]`, `filteredExercises` is empty,
  and the UI shows "No matches" + the CTA. Users who trust that empty state may
  create duplicate exercises. Render a distinct error state when either query errors.
- **Status:** ✅ Resolved
- **Resolution:** —

#### [FIX] P16-006: Fragile index-based checkbox selection in test

- **File:** `src/components/exercises/__tests__/create-exercise-sheet.test.tsx` line 131
- **Severity:** Low
- **Detail:** `screen.getAllByRole('checkbox')[0]` selects by DOM position. If muscle
  group and equipment checkboxes render in a different order, this silently clicks the
  wrong element and may still pass validation. Replace with
  `screen.getByRole('checkbox', { name: /chest/i })` to fail loudly on label change.
- **Status:** ✅ Resolved
- **Resolution:** —

#### [FIX] P16-008: `showCreateCta || createSheetOpen` conditional mount is unnecessary

- **File:** `src/components/workout/add-exercise-sheet.tsx` line 131
- **Severity:** Low
- **Detail:** `CreateExerciseSheet` renders nothing when `open=false` (Radix Sheet
  handles it via a portal). The guard exists to avoid passing a stale `defaultName`,
  but the `useEffect` in `CreateExerciseSheet` already handles the `open: false → true`
  transition. Mounting unconditionally is simpler and removes the implicit coupling
  between `showCreateCta` and `createSheetOpen`. Recommended replacement:
  ```tsx
  <CreateExerciseSheet
    open={createSheetOpen}
    onOpenChange={setCreateSheetOpen}
    defaultName={searchQuery}
    onCreated={handleSelect}
  />
  ```
- **Status:** ✅ Resolved
- **Resolution:** —

### Missing Tasks

#### [TASK] P16-004: `AddExerciseSheet` has no tests for the new creation flow

- **File:** `src/components/workout/add-exercise-sheet.tsx` (no test file exists)
- **Severity:** High
- **Detail:** The PR's core contract -- search no-match → CTA → create → auto-add to
  workout -- lives entirely in `AddExerciseSheet` and is unverified. A new file at
  `src/components/workout/__tests__/add-exercise-sheet.test.tsx` should cover:
  1. Search with no matches renders "Create exercise" button
  2. Clicking it mounts/opens `CreateExerciseSheet`
  3. After `handleCreated` fires: `onExerciseSelected` called with exercise +
     `'STRAIGHT_SETS'`, `onOpenChange(false)` called, search query clears
  4. `CreateExerciseSheet` stays mounted when `createSheetOpen=true` even if search
     results subsequently appear (the `showCreateCta || createSheetOpen` guard)
  5. `defaultName` passed to `CreateExerciseSheet` matches the current search query
- **Status:** ✅ Resolved
- **Resolution:** —

#### [TASK] P16-005: No test for `mutateAsync` rejection path in `CreateExerciseSheet`

- **File:** `src/components/exercises/__tests__/create-exercise-sheet.test.tsx`
- **Severity:** Medium
- **Detail:** The mock at line 27 always resolves. A test with a rejecting mock should
  assert: `onCreated` is not called, `onOpenChange` is not called with `false`, the
  sheet stays open, and the inline error message ("Failed to create exercise. Please
  try again.") is visible. Without this, accidentally calling `onCreated` on failure
  would go undetected.
- **Status:** ✅ Resolved
- **Resolution:** —

### Architectural Concerns

_None._

### Convention Gaps

#### [RULE] P16-007: No rule covering hook vs. component log ownership on mutation failure

- **Files:** `src/hooks/use-exercises.ts`, `src/components/exercises/create-exercise-sheet.tsx`
- **Severity:** Low
- **Detail:** `useCreateExercise` has an `onError` handler that logs
  `[exercises] Failed to create exercise`. The component's catch block also logs
  `[create-exercise-sheet] Failed to create exercise`. A single mutation failure
  produces two log lines with different module prefixes. The sibling hooks
  (`usePublishExercise`, `useUnpublishExercise`) own both logging and toast in `onError`
  with no component-level catch. No existing rule in `.claude/rules/` establishes
  which layer owns error logging for mutation hooks.
  Suggested addition to `error-handling.md`: when a `useMutation` hook has an `onError`
  handler, the consuming component should not also catch and log the same rejection --
  the hook is the single log owner. The component may still render `isError` state.
- **Status:** ✅ Resolved
- **Resolution:** —

## Resolution Checklist

- [x] All [FIX] findings resolved (P16-001, P16-002, P16-003, P16-006, P16-008)
- [x] All [TASK] findings added to plan or scheduled (P16-004, P16-005)
- [x] All [RULE] findings applied or dismissed (P16-007)
- [x] Review verified by review-verify agent
