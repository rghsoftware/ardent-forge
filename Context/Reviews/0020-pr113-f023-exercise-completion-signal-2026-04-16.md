# PR Review: feat/f023-exercise-completion-signal → main

**Date:** 2026-04-16
**Feature:** Context/Features/023-Exercise-Completion-Signal/
**Branch:** feat/f023-exercise-completion-signal
**PR:** #113
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter (automated agents)
**Status:** 🟢 Resolved

## Summary

10 findings total: 7 [FIX], 3 [TASK], 0 [ADR], 0 [RULE]. Two critical blockers --
`allActivitiesDone` is broken for circuit-modality workouts (always returns false when
any circuit is present), and both A-006 and A-003 spec tests do not exercise the
handlers they claim to cover. Three pre-existing error-handling issues were also
surfaced in code touched adjacent to this PR.

## Findings

### Fix-Now

#### [FIX] P20-001: `allActivitiesDone` permanently false for workouts containing circuits
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:290-294`
- **Severity:** Critical
- **Detail:** The derivation flattens all activities regardless of group type:
  ```tsx
  loggedGroups.flatMap((g) => g.activities).every((a) => skippedActivityIds.has(a.id))
  ```
  Circuit activities go through `CircuitPanel` -- no `onSkipExercise` is wired to
  them, so they never enter `skippedActivityIds`. Any workout containing a CIRCUIT
  group will never show the "ALL EXERCISES DONE -- READY TO FINISH?" banner, even
  after every straight-set exercise is marked done.
  **Fix:** Filter out CIRCUIT groups before flattening.
- **Relates to:** A-008 (skippedActivityIds semantics), all-done banner behavior
- **Status:** ✅ Fixed
- **Resolution:** Added `.filter((g) => g.groupType !== 'CIRCUIT')` before `.flatMap()` in `allActivitiesDone` derivation

#### [FIX] P20-004: "Done" and "Add set" buttons below 48px gym-floor touch target
- **File:** `src/components/workout/exercise-block.tsx:210-227`
- **Severity:** High
- **Detail:** Both action buttons use `py-2 text-xs` yielding ~28-32px height. The
  adjacent expand chevron in the collapsed state correctly uses `h-12 w-12` (48px).
  Per CLAUDE.md design rules: "Touch targets 48px minimum. Interactions must work
  with sweaty hands and gloves." The "Done" button in particular is a primary
  gym-floor action made always-visible by this PR.
- **Status:** ✅ Fixed
- **Resolution:** Added `min-h-12` to both "Add set" and "Done" button classes

#### [FIX] P20-005: Remove-exercise button below 48px touch target *(pre-existing)*
- **File:** `src/components/workout/exercise-block.tsx:131-138`
- **Severity:** Medium
- **Detail:** The delete button renders an 18px icon with no explicit dimensions or
  padding. Contrast with the expand chevron which uses `h-12 w-12`. Pre-existing --
  not introduced in this PR but surfaced during review.
- **Status:** ✅ Fixed
- **Resolution:** Added `flex h-12 w-12 items-center justify-center` to the remove-exercise button

#### [FIX] P20-006: `deleteSet`/`removeActivity` `.catch()` silently discard errors *(pre-existing)*
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:830, 839`
- **Severity:** High
- **Detail:** Both handlers use bare `catch()` (no error parameter) with the comment
  "Hook already logged." That comment is factually wrong for the guard-clause path:
  when `workoutLog` is null at the time of the tap, `mutateAsync` never executes so
  `onError` never fires. Pre-existing -- not introduced in this PR.
- **Status:** ✅ Fixed
- **Resolution:** Added `err` parameter and `console.error('[workout-page]')` with activityId/setId context to both catch blocks

#### [FIX] P20-007: `handleUnconfirmSet` bare catch discards guard-clause throws *(pre-existing)*
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:446`
- **Severity:** High
- **Detail:** `unconfirmSet` has a guard that throws before `mutateAsync` when
  `workoutLog` is null. The bare `catch` (no error parameter) silently discards this
  path -- the mutation hook's `onError` never runs in that case. Pre-existing -- not
  introduced in this PR.
- **Status:** ✅ Fixed
- **Resolution:** Added `err` parameter and `console.error('[workout-page] handleUnconfirmSet failed:')` with context

#### [FIX] P20-009: Misleading comment in A-006 test implies `handleFinish` was exercised
- **File:** `src/routes/_authenticated/__tests__/-log-workout-finish-banner.test.tsx:468-485`
- **Severity:** Low
- **Detail:** The comment reads "Manually simulate what handleFinish does: clear
  pending inputs" but the code only updates `storeState.skippedActivityIds` and
  re-renders. No handler is exercised.
- **Relates to:** A-006
- **Status:** ✅ Fixed
- **Resolution:** Replaced misleading multi-line comment with accurate note that this test does NOT exercise handleFinish and references P20-002/S005-T for proper coverage

#### [FIX] P20-010: Dead "Add Set" button stub in finish-banner mock ExerciseBlock
- **File:** `src/routes/_authenticated/__tests__/-log-workout-finish-banner.test.tsx:301-307`
- **Severity:** Low
- **Detail:** The mock `ExerciseBlock` renders `<button>Add Set</button>` whose
  `onClick` is an empty comment stub. Clicking it does nothing.
- **Relates to:** A-006, P20-002
- **Status:** ✅ Fixed
- **Resolution:** Removed the dead "Add Set" button from the mock ExerciseBlock

### Missing Tasks

#### [TASK] P20-002: A-006 test never invokes `handleFinish` -- coverage is vacuous
- **File:** `src/routes/_authenticated/__tests__/-log-workout-finish-banner.test.tsx`
- **Severity:** Critical
- **Detail:** Both A-006 tests never call `handleFinish`. `WorkoutPausedBar` is mocked
  to `null` so the FINISH button never renders in the DOM. A valid A-006 test needs:
  (1) an activity with 0 confirmed sets so the auto-pending row renders,
  (2) a rendered FINISH trigger in the DOM,
  (3) assertion that `mockFinishWorkout` was called and the pending row is gone.
- **Relates to:** A-006 (Spec.md), S003-T (Steps.md Phase 3)
- **Status:** ✅ Task created
- **Resolution:** Added as S005-T in Steps.md Phase 5

#### [TASK] P20-003: A-003 test is vacuously true -- no pending row is established before mark-done
- **File:** `src/routes/_authenticated/__tests__/-log-workout-mark-done.test.tsx`
- **Severity:** Critical
- **Detail:** The A-003 test uses `act-1` which has 2 confirmed sets. Because
  `confirmedSets.length > 0`, the route does NOT auto-add a pending row on mount.
  A valid A-003 test needs an activity starting with 0 confirmed sets.
- **Relates to:** A-003 (Spec.md), S002-T (Steps.md Phase 2)
- **Status:** ✅ Task created
- **Resolution:** Added as S006-T in Steps.md Phase 5

#### [TASK] P20-008: Mixed-modality and programmed-workout banner behavior untested
- **File:** `src/routes/_authenticated/__tests__/-log-workout-finish-banner.test.tsx`
- **Severity:** Medium
- **Detail:** Two behavioral contracts are missing from the test suite:
  (1) Circuit/cardio/ruck modality banner behavior untested.
  (2) Banner absent when `isProgrammedWorkout=true` untested.
- **Relates to:** allActivitiesDone derivation, P20-001
- **Status:** ✅ Task created
- **Resolution:** Added as S007-T in Steps.md Phase 5

## Resolution Summary
**Resolved at:** 2026-04-16
**Session:** Review resolve for PR #113 (F023 Exercise Completion Signal)

| Category | Total | Resolved |
|---|---|---|
| [FIX] | 7 | 7 |
| [TASK] | 3 | 3 |
| [ADR] | 0 | 0 |
| [RULE] | 0 | 0 |
| **Total** | **10** | **10** |

## Resolution Checklist
- [x] All [FIX] findings resolved (P20-001, P20-004, P20-005, P20-006, P20-007, P20-009, P20-010)
- [x] All [TASK] findings added to Steps.md (P20-002, P20-003, P20-008)
- [ ] Review verified by review-verify agent
