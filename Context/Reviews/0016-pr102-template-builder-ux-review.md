# PR Review: fix+template-building-ui-ux → develop

**Date:** 2026-04-11
**Feature:** Context/Features/021-Template-Builder-Route/
**Branch:** worktree-fix+template-building-ui-ux (PR #102)
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer
**Status:** ✅ Resolved

## Summary

14 findings total: 3 [FIX] critical, 2 [FIX] high, 5 [FIX] low/medium, 4 [TASK] high, plus 4 [TASK] missing test cases. The PR is a high-quality feature delivery -- Iron & Ember compliance, touch targets, and dirty-state guard are all well-executed. The blocking issues are a double-logging convention violation in two files (5-min fix), two touch-target regressions on new nav elements, missing `isError` handling on exercise queries, and four test gaps in the updated form test suite.

---

## Findings

### Fix-Now

#### [FIX] P16-001: Double-logging mutation failure
- **Files:** `src/components/session-builder/session-template-form.tsx:388`, `src/components/event-builder/event-template-form.tsx:399`
- **Severity:** Critical
- **Detail:** `useCreateSessionTemplate` and `useUpdateSessionTemplate` hooks already log `[session-templates] Failed to create/update template` in their `onError` handlers. Both consuming components also `console.error` the same rejection in their catch blocks with a different `[module-name]` prefix. This produces two log lines per failure with different prefixes, violating the "Mutation Hook Log Ownership" rule in `.claude/rules/error-handling.md`. The catch block must stay to set `serverError` state, but the `console.error` inside it must be removed.
- **Fix:** Remove `console.error(...)` from both catch blocks. Keep `setServerError(...)`. If TypeScript requires naming the error param, use `catch (_err)`.
- **Status:** ✅ Fixed
- **Resolution:** Removed `console.error(...)` from both catch blocks in `session-template-form.tsx` and `event-template-form.tsx`. Renamed `err` to `_err` in both. Hook `onError` already owns the log.

#### [FIX] P16-002: `useExercises` isError ignored -- silent empty picker on network failure
- **Files:** `src/components/session-builder/session-template-form.tsx:193`, `src/components/workout/exercise-picker-panel.tsx:27-28`
- **Severity:** High
- **Detail:** Both files destructure `data` from `useExercises()` but not `isError`. On a network failure the exercise list silently defaults to `[]`. In the form this means every activity shows "Select exercise" with no error indication. In the picker panel, search returns zero results indistinguishably from a legitimate empty state. Compare to `templates.$templateId.edit.tsx:31-56` which correctly handles all three query states.
- **Fix:** Destructure `isError` in both files. In `exercise-picker-panel.tsx`, render an error state ("Could not load exercises. Check your connection and try again.") when `exercisesFailed` is true, instead of an empty list.
- **Status:** ✅ Fixed
- **Resolution:** Destructured `isError: exercisesFailed` from `useExercises()` in both `session-template-form.tsx` (added `useEffect` to log on failure) and `exercise-picker-panel.tsx` (added error state paragraph guarding all list content).

#### [FIX] P16-003: Touch-target regression on back button
- **File:** `src/components/session-builder/template-editor-layout.tsx:26,36`
- **Severity:** High
- **Detail:** Both the `<button>` and `<Link>` back controls use `min-h-10` (40px). CLAUDE.md mandates 48px minimum touch targets for gym-floor usability. This is the primary navigation exit on every template editor page. Inconsistent with the rest of this PR which aggressively upgrades other controls to `min-h-12`.
- **Fix:** Change `min-h-10` to `min-h-12` on both branches. Consider `min-w-12` as well for a square tap zone, though the label text already provides adequate horizontal extent.
- **Status:** ✅ Fixed
- **Resolution:** Changed `min-h-10` to `min-h-12` (and added `min-w-12`) on both the `<button>` and `<Link>` back controls in `template-editor-layout.tsx`.

#### [FIX] P16-004: Touch-target regression on exercise picker close button
- **File:** `src/components/session-builder/exercise-picker-drawer.tsx:1264`
- **Severity:** High
- **Detail:** The drawer close button uses `min-h-10 min-w-10` (40px). The header row is `min-h-12` but the tap target is the button element, not the row. Inconsistent with `AddExerciseSheet`'s `ExerciseRow` which is already `min-h-12`.
- **Fix:** Change to `min-h-12 min-w-12`.
- **Status:** ✅ Fixed
- **Resolution:** Changed `min-h-10 min-w-10` to `min-h-12 min-w-12` on the close button at line 90 of `exercise-picker-drawer.tsx`.

#### [FIX] P16-005: `max-w-5xl` deviation undocumented
- **File:** `src/components/session-builder/template-editor-layout.tsx`
- **Severity:** Medium
- **Detail:** `TemplateEditorLayout` omits `mx-auto max-w-5xl`, silently breaking `.claude/rules/layout-conventions.md` which states "All authenticated pages use `max-w-5xl`". The deviation is intentional -- the 3-column `xl:grid-cols-[300px_1fr_280px]` preview layout requires full viewport width. However there is no comment or rule carve-out documenting this.
- **Fix:** (a) Add an inline comment in `template-editor-layout.tsx` explaining the intentional exception. (b) Update `.claude/rules/layout-conventions.md` to note that 3-column preview layouts may omit `max-w-5xl` at `xl+` breakpoints.
- **Status:** ✅ Fixed
- **Resolution:** Added JSDoc to `TemplateEditorLayout` explaining the intentional `max-w-5xl` omission (3-col grid + fixed-position drawer docking). Added an explicit carve-out paragraph to `.claude/rules/layout-conventions.md` documenting when multi-column editor layouts may omit `max-w-5xl`.

#### [FIX] P16-006: "Scoring" label typography inconsistency
- **File:** `src/components/session-builder/session-template-form.tsx:1690`
- **Severity:** Low
- **Detail:** The "Scoring" field label still has `uppercase tracking-wider` while adjacent "Category" and "Description" labels were updated to mixed-case in this PR per the typography convention. Minor visual inconsistency that will recur if not fixed here.
- **Fix:** Remove `uppercase tracking-wider` from the Scoring label class string.
- **Status:** ✅ Already resolved
- **Resolution:** The Scoring label at line 490 of `session-template-form.tsx` is already mixed-case (`text-xs font-medium text-warm-ash/60`) -- `uppercase tracking-wider` was not present. False positive from capture session.

#### [FIX] P16-007: Scroll handler duplication
- **File:** `src/components/session-builder/session-template-form.tsx:1797-1809`
- **Severity:** Low
- **Detail:** The inline `onClick` handler on summary-item error links duplicates the scrolling logic of `scrollToFirstError` almost verbatim. The duplication means a future change to scroll behavior (e.g., adding offset for a sticky header) must be applied in two places.
- **Fix:** Extract a `scrollToAnchor(id: string)` helper function shared by both `scrollToFirstError` and the summary-item `onClick` handlers.
- **Status:** ✅ Fixed
- **Resolution:** Extracted `scrollToAnchor(id: string)` helper in `session-template-form.tsx`. Updated `scrollToFirstError` to call `scrollToAnchor(id)` and replaced 12-line inline `onClick` in summary items with `onClick={() => scrollToAnchor(item.anchorId)}`.

#### [FIX] P16-008: Move-item guard clauses need defensive comment
- **Files:** `src/components/session-builder/session-template-form.tsx:319-321`, `src/components/session-builder/activity-group-editor.tsx:146-149`
- **Severity:** Low
- **Detail:** `handleMoveGroup` and `handleMoveActivity` guard clauses log on out-of-bounds index but don't set user-facing error state, which the error-handling rule requires for user-action handlers. In practice these paths are unreachable -- Move up/down controls are disabled at bounds. A future reviewer will flag this as a rule violation without understanding the rationale.
- **Fix:** Add a brief inline comment on each guard clause explaining the UI prevents this path (the controls are disabled at the bounds, so this guard is only reachable if state gets desynchronized).
- **Status:** ✅ Fixed
- **Resolution:** Added defensive comment to `handleMoveGroup` in `session-template-form.tsx` and `handleMoveActivity` in `activity-group-editor.tsx` explaining the UI disables controls at bounds, so the guard is only reachable on state desynchronization.

#### [FIX] P16-009: Pre-existing -- `useTouchSessionTemplateLastAssigned` missing onError
- **File:** `src/hooks/use-session-templates.ts:96-104`
- **Severity:** Low
- **Detail:** This mutation has no `onError` handler, violating the rule that all `useMutation` hooks attach `onError` with a `[module-name]` prefix log. Not introduced by this PR but the hooks file is in scope. The "touch last assigned" operation is non-critical; a `console.warn` (not `console.error`) is appropriate.
- **Fix:** Add `onError: (err) => console.warn('[session-templates] touchLastAssigned failed:', err)` to the mutation options.
- **Status:** ✅ Fixed
- **Resolution:** Added `onError: (err) => console.warn('[session-templates] touchLastAssigned failed:', err)` to `useTouchSessionTemplateLastAssigned` in `use-session-templates.ts`.

---

### Missing Tasks

#### [TASK] P16-010: Add test -- successful save path
- **File:** `src/components/session-builder/__tests__/session-template-form.test.tsx`
- **Severity:** Critical
- **Detail:** The primary user flow (fill name, have a valid group, click "Save template", `onSave` called) is completely untested. A regression here means users cannot save templates and the test suite would not catch it. The full mock of `ActivityGroupEditor` prevents building valid form state via interaction, but the `initial` prop can pre-populate form state directly.
- **Approach:** Render with a fully-hydrated `initial` prop (name, one group with type, one activity with `exerciseId`). Verify the button reads "Save template" and is enabled. Click it. Assert `mutateAsync` and `onSave` were called.
- **Relates to:** Steps.md S016 assertion A9 (tests pass) -- passing ≠ covering new behaviors
- **Status:** ✅ Task created
- **Resolution:** Added as S019-T in Steps.md. Test implemented in `session-template-form.test.tsx`: renders with `validInitial`, clicks "Save template", asserts `onSave` called with `{ id: 'st-1' }`.

#### [TASK] P16-011: Add tests -- computeErrors pure validation logic
- **File:** `src/components/session-builder/__tests__/session-template-form.test.tsx` (or colocated unit test)
- **Severity:** Critical
- **Detail:** `computeErrors` (`session-template-form.tsx:121-135`) contains the entire validation ruleset as a pure function with five distinct error conditions. Zero coverage. A logic inversion in any branch silently allows invalid data to the server. No rendering overhead required to test this.
- **Approach:** Export `computeErrors`. Assert each branch: empty name → `name` error; no groups → `noGroups` error; group with `groupType: null` → `groups[id].noType`; group with no activities → `groups[id].noActivities`; activity with `exerciseId: null` → `activities[id]` error; fully valid → no errors.
- **Relates to:** Steps.md S016 assertion A9
- **Status:** ✅ Task created
- **Resolution:** Added as S022-T in Steps.md. Exported `computeErrors` from `session-template-form.tsx`. Seven unit tests added in `computeErrors` describe block covering all error branches.

#### [TASK] P16-012: Add tests -- save button state machine
- **File:** `src/components/session-builder/__tests__/session-template-form.test.tsx`
- **Severity:** Critical
- **Detail:** Button transitions through "Resolve errors" (disabled), "Save template" (enabled), and "Saving..." (disabled during mutation). Only "Resolve errors" is tested. The transition to enabled and the pending state are both untested.
- **Approach:** "Save template" state: use `initial` prop approach (P16-010). "Saving..." state: mock `useCreateSessionTemplate` to return `isPending: true`, render with valid `initial`, verify button shows "Saving..." and is disabled.
- **Relates to:** Steps.md S016 assertion A9
- **Status:** ✅ Task created
- **Resolution:** Added as S020-T in Steps.md. Two tests added: "Save template" button enabled with `validInitial`; "Saving..." button disabled when `isPending: true`.

#### [TASK] P16-013: Add tests -- onDirtyChange callback and server error display
- **File:** `src/components/session-builder/__tests__/session-template-form.test.tsx`
- **Severity:** High
- **Detail:** Two missing coverage areas: (a) `onDirtyChange` callback -- the entire `DirtyNavGuardDialog`/`useBlocker` integration depends on it firing `true` on edit and `false` after successful save; (b) server error display -- when `mutateAsync` throws, the `role="alert"` error paragraph must appear; currently no test covers this failure path.
- **Approach:** (a) Render with `onDirtyChange` spy, type in name field, assert spy called with `true`; mock successful save, assert spy called with `false`. (b) Mock `mutateAsync` to reject, render with valid `initial`, click save, assert alert message visible.
- **Relates to:** Steps.md S014 (dirty-state guard)
- **Status:** ✅ Task created
- **Resolution:** Added as S021-T in Steps.md. Three tests added: `onDirtyChange(true)` on edit; `onDirtyChange(false)` after successful save; `role="alert"` rendered when mutation rejects.

---

## Resolution Checklist
- [x] All [FIX] findings resolved (P16-001 through P16-009)
- [x] All [TASK] findings added to implementation work (P16-010 through P16-013)
- [ ] Review verified by review-verify agent

## Resolution Summary
**Resolved at:** 2026-04-11
**Session:** PR #102 review resolution -- template builder UX fixes and test coverage

| Category | Total | Resolved |
|---|---|---|
| [FIX] | 9 | 9 |
| [TASK] | 4 | 4 |
| **Total** | **13** | **13** |
