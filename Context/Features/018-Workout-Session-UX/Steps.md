# Feature 018: Workout Session UX -- Implementation Steps

## Team Composition

| Agent                 | Stack                        | Responsibility                                          |
| --------------------- | ---------------------------- | ------------------------------------------------------- |
| `database-architect`  | Supabase / SQL               | Migration for `paused_at` and `total_paused_ms` columns |
| `backend-engineer`    | Domain types / data adapter  | Update Zod schema, row mappers, hooks                   |
| `frontend-specialist` | React / TypeScript / Zustand | Component changes, store refactor, new components       |
| `quality-engineer`    | Vitest / Playwright          | Validation against testable assertions                  |

## Wave Structure

The work is organized into 5 waves. Waves are sequential; tasks within a wave can run in parallel.

```
Wave 1: Schema foundation (DB migration + Zod schema + adapter mappers)
   ↓
Wave 2: Bug fixes (parallel: timer, circuit, crash-recovery, bodyweight)
   ↓
Wave 3: Pause/resume infrastructure (store, hook, header button)
   ↓
Wave 4: New UI surfaces (preview sheet, paused card, integrations)
   ↓
Wave 5: Validation (quality-engineer pass against all testable assertions)
```

---

## Wave 1: Schema Foundation

### S001 -- Create migration for pause columns

**Owner:** `database-architect`
**Files:** `supabase/migrations/YYYYMMDDHHMMSS_add_workout_pause_fields.sql`
**Deliverable:** Migration that adds `paused_at TIMESTAMPTZ` and `total_paused_ms BIGINT NOT NULL DEFAULT 0` to `workout_logs`. Run `npx supabase db push` to apply locally. Verify with a SELECT against the table.
**Acceptance:** Migration applies cleanly, columns exist with correct types and defaults.

### S002 -- Update WorkoutLog Zod schema and row mappers

**Owner:** `backend-engineer`
**Blocked by:** S001
**Files:**

- `src/domain/types/workout-log.ts` -- add `pausedAt`, `totalPausedMs` fields
- `src/lib/supabase-adapter.ts` -- update `toWorkoutLog` and `fromWorkoutLog` mappers
- `src/lib/data-adapter.ts` -- if any type signatures need update
  **Deliverable:** Schema and adapter handle the new fields. Default `totalPausedMs` to 0, `pausedAt` is optional.
  **Acceptance:** `bun run build` passes (TypeScript check). Existing tests still pass.

### S001-T -- Schema migration test

**Owner:** `quality-engineer` (validation mode)
**Blocked by:** S002
**Deliverable:** Verify schema round-trip: insert a WorkoutLog with pausedAt set, read it back, confirm values preserved. Add unit test if missing.

---

## Wave 2: Bug Fixes (Parallel)

These four tasks are independent and run in parallel.

### S010 -- Fix elapsed timer (Bug TA-1, TA-2)

**Owner:** `frontend-specialist`
**Blocked by:** S002
**Files:**

- `src/stores/active-workout-store.ts` -- replace `_elapsedInterval`/`tickElapsed`/`startElapsedTimer` with a simpler `setElapsedSeconds(n)` setter. Keep rest timer interval logic as-is.
- `src/hooks/use-active-workout.ts` -- remove the cleanup effect that calls `store.cleanup()` on unmount (or split it so only rest timer is cleared)
- `src/routes/_authenticated/log.$workoutId.tsx` -- add `useEffect` that:
  1. On mount with `workoutLog` present, computes initial `elapsedSeconds` from `(Date.now() - startedAt) - totalPausedMs - (pausedAt ? Date.now() - pausedAt : 0)`
  2. Starts a 1-second `setInterval` when `pausedAt` is null
  3. Clears interval on unmount and when `pausedAt` becomes set
     **Acceptance:** TA-1 (timer >0 within 2s of start) and TA-2 (timer survives Forge → log navigation) pass manually.

### S011 -- Fix circuit panel duplication (Bug TA-5)

**Owner:** `frontend-specialist`
**Blocked by:** none (no schema dependency)
**Files:** `src/routes/_authenticated/log.$workoutId.tsx`
**Deliverable:** Restructure the rendering loop so circuit groups render exactly one `CircuitPanel`:

```tsx
loggedGroups.map((group) => {
  if (group.groupType === 'CIRCUIT') {
    const circuitExercises = group.activities.map((a) => ({ ... }))
    return <CircuitPanel key={group.id} ... />
  }
  return group.activities.map((activity) => { /* existing per-activity rendering */ })
})
```

Remove the `if (modality === 'circuit')` branch from inside the activity loop.
**Acceptance:** TA-5 (circuit with N activities renders 1 panel) passes manually.

### S012 -- Fix crash recovery filter (Bug TA-3, TA-4)

**Owner:** `frontend-specialist`
**Blocked by:** S002 (needs new pausedAt field)
**Files:** `src/components/workout/crash-recovery-dialog.tsx`
**Deliverable:** Update the `incompleteWorkout` detection to filter out:

1. Sessions where `pausedAt` is set (those go to PausedSessionCard, not crash dialog)
2. Sessions started less than 60 seconds ago AND with no confirmed sets
   - Check confirmed sets via `useWorkoutLogFull` -- a session with at least one set having `completed: true`
3. Add a memoized check, log decisions with `[crash-recovery]` prefix
   **Acceptance:** TA-3 (no dialog for fresh user) and TA-4 (dialog shows for sessions with confirmed sets after crash) pass manually.

### S013 -- Bodyweight exercise inputs (Bug TA-6)

**Owner:** `frontend-specialist`
**Blocked by:** none
**Files:**

- `src/routes/_authenticated/log.$workoutId.tsx` -- build an `exerciseCategories` lookup alongside `exerciseNames`. Pass `isBodyweight={category === 'BODYWEIGHT'}` to ExerciseBlock.
- `src/components/workout/exercise-block.tsx` -- accept `isBodyweight?: boolean` prop, adjust column header to "BW" instead of "WEIGHT" when set, pass through to SetRow
- `src/components/workout/set-row.tsx` -- accept `isBodyweight?: boolean` prop. When true: hide weight input, display "BW" badge in its place, confirm button only requires reps to be filled
  **Acceptance:** TA-6 (pushups shows reps input only) passes manually. Non-bodyweight exercises unchanged.

### S010-T / S011-T / S012-T / S013-T -- Bug fix validation

**Owner:** `quality-engineer` (validation mode)
**Blocked by:** S010, S011, S012, S013 (one validation task per fix, can run in parallel after each fix completes)
**Deliverable:** For each bug fix, validate against the corresponding TA. Report pass/fail without modifying files. Use a real running app (`bun run dev`) to test.

---

## Wave 3: Pause/Resume Infrastructure

### S020 -- Pause/resume store actions

**Owner:** `frontend-specialist`
**Blocked by:** S002, S010 (timer must already be page-owned)
**Files:** `src/stores/active-workout-store.ts`
**Deliverable:** Add two new actions:

- `pauseWorkout()` -- sets `workoutLog.pausedAt = new Date().toISOString()` in store
- `resumeWorkout()` -- if `pausedAt` is set, computes elapsed pause duration, adds to `totalPausedMs`, clears `pausedAt`
  Both are pure local state updates. The hook layer handles DB persistence.
  **Acceptance:** Store actions work in isolation (unit test).

### S021 -- Pause/resume hook mutations

**Owner:** `frontend-specialist`
**Blocked by:** S020
**Files:** `src/hooks/use-active-workout.ts`
**Deliverable:** Add `pauseWorkout` and `resumeWorkout` to the hook. Each:

1. Calls the corresponding store action
2. Persists the updated `WorkoutLog` to DB via `updateWorkoutLog` mutation
3. Returns a promise that resolves on success
4. Logs errors with `[active-workout]` prefix
   **Acceptance:** Hook methods callable, DB row reflects pause state after call.

### S022 -- Pause/resume button in workout header

**Owner:** `frontend-specialist`
**Blocked by:** S021
**Files:** `src/components/workout/workout-header.tsx`
**Deliverable:** Add a pause/resume toggle button next to the timer. Show pause icon when running, play icon when paused. Clicking calls the corresponding hook action. When paused, the timer display freezes (shown via a "PAUSED" label or color shift, follow Iron & Ember design system).
**Acceptance:** TA-9 (pause stops timer, resume restarts excluding paused time) passes manually.

### S020-T -- Pause/resume validation

**Owner:** `quality-engineer` (validation mode)
**Blocked by:** S022
**Deliverable:** Validate TA-9 and TA-11 (page refresh recalculates elapsed correctly with paused state).

---

## Wave 4: New UI Surfaces

### S030 -- WorkoutPreviewSheet component

**Owner:** `frontend-specialist`
**Blocked by:** none (purely additive)
**Files:** `src/components/workout/workout-preview-sheet.tsx` (new)
**Deliverable:** Bottom sheet/dialog component that:

- Accepts `sessionTemplateId: string` and `open`/`onOpenChange` props
- Fetches `SessionTemplateFull` via existing `useSessionTemplateFull(id)` (or creates the hook if it does not exist -- check with `search_symbols`)
- Resolves exercise names via the existing exercises query
- Calls `resolveSessionTemplate()` to get prescriptions for display
- Renders groups → exercises → sets with prescribed weights/reps
- Has a "Start Workout" button at the bottom that calls `onStart` callback
- Read-only -- no edit affordances
- Follows Iron & Ember design system (zero border-radius, surface tonal layering, no shadows)
  **Acceptance:** TA-7 (preview shows content without starting), TA-8 (Start CTA initiates session) pass.

### S031 -- Integrate preview into Forge page

**Owner:** `frontend-specialist`
**Blocked by:** S030
**Files:**

- `src/components/today/program-session-card.tsx` -- add `onPreview` prop, make card body tappable to call it (the existing Start button keeps its current behavior)
- `src/routes/_authenticated/index.tsx` -- manage preview sheet open state, pass `onPreview` to ProgramSessionCard, render WorkoutPreviewSheet
  **Acceptance:** TA-7 passes from Forge page entry point.

### S032 -- Integrate preview into program builder

**Owner:** `frontend-specialist`
**Blocked by:** S030
**Files:** `src/components/program-builder/session-slot.tsx`
**Deliverable:** Add `onClick` handler to filled session slots that opens the WorkoutPreviewSheet. Pass through callback from parent. Builder page (`builder.tsx`) manages preview state.
**Acceptance:** TA-12 (program builder session click opens preview) passes.

### S033 -- PausedSessionCard component

**Owner:** `frontend-specialist`
**Blocked by:** S021 (needs pause hook actions)
**Files:** `src/components/today/paused-session-card.tsx` (new)
**Deliverable:** Card component that:

- Detects a paused workout from `useWorkoutLogs(userId, 5)` filtered by `pausedAt != null && !completedAt`
- Displays session title, computed elapsed time (excluding paused duration), "PAUSED" badge, "paused X minutes ago" timestamp
- Resume button -- navigates to `/log/$workoutId`, calls `resumeWorkout()` on mount
- Discard button -- shows confirmation, then deletes the workout log
- Follows design system, renders prominently above ProgramSessionCard
  **Acceptance:** TA-10 (paused session card shows on Forge with resume option) passes.

### S034 -- Integrate PausedSessionCard into Forge page

**Owner:** `frontend-specialist`
**Blocked by:** S033
**Files:** `src/routes/_authenticated/index.tsx`
**Deliverable:** Render `PausedSessionCard` above the program session card when a paused session exists. Ensure crash-recovery dialog and paused card never render simultaneously (S012's filter handles this -- verify).
**Acceptance:** TA-10 passes end-to-end. Crash dialog does not fire when paused card is shown.

### S030-T / S031-T / S032-T / S033-T -- New UI validation

**Owner:** `quality-engineer` (validation mode)
**Blocked by:** S031, S032, S034
**Deliverable:** Validate TA-7, TA-8, TA-10, TA-12 against running app.

---

## Wave 5: Final Validation

### S040 -- Full feature validation

**Owner:** `quality-engineer`
**Blocked by:** all prior waves
**Deliverable:** Run through all 12 testable assertions on a real device/browser. Report results. Capture screenshots for any failures. Confirm no regressions in:

- Programmed workout start (TA from F013, F017)
- Crash recovery for genuine crash scenarios (TA-4)
- Existing rest timer behavior
- Sync engine push/pull with new columns
  **Acceptance:** All 12 TAs pass. Lint and TypeScript build clean (`bun run lint`, `bun run build`).

### S040-D -- Documentation update

**Owner:** `backend-engineer`
**Blocked by:** S040
**Deliverable:**

- Update `Context/Features/018-Workout-Session-UX/Spec.md` Revision History
- Update `Context/Features/018-Workout-Session-UX/Tech.md` Revision History
- Note any deviations from the plan in a "Implementation Notes" section if applicable
- Update CLAUDE.md if any new conventions were introduced (e.g., page-owned timer pattern)

---

## Milestones

| Milestone                          | Criteria                                  | Testable Assertions                |
| ---------------------------------- | ----------------------------------------- | ---------------------------------- |
| **M1: Schema ready**               | Migration applied, schema/adapter updated | --                                 |
| **M2: Bugs fixed**                 | All 4 bug fixes merged and validated      | TA-1, TA-2, TA-3, TA-4, TA-5, TA-6 |
| **M3: Pause works**                | Pause/resume functional end-to-end        | TA-9, TA-11                        |
| **M4: Preview & paused card live** | New UI surfaces integrated                | TA-7, TA-8, TA-10, TA-12           |
| **M5: Feature complete**           | Full validation passes, docs updated      | All 12 TAs                         |

## Contracts at Milestone Boundaries

- **M1 → M2:** `WorkoutLog` type now includes `pausedAt?: string` and `totalPausedMs: number`. All consumers must default `totalPausedMs` to 0.
- **M3 → M4:** Hook exposes `pauseWorkout()` and `resumeWorkout()` methods. Store has `pausedAt` reflected in `workoutLog`. Elapsed time formula accounts for paused duration.
- **M4 → M5:** Forge page has both `PausedSessionCard` (for paused sessions) and `CrashRecoveryDialog` (for crash-orphaned sessions), mutually exclusive.

## Execution Notes

- Use Opus model for all sub-agents (per CLAUDE.md mandate)
- Commit after each wave completes (not each task)
- Build-then-validate pattern: every frontend-specialist task is paired with a quality-engineer validation task in the same wave
- Sub-agents should use jCodemunch tools for code exploration (per global CLAUDE.md)
- Use `bun` and `bunx`, never `npm`/`npx`/`yarn`

## Recommended Execution Command

`/team-impl 018` -- this feature has cross-domain coordination (database → backend → frontend) with shared schema contracts at the M1 boundary. Tasks within waves can parallelize but the wave dependencies require team-level coordination.

## Wave 6: PR #92 Review Follow-ups

Follow-up tasks captured from PR #92 review (`Context/Reviews/0014-pr92-workout-template-ux-review.md`).

### S041 -- Mutation hook onError handlers (P14-007, High)

**Owner:** `frontend-specialist`
**Files:** `src/hooks/use-workout-logs.ts:37-73, 138-207`
**Deliverable:** Add `onError` handlers to all 8 new mutation hooks: `useCreateWorkoutLog`, `useUpdateWorkoutLog`, `useDeleteWorkoutLog`, `useUpdateLoggedActivity`, `useDeleteLoggedActivity`, `useUpdateLoggedActivityGroup`, `useDeleteLoggedActivityGroup`, `useDeleteLoggedSet`. Each should match the existing `useCreateLoggedSet` pattern: prefixed `[workout-logs]` log with operation name and entity id, plus cache rollback where applicable.
**Acceptance:** All 8 mutations log on failure with `[workout-logs]` prefix; rollback on optimistic updates verified by test.
**Review finding:** P14-007

### S042 -- Wire pauseTimingError to UI (P14-009-followup, High)

**Owner:** `frontend-specialist`
**Files:** `src/hooks/use-active-workout.ts`, `src/routes/_authenticated/log.$workoutId.tsx`
**Deliverable:** The `active-workout-store` will expose a new `pauseTimingError: string | null` field (added in this PR's fixes). Subscribe to it in the route and surface a banner when set, allowing user to dismiss. Cleared automatically on next successful pause/unpause cycle.
**Acceptance:** Banner appears on pause-timing error, dismissible, auto-clears on next successful cycle.
**Review finding:** P14-009-followup

### S043 -- Test coverage: pause/unpause store actions (P14-010, High)

**Owner:** `quality-engineer`
**Files:** `src/stores/__tests__/active-workout-store.test.ts` (create if missing), covering `src/stores/active-workout-store.ts:254-286`
**Deliverable:** Add a `describe('pause')` block with cases: idempotent double-pause; multi-cycle accumulation of `totalPausedMs` using `vi.useFakeTimers()`; unpause-when-not-paused no-op; invalid-`pausedAt` reset without NaN propagation. Target <50 LOC. Direct data-integrity coverage.
**Acceptance:** Tests pass; covers all four cases.
**Review finding:** P14-010

### S044 -- Test coverage: compound diff edit-mode save (P14-011, High)

**Owner:** `quality-engineer`
**Files:** `src/components/workout/__tests__/manual-workout-form.test.tsx`
**Deliverable:** Add tests for: simultaneous delete + update + add within one activity (compound diff); `tempId` vs `id` disambiguation across multi-add-then-delete; mid-save mutation rejection leaving form recoverable; ordinal/reorder persistence. At minimum one combined-diff test and one mid-save-rejection test.
**Acceptance:** New tests pass; compound diff and mid-save-rejection paths covered.
**Review finding:** P14-011

### S045 -- Test coverage: crash-recovery dialog (P14-012, High)

**Owner:** `quality-engineer`
**Files:** `src/components/workout/__tests__/crash-recovery-dialog.test.tsx` (create)
**Deliverable:** Cover: snapshot restore when `pausedAt` was set at crash time; `totalPausedMs` preservation across `resumeWorkout`; stale-snapshot detection (snapshot older than server `updatedAt`); discard path fully resets store including rest timer listeners.
**Acceptance:** All four scenarios covered; tests pass.
**Review finding:** P14-012

### S046 -- Test coverage: rest-panel/rest-view (P14-013, High)

**Owner:** `quality-engineer`
**Files:** `src/components/workout/__tests__/rest-panel.test.tsx`, `src/components/workout/__tests__/rest-view.test.tsx` (both new)
**Deliverable:** Tests for `rest-panel.tsx` (123 LOC) and `rest-view.tsx` (142 LOC). Cover: tick, skip, adjust, auto-complete behaviors. Replaces the deleted `rest-timer-overlay.test.tsx` (90 LOC).
**Acceptance:** Both test files exist; tick/skip/adjust/auto-complete covered for both components.
**Review finding:** P14-013

### S047 -- Verify ManualWorkoutForm query hooks render error/loading state (P14-015, Medium)

**Owner:** `frontend-specialist`
**Files:** `src/components/workout/manual-workout-form.tsx:536-545, 857-869`
**Deliverable:** Audit: `useExercises` defaults to `[]` causing empty picker during load; `useUserProfile` lacks loading skeleton. Verify `exercisesError`/`profileError` are wired to a visible error state per project query-hook error-state rule. Add loading skeletons and error banners as needed.
**Acceptance:** Loading skeletons render during fetch; error banners render on `isError`; matches `.claude/rules/error-handling.md` query-hook rule.
**Review finding:** P14-015

### S048 -- Route smoke tests for log.new and log.$workoutId.edit (P14-027, Low)

**Owner:** `quality-engineer`
**Files:** `src/routes/_authenticated/__tests__/log.new.test.tsx`, `src/routes/_authenticated/__tests__/log.$workoutId.edit.test.tsx` (both new)
**Deliverable:** Smoke tests verifying not-found and unauthenticated states render. Security-relevant if userId guard is bypassed.
**Acceptance:** Both test files exist; not-found and unauthenticated states asserted.
**Review finding:** P14-027

### S049 -- ADR-012 implementation: Transactional updateWorkoutLogFull adapter

**Owner:** `backend-engineer` + `tauri-specialist` + `frontend-specialist`
**Files:**

- `supabase/migrations/YYYYMMDDHHMMSS_add_update_workout_log_full_rpc.sql`
- `src-tauri/migrations/` (next sequential file) and Rust command module
- `src/domain/types/workout-log-diff.ts` (new)
- `src/lib/supabase-adapter.ts`, `src/lib/tauri-adapter.ts`
- `src/components/workout/manual-workout-form.tsx`

**Deliverable:** Per ADR-012, implement a transactional `updateWorkoutLogFull(diff)` adapter method:

- New Supabase migration adding `update_workout_log_full(payload jsonb)` RPC with RLS guards
- New Rust command + SQLite migration parity for the same operation
- New `WorkoutLogDiff` Zod schema in the domain layer (deletes/updates/inserts grouped by entity type)
- Refactor `manual-workout-form.tsx` to use the new transactional mutation in place of sequential mutations
- Round-trip tests on both adapters

**Acceptance:** Single transactional call replaces the sequential mutation chain; round-trip tests pass on both Supabase and Tauri adapters; no partial-write states observable on failure.
**Review finding:** ADR-012

### S050 -- ADR-013 implementation: Pause state persistence on Tauri

**Owner:** `tauri-specialist` + `frontend-specialist`
**Files:**

- `src-tauri/migrations/` (next sequential file)
- Rust command modules: `create_workout_log`, `update_workout_log`, `get_workout_log`
- `src/lib/tauri-adapter.ts` (`toWorkoutLogRow` and row→domain conversion)
- `src/lib/__tests__/tauri-adapter.test.ts`

**Deliverable:** Per ADR-013, ship pause-state persistence parity:

- New SQLite migration adding `paused_at INTEGER` and `total_paused_ms INTEGER NOT NULL DEFAULT 0` columns to `workout_logs`
- Update Rust commands `create_workout_log`, `update_workout_log`, `get_workout_log` to accept/persist/return pause fields
- Update `src/lib/tauri-adapter.ts` `toWorkoutLogRow` and row→domain conversion to round-trip pause fields with warn-on-fallback
- Round-trip tests in `src/lib/__tests__/tauri-adapter.test.ts`
- Remove the interim Tauri pause-UI gate added in this PR (P14-001 fix)

**Acceptance:** Pause/resume works on Tauri with full persistence parity; interim UI gate removed; round-trip tests pass.
**Review finding:** ADR-013

## Wave 7: PR #109 Review Follow-ups

Follow-up tasks captured from PR #109 review (`Context/Reviews/0018-pr109-workout-set-ux-2026-04-13.md`).

### S051 -- Tests for new store actions (P18-010, High)

**Owner:** `quality-engineer`
**Files:** `src/stores/__tests__/active-workout-store.test.ts`
**Deliverable:** Tests for four new store actions added in PR #109: `deleteSet`, `unconfirmSet`, `removeActivity` (undo-clearing side effect), `skipActivity` (lifecycle reset). Must cover:

- `deleteSet` and `removeActivity` null out `undoAction` when targeted set matches
- `skipActivity` with `initialState` spread does not share `skippedActivityIds` Set reference

**Acceptance:** All four actions covered; undo-clearing side effect and Set reference isolation tested.
**Review finding:** P18-010

### S052 -- Component test for swipe-to-delete DEL button (P18-011, High)

**Owner:** `quality-engineer`
**Files:** `src/components/workout/__tests__/set-row.test.tsx`
**Deliverable:** Tests for DEL button path (swipe/touch simulation not required -- tap path only):

1. DEL button renders when `onDelete` prop provided
2. DEL button absent when `onDelete` is absent
3. Clicking DEL calls `onDelete` and resets `swipeX` to 0

**Acceptance:** All three cases pass.
**Review finding:** P18-011

### S053 -- Regression test for B008 gym picker fix (P18-012, High)

**Owner:** `quality-engineer`
**Files:** `src/routes/_authenticated/__tests__/` (new test file or existing)
**Deliverable:** Two test cases for B008 behavioral contract:

1. Mock `readLastGymChoice` to return a saved gym -- start workout -- assert `openGymPicker` is NOT called
2. Mock `readLastGymChoice` to return null -- start workout -- assert `openGymPicker` IS called

**Acceptance:** Both cases pass; regression is guarded.
**Review finding:** P18-012

### S054 -- Tests for `RestTimerBanner` component (P18-015, Medium)

**Owner:** `quality-engineer`
**Files:** New test file alongside `src/components/workout/rest-timer-banner.tsx`
**Deliverable:** Unit tests covering:

- Progress bar clamping (`Math.max(0, Math.min(100, ...))`) -- verify `remaining > total` does not produce >100%
- `total > 0` guard -- verify nothing renders (or renders safely) when `total === 0`
- Expand button calls `onExpand` callback
- Skip button calls `onSkip` callback
- Countdown text renders from `formatCountdown(remaining)`

**Acceptance:** All cases covered and passing.
**Review finding:** P18-015

---

## Revision History

| Date       | Change                                           | ADR              |
| ---------- | ------------------------------------------------ | ---------------- |
| 2026-04-06 | Initial draft                                    | --               |
| 2026-04-07 | Add Wave 6 PR #92 review follow-ups (S041-S050)  | ADR-012, ADR-013 |
| 2026-04-13 | Add Wave 7 PR #109 review follow-ups (S051-S054) | --               |
