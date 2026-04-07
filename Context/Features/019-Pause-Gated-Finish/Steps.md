# Implementation Steps: Pause-Gated Finish

**Spec:** Context/Features/019-Pause-Gated-Finish/Spec.md
**Tech:** Context/Features/019-Pause-Gated-Finish/Tech.md

## Progress

- **Status:** Complete
- **Current task:** --
- **Last milestone:** Feature complete (2026-04-06)

## Team Orchestration

### Team Members

- **builder-ui**
  - Role: React/TypeScript component and route work
  - Agent Type: frontend-specialist
  - Resume: true
- **validator**
  - Role: Quality validation (read-only)
  - Agent Type: quality-engineer
  - Resume: false

## Tasks

### Phase 1: New paused-bar component

- [ ] S001: Create `WorkoutPausedBar` component at `src/components/workout/workout-paused-bar.tsx` with the props interface from Tech.md D-3 (`onResume`, `onFinish`, `isFinishing`, `canFinish`, `onDiscard`, `showFinishHelper`, plus an `isPaused` prop for the always-mounted collapse pattern). Render Resume / [helper text] / Finish / Discard per D-5 layout. Use the always-mounted + `max-h`/`opacity` transition pattern from D-6, with `tabIndex={-1}` and `aria-hidden="true"` on contained controls when collapsed. Use Lucide icons (`ChevronLeft` for Resume), the existing `Button` component with `outline`/`molten`/`ghost` variants, `text-warning-flare` for Discard label, and `text-[11px] uppercase tracking-widest text-warm-ash/60` for the helper. Helper copy: `"Log a set before finishing"`.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** false
- [ ] S001-T: Component test for `WorkoutPausedBar` at `src/components/workout/__tests__/workout-paused-bar.test.tsx` (renders all three actions when `isPaused=true`; Finish disabled when `canFinish=false`; helper text appears iff `showFinishHelper=true`; each callback fires on click; when `isPaused=false` the contained buttons are not focusable and `aria-hidden`).
  - **Assigned:** builder-ui
  - **Depends:** S001

🏁 MILESTONE: Paused bar component exists in isolation -- verify against [A-003, A-004, A-005]
**Contracts:**

- `src/components/workout/workout-paused-bar.tsx` -- Component and exported `WorkoutPausedBarProps` interface for the route to consume

### Phase 2: Slim the active header

- [ ] S002: Update `src/components/workout/workout-header.tsx` to remove the FINISH button and its props (`onFinish`, `isFinishing`, `canFinish`). Keep the timer, `isPaused` indicator, pause/play toggle, and `actions` slot (for cast). The header should render only `[timer + paused badge] [actions slot] [pause/play toggle]` after this task.
  - **Assigned:** builder-ui
  - **Depends:** none
  - **Parallel:** true
- [ ] S002-T: Update or create `src/components/workout/__tests__/workout-header.test.tsx` to assert no element matching "Finish" renders in any header state, the pause button is still present and fires `onPause`/`onResume`, and the cast slot still renders provided `actions`.
  - **Assigned:** builder-ui
  - **Depends:** S002

🏁 MILESTONE: Active header is finish-free -- verify against [A-001, A-002, A-007, A-008]
**Contracts:**

- `src/components/workout/workout-header.tsx` -- New props interface (no finish-related props) for the route to consume

### Phase 3: Wire into the route (event + strength paths)

- [ ] S003: In `src/routes/_authenticated/log.$workoutId.tsx`, wrap `WorkoutHeader` and a new `WorkoutPausedBar` instance in a single `<div className="sticky top-0 z-50">` container in BOTH the event branch and the strength branch. Pass the props through: `onResume={handleResume}`, `onFinish={handleFinish}`, `isFinishing={isFinishing}`, `onDiscard={() => setShowDiscardDialog(true)}`, `isPaused={isPaused}`. For the strength branch: `canFinish={confirmedSetCount > 0}`, `showFinishHelper={confirmedSetCount === 0}`. For the event branch: `canFinish={true}`, `showFinishHelper={false}`. Remove the `onFinish` / `isFinishing` / `canFinish` props from the `WorkoutHeader` calls.
  - **Assigned:** builder-ui
  - **Depends:** S001, S002
  - **Parallel:** false
- [ ] S004: In the same file, delete the two standalone Discard render blocks (the `{isPaused && <div className="px-4 pb-4"><Button … >Discard workout</Button></div>}` blocks in the event and strength branches). The `Dialog`, `showDiscardDialog` state, `handleDiscard`, and `setShowDiscardDialog` stay -- only the trigger button is removed from those locations (it now lives inside `WorkoutPausedBar`).
  - **Assigned:** builder-ui
  - **Depends:** S003
  - **Parallel:** false
- [ ] S005: In the same file, delete the `{confirmedSetCount === 0 && <p role="status" …>Log a set to finish</p>}` block under `WorkoutHeader`. Helper responsibility now lives in the paused bar.
  - **Assigned:** builder-ui
  - **Depends:** S003
  - **Parallel:** false
- [ ] S005-T: Route-level integration test (extend an existing log-route test or create one) covering: pause toggles the bar visibility on both branches; resume restores the active state; helper text never appears in the active header; tapping Discard in the bar opens the existing dialog; tapping Finish from the bar fires `handleFinish`.
  - **Assigned:** builder-ui
  - **Depends:** S003, S004, S005

🏁 MILESTONE: Route uses pause-gated finish on both branches -- verify against [A-006, A-009, A-010, A-011, A-012]

### Phase 4: Validation

- [ ] S006: Run `bunx tsc --noEmit`, `bun run lint`, and `bun run test` and confirm all pass.
  - **Assigned:** builder-ui
  - **Depends:** S005-T
  - **Parallel:** false
- [ ] S007: Validator pass: read-only inspection against all twelve testable assertions from Spec.md. Verify both branches symmetrically apply the gating; verify the `aria-hidden`/`tabIndex` accessibility pattern on the collapsed bar; verify no orphaned imports or dead code in `log.$workoutId.tsx` or `workout-header.tsx`; verify Iron & Ember conventions (zero radius, ember reserved for primary CTA, badge typography for helper).
  - **Assigned:** validator
  - **Depends:** S006

🏁 MILESTONE: Feature complete -- verify all assertions, full drift check

## Acceptance Criteria

- [ ] All twelve testable assertions (A-001 through A-012) from Spec.md verified
- [ ] All tests passing (`bun run test`)
- [ ] Type check clean (`bunx tsc --noEmit`)
- [ ] Lint clean (`bun run lint`)
- [ ] No TODO/FIXME stubs remaining
- [ ] No orphaned imports in modified files
- [ ] Manual QA pass on both event and strength paths (start → pause → finish, start → pause → discard, start → pause → resume → log set → pause → finish)
- [ ] Manual QA pass with `prefers-reduced-motion` enabled
- [ ] Manual QA pass on a small viewport (375x667) confirming the paused bar does not crowd content off-screen

## Validation Commands

```bash
bunx tsc --noEmit
bun run lint
bun run test
```
