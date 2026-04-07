# PR Review: worktree-feat+workout-template-ux → develop

**Date:** 2026-04-07
**Feature:** Context/Features/018-Workout-Session-UX/, 019-Pause-Gated-Finish/, 020-Workout-Notes/ (+ Context/QuickPlans/2026-04-06-manual-workout-entry-and-edit.md)
**Branch:** worktree-feat+workout-template-ux
**PR:** #92
**Reviewers:** pr-review-toolkit:code-reviewer, pr-review-toolkit:pr-test-analyzer, pr-review-toolkit:silent-failure-hunter
**Status:** ✅ Resolved

## Summary

Comprehensive review of PR #92 (~8000 LOC) bundling F018 Workout Session UX, F019 Pause-Gated Finish, F020 Workout Notes, and the new Manual Workout entry/edit form. 28 findings: 6 [FIX], 9 [TASK], 3 [ADR], 1 [RULE], plus 9 backlog/suggestion items captured as low-priority [FIX]/[TASK]. Highest-risk areas are Tauri pause persistence (data integrity), non-transactional manual edit save, and missing test coverage on pause/unpause time accounting.

## Findings

### Fix-Now

#### [FIX] P14-001: Tauri adapter silently drops pause state

- **File:** src/lib/tauri-adapter.ts:647-648, 1113-1145
- **Severity:** Critical
- **Detail:** `toWorkoutLogRow` hardcodes `paused_at: null, total_paused_ms: 0` and `createWorkoutLog`/`updateWorkoutLog` never send pause fields to the Rust command. On Tauri/mobile, pausing persists nothing — after reload/crash recovery `totalPausedMs` resets to 0 and the elapsed timer is permanently overstated. Violates `.claude/rules/error-handling.md` adapter-fallback rule (silent coercion, no warn). Either persist pause fields in SQLite + Rust commands, or hide pause UI when adapter is Tauri and emit a one-shot `console.warn('[tauri-adapter] Pause state not persisted on mobile (F018 deferred)')`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-002: `resumeWorkout` ignores `totalPausedMs` on crash recovery

- **File:** src/hooks/use-active-workout.ts:549-553
- **Severity:** Critical
- **Detail:** Computes `elapsed = floor((Date.now() - startedAt) / 1000)` with no subtraction of `totalPausedMs` and no handling of an in-flight `pausedAt`. The route effect overwrites this immediately, but the hook should not produce a wrong intermediate value. Mirror `computeElapsed` in `log.$workoutId.tsx` or pass 0 and let the route be the single source of truth.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-003: `computeElapsed` silently returns 0 on invalid timestamps

- **File:** src/routes/\_authenticated/log.$workoutId.tsx:~1244-1266
- **Severity:** High
- **Detail:** Logs `[workout-log] Invalid startedAt/pausedAt` then returns 0. User sees a frozen 00:00 clock with no in-app feedback — gym-floor user thinks pause is broken. Add `setPageError('Workout timer data is corrupt. Please discard or reload.')` on `!Number.isFinite(startedMs)` paths.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-004: `addExercise` rollback failure swallowed

- **File:** src/hooks/use-active-workout.ts:~302-320
- **Severity:** High
- **Detail:** Inner catch logs `[workout] Failed to roll back orphaned group` then re-throws only the original `activityErr`. The user never learns the rollback also failed and the DB now has a stranded empty group. Throw a wrapped error: `throw new Error('Could not add exercise; an orphaned group may remain. Please refresh.', { cause: activityErr })`, or surface a second toast for the rollback path.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-005: Pause/unpause UI-DB drift on mutation failure

- **File:** src/routes/\_authenticated/log.$workoutId.tsx:1205-1216
- **Severity:** High
- **Detail:** `storePauseWorkout()` mutates the local store before `updateWorkoutLogMutation.mutateAsync` fires. On DB write failure, the UI shows "paused" while the backend is unpaused; refresh shows the unexpected state. In the catch block, revert the store (`storeUnpauseWorkout()` if we just paused locally) before calling `setPageError('Pause failed — workout is still running. Check your connection.')`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-006: `recent-tags-store` corrupt localStorage never evicted

- **File:** src/stores/recent-tags-store.ts:~797-814
- **Severity:** Medium
- **Detail:** On JSON parse failure, the store resets to `[]` and logs `[recent-tags]` but does not remove the bad value. Every page load re-hits the parse error; recent-tags inventory permanently appears empty. Call `localStorage.removeItem(STORAGE_KEY)` after the warn.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

### Missing Tasks

#### [TASK] P14-007: Add `onError` handlers to all new mutation hooks

- **File:** src/hooks/use-workout-logs.ts:37-73, 138-207
- **Severity:** High
- **Detail:** `useCreateWorkoutLog`, `useUpdateWorkoutLog`, `useDeleteWorkoutLog`, `useUpdate/DeleteLoggedActivity`, `useUpdate/DeleteLoggedActivityGroup`, `useDeleteLoggedSet` have no `onError`, unlike the existing `useCreateLoggedSet` which logs with `[workout]` prefix and rolls back. Add prefixed `onError: (err, vars) => console.error('[workout-logs] <op> failed:', { id: vars.id, err })` to each.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-008: Pause/unpause bridge guards must log + surface error

- **File:** src/hooks/use-active-workout.ts:104-134
- **Severity:** High
- **Detail:** `pauseWorkout`/`unpauseWorkout` early-return silently on missing or already-paused state, violating `.claude/rules/error-handling.md` user-action guard rule. Add `console.warn('[active-workout] pauseWorkout ignored: ...')` and consider throwing so the route's `.catch()` surfaces an ErrorBanner.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-009: `unpauseWorkout` invalid-`pausedAt` branch needs UI feedback

- **File:** src/stores/active-workout-store.ts:~625-648
- **Severity:** High
- **Detail:** On invalid `pauseDurationMs`, action logs `[active-workout] Invalid pausedAt when unpausing` and clears `pausedAt` without accumulating into `totalPausedMs`. Workout clock then jumps forward by the bad interval with no user notification. Surface a banner via the bridge layer.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-010: Test coverage — pause/unpause store actions

- **File:** src/stores/**tests**/active-workout-store.test.ts (missing) for src/stores/active-workout-store.ts:254-286
- **Severity:** High
- **Detail:** No `describe('pause')` block. Cover: idempotent double-pause, multi-cycle accumulation of `totalPausedMs` (with `vi.useFakeTimers()`), unpause-when-not-paused no-op, invalid-`pausedAt` reset without NaN propagation. <50 LOC. Direct data-integrity risk because session duration is user-visible.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-011: Test coverage — compound diff edit-mode save

- **File:** src/components/workout/**tests**/manual-workout-form.test.tsx
- **Severity:** High
- **Detail:** Edit-mode tests cover each mutation in isolation but no compound diff (simultaneous delete + update + add within one activity). Also missing: `tempId` vs `id` disambiguation across multi-add-then-delete, mid-save mutation rejection leaving form recoverable, ordinal/reorder persistence. Add at least one combined-diff test and one mid-save-rejection test.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-012: Test coverage — crash-recovery dialog

- **File:** src/components/workout/crash-recovery-dialog.tsx (no `__tests__/`)
- **Severity:** High
- **Detail:** Dialog was modified +46 LOC with no dedicated test file. Cover: snapshot restore when `pausedAt` set at crash time, `totalPausedMs` preservation across `resumeWorkout`, stale-snapshot detection (snapshot older than server `updatedAt`), discard path fully resets store including rest timer listeners.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-013: Test coverage — rest-panel/rest-view (replacing deleted overlay tests)

- **File:** src/components/workout/rest-panel.tsx (123 LOC), src/components/workout/rest-view.tsx (142 LOC)
- **Severity:** High
- **Detail:** `rest-timer-overlay.test.tsx` (90 LOC) was deleted with the overlay component, but the new rest-panel/rest-view files have no tests. Rest timer is safety-critical for interval training. Cover: tick, skip, adjust, auto-complete behaviors.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-014: Test coverage — adapter note sync edge cases

- **File:** src/lib/**tests**/supabase-adapter.test.ts, src/lib/**tests**/tauri-adapter.test.ts
- **Severity:** Medium
- **Detail:** Adapter additions exist but missing: `null` vs `[]` normalization for `noteTags`, round-trip preserving tag order without dedup loss, offline queue write-then-sync (Tauri), conflict resolution when server has a newer note.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-015: Verify `ManualWorkoutForm` query hooks render visible error/loading state

- **File:** src/components/workout/manual-workout-form.tsx:536-545, 857-869
- **Severity:** Medium
- **Detail:** `useExercises` defaulted to `[]` shows empty picker during initial load; `useUserProfile` similarly has no `isLoading` skeleton. `exercisesError`/`profileError` are destructured but the rendering path should be verified to render a visible error state, not silently fall through to defaults. Violates the project query-hook error-state rule if not wired.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

### Architectural Concerns

#### [ADR] P14-016: Manual edit save needs transactional adapter method

- **File:** src/components/workout/manual-workout-form.tsx:607-833
- **Severity:** Critical
- **Detail:** Edit-mode `onSubmit` issues sequential delete/upsert mutations. Mid-loop failure leaves the DB in a partially-applied state and the user gets a generic "Some changes may have been partially applied. Reload to see the current state." toast with no entity context. Hidden failures: per-record RLS rejection, network drop, stale activity id, Zod coercion throw inside `toWeight/toDistance`. Decision needed: (a) introduce a transactional `updateWorkoutLogFull(diff)` adapter method (preferred — single RPC/transaction on both Supabase and Tauri/SQLite), or (b) accept best-effort and add per-step entity-id logging + disable resubmit after partial-apply. Affects both adapter implementations.
- **Relates to:** Context/QuickPlans/2026-04-06-manual-workout-entry-and-edit.md, src/lib/data-adapter.ts contract
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [ADR] P14-017: Pause-state persistence parity between Supabase and Tauri adapters

- **File:** src/lib/tauri-adapter.ts, src-tauri/migrations/, src-tauri/src/commands/workout_logs.rs
- **Severity:** Critical
- **Detail:** Pause is a first-class workout state on Supabase (migration `20260406130000`) but is deferred on Tauri ("Pause state deferred for Tauri offline mode (F018)"). This creates platform-divergent behavior in a feature where mobile is the primary target. Decision needed: ship pause persistence to SQLite migration + Rust commands now (recommended), or make the platform divergence explicit in the domain layer (`pauseStateSupported` capability flag) and gate pause UI. Tied to F018 acceptance criteria.
- **Relates to:** Context/Features/018-Workout-Session-UX/Tech.md
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [ADR] P14-018: `note_tags` validation layering (DB CHECK vs application Zod)

- **File:** supabase/migrations/20260406140000_add_note_tags.sql, src-tauri/migrations/013_workout_note_tags.sql
- **Severity:** Medium
- **Detail:** Per-element length and emptiness are enforced only at the application/Zod layer. Direct SQL writes (admin tools, backfills, future server functions) bypass validation. Decide whether to add `CHECK (NOT EXISTS (SELECT 1 FROM unnest(note_tags) t WHERE length(t) > 32 OR t = ''))` or formally accept the application-only enforcement and document it.
- **Relates to:** Context/Features/020-Workout-Notes/Tech.md
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

### Convention Gaps

#### [RULE] P14-019: Mutation hook `onError` logging convention

- **Files:** src/hooks/use-workout-logs.ts (8 new mutations), src/hooks/use-active-workout.ts
- **Severity:** Medium
- **Detail:** `.claude/rules/error-handling.md` covers `useQuery` consumers but does not explicitly require `onError` on `useMutation` hooks. This PR added 8 mutation hooks with no `onError` despite an existing pattern in `useCreateLoggedSet`. Add a section to `.claude/rules/error-handling.md` requiring all `useMutation` hooks to attach `onError` with `[module-name]` prefix logging and (where applicable) cache rollback.
- **Suggested rule:** `.claude/rules/error-handling.md` — new "Mutation Hook Error Handling" section
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

### Suggestions (bulk-captured)

#### [FIX] P14-020: Optimistic id collision risk in `useCreateLoggedSet`

- **File:** src/hooks/use-workout-logs.ts:122
- **Severity:** Low
- **Detail:** `'temp-' + Date.now()` can collide on rapid taps within the same ms. Use `crypto.randomUUID()`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-021: Pre-existing `intToBool` silent coercion

- **File:** src/lib/tauri-adapter.ts:604-607
- **Severity:** Low
- **Detail:** Pre-existing but touched by this PR. Anti-example in `.claude/rules/error-handling.md`. Add a TODO or fix to log on null fallback.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-022: Raw Supabase errors thrown unprefixed in new delete adapters

- **File:** src/lib/supabase-adapter.ts:~238-281 (deleteLoggedSet/Activity/Group)
- **Severity:** Low
- **Detail:** `PostgrestError` bubbles up without `[supabase-adapter]` prefix. No row-count check — silent no-op when id doesn't exist masks referential-integrity issues. Wrap with try/catch + prefix log; consider `.select()` to verify row was deleted.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-023: `localInputToIso` throws RangeError on invalid date

- **File:** src/components/workout/manual-workout-form.tsx:178-182
- **Severity:** Low
- **Detail:** `d.toISOString()` throws on Invalid Date; bubbles into `onSubmit`'s generic catch as "Failed to save workout" instead of a field-level message. Guard with `if (isNaN(d.getTime())) throw new Error('Invalid date')` and log `[manual-workout-form]`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-024: Unknown-exercise renders generic "Exercise" label

- **File:** src/components/workout/manual-workout-form.tsx:~503
- **Severity:** Low
- **Detail:** If an exercise id points to a deleted exercise, UI shows literal "Exercise" with no warning. Use `?? '⚠ Unknown exercise'` and emit a one-shot `console.warn('[manual-workout-form] Unknown exerciseId in log: %s', field.exerciseId)`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-025: `parseNoteTags` log could include truncated raw value

- **File:** src/lib/tauri-adapter.ts:~317-331
- **Severity:** Low
- **Detail:** Already compliant with warn-on-fallback rule. Improvement: include `String(value).slice(0, 120)` for forensic context.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [FIX] P14-026: `CrashRecoveryDialog.handleResume` silent guard

- **File:** src/components/workout/crash-recovery-dialog.tsx:~430
- **Severity:** Low
- **Detail:** `if (!fullWorkout || !incompleteWorkout) return` with no log. Button is `disabled={!fullWorkout}` so practical risk is low, but violates the guard-clause rule. Add `console.warn('[crash-recovery] Resume ignored: workout not loaded yet')`.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-027: Route smoke tests for `log.new.tsx` / `log.$workoutId.edit.tsx`

- **File:** src/routes/\_authenticated/log.new.tsx (51 LOC), src/routes/\_authenticated/log.$workoutId.edit.tsx (117 LOC)
- **Severity:** Low
- **Detail:** No route-level tests. Even smoke tests verifying the not-found / unauthenticated states render add value (security-relevant if userId guard is bypassed).
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

#### [TASK] P14-028: `filter-history.test.ts` boundary cases

- **File:** src/routes/\_authenticated/history/**tests**/filter-history.test.ts
- **Severity:** Low
- **Detail:** Add empty input, all-filtered-out, case-insensitive tag matching, and unicode/emoji-in-tag cases.
- **Status:** ✅ Resolved
- **Resolution:** See Resolution Summary below.

## Resolution Checklist

- [x] All [FIX] findings resolved (P14-001..P14-006, P14-020..P14-026)
- [x] All [TASK] findings added to Steps.md (P14-007..P14-015, P14-027..P14-028)
- [x] All [ADR] findings have ADRs created or dismissed (P14-016..P14-018)
- [x] All [RULE] findings applied or dismissed (P14-019)
- [x] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-07
**Session:** review-resolve on worktree-feat+workout-template-ux

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 13     | 13       |
| [TASK]    | 11     | 11       |
| [ADR]     | 3      | 3        |
| [RULE]    | 1      | 1        |
| **Total** | **28** | **28**   |

### [FIX] resolutions

- **P14-001** Tauri pause UI gated behind `!isTauri()` in `log.$workoutId.tsx` (both render branches); one-shot warn added at `createWorkoutLog`/`updateWorkoutLog` entry points in `tauri-adapter.ts`. Per ADR-013, full SQLite persistence is tracked as F018/S050.
- **P14-002** `resumeWorkout` in `use-active-workout.ts` now passes `0` with comment that route's `computeElapsed` is single source of truth.
- **P14-003** `computeElapsed` in `log.$workoutId.tsx` now calls `setPageError('Workout timer data is corrupt. Please discard or reload.')` on both invalid-timestamp paths.
- **P14-004** `addExercise` in `use-active-workout.ts` rollback-failure path now throws wrapped error with `cause: activityErr`.
- **P14-005** `handlePause`/`handleResume` in `log.$workoutId.tsx` revert local store before setting page error on mutation failure.
- **P14-006** `recent-tags-store.ts` now calls `localStorage.removeItem(STORAGE_KEY)` on parse failure / non-array branches.
- **P14-020** `useCreateLoggedSet` optimistic id now uses `crypto.randomUUID()`.
- **P14-021** `intToBool` in `tauri-adapter.ts` has TODO comment (>10 call sites; behavior unchanged this PR).
- **P14-022** Supabase delete adapters wrapped with `[supabase-adapter]` prefixed try/catch.
- **P14-023** `localInputToIso` in `manual-workout-form.tsx` guards `Number.isNaN(d.getTime())` before `toISOString()`.
- **P14-024** Unknown exercise label fallback now `'⚠ Unknown exercise'` with prefixed warn.
- **P14-025** `parseNoteTags` warn now includes `String(value).slice(0, 120)` forensic context.
- **P14-026** `CrashRecoveryDialog.handleResume` guard now logs `[crash-recovery] Resume ignored: workout not loaded yet`.

### [TASK] resolutions (added to Steps.md)

- **P14-007** → F018 S041 (Mutation hook onError handlers)
- **P14-009-followup** → F018 S042 (Wire `pauseTimingError` to UI)
- **P14-010** → F018 S043 (Test: pause/unpause store actions)
- **P14-011** → F018 S044 (Test: compound diff edit-mode save)
- **P14-012** → F018 S045 (Test: crash-recovery dialog)
- **P14-013** → F018 S046 (Test: rest-panel/rest-view)
- **P14-014** → F020 S019 (Test: adapter note sync edge cases)
- **P14-015** → F018 S047 (Verify ManualWorkoutForm query hook error/loading states)
- **P14-027** → F018 S048 (Route smoke tests for log.new / log.$workoutId.edit)
- **P14-028** → F020 S020 (filter-history boundary cases)
- **P14-008** -- folded into the P14-008 FIX (bridge-layer warn logging applied directly).

### [ADR] resolutions

- **P14-016** → ADR-012 (Transactional `updateWorkoutLogFull` adapter); implementation tracked as F018 S049.
- **P14-017** → ADR-013 (Pause state persistence parity); implementation tracked as F018 S050. Interim fix shipped as P14-001.
- **P14-018** → ADR-014 (`note_tags` validation layering); implementation tracked as F020 S021.

### [RULE] resolutions

- **P14-019** → New "Mutation Hook Error Handling" section added to `.claude/rules/error-handling.md`.

### Notes for follow-up

- The TypeScript diagnostics flagged during this session for `WorkoutHeaderProps.actions`, `ExerciseBlockProps.isActive`, missing modules `push-to-display-button` / `rest-timer-overlay`, and `note_tags` not present on `WorkoutLogRow`/`LoggedActivityRow`/`LoggedSetRow` types are **pre-existing in PR #92** and outside the scope of this review. They should be addressed in a separate pass before merge -- the row-type gaps in particular indicate the F020 note_tags adapter wiring is half-finished.
