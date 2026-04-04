# 009 - Display Route + Board and Focused Views

## Overview

Build the `/display` route: a full-viewport, no-chrome web page that subscribes to the `display` Supabase Broadcast channel and renders active workout sessions in real time. The display is designed for a TV or large monitor in a gym, readable from 3+ meters on a 1080p screen.

Three display modes: **Board** (grid of active session cards), **Focused** (full-screen single user), and **Idle** (clock + schedule, deferred to Step 29). This step implements Board and Focused modes, plus the display shell, state management, timer interpolation, and reconnection behavior.

**Implementation Plan Reference:** Step 28
**PRD Reference:** `docs/13-prd-remote-display.md`
**Dependencies:** Step 27 (Display Broadcast Infrastructure) -- merged as PR #59

## Problem Statement

Step 27 built the publisher side: phones broadcast `DisplaySnapshot` events on every workout state change. There is currently no consumer of these events. The `/display` route is the subscriber that renders this data as a passive, read-only gym display.

The display must:
- Work without authentication (no login required on the TV)
- Never query the database (pure Broadcast subscription)
- Render smoothly with multiple concurrent sessions
- Produce a smooth rest timer countdown from sparse snapshot updates
- Recover gracefully from network disconnections
- Be readable from across a gym (3+ meters on 1080p)

## User Stories

1. **As a gym owner**, I want to mount a screen showing who is actively training and what they are doing, so the gym feels alive and engaged.
2. **As an athlete**, I want to push my workout to a focused full-screen view on the gym display, so my coach or training partners can follow my session in detail.
3. **As a coach**, I want to see all active sessions at a glance on the board view, so I can monitor multiple athletes simultaneously.
4. **As a display operator**, I want the display to recover automatically after network drops, so I can set it and forget it.

## Requirements

### Must Have (P0)

- [ ] **M1**: `/display` route renders full-viewport with no app chrome (no nav, no sidebar, no header)
- [ ] **M2**: Display subscribes to `display` Broadcast channel on mount
- [ ] **M3**: Board view shows cards for all active visible sessions
- [ ] **M4**: Board grid layout adapts from 1 to 4 sessions per page
- [ ] **M5**: Focused view renders full set table and large timer for a single user
- [ ] **M6**: Focus/unfocus events from phone toggle display mode
- [ ] **M7**: Timer interpolation produces smooth countdown (within 1 second accuracy)
- [ ] **M8**: Display auto-reconnects and rebuilds state after network drop
- [ ] **M9**: Connection status footer shows current state (connected, reconnecting, session count)
- [ ] **M10**: All typography readable at 3+ meters on 1080p display
- [ ] **M11**: Iron & Ember design tokens applied throughout (zero border-radius, tonal surfaces, dual fonts)
- [ ] **M12**: No database queries from the display route
- [ ] **M13**: Display route is unauthenticated (no login required)

### Should Have (P1)

- [ ] **S1**: Board auto-cycles through pages when 5+ sessions active (10-second interval)
- [ ] **S2**: "Push to Display" button in active workout UI exists (already built in Step 27)
- [ ] **S3**: Idle placeholder when no sessions are active (simple clock, deferred full idle mode to Step 29)
- [ ] **S4**: Smooth transitions between display modes (300-400ms fades)

### Won't Have (this step)

- **W1**: Full idle mode with scheduled sessions and Edge Function (Step 29)
- **W2**: Authentication or user-specific display configuration
- **W3**: Database queries or server-side state persistence
- **W4**: Portrait orientation support (landscape only per PRD)

## Testable Assertions

| ID | Assertion | Validation Method |
|----|-----------|-------------------|
| TA-1 | `/display` route renders without authentication | Navigate to `/display` without sign-in; page loads |
| TA-2 | No nav bar, sidebar, or header visible on `/display` | Visual inspection; DOM query for nav elements returns empty |
| TA-3 | Incoming `workout_snapshot` event creates a session card on board | Publish mock event; card appears within 500ms |
| TA-4 | Incoming `session_ended` event removes the session card | Publish mock event after snapshot; card removed |
| TA-5 | Incoming `focus` event switches to focused view for that user | Publish focus event; display switches to single-user view |
| TA-6 | Incoming `unfocus` event returns to board view | Publish unfocus event; display returns to grid |
| TA-7 | Rest timer counts down smoothly from snapshot's `started_at` + `total_seconds` | Publish snapshot with running timer; countdown updates every second |
| TA-8 | Grid layout shows 1 card centered, 2 in columns, 3-4 in 2x2 | Publish N snapshots; verify grid adapts |
| TA-9 | 5+ sessions trigger page cycling every 10 seconds | Publish 5+ snapshots; pages auto-advance |
| TA-10 | WebSocket reconnection rebuilds session map via `display_hello` | Disconnect network; reconnect; sessions reappear |
| TA-11 | Connection status footer reflects connected/reconnecting state | Observe footer during connection changes |
| TA-12 | Typography meets distance-readable sizing (Space Grotesk 2rem+ for headlines) | Visual inspection on 1080p monitor from 3m |

## Open Questions

1. **Landscape enforcement**: Should the display route use CSS to force landscape, or just recommend it in docs? PRD says "landscape only" but CSS `orientation` media queries can handle portrait gracefully.
   - **Resolution**: Use CSS to display a "rotate device" message if portrait detected. No forced orientation lock.

2. **Display route path**: Should it be `/display` (public, outside `_authenticated` layout) or something else?
   - **Resolution**: `/display` as a top-level public route, similar to `/s/$token`. No auth required per PRD FR-1.

3. **Supabase client for subscription**: The display doesn't authenticate, but needs a Supabase client to subscribe to Broadcast channels. How does it get credentials?
   - **Resolution**: Use the same config store pattern as the rest of the app. The display reads `VITE_SUPABASE_URL` and publishable key from env/config. Broadcast channels don't require auth tokens -- the publishable key is sufficient for subscription.

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Step 27: Display Broadcast Infrastructure | Complete (PR #59) | DisplaySnapshot type, publisher, channel setup |
| Step 1.5: Iron & Ember Design System | Complete | All design tokens, typography utilities |
| Step 6: Active Workout Logging | Complete | Workout store, set/exercise types |
| Supabase Realtime (Broadcast) | Available | Used by publisher; display subscribes to same channel |
| `docs/13-prd-remote-display.md` | Reference | Full display spec with layouts and design callouts |
