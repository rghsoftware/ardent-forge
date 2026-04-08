# F019 Wave 8 Implementation Session: Display Setup UX Post-Review Follow-ups

**Plan:** Context/Features/019-Display-Setup-UX/Steps.md
**Review source:** Context/Reviews/0015-pr91-f019-display-setup-ux-review.md
**Branch:** worktree-feat+multipe-instance-display
**Started:** 2026-04-08

## Context

Waves 1-7 of F019 are already shipped (commits 2cb69e1, e1382d2, a95d013).
Wave 8 captures 9 follow-up tasks from the PR #91 review that did not block merge
but should be addressed in this follow-up session.

## Team Roster

- **fe-broadcast** — frontend-specialist — display URL parser, dispatcher,
  edge function alerting, supabase test, publisher test stabilization
- **fe-ui** — frontend-specialist — profile panel coverage, qr scanner hook,
  test fixture extraction
- **validator** — quality-engineer — final read-only validation pass

## Execution Mode

Hub-and-spoke (`/impl 019`). All 9 Wave 8 tasks are independent (Parallel: true,
Depends: none) so they fan out in a single wave with no contract handoff needed.
Validator runs sequentially after all 9 complete.

## Wave 8 Task Map

| Task   | Owner        | Files                                                              |
| ------ | ------------ | ------------------------------------------------------------------ |
| S018-T | fe-broadcast | supabase/tests/018_gym_owner_enroll.sql → 019_gym_owner_enroll.sql |
| S019-T | fe-ui        | src/components/profile/**tests**/show-display-panel.test.tsx       |
| S020-T | fe-ui        | src/hooks/**tests**/use-qr-scanner.test.tsx                        |
| S021-T | fe-broadcast | src/lib/**tests**/display-publisher-hello.test.ts                  |
| S022-T | fe-broadcast | src/lib/**tests**/discovery.test.ts                                |
| S023   | fe-broadcast | supabase/functions/display-idle-snapshot/index.ts                  |
| S024-T | fe-broadcast | src/lib/**tests**/display-url.test.ts                              |
| S025-T | fe-ui        | src/test/fixtures/gym.ts (NEW) + 3 dispatcher test migrations      |
| S026-T | fe-ui        | src/components/profile/**tests**/show-display-panel.test.tsx       |

## Progress Log

### Wave 8: Post-review follow-ups — IN PROGRESS

- Session created
- Tasks 1-9 created in TaskList, owners assigned
- Validation task #10 blocked by all 9 follow-ups
- 2026-04-08 07:15 — fe-ui agent dispatched (background, agentId aeb2d06e1c6b4434c)
- 2026-04-08 07:15 — fe-broadcast initial spawn hit transient API overload; resumed via SendMessage to agentId ac863a0842e63915f
- Both agents working in parallel on disjoint file sets
- 2026-04-08 — fe-ui completed S019-T, S020-T, S025-T, S026-T (4/4), lint+tsc clean
- 2026-04-08 — fe-broadcast completed S018-T, S021-T, S022-T, S023, S024-T (5/5), lint clean, build clean
- Both agents independently verified 3 pre-existing test failures unrelated to Wave 8:
  1. `show-display-panel.test.tsx:131` — Copy button logPrefix drift (`display-setup` vs `show-display-panel`)
  2. `gym-management-section.test.tsx:236` — Leave gym mutate signature drift
  3. `gym-management-section.test.tsx:344` — Join gym mutate signature drift
- 2026-04-08 — Validator dispatched for Wave 8 read-only verification

## Wave 8 Validation Report

**Validator:** quality-engineer (read-only)
**Date:** 2026-04-08
**Scope:** 9 post-review follow-up tasks (S018-T through S026-T)

### Per-task verdict

| Task   | Finding | File(s)                                                                  | Verdict | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------- | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S018-T | P15-021 | `supabase/tests/019_gym_owner_enroll.sql` (renamed + rewritten)          | PASS    | Rename via `git mv` (`D 018_*.sql` / `A 019_*.sql`). Section 2 now drops the trigger, pre-inserts membership, recreates trigger with `insert or update` scope, updates gym to re-fire, asserts membership count = 1. Actually exercises the trigger function's `on conflict do nothing` path. Header references F019 and migration `20260407000004_enroll_gym_creator.sql`.                                                                             |
| S019-T | P15-022 | `src/components/profile/__tests__/show-display-panel.test.tsx` +59 lines | PASS    | `it('falls through to backfill form when getConfig() rejects', ...)` added inside the Tauri describe block. Mocks `mockGetConfig.mockRejectedValueOnce(new Error('store corrupted'))`, asserts backfill form renders, URL/Copy/QR are absent, and the `[show-display-panel] Failed to read config for origin:` log fires. Passes (12 tests / 11 passing).                                                                                               |
| S020-T | P15-023 | `src/hooks/__tests__/use-qr-scanner.test.tsx` +49 lines                  | PASS    | New `describe('useQrScanner.cancel public API', ...)` with two cases: (1) noop when no scan in progress (cancelMock not called), (2) noop after completed scan (cancelMock called exactly once by scan()'s internal cleanup, not re-invoked by explicit cancel). File passes in isolation.                                                                                                                                                              |
| S021-T | P15-049 | `src/lib/__tests__/display-publisher-hello.test.ts` +15 lines            | PASS    | Multi-line "IMPLICIT COUPLING NOTICE (P15-049)" block comment documents the lazy-init dependency and the specific replacement needed if the publisher ever goes eager-init. Option A (no production change). File still passes.                                                                                                                                                                                                                         |
| S022-T | P15-050 | `src/lib/__tests__/discovery.test.ts` +23 lines                          | PASS    | `it('returns INVALID_INPUT for a javascript: URL', ...)` added next to the `file://` / `ftp://` rejection cases. Comment explains the https-prepend branch that this input takes. Asserts full error shape + `fetch` not called. File passes.                                                                                                                                                                                                           |
| S023   | P15-051 | `supabase/functions/display-idle-snapshot/index.ts` +30 lines            | PASS    | Permanent-failure path extracts `sharedCode` once, emits `console.error('[display-idle-snapshot] PERMANENT_FAILURE', { error_code, failure_count, gym_count })`, AND adds conditional `permanent_failure: true`, `error_code`, `failure_count` fields to JSON response body (spread only when `isPermanentFailure`). Cron status unchanged (200 for all-permanent). Comment flags Sentry swap-in point. Build compiles.                                 |
| S024-T | P15-052 | `src/lib/__tests__/display-url.test.ts` +52 lines                        | PASS    | `describe('parseDisplayUrlInput ∘ buildDisplayUrl round-trip', ...)` with 10 UUIDs × 4 origins = 40 generated `it(...)` cases. No fast-check dependency. Each case builds URL, asserts `built.ok`, parses it, asserts round-tripped `gymId === uuid`. File passes.                                                                                                                                                                                      |
| S025-T | P15-053 | `src/test/fixtures/gym.ts` (new, 39 lines) + 3 dispatcher tests          | PASS    | New fixture module exports `makeGym(overrides)` that runs every fixture through `gymSchema.parse`. Migrated `dispatcher-state.test.ts`, `display-dispatcher.test.tsx`, `display-chooser.test.tsx` to `import { makeGym } from '@/test/fixtures/gym'`. Local `makeGym` definitions removed from all three. `display-setup-panel.test.tsx` intentionally untouched (it redefines `makeGym` for its own scope). All 29 tests in the 3 migrated files pass. |
| S026-T | P15-054 | `src/components/profile/__tests__/show-display-panel.test.tsx`           | PASS    | `it('renders dev-origin warning when Tauri appUrl is loopback', ...)` added inside the Tauri describe block. Mocks `appUrl: 'http://localhost:5173'`, asserts URL resolves to loopback, and the `show-display-dev-warning-${GYM_ID}` caption is rendered. Passes.                                                                                                                                                                                       |

### Full-suite results

- **Vitest:** 2394 passed / 3 failed / 2397 total (122 test files, 120 passing)
- **Lint:** PASS (no eslint errors)
- **Build:** PASS (`✓ built in 709ms`, TypeScript check clean)

### Pre-existing failures (unchanged from baseline)

- `src/components/profile/__tests__/show-display-panel.test.tsx:134` — Copy button `logPrefix` drift. Verified the `it('Copy button calls copyToClipboard...')` block at lines 127-142 is **unchanged by Wave 8**. Line 138 still reads `logPrefix: 'display-setup'` while production passes `logPrefix: 'show-display-panel'`. Diff only adds new tests after line 166 (inside the Tauri describe block). NOT a regression.
- `src/components/profile/__tests__/gym-management-section.test.tsx` > `leaveGym.mutate` — Verified `gym-management-section.test.tsx` is **entirely untouched by Wave 8** (empty `git diff HEAD -- <file>`). NOT a regression.
- `src/components/profile/__tests__/gym-management-section.test.tsx` > `joinGym.mutate` — Same file, same verification. NOT a regression.

### Scope leak check

- Modified files: 12 tracked + 3 untracked = 15 total
  - **Tracked** (12): `Context/Features/019-Display-Setup-UX/Steps.md`, `src/components/display/__tests__/dispatcher-state.test.ts`, `src/components/display/__tests__/display-chooser.test.tsx`, `src/components/display/__tests__/display-dispatcher.test.tsx`, `src/components/profile/__tests__/show-display-panel.test.tsx`, `src/hooks/__tests__/use-qr-scanner.test.tsx`, `src/lib/__tests__/discovery.test.ts`, `src/lib/__tests__/display-publisher-hello.test.ts`, `src/lib/__tests__/display-url.test.ts`, `supabase/functions/display-idle-snapshot/index.ts`, `supabase/tests/018_gym_owner_enroll.sql` (D), `supabase/tests/019_gym_owner_enroll.sql` (A, staged).
  - **Untracked** (3): `.cortex/session.md`, `.cortex/archive/session-f019-display-setup-ux.md`, `src/test/fixtures/` (contains new `gym.ts`).
- Files outside expected set: **NONE**.

### Cross-cutting checks

- **Error handling rules**: PASS. New `console.error('[display-idle-snapshot] PERMANENT_FAILURE', ...)` uses `[module-name]` prefix per `.claude/rules/error-handling.md`. Added test-file `console.error` spies (`show-display-panel`, `discovery`) also assert the `[module-name]` prefix on production logs. No bare `catch {}` introduced in the diff.
- **bun/bunx only**: PASS. No `npx`/`npm install`/`yarn` tokens found in `git diff HEAD`.
- **Tests colocated**: PASS. All touched test files live in `__tests__/` subdirectories colocated with source. New fixture lives at `src/test/fixtures/gym.ts` (the canonical shared-fixtures location per P15-053 guidance).

### Overall verdict

**PASS** — Wave 8 follow-ups are ready for commit. All 9 tasks correctly address their corresponding review findings, the full test suite reports the expected 3 pre-existing failures (each verified untouched by Wave 8), lint and build are clean, and there is no scope leak beyond the expected 12-file set.
