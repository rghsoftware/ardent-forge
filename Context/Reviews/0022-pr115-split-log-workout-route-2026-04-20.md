# PR Review: refactor/split-log-workout-route → main

**Date:** 2026-04-20
**Feature:** N/A (pure extraction refactor, no feature spec)
**Branch:** refactor/split-log-workout-route
**Reviewers:** pr-review-toolkit (code-reviewer, silent-failure-hunter, type-design-analyzer)
**Status:** ✅ Resolved

## Summary

15 findings total across 3 files (`event-workout-view.tsx`, `strength-workout-view.tsx`,
`log.$workoutId.tsx`). The extraction is mechanically faithful — no logic leaked into views,
no Iron & Ember regressions, no silent-import drift. Primary issues are error handling gaps
carried forward from the original file (including one data-loss path in circuit completion),
log prefix inconsistencies introduced by the split, and type drift on the `confirmSet` prop.
One architectural concern about dual mutation paths and one follow-up task for state ownership.

**Breakdown:** 13 [FIX] · 1 [TASK] · 1 [ADR]

---

## Findings

### Fix-Now

#### [FIX] P22-001: `computeElapsed` catch logs but never calls `setPageError`
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:208-211`
- **Severity:** Critical
- **Detail:** The catch block returns `0` and logs the error but does not call `setPageError`. If `startedAt` is corrupt, this fires on every interval tick and the user sees a frozen 00:00 timer with no explanation. The `Number.isFinite` guard above it (which does call `setPageError`) only catches the non-finite case — a JS exception in `computeElapsed` takes a separate code path.
- **Fix:** Add `setPageError('Workout timer data is corrupt. Please discard or reload.')` inside the catch before `return 0`.
- **Status:** ✅ Fixed
- **Resolution:** Added `setPageError('Workout timer data is corrupt. Please discard or reload.')` inside the catch before `return 0`.

#### [FIX] P22-002: Silent data loss in circuit `onExerciseDone` guard
- **File:** `src/components/workout/strength-workout-view.tsx:227-228`
- **Severity:** Critical
- **Detail:** `if (!activity) return` when `exerciseIndex` is out of bounds silently drops the circuit rep. The user has no indication the save was skipped — their workout data is silently incomplete. Must log with `[strength-workout-view]` prefix and call `setPageError`.
- **Fix:**
  ```ts
  if (!activity) {
    console.error('[strength-workout-view] onExerciseDone: no activity at index', { exerciseIndex, round, groupId: group.id })
    setPageError('Failed to record circuit set. Please log it manually.')
    return
  }
  ```
- **Status:** ✅ Fixed
- **Resolution:** Added error log and `setPageError` call before returning; guard now surfaces the failure.

#### [FIX] P22-003: Bare `return null` guard renders blank screen
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:480`
- **Severity:** High
- **Detail:** `if (!workoutLog) return null` renders a completely blank screen with no log entry and no user message. The `useEffect` redirect fires after the render, leaving a visible void window. Per error-handling conventions, guard clauses in rendering paths that can produce user-visible failure states must log.
- **Fix:** Replace with a minimal logged indicator: `console.error('[workout-page] Rendered without active workoutLog'); return <div className="min-h-[100dvh] bg-surface-anvil" />`
- **Status:** ✅ Fixed
- **Resolution:** Replaced `return null` with `console.error` + minimal surface div `<div className="min-h-[100dvh] bg-surface-anvil" />`.

#### [FIX] P22-004: `handleMarkDone` and `handleExpandDone` — silent user-action bare returns
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:441-456`
- **Severity:** High
- **Detail:** Both handlers accept `activityId: string` with no guard. If `activityId` is empty or stale, `skipActivity` and `setExpandedDoneActivityIds` mutate silently with no log and no user feedback. Per error-handling conventions, user-action handlers must never silently return.
- **Fix:** Add `if (!activityId) { console.error('[workout-page] handleMarkDone called with empty activityId'); setPageError('Could not mark exercise done. Please reload.'); return }` at entry.
- **Status:** ✅ Fixed
- **Resolution:** Both handlers guard `!activityId` with `console.error` + `setPageError` before proceeding.

#### [FIX] P22-005: `confirmSet` prop drops `exerciseName?: string` 4th parameter
- **File:** `src/components/workout/strength-workout-view.tsx:84-88`
- **Severity:** High
- **Detail:** The hook signature is `(loggedActivityId, setData, restSeconds?, exerciseName?)` but the prop interface declares only 3 parameters. Any future caller inside the view that needs to forward `exerciseName` cannot — the type silently truncates it. The return type is also widened to `Promise<unknown>` rather than the hook's typed return.
- **Fix:** Add `exerciseName?: string` as 4th parameter to the prop type. Propagate the hook's actual return type if known.
- **Status:** ✅ Fixed
- **Resolution:** Added `exerciseName?: string` as 4th parameter to `confirmSet` prop type in `StrengthWorkoutViewProps`.

#### [FIX] P22-006: Log prefix `[workout-log]` inconsistent with rest of file
- **File:** `src/components/workout/strength-workout-view.tsx:244`
- **Severity:** Medium
- **Detail:** Circuit set catch emits `[workout-log]` while every other log in both extracted components uses `[workout-page]`. This inconsistency breaks grep searches in production logs when tracing circuit failures.
- **Fix:** Change `[workout-log]` → `[workout-page]` at line 244.
- **Status:** ✅ Fixed
- **Resolution:** Changed `[workout-log]` → `[strength-workout-view]` (used consistent prefix with P22-007 rather than `[workout-page]` as specified; `[strength-workout-view]` is the correct origin module).

#### [FIX] P22-007: CardioPanel/RuckPanel catch blocks use wrong module prefix
- **File:** `src/components/workout/strength-workout-view.tsx:291, 323`
- **Severity:** Medium
- **Detail:** Both catch blocks emit `[workout-page]` but they live inside `strength-workout-view.tsx`. Module prefixes should reflect where the log originates. Using the route's prefix for a component makes failures harder to locate in production log search.
- **Fix:** Change both to `[strength-workout-view]`.
- **Status:** ✅ Fixed
- **Resolution:** Changed both CardioPanel and RuckPanel catch prefixes from `[workout-page]` to `[strength-workout-view]`.

#### [FIX] P22-008: `handleDiscard` — `navigate` not awaited after destructive operation
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:341-350`
- **Severity:** Medium
- **Detail:** `discardWorkout()` is awaited and the dialog closes, then `navigate({ to: '/' })` is called fire-and-forget. If navigation fails, the user is stranded on a cleared-state page: workout discarded, dialog gone, no active session, no recovery path.
- **Fix:** `await navigate({ to: '/' }).catch((err) => { console.error('[workout-page] handleDiscard navigation failed:', err); setPageError('Workout discarded but could not navigate home.') })`
- **Status:** ✅ Fixed
- **Resolution:** `navigate` is now awaited with a `.catch` that logs and calls `setPageError` on navigation failure.

#### [FIX] P22-009: Remove `exerciseNames` prop — redundant with `exerciseMap`
- **File:** `src/components/workout/strength-workout-view.tsx:65`
- **Severity:** Low
- **Detail:** `exerciseNames: Record<string, string>` is fully derivable from `exerciseMap` inside the component. Both records must share the same key universe — passing them separately creates a consistency dependency the type system cannot enforce.
- **Fix:** Remove `exerciseNames` from `StrengthWorkoutViewProps`; derive inside the component: `const exerciseNames = Object.fromEntries(Object.entries(exerciseMap).map(([k, v]) => [k, v.name]))`. Alternatively, thread `exerciseMap` into the child components that currently accept `Record<string, string>`.
- **Status:** ✅ Fixed
- **Resolution:** Removed `exerciseNames` from `StrengthWorkoutViewProps` and call site; added `const exerciseNames = Object.fromEntries(...)` derivation inside the component.

#### [FIX] P22-010: Name the anonymous `undoAction` inline type
- **File:** `src/components/workout/strength-workout-view.tsx:69`
- **Severity:** Low
- **Detail:** `{ setId: string; expiresAt: number }` is a domain concept (an undo window) declared as an anonymous inline type. If the store already names this type, import it; if not, export `type UndoAction = { setId: string; expiresAt: number }` from the store and reference it here.
- **Status:** ✅ Fixed
- **Resolution:** Exported `UndoAction` from `active-workout-store.ts`; imported and used it in `StrengthWorkoutViewProps`.

#### [FIX] P22-011: `programBannerProps` allows an all-optional empty object
- **File:** `src/components/workout/strength-workout-view.tsx:72-77`
- **Severity:** Low
- **Detail:** The inline type has four optional fields, meaning `{}` is structurally valid. A caller could pass `programBannerProps: {}` (non-null), enter the `ProgramContextBanner` render path, and display a blank banner with no type error.
- **Fix:** Extract to a named type with at least one required field (e.g., `programName: string`) so the "has a program but no data" case is unrepresentable.
- **Status:** ✅ Fixed
- **Resolution:** Extracted to named `ProgramBannerProps` type with `weekNumber: number` required (always present from `programContext`); replaces inline type in `StrengthWorkoutViewProps`.

#### [FIX] P22-012: Extract `EventWorkoutViewProps.workoutLog` to a named type
- **File:** `src/components/workout/event-workout-view.tsx:18`
- **Severity:** Low
- **Detail:** The inline `{ id: string; eventMetadata: EventMetadata }` achieves correct narrowing but is anonymous. Tests, stories, or future sibling components must re-type it structurally. A named export (`EventWorkoutLog`) gives it a stable identity.
- **Fix:** `export type EventWorkoutLog = { id: string; eventMetadata: EventMetadata }` at module scope, then use in the props interface.
- **Status:** ✅ Fixed
- **Resolution:** Exported `EventWorkoutLog = { id: string; eventMetadata: EventMetadata }` from `event-workout-view.tsx`; used in `EventWorkoutViewProps`.

#### [FIX] P22-013: `handleSummaryDone` — uncaught navigation failure leaves user stranded
- **File:** `src/routes/_authenticated/log.$workoutId.tsx:434-439`
- **Severity:** Medium
- **Detail:** `navigate({ to: '/' })` is called after clearing `summaryData`, `showSummary`, and `detectedPrs`. If navigation fails, the user is on a blank post-summary state with no recovery path and no feedback.
- **Fix:** Chain `.catch((err) => { console.error('[workout-page] handleSummaryDone navigation failed:', err); setPageError('Could not return to home. Please navigate manually.') })` on the navigate call.
- **Status:** ✅ Fixed
- **Resolution:** Chained `.catch` on `navigate({ to: '/' })` with `console.error` + `setPageError`.

---

### Missing Tasks

#### [TASK] P22-014: Move view-local modal state into `StrengthWorkoutView`
- **File:** `src/components/workout/strength-workout-view.tsx:29-93` / `src/routes/_authenticated/log.$workoutId.tsx:113-123`
- **Severity:** Low
- **Detail:** `showAddExercise`, `setShowAddExercise`, `showDiscardDialog`, `setShowDiscardDialog`, `pendingInputs`, `setPendingInputs`, `restMinimized`, `setRestMinimized` are all used exclusively inside `StrengthWorkoutView`. The parent holds them only because this was a pure extraction. Moving these 4 `useState` calls into the view cuts the prop interface from ~44 to ~36 props and removes shared state ownership. This is out of scope for a pure-extraction PR — track as a follow-up.
- **Relates to:** —
- **Status:** ✅ Task created
- **Resolution:** Added to `Context/Backlog/Ideas.md` as a standalone refactor item.

---

### Architectural Concerns

#### [ADR] P22-015: Dual mutation paths — `confirmSet` (raw) and `handleConfirmSet` (wrapped) both passed to `StrengthWorkoutView`
- **File:** `src/components/workout/strength-workout-view.tsx:36-48, 84-90`
- **Severity:** Medium
- **Detail:** The view receives both the raw hook operation (`confirmSet`) and the parent-wrapped handler (`handleConfirmSet`). Strength sets use `handleConfirmSet` (which calls `setRestMinimized(false)` before confirming and normalizes inputs via `parseNumericInput`). Circuit, cardio, and ruck sets call raw `confirmSet` directly, bypassing the rest-timer minimization and normalization. This is a behavioral inconsistency invisible from the prop interface: the same physical action (completing a set) takes two different code paths depending on modality. The root question is whether mutation orchestration (wrapping, normalizing, side-effecting) belongs in the route or in the view — and the current split answers "both", which is the wrong answer. Requires an explicit design decision before the next feature builds on top of this component.
- **Relates to:** —
- **Status:** ✅ ADR created
- **Resolution:** ADR-022 — `Context/Decisions/ADR-022-strength-view-mutation-orchestration-boundary.md`

---

## Resolution Checklist
- [x] All [FIX] findings resolved (P22-001 through P22-013)
- [x] All [TASK] findings added to Steps.md or backlog (P22-014)
- [x] All [ADR] findings have ADRs created or dismissed (P22-015)
- [ ] Review verified by review-verify agent

## Resolution Summary
**Resolved at:** 2026-04-20
**Session:** PR #115 review resolve

| Category | Total | Resolved |
|---|---|---|
| [FIX] | 13 | 13 |
| [TASK] | 1 | 1 |
| [ADR] | 1 | 1 |
| **Total** | **15** | **15** |
