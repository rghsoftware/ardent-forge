# Feature 018: Workout Session UX

## Overview

The active workout experience has multiple bugs and UX gaps that undermine usability. The elapsed timer freezes immediately after starting, the crash-recovery dialog fires even with no prior sessions, circuit groups render duplicate panels, bodyweight exercises show irrelevant weight inputs, there is no way to preview a workout before committing, and there is no intentional pause/resume flow. This feature addresses all six issues as a cohesive UX pass over the workout session lifecycle.

## Problem Statement

The current workout session flow has compounding issues that erode trust:

1. **Elapsed timer frozen at 0:00:** The `useActiveWorkout` hook runs a cleanup effect on unmount that kills the store's `_elapsedInterval`. Since `startWorkout` is called from the home page and then the user navigates to `/log/$workoutId`, the home page unmounts, the cleanup fires, and the interval is dead before the workout log page mounts. The rest timer works because it is only created post-navigation.

2. **Crash-recovery dialog always appears:** `CrashRecoveryDialog` queries for any `WorkoutLog` without `completedAt`. If a previous session was abandoned without explicit discard (app kill, browser close, or a bug that skipped cleanup), the stale record triggers the dialog on every visit to the Forge page, even for first-time users or users with no active session.

3. **No pause/resume:** There is no intentional way to pause a workout mid-session (e.g., taking a phone call, resting between sections). The only "resume" path is crash recovery, which treats every incomplete session as a crash. Athletes need an explicit pause/resume flow.

4. **No workout preview:** Clicking a programmed workout on the Forge page immediately starts the session. Athletes want to review the day's workout (exercises, sets, loads) before committing. The same applies to clicking a session template in the program builder.

5. **Bodyweight exercises show weight input:** `SetRow` is category-agnostic -- it always renders weight and reps columns. For bodyweight exercises (pushups, pull-ups, dips), the weight input is meaningless and confusing. The component never receives the exercise category.

6. **Circuit groups render N duplicate panels:** In `log.$workoutId.tsx`, `CircuitPanel` is rendered inside `group.activities.map(...)`. A circuit group with N activities produces N identical `CircuitPanel` components, each iterating over all N activities internally.

## User Stories

- As an athlete, I want the elapsed timer to count up throughout my workout so I can track total session duration.
- As an athlete, I want to start a fresh workout without being asked to resume a non-existent session so the app feels reliable.
- As an athlete, I want to pause my workout intentionally and resume it later so I can handle interruptions without losing progress.
- As an athlete, I want to see my paused workout on the Forge page so I can quickly resume where I left off.
- As an athlete, I want to preview today's programmed workout before starting so I can see exercises, sets, and prescribed loads.
- As a coach reviewing templates, I want to click a session in the program builder to see a read-only preview so I can verify the programming.
- As an athlete doing bodyweight exercises, I want the interface to show only the relevant input (reps) so I'm not confused by an empty weight field.
- As an athlete doing a circuit, I want to see one circuit panel per group, not duplicates for each exercise in the circuit.

## Requirements

### Must Have

- **M-1:** Elapsed timer ticks continuously from workout start to finish/discard, surviving the navigation from Forge to workout log page.
- **M-2:** Crash-recovery dialog only appears when a genuinely incomplete workout exists (has at least one confirmed set, or was started more than 30 seconds ago) -- not for freshly created but immediately abandoned sessions.
- **M-3:** Circuit groups render exactly one `CircuitPanel` per group, regardless of activity count.
- **M-4:** Bodyweight exercises hide the weight input and show "BW" or a bodyweight indicator in its place, passing exercise category context to `SetRow`.
- **M-5:** Workout preview modal/sheet showing exercises, groups, sets, and prescribed loads for the day's programmed session. Accessible by tapping the workout card on the Forge page (not the "Start" button).
- **M-6:** Intentional pause/resume: a pause button on the active workout screen that stops the elapsed timer, persists a `pausedAt` timestamp, and allows resuming. Paused time is excluded from total elapsed duration.
- **M-7:** Paused session card on the Forge page showing session name, elapsed time (excluding paused duration), and a resume button.

### Should Have

- **S-1:** Workout preview also accessible from the program builder when clicking a session template.
- **S-2:** Elapsed timer recalculates correctly on page refresh by deriving from `startedAt`, `pausedAt`, and total paused duration rather than relying solely on in-memory interval.
- **S-3:** Auto-discard stale sessions older than 24 hours to prevent indefinite crash-recovery prompts.

### Won't Have (this iteration)

- **W-1:** Multiple concurrent paused sessions -- only one active/paused session at a time (existing invariant L-8).
- **W-2:** Background notifications for paused sessions.
- **W-3:** Offline-first pause/resume sync -- relies on existing sync engine.

## Testable Assertions

| ID    | Assertion                                                                              | Verification                                                                   |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| TA-1  | Elapsed timer displays >0 within 2 seconds of workout start                            | Start ad-hoc workout, observe timer increments on workout log page             |
| TA-2  | Elapsed timer survives navigation from Forge to workout log page                       | Start programmed workout from Forge, verify timer is ticking on log page       |
| TA-3  | Crash-recovery dialog does not appear when no prior sessions exist                     | Fresh user, navigate to Forge, confirm no dialog                               |
| TA-4  | Crash-recovery dialog appears for sessions with confirmed sets that lack `completedAt` | Start workout, confirm a set, kill app, reopen, verify dialog                  |
| TA-5  | Circuit group with 3 activities renders exactly 1 `CircuitPanel`                       | Start programmed workout with circuit, count rendered panels                   |
| TA-6  | Bodyweight exercise (pushups) shows reps input only, no weight input                   | Add pushups to workout, verify weight column absent or shows "BW"              |
| TA-7  | Workout preview shows exercises, sets, and prescribed loads without starting a session | Tap workout card on Forge (not Start button), verify preview content           |
| TA-8  | Workout preview has a "Start" CTA that initiates the session                           | Tap Start in preview, verify navigation to active workout                      |
| TA-9  | Pause button stops elapsed timer; resume button restarts it                            | Start workout, pause, wait 10s, resume, verify elapsed excludes paused time    |
| TA-10 | Paused session appears as a card on the Forge page with resume option                  | Start workout, pause, navigate to Forge, verify paused session card            |
| TA-11 | Page refresh on active workout recalculates elapsed from timestamps                    | Start workout, wait 30s, refresh page, verify elapsed is approximately correct |
| TA-12 | Program builder session click opens preview (not edit)                                 | In program builder, click session template, verify preview modal               |

## Open Questions

- [x] Should pause/resume be a full feature or lower priority? -- **Full feature (confirmed by user)**
- [x] What format for workout preview? -- **Bottom sheet/modal with exercises, sets, loads, and Start CTA (confirmed)**
- [x] Single feature or split bugs vs features? -- **Single feature, no preference (confirmed)**
- [x] Should the paused state persist across app restarts (Tauri kill + reopen)? -- **Yes, paused sessions persist until explicitly dismissed (discard) or completed by the user. No auto-discard for intentional pauses.**
- [x] Maximum pause duration before auto-discard? -- **No auto-discard. S-3 (24h stale auto-discard) applies only to sessions that were never intentionally paused -- i.e., crash-orphaned sessions with no confirmed sets.**

## Dependencies

- **Upstream:** Active workout store (`src/stores/active-workout-store.ts`), workout data adapter, prescription resolver
- **Upstream:** `WorkoutLog` schema may need `pausedAt` / `totalPausedMs` fields -- requires Supabase migration
- **Related:** F013 Session-Instance-Editing (override merger), F017 Program-Time-Travel (program position)

## Revision History

| Date       | Change        | ADR |
| ---------- | ------------- | --- |
| 2026-04-06 | Initial draft | --  |
