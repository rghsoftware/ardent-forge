# Feature 019: Pause-Gated Finish

## Overview

Remove the FINISH button from the active workout header and surface it only when the workout is paused, alongside Discard. Finishing a session becomes a deliberate two-step action (pause → finish), matching the gating pattern already in place for Discard and reframing session termination as a decision rather than a tap.

## Problem Statement

Today the FINISH button lives in the sticky header throughout the entire active workout, sitting one stray tap away from the user at all times. This creates two problems:

1. **Internally inconsistent gating.** Discard is already gated behind a paused state (Feature 018) on both the strength and event paths because destructive/terminal actions shouldn't be one-tap reachable mid-session. FINISH is also a terminal action — it commits the session and exits the page — but it has no equivalent gate. The two terminal actions follow different mental models.
2. **Header competes with itself.** The molten-gradient FINISH button (Feature 018) is the most visually dominant element in the header at all times, even when the user has no intention of finishing. The brand principle reserves ember for primary CTAs at moments of action; an "always-on" finish CTA dilutes that signal and competes with the timer for attention.

Pausing-then-finishing reuses an affordance that already exists, requires no new gestures, and turns the paused state into a coherent "what do you want to do now" screen.

## User Stories

- As an athlete mid-set, I want the active workout header to show only the timer, pause, and cast controls so that I'm not visually competing with a terminal action I'm not ready to take.
- As an athlete wrapping up a session, I want to pause and then explicitly choose Finish so that ending the workout feels like a deliberate decision.
- As an athlete who paused to rest, I want Finish and Discard available as peer actions in the paused state so that all session-termination options live in one consistent place.
- As an athlete with muscle memory from the prior FINISH-in-header pattern, I want the change to be discoverable without explanation so that I can adapt on first use.

## Requirements

### Must Have

- The active (non-paused) workout header MUST NOT render a FINISH button on either the event path or the strength path.
- When the workout is paused, the header (or a paused-state surface attached to it) MUST surface a FINISH action.
- When the workout is paused, the FINISH action MUST sit alongside the existing Discard action as visually peer controls — neither subordinate to the other in placement, both clearly distinguishable in intent (FINISH constructive/molten, Discard destructive/warning).
- Resuming the workout MUST hide both the FINISH and Discard actions, returning the header to its quiet active state.
- The FINISH action's enabled/disabled gating MUST be preserved: it remains disabled until at least one set has been confirmed (`confirmedSetCount > 0`) on the strength path; the event path's existing always-enabled rule is preserved.
- The "Log a set to finish" helper subtext MUST be removed from its current location (under the active header) and either relocated to the paused-state finish surface (visible only when paused AND `confirmedSetCount === 0`) or removed entirely if its location no longer makes sense.
- Pausing MUST remain a single tap from the active header (no regression to the existing pause affordance).
- The change MUST apply to BOTH the event-workout path and the strength-workout path so the two paths stay consistent.

### Should Have

- The paused-state action cluster (Resume, Finish, Discard) SHOULD have a clear visual hierarchy that signals Resume as the safe default and Finish/Discard as deliberate exits.
- A short transitional moment (e.g., 200-300ms fade) when toggling between active and paused header states SHOULD smooth the visual swap so the header doesn't feel like it's flickering between layouts.
- The paused state SHOULD remain reachable via keyboard for accessibility (existing pause button focus order is preserved).

### Won't Have (this iteration)

- Swipe-to-finish or other custom gestures. The pause-then-tap pattern is sufficient and reuses an existing affordance.
- A separate full-screen "session summary preview" before commit. Finish remains a single confirmation tap from the paused state.
- Changes to what happens AFTER FINISH is tapped (the existing finishWorkout flow, summary redirect, and summary screen are out of scope).
- Renaming, restyling, or relocating the pause button itself.
- Changes to the Discard confirmation dialog.
- Changes to the cast/Push-to-Display button placement.

## Testable Assertions

| ID    | Assertion                                                                                                                                         | Verification                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A-001 | When `isPaused === false`, the workout header on the strength path renders no element matching `text/role` "Finish".                              | Component test on `WorkoutHeader` (or page test on `log.$workoutId.tsx`); query absence.      |
| A-002 | When `isPaused === false`, the workout header on the event path renders no element matching "Finish".                                             | Same as A-001 against the event branch.                                                       |
| A-003 | When `isPaused === true` AND `confirmedSetCount > 0`, a FINISH action is visible and enabled.                                                     | Component test: render with paused=true, confirmedSetCount=1, assert visible and `!disabled`. |
| A-004 | When `isPaused === true` AND `confirmedSetCount === 0` (strength path), the FINISH action is visible but disabled.                                | Component test: render with paused=true, confirmedSetCount=0, assert visible and disabled.    |
| A-005 | When `isPaused === true`, both FINISH and Discard are present and visually peer (no nesting, no subordination), with Resume also accessible.      | Snapshot or DOM-structure test; manual visual review against Iron & Ember design system.      |
| A-006 | Toggling `isPaused` from true → false hides the FINISH and Discard actions; toggling false → true shows them.                                     | Component test with state toggle; assert visibility transitions.                              |
| A-007 | The pause button remains a single tap from the active header (no extra taps introduced).                                                          | Manual test + component test asserting pause button still in active-header DOM.               |
| A-008 | The "LOG A SET TO FINISH" helper text does NOT render in the active header at any point.                                                          | Search the active-header subtree; assert the string is absent.                                |
| A-009 | If the helper text is relocated to the paused state, it renders only when `isPaused === true` AND `confirmedSetCount === 0` on the strength path. | Component test covering all four (paused, count) combinations.                                |
| A-010 | The event path and strength path both apply identical pause-gating logic for FINISH (no divergence between branches).                             | Code review: shared header component or symmetric branch handling. Optional test parity.      |
| A-011 | Tapping Resume from the paused state restores the active header in a single tap and returns the user to logging without losing in-progress input. | Manual test + integration test on the route component.                                        |
| A-012 | The molten-gradient ember treatment on FINISH is preserved when it appears in the paused state (visual continuity with Feature 018).              | Manual visual review; class-name assertion in component test.                                 |

## Resolved Decisions

- **Paused subheader bar** is the chosen surface for the action cluster. When `isPaused` is true, a bar renders directly beneath the sticky main header containing three peer actions: `Resume` (left, default/safe), `Finish` (right, molten when enabled), `Discard` (far right, ghost + `text-warning-flare`). The active header is unchanged when not paused — only the timer + pause button + cast button.
- **Helper copy moves to the paused bar.** The global "LOG A SET TO FINISH" subtext under the active header is removed. When paused AND `confirmedSetCount === 0` on the strength path, a small inline helper renders adjacent to the disabled Finish button reading "Log a set before finishing."
- **No "Cancel workout" semantics.** An empty-workout abandon path is `pause → discard`. Finish stays disabled when no sets are logged; we do not overload its label or behavior.
- **No onboarding hint and no telemetry.** Zero existing users; no muscle memory to fight. The paused bar is self-explanatory the first time a user pauses.
- **Sticky behavior preserved.** The paused subheader sits directly below the sticky main header and inherits sticky positioning so the action cluster is always reachable regardless of scroll position. No auto-scroll needed.
- **Active header layout unchanged otherwise.** Pause button, cast button, and timer all retain their current positions and behavior.

## Open Questions

- [ ] None remaining. Implementation choices (transition timing, exact spacing, animation easing) deferred to Tech.md.

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-06 | Initial spec | —   |
