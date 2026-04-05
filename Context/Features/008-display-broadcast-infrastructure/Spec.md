# Spec: Display Broadcast Infrastructure (Step 27)

**Feature:** 008-display-broadcast-infrastructure
**Status:** Draft
**Created:** 2026-04-03
**Source:** `docs/implementation-plan.md` Step 27, `docs/13-prd-remote-display.md` Broadcast Channel Design + Snapshot Publishing + Display Opt-Out, `docs/05-domain-model.md` UserProfile, `docs/06-invariants.md`

---

## Overview

Build the data pipeline that powers the remote gym display. The phone constructs a `DisplaySnapshot` from the active workout Zustand store and publishes it to a Supabase Realtime Broadcast channel named `display` on every meaningful state change (set confirmed, exercise transitioned, rest timer started/expired, workout started/completed). A display visibility toggle on the user profile gates all publishing. This step produces no UI for the `/display` route itself (that is Step 28) -- it produces the Zod schema, the publisher logic wired into the existing active workout store, the visibility setting, and the Broadcast channel plumbing.

## Problem Statement

The active workout store manages all in-progress workout state but has no mechanism to push that state to external consumers. The existing Broadcast infrastructure (`RealtimeManager`) is scoped entirely to chat channels (`chat:{conversationId}`). A separate, independent channel is needed for display broadcast -- a single `display` channel that all phone clients publish to and all display clients subscribe to, discriminated by `user_id` in the payload.

## User Stories

1. **As a gym member**, when I confirm a set during my workout, the gym TV automatically updates to show my progress within 500ms, so my training partners can see what I'm doing.
2. **As a gym member**, I can toggle "Display Visibility" off in Settings so my workout does not appear on the gym TV.
3. **As a gym member**, I can tap "Push to Display" during my workout to make the gym TV show my session full-screen.
4. **As a gym member**, I can tap "Return to Board" to give the TV back to the multi-user view.
5. **As a display client** (the TV), when I subscribe to the Broadcast channel I receive self-contained snapshots that require no database lookups to render.
6. **As a display client**, when a user finishes their workout I receive a `session_ended` event so I can remove their card.

## Requirements

### Must Have (P0)

| ID | Requirement | Invariant | Verification |
|----|-------------|-----------|--------------|
| M1 | `DisplaySnapshot` Zod schema validates all fields from PRD "What Gets Pushed" table | -- | Unit test: valid snapshot passes, missing required fields rejected |
| M2 | Active workout store publishes `workout_snapshot` on set confirmed | -- | Confirm a set in dev tools, observe Broadcast event in Supabase dashboard |
| M3 | Active workout store publishes `workout_snapshot` on exercise transitioned | -- | Add a new exercise, observe Broadcast event |
| M4 | Active workout store publishes `workout_snapshot` on rest timer started | -- | Start rest, observe Broadcast event with `rest_timer.state = 'running'` |
| M5 | Active workout store publishes `workout_snapshot` on rest timer expired | -- | Let timer expire, observe Broadcast event with `rest_timer.state = 'idle'` |
| M6 | Active workout store publishes `workout_snapshot` on workout started | -- | Start workout, observe initial Broadcast snapshot |
| M7 | Active workout store publishes `session_ended` on workout completion | -- | Finish workout, observe `session_ended` event with `user_id` |
| M8 | Active workout store publishes `session_ended` on workout abandoned/discarded | -- | Discard workout, observe `session_ended` event |
| M9 | Phone publishes `focus` event with `user_id` payload | -- | Trigger focus from phone, observe event |
| M10 | Phone publishes `unfocus` event with empty payload | -- | Trigger unfocus, observe event |
| M11 | `display_visible` boolean exists on UserProfile (default: `true`) | -- | New user profile has `display_visible = true` |
| M12 | When `display_visible = false`, zero Broadcast events are published | -- | Opt out, confirm set, verify no events on channel |
| M13 | Snapshot includes correct rest timer state: `running` with `started_at` and `total_seconds`, or `idle` | -- | Start timer, verify snapshot timer fields; let expire, verify idle |
| M14 | Publishing is fire-and-forget and does not degrade active workout UI performance | -- | Confirm set with network latency; UI feedback remains < 100ms |
| M15 | Snapshot is self-contained -- all rendering data included, no entity IDs that require DB lookup | -- | Inspect snapshot payload: exercise names (not IDs), display name, session type label |

### Should Have (P1)

| ID | Requirement | Verification |
|----|-------------|--------------|
| S1 | Display Broadcast channel is independent from chat Broadcast channels | Verify `display` channel exists separately from `chat:*` channels |
| S2 | Display visibility toggle is available in Settings under "Remote Display" section | Visual inspection of Settings screen |
| S3 | "Push to Display" / "Return to Board" button appears in active workout header | Visual inspection during active workout |
| S4 | Snapshot publishes on `rest_timer_adjusted` (user changes timer duration mid-countdown) | Adjust timer, observe updated snapshot |

### Will Not Have

| ID | Feature | Rationale |
|----|---------|-----------|
| W1 | `/display` route rendering | Step 28 |
| W2 | Idle mode data or Edge Function | Step 29 |
| W3 | Display-side subscription or state management | Step 28 |
| W4 | Database persistence of snapshots | Snapshots are ephemeral by design (Constraint 3 in PRD) |
| W5 | Display-side authentication | PRD explicitly excludes this |

## Testable Assertions

| ID | Assertion | How to Test |
|----|-----------|-------------|
| TA1 | `displaySnapshotSchema.parse(validPayload)` succeeds for a complete snapshot | Unit test with Vitest |
| TA2 | `displaySnapshotSchema.parse(incompletePayload)` throws for missing required fields | Unit test with Vitest |
| TA3 | `confirmSet` action publishes exactly one `workout_snapshot` event | Integration test: spy on Broadcast channel, call `confirmSet`, assert 1 event |
| TA4 | `finishWorkout` action publishes exactly one `session_ended` event | Integration test: spy on channel, call `finishWorkout`, assert event |
| TA5 | With `display_visible = false`, all publish actions produce zero events | Integration test: set flag false, run all actions, assert 0 events |
| TA6 | `focus` event payload contains `{ user_id }` | Unit test on payload construction |
| TA7 | `unfocus` event payload is `{}` | Unit test on payload construction |
| TA8 | Snapshot `sets` array contains `prescribed` and `actual` values, not IDs | Inspect serialized snapshot in test |
| TA9 | Snapshot `rest_timer` when running includes `started_at` (ISO) and `total_seconds` (number) | Unit test on timer snapshot construction |
| TA10 | Publishing does not block the Zustand state update | Timing test: measure time from `confirmSet` call to state update; must be < 5ms |

## Open Questions

None -- all display-related architectural decisions are resolved in `13-prd-remote-display.md` Resolved Decisions table.

## Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Step 6: Active Workout Logging | Complete | Store actions exist to hook into |
| Step 1.5: Design System | Complete | Settings UI for visibility toggle |
| Supabase Realtime | Available | Broadcast channel infrastructure from chat (Feature 005) |
| UserProfile domain type | Exists | Needs `display_visible` field added |
| `RealtimeManager` pattern | Exists | Pattern reference; display uses independent channel, not the chat manager |
