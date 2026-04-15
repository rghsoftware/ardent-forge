# Feature 022: Browser Notifications (Phase 1)

## Overview

Extend the existing Web Notifications API coverage in the browser to include rest timer alerts and session reminders. Currently, browser users only receive PR celebration notifications; all other notification types are silently skipped or blocked behind a "requires native app" gate. Phase 1 enables rest timer and session reminder notifications while the browser tab is open, bringing the web experience closer to parity with the Tauri mobile app.

Phase 2 (separate backlog item) will add Web Push API support for background and closed-tab delivery.

## Problem Statement

Browser users who train without the mobile app miss two of the three notification types that make the app useful during a workout: rest timer alerts and session reminders. The rest timer in particular is a primary workout tool -- missing it means athletes must watch the screen instead of resting or preparing for their next set. The current settings UI actively discourages browser users from enabling session reminders by labeling them as native-only, even though basic in-tab delivery is feasible.

## User Stories

- As a browser user in an active workout, I want a system notification when my rest timer expires so that I can focus elsewhere during rest periods without watching the screen.
- As a browser user with a training program, I want to receive a session reminder notification before my scheduled workout so that I am not caught unprepared.
- As a user enabling notifications for the first time, I want to be prompted for browser notification permission at the moment it becomes relevant so that I understand why permission is needed.
- As a user whose notification permission has been denied, I want clear guidance in settings on how to re-enable it so that I am not left with a silently non-functional toggle.

## Requirements

### Must Have

- When a rest timer expires in browser mode, fire a Web Notification with the exercise name and set context if notification permission is granted and the rest timer toggle is enabled.
- When a browser user has session reminders enabled and the tab is open, deliver a Web Notification at the configured advance time (`advanceMinutes`) before their scheduled session, provided the session has not been logged and quiet hours are not active.
- Session reminder polling in browser mode must track a "reminded today" state so the notification fires at most once per day per session.
- When a notification-triggering action would fire but browser permission is in the `default` state, prompt the user for permission contextually rather than silently dropping the notification.
- The notification settings UI must show the current browser permission state (`granted`, `denied`, `default`) for users in browser mode.
- When permission is `denied`, the settings UI must display a clear message and direct the user to their browser settings -- it must not show a re-request button (browsers do not allow re-requesting after denial).
- The "Session reminders require the native app" message must be replaced with an informational note that session reminders work but require the tab to remain open.

### Should Have

- The settings UI permission state display should update reactively if the user grants or denies permission in the browser settings dialog without reloading the page.
- Rest timer notifications in browser mode should include the same body copy as the Tauri version: exercise name and set context (e.g., "Barbell Squat -- Set 3 of 5").

### Won't Have (this iteration)

- Web Push API / service worker for background or closed-tab delivery -- Phase 2.
- Event reminder notifications in browser mode -- Phase 2.
- Notification action buttons (e.g., "Open Workout") in browser notifications -- not supported consistently across browsers without a service worker.
- Sound or vibration control for browser notifications -- these are browser-controlled.
- Any changes to Rust/Tauri code.

## Testable Assertions

| ID    | Assertion                                                                                                                          | Verification                                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A-001 | When a rest timer expires in browser mode with permission granted and rest timer toggle on, a Web Notification fires immediately.  | Start a rest timer in browser, let it expire, observe system notification.                                                      |
| A-002 | Rest timer notification body contains the exercise name and set number matching the active set.                                    | Inspect notification body text against current workout context.                                                                 |
| A-003 | When rest timer toggle is off, no notification fires on timer expiry even if permission is granted.                                | Toggle off rest timer alerts, expire a timer, confirm no notification.                                                          |
| A-004 | When master notifications toggle is off, no rest timer notification fires.                                                         | Disable master toggle, expire a timer, confirm no notification.                                                                 |
| A-005 | When browser permission is `default` and a rest timer expires, the user is prompted for permission.                                | Start from permission=default, expire timer, observe permission dialog.                                                         |
| A-006 | When browser permission is `denied`, no notification fires and no permission prompt is shown.                                      | Set permission to denied, expire timer, confirm no notification and no dialog.                                                  |
| A-007 | When session reminders are enabled in browser mode with the tab open, a Web Notification fires within 1 minute of the target time. | Enable session reminders, set advanceMinutes to a near-future window, observe notification arrives within 60 seconds of target. |
| A-008 | Session reminder notification fires at most once per day per scheduled session.                                                    | Trigger a session reminder, wait for the next poll cycle, confirm no duplicate notification fires.                              |
| A-009 | Session reminder does not fire if the scheduled session has already been logged.                                                   | Log a workout, confirm no reminder notification fires for that session.                                                         |
| A-010 | Session reminder does not fire if quiet hours are active.                                                                          | Set quiet hours to cover the current time, confirm no session reminder notification.                                            |
| A-011 | The settings UI shows the current browser permission state (granted / denied / default) in browser mode.                           | Inspect settings page in browser; permission status label matches actual `Notification.permission` value.                       |
| A-012 | When permission is `denied`, settings UI shows a message directing the user to browser settings, with no re-request button.        | Set permission to denied, open settings, verify UI copy and absence of re-request button.                                       |
| A-013 | The "Session reminders require the native app" message is not present in browser mode.                                             | Open settings in browser mode, confirm old message string is absent.                                                            |
| A-014 | Session reminders section in browser mode shows an informational note that the tab must remain open.                               | Open settings in browser mode with session reminders enabled, read the note text.                                               |

## Open Questions

- [ ] Does the rest timer in browser mode currently track expiry in a way the notification layer can hook into, or does a new JS timer need to be introduced alongside the display interpolation hook? The existing `use-timer-interpolation.ts` is display-only and does not emit an expiry event. This determines whether we extend that hook or add a separate timer hook.
- [ ] What Supabase query does the browser-mode session reminder polling need to make to determine if today's session is scheduled and not yet logged? The Rust implementation queries `program_activations`, `scheduled_sessions`, and `workout_logs`. The browser equivalent needs the same data via the Supabase JS client.
- [ ] Should the browser permission status in settings also be shown for Tauri users (where the Tauri plugin manages permission separately), or is it browser-only? Current assumption: browser-only display.

## Revision History

| Date       | Change       | ADR |
| ---------- | ------------ | --- |
| 2026-04-15 | Initial spec | --  |
