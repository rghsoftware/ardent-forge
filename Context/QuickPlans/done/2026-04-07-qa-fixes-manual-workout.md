# Quick Plan: QA Fixes -- Manual Workout Entry

**Date:** 2026-04-07
**Task:** Fix all QA issues identified across manual-workout-form.tsx, route files, and F020 test fixture regressions
**Scope:** Bug fix + convention compliance pass

---

## Goal

Bring the manual workout entry feature to a passing build, clean tests, and full convention compliance before merge.

---

## Approach

All changes are in two files: `src/components/workout/manual-workout-form.tsx` and test fixtures.

### Blocking (E) -- must fix

**E1** (`manual-workout-form.tsx:501-502`) -- Query hook silent fallback corrupts metric data
- Destructure `isError` from `useExercises()` and `useUserProfile(userId)`
- Block form render (or at minimum the unit-sensitive inputs and exercise picker) with an error + retry state when either fails

**E2** (`manual-workout-form.tsx:86, 921`) -- Invisible validation errors
- Render per-set `refine` error inside `SetRows` component (currently no per-set error output)
- Fix group-level error path: `errors.groups?.message` -> `errors.groups?.root?.message` (zod-resolver v4 behavior)

**E3** (`manual-workout-form.tsx:818, 908-910`) -- Typography rule violation
- `<h2>SESSION</h2>` -> `<h2>Session</h2>`, remove `uppercase tracking-widest`
- `<h2>BLOCKS</h2>` -> `<h2>Blocks</h2>`, remove `uppercase tracking-widest`
- (Column headers in SetRows ~line 286 remain uppercase -- correct per rule)

### Warnings (W) -- should fix before merge

**W1** (`manual-workout-form.tsx:566-787`) -- Edit submit partial-failure masking
- Surface which mutation step failed in the catch message
- Warn user that partial changes may have applied (cannot auto-rollback without server RPC)
- Log full error with `[manual-workout-form]` prefix

**W2** (`manual-workout-form.tsx:634`) -- `as WorkoutLog` cast hides shape drift
- Build the update payload explicitly without the cast so new fields cause compile errors

**W3** (`manual-workout-form.tsx:313, 828-843, 931`) -- Native select / datetime-local
- Replace raw `<select>` with shadcn `<Select>` (consistent with rest of project)
- Add `appearance-none` + custom caret to `datetime-local` input (or replace with shadcn if a date-time picker exists)

**W4** (`manual-workout-form.tsx:641-654`) -- `filter(Boolean) as string[]`
- Replace with type predicate: `.filter((id): id is string => Boolean(id))`

**W5** (`manual-workout-form.tsx:814`) -- `motion-safe:transition-none` no-op
- Remove the class (or use `motion-reduce:transition-none` if reduced-motion intent)

### Suggestions (S) -- cleanup

**S1** -- `GROUP_TYPE_OPTIONS` / `SET_TYPE_OPTIONS` satisfies
- Add `satisfies readonly GroupType[]` / `satisfies readonly SetSchemeType[]`

**S2** -- `nowLocalInput` round-trip
- Format directly from `new Date()` instead of `new Date().toISOString()` -> parse

**S3** -- `overallNotes` textarea missing `maxLength`
- Add `maxLength` matching server constraint (check F020 spec for value) + character counter

**S5** -- Extract submit label ternary
- Pull nested ternary into `const submitLabel` local variable

### Pre-existing build failures (F020 test fixtures)

Fix test fixtures broken by F020 `note_tags` additions:
- `src/lib/__tests__/data-mapper.test.ts` lines 120, 143, 193, 204, 219, 241 -- add `note_tags: null` to WorkoutLogRow / LoggedActivityRow / LoggedSetRow fixtures
- `src/lib/__tests__/supabase-adapter.test.ts` lines 61, 96, 107 -- same
- `src/routes/_authenticated/history/__tests__/filter-history.test.ts:7` -- add `exerciseCount` to WorkoutLogSummary fixture

---

## File List

| File | Changes |
|---|---|
| `src/components/workout/manual-workout-form.tsx` | E1, E2, E3, W1-W5, S1-S3, S5 |
| `src/lib/__tests__/data-mapper.test.ts` | Add `note_tags` to fixtures |
| `src/lib/__tests__/supabase-adapter.test.ts` | Add `note_tags` to fixtures |
| `src/routes/_authenticated/history/__tests__/filter-history.test.ts` | Add `exerciseCount` to fixture |

---

## Verification

- `bun run build` exits 0 with no type errors
- `bun run lint` exits 0
- `bun run test` exits 0
- Manual check: form renders an error state when exercises or profile fetch fails
- Manual check: submitting a set with no measurements shows validation error
- Manual check: section headings are mixed-case

---

## Risks

- W3 (native select replacement) is the most visually impactful change; verify layout of group-type and set-type pickers after switching to shadcn Select
- E1 error state placement: decide whether to block the whole form or just the affected controls
