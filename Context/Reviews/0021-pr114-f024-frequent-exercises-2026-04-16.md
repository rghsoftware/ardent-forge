# PR Review: feat/frequent-exercises → develop

**Date:** 2026-04-16
**Feature:** F024 -- Frequent Exercises Add Picker
**Branch:** feat/frequent-exercises
**PR:** #114
**Reviewers:** code-reviewer (automated agent)
**Status:** 🟢 Resolved

## Summary

7 findings total: 2 [BLOCKER], 5 [SUGGESTION]. Two blockers require fixes before merge:
the SQL migration's `SECURITY DEFINER` function is missing `SET search_path` (security
anti-pattern present on every other SECURITY DEFINER function in this codebase), and the
prefetch in `_authenticated.tsx` caches `string[]` (raw IDs) under the same query key
that `useFrequentExercises` expects to contain `Exercise[]`, causing the hook to serve
wrong-shaped stale data.

## Findings

### Blockers

#### [BLOCKER] P21-001: SECURITY DEFINER function missing SET search_path
- **File:** `supabase/migrations/20260416000001_add_get_frequent_exercise_ids.sql:9`
- **Severity:** Blocker
- **Status:** ✅ Fixed
- **Resolution:** Added `SET search_path = public` between `SECURITY DEFINER` and `AS $$`. Also fixed SQL keyword casing (P21-005) and added `HAVING` clause (P21-004) in the same edit.
- **Detail:** Every other `SECURITY DEFINER` function in this codebase includes
  `SET search_path = public`. Without it, a malicious schema can shadow table names and
  the function executes with elevated privileges against the wrong objects.

#### [BLOCKER] P21-002: Prefetch caches string[] but hook expects Exercise[]
- **File:** `src/routes/_authenticated.tsx:48-50`
- **Severity:** Blocker
- **Status:** ✅ Fixed
- **Resolution:** Removed the prefetch `useEffect` entirely, along with the now-unused `useQueryClient` and `getAdapter` imports and the `queryClient` local variable. The `useFrequentExercises` hook's 5-minute `staleTime` handles caching after first mount.
- **Detail:** The `queryClient.prefetchQuery` stores raw `string[]` (exercise IDs from
  `adapter.getFrequentExerciseIds()`) under key `['exercises', 'frequent', user.id]`.
  `useFrequentExercises` uses that same key but its `queryFn` resolves those IDs to full
  `Exercise[]` objects. TanStack Query finds the `string[]` in cache, considers it fresh
  (same `staleTime`), and serves it -- consumers then receive `string[]` instead of
  `Exercise[]`, causing the UI to silently render nothing.

### Suggestions

#### [SUGGESTION] P21-003: useEffect missing queryClient in dependency array
- **File:** `src/routes/_authenticated.tsx:53`
- **Status:** ✅ Fixed
- **Resolution:** Moot -- the `useEffect` was removed as part of P21-002.
- **Detail:** The `useEffect` dependency array is `[user?.id]` but closes over
  `queryClient` inside. While `queryClient` is stable, ESLint `react-hooks/exhaustive-deps`
  will flag it as a missing dependency.

#### [SUGGESTION] P21-004: HAVING clause missing -- zero-set exercises could occupy slots
- **File:** `supabase/migrations/20260416000001_add_get_frequent_exercise_ids.sql:12-14`
- **Status:** ✅ Fixed
- **Resolution:** Added `having count(ls.id) > 0` before `order by set_count desc`.
- **Detail:** A `LEFT JOIN` on `logged_sets` returns `COUNT(ls.id) = 0` for exercises
  with activity rows but no completed sets. These exercises can still appear in results,
  displacing genuinely-used exercises. This diverges from "most frequently used"
  semantics.

#### [SUGGESTION] P21-005: SQL keywords uppercase -- violates project SQL style convention
- **File:** `supabase/migrations/20260416000001_add_get_frequent_exercise_ids.sql` (whole file)
- **Status:** ✅ Fixed
- **Resolution:** Lowercased all SQL keywords throughout the function body (select, from, join, where, group by, having, order by, limit, count, now).
- **Detail:** `.claude/rules/supabase.md` SQL Style section requires lowercase SQL
  keywords. Migration uses `SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, etc.

#### [SUGGESTION] P21-006: isError not handled in add-exercise-sheet.tsx
- **File:** `src/components/workout/add-exercise-sheet.tsx:38`
- **Status:** ✅ Fixed
- **Resolution:** Destructured `isError: frequentFailed` from `useFrequentExercises` and added a `console.warn` with `[add-exercise-sheet]` prefix when it triggers.
- **Detail:** Destructures only `{ data: frequentExercises = [] }` and discards
  `isError`. On query failure the user sees "No history yet" (new-user fallback), which
  is misleading. Per `.claude/rules/error-handling.md`, query hooks in user-facing
  components must handle `isError`.

#### [SUGGESTION] P21-007: showFrequent and showRecent use inconsistent debounce guards
- **File:** `src/components/workout/exercise-picker-panel.tsx:51`
- **Status:** ✅ Fixed
- **Resolution:** Changed `showRecent` to use `!searchQuery` (raw) instead of `debouncedQuery.length === 0`, matching `showFrequent` for instant hide on keypress.
- **Detail:** `showFrequent` checks raw `!searchQuery` (instant hide on keypress) while
  `showRecent` checks `debouncedQuery.length === 0` (200ms lag). Both sections should
  hide at the same moment.

## Positive Notes

- Rust Tauri implementation correctly mirrors the SQL logic (90-day window, top-8, LEFT
  JOIN on completed sets).
- UI follows Iron & Ember conventions: no border dividers, ALL-CAPS FREQUENT section
  header, tonal layering.
- Test coverage is solid -- tests exercise frequency ordering, empty state, search
  toggle, and unknown ID filtering.
- 5-minute `staleTime` on the hook is a reasonable cache window; no per-picker-open
  fetch.

## Resolution Summary
**Resolved at:** 2026-04-16
**Session:** review-resolve for P21 / PR #114

| Category | Total | Resolved |
|---|---|---|
| [BLOCKER] | 2 | 2 |
| [SUGGESTION] | 5 | 5 |
| **Total** | **7** | **7** |
