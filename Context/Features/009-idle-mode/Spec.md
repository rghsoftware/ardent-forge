# Feature 009: Idle Mode + Edge Function

## Overview

Idle mode is the ambient display state for the `/display` route when no workouts are active. It renders a large clock, today's scheduled sessions, and a countdown to the next upcoming session -- all driven by a server-side Edge Function that publishes data every 60 seconds over the existing Supabase Broadcast channel. This is the final step of Phase 7 (Remote Display), completing the gym TV experience.

## Problem Statement

The `/display` route (Step 28) shows active workout sessions, but when no one is training, the screen is blank. A gym TV should always show useful information: the current time, who is training next, and when. Because the display route has no authentication and no database access, a server-side process must push schedule data to it via the same Broadcast channel used for workout snapshots.

## User Stories

- As a gym owner, I want the TV to show a clock and today's training schedule when no one is working out, so the display is always useful
- As a gym member, I want to see when the next session starts on the gym TV, so I know how long until someone needs the platform
- As a gym owner, I want the display to transition smoothly between idle and active states, so it looks professional on a wall-mounted TV
- As a gym member, I want the idle display to update automatically without anyone touching the TV, so it stays current throughout the day

## Requirements

### Must Have

- M-1: Large clock display updating every second, rendered in local timezone
- M-2: Automatic transition from idle to board view when the first `workout_snapshot` event arrives
- M-3: Automatic transition from board/focused back to idle when the last `session_ended` event fires
- M-4: Supabase Edge Function that queries today's remaining scheduled sessions across all users
- M-5: Edge Function publishes `idle_state` event to the `display` Broadcast channel every 60 seconds
- M-6: Clock text readable from 5+ meters on a 1080p display (minimum 8rem Space Grotesk)
- M-7: Display remains stable for hours of continuous operation without memory leaks or visual drift
- M-8: Transitions between idle, board, and focused modes are smooth (300-400ms)

### Should Have

- S-1: Today's scheduled sessions listed below the clock when idle state data is available
- S-2: Countdown badge showing time until the next upcoming session ("Next up in X:XX") with session name
- S-3: Server time from idle_state used for clock sync correction (drift prevention over long runtimes)
- S-4: Edge Function uses service_role key and never exposes credentials to the client

### Won't Have (this iteration)

- W-1: Authentication on the display route (it remains a public, no-auth page)
- W-2: User interaction or touch controls on the idle screen
- W-3: Custom idle backgrounds, themes, or branding configuration
- W-4: Historical schedule data (only today's remaining sessions)
- W-5: Per-user opt-out from appearing in the idle schedule (display_visible controls broadcast, not schedule visibility)

## Testable Assertions

| ID    | Assertion                                                                                          | Verification                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A-001 | Clock updates every second and displays the correct local time                                     | Open /display with no active workouts; confirm clock ticks match system time within 1 second      |
| A-002 | Clock renders at minimum 8rem in Space Grotesk on a 1080p viewport                                | Inspect computed font-size on a 1920x1080 browser window                                         |
| A-003 | Date line renders below the clock in Inter body-large, text-secondary                              | Visual inspection of rendered display                                                            |
| A-004 | When idle_state event arrives, scheduled sessions render as a list below the clock                  | Publish a mock idle_state event; confirm session rows appear                                     |
| A-005 | Countdown badge shows "Next up in M:SS" with session name when next_session is present             | Publish idle_state with next_session; confirm badge renders with ember text on surface-steel      |
| A-006 | Countdown badge is absent when next_session is null                                                | Publish idle_state with next_session: null; confirm no badge renders                             |
| A-007 | Display transitions from idle to board within 300ms when first workout_snapshot arrives             | Start a workout on a phone while /display is in idle mode; measure transition timing              |
| A-008 | Display transitions from board to idle within 300ms when last session_ended fires                   | End the only active workout; measure transition timing                                           |
| A-009 | Edge Function publishes idle_state event to the display channel every 60 seconds                    | Check Supabase function logs for invocation frequency; subscribe to channel and time events       |
| A-010 | Edge Function payload includes server_time, scheduled_sessions array, and next_session              | Inspect broadcast event payload structure against schema                                         |
| A-011 | Edge Function filters to today's remaining (not-yet-completed) sessions only                       | Seed DB with past, today-completed, today-upcoming, and tomorrow sessions; verify only upcoming   |
| A-012 | Edge Function uses service_role key (not publishable key)                                          | Inspect function env and Supabase config; confirm no client-visible credentials                   |
| A-013 | Display runs for 4+ hours without memory growth exceeding 50MB above baseline                      | Profile /display in Chrome DevTools over extended period; monitor JS heap                         |
| A-014 | No stale setInterval or requestAnimationFrame callbacks accumulate across mode transitions          | Monitor active timer count in DevTools across 10+ idle-board-idle cycles                         |
| A-015 | Idle mode layout uses surface-anvil background, surface-iron cards, surface-pit footer              | Visual inspection against design tokens                                                          |
| A-016 | All text meets minimum 1.25rem for TV readability                                                  | Inspect smallest computed font-size in the idle view                                             |
| A-017 | Board-to-focused and focused-to-board transitions animate at 400ms                                 | Trigger focus/unfocus events; measure CSS transition durations                                   |

## Open Questions

- [x] Should the Edge Function run via pg_cron (Postgres-native) or Supabase's scheduled function invocation (external cron)? -- Resolved: Use Supabase scheduled function invocation (pg_cron is not available on all Supabase plans; Edge Function cron is universally available)
- [x] How should the display handle the case where the Edge Function is unreachable or not deployed? -- Resolved: Silently hide the schedule section; no error message shown
- [x] Should the clock use 12-hour or 24-hour format? -- Resolved: Default 24-hour; override via URL param `/display?clock=12h`
- [x] What is the maximum number of scheduled sessions to display? -- Resolved: Show up to 3 sessions; truncate beyond that

## Dependencies

| Feature | Dependency Type | Status |
| ------- | --------------- | ------ |
| 008 - Display Broadcast Infrastructure (Step 27) | Build dependency -- publisher and types | Complete |
| Step 28 - Display Route + Board/Focused Views | Build dependency -- idle mode extends this route | Not started |
| Step 11 - Program Structure | Data dependency -- scheduled_sessions table | Complete |
| Step 3 - Supabase Project | Infrastructure dependency -- Edge Function deployment | Complete |

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-04 | Initial spec | --  |
