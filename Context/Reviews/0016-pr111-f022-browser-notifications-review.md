# PR Review: feat+browser-notif → main

**Date:** 2026-04-15
**Feature:** Context/Features/022-Browser-Notifications/
**Branch:** worktree-feat+browser-notif
**PR:** #111 -- feat(notifications): F022 browser rest timer and session reminder notifications
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer
**Status:** 🟢 Resolved

## Summary

10 findings total: 9 Fix-Now (2 Critical, 7 High/Medium), 1 Missing Task. All 14 spec assertions are covered by tests (2508/2508 passing). The notification delivery path has a cluster of unhandled async errors: an async function is called in a sync callback without `.catch()`, the `Notification` constructor is uncaught in all three send functions, and the module-level once-per-day guard is not set on failure -- creating a Supabase query spam loop. Six of the nine fix-now findings are violations of existing `error-handling.md` conventions.

## Findings

### Fix-Now

#### [FIX] P16-001: Bare `catch {}` -- no error parameter captured

- **File:** `src/lib/notification-service.ts:32`
- **Severity:** Critical
- **Detail:** Catch block logs `console.warn` but swallows the actual error value. Violates `error-handling.md` rule: "Never use bare `catch {}`. Always capture the error parameter." Root cause is permanently invisible in production logs if a non-`SyntaxError` is thrown or if Tauri `invoke` returns malformed data.
- **Fix:** Change to `catch (err)` and append `, err` to the warn call.
- **Relates to:** error-handling.md rule 1
- **Status:** ✅ Fixed
- **Resolution:** Changed `catch {` to `catch (err)` and appended `, err` to the warn call (`notification-service.ts:32`)

#### [FIX] P16-002: `sendRestTimerNotification` Promise discarded in sync `onExpired` callback

- **File:** `src/hooks/use-active-workout.ts:~375`, `src/stores/active-workout-store.ts` (tickRest)
- **Severity:** Critical
- **Detail:** `sendRestTimerNotification` is `async` (contains `await Notification.requestPermission()`). The `_onRestExpired` callback is called synchronously from `tickRest` and from the Tauri `timer_expired` listener. The returned Promise is discarded. If `requestPermission()` rejects or the `Notification` constructor throws, an unhandled promise rejection is produced -- silent in most browsers, crashes service worker context on others.
- **Fix:**
  ```typescript
  storeStartRestTimer(restSeconds, exerciseName, setNum, () => {
    sendRestTimerNotification(exerciseName, setNum, prefs).catch((err) => {
      console.error('[workout] Rest timer notification failed:', err)
    })
  })
  ```
- **Relates to:** A-001 (rest timer fires on expiry)
- **Status:** ✅ Fixed
- **Resolution:** Added `.catch((err) => console.error('[workout] Rest timer notification failed:', err))` to the `sendRestTimerNotification` call in the `onExpired` callback (`use-active-workout.ts:~403`)

#### [FIX] P16-003: `new Notification()` constructor uncaught in all three send functions

- **File:** `src/lib/notification-service.ts:~131, ~161, ~186`
- **Severity:** High
- **Detail:** `sendPrNotification`, `sendRestTimerNotification`, and `sendSessionReminderNotification` all call `new Notification(title, { body })` as a bare statement. The constructor can throw synchronously on permission revoked mid-session (TOCTOU), MDM/kiosk policy, or browser queue limits. In the async functions, the exception propagates as a rejected Promise but has no catch handler (see P16-002).
- **Fix:** Wrap each constructor call:
  ```typescript
  try {
    new Notification(title, { body })
  } catch (err) {
    console.error('[notification-service] Failed to create notification:', err)
  }
  ```
- **Relates to:** A-001, A-007
- **Status:** ✅ Fixed
- **Resolution:** Wrapped `new Notification()` in try/catch with `console.error('[notification-service] Failed to create ... notification:', err)` in all three send functions (`notification-service.ts:~134,~167,~193`)

#### [FIX] P16-004: `_lastRemindedDate` not set on notification failure -- Supabase query spam loop

- **File:** `src/hooks/use-session-reminder-browser.ts:~121-130`
- **Severity:** High
- **Detail:** `_lastRemindedDate = today` is assigned only after `sendSessionReminderNotification` succeeds. If the notification throws (per P16-003), the guard is never set. On the next 60s poll the guard passes, all four Supabase queries execute again, and the same failure repeats -- ~1,440 round-trips/day.
- **Fix:** Set the guard before firing the notification (or in the catch block at minimum).
- **Relates to:** A-008 (at most once per day)
- **Status:** ✅ Fixed
- **Resolution:** Moved `_lastRemindedDate = today` to before the `sendSessionReminderNotification` call so a notification failure does not leave the guard unset (`use-session-reminder-browser.ts:~127`)

#### [FIX] P16-005: Throwing `.parse()` at write boundary -- ZodError escapes with no module prefix

- **File:** `src/lib/notification-service.ts:51` (`setNotificationPreferences`)
- **Severity:** High
- **Detail:** The read path (`getNotificationPreferences`) correctly uses `safeParse` + explicit handling. The write path uses the throwing variant. A ZodError propagates to callers without a `[notification-service]` prefix or diagnostic context, indistinguishable from a Tauri IPC failure or `localStorage` quota error.
- **Fix:** Switch to `safeParse`:
  ```typescript
  const result = notificationPreferencesSchema.safeParse(prefs)
  if (!result.success) {
    console.error(
      '[notification-service] setNotificationPreferences: invalid prefs:',
      result.error.issues,
    )
    throw new Error('Invalid notification preferences')
  }
  ```
- **Status:** ✅ Fixed
- **Resolution:** Switched to `safeParse` with explicit `console.error('[notification-service] setNotificationPreferences: invalid prefs:', result.error.issues)` and re-throws a typed Error (`notification-service.ts:51`)

#### [FIX] P16-006: Silent return from user-action guard in `update` helper

- **File:** `src/components/profile/notification-settings.tsx:~65-68`
- **Severity:** High
- **Detail:** `const update = (patch) => { if (!prefs) return; ... }`. Violates `error-handling.md` "Guard clauses in user-action handlers must never silently return." User toggle presses silently fail when preferences haven't loaded -- no log, no toast, no visual feedback.
- **Fix:**
  ```typescript
  if (!prefs) {
    console.error('[notification-settings] update called before preferences loaded')
    return
  }
  ```
- **Relates to:** error-handling.md §User-Action Guard Clauses
- **Status:** ✅ Fixed
- **Resolution:** Added `console.error('[notification-settings] update called before preferences loaded')` before the early return (`notification-settings.tsx:~63`)

#### [FIX] P16-007: UTC vs local date mismatch in once-per-day guard

- **File:** `src/hooks/use-session-reminder-browser.ts:~32`
- **Severity:** High
- **Detail:** `_lastRemindedDate` uses `toISOString().slice(0, 10)` (UTC date) but the hour-window guard uses `new Date().getHours()` (local time). Users in UTC+ offsets receive two reminders on the same local calendar day: the UTC date rolls over while local time is still within the allowed window.
- **Fix:** Use local date:
  ```typescript
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  ```
- **Relates to:** A-008 (at most once per day)
- **Status:** ✅ Fixed
- **Resolution:** Replaced `new Date().toISOString().slice(0, 10)` with local date construction using `getFullYear()`/`getMonth()`/`getDate()` (`use-session-reminder-browser.ts:~32`)

#### [FIX] P16-008: Silent adapter coercion on `session_templates` join with no warn log

- **File:** `src/hooks/use-session-reminder-browser.ts:~123-126`
- **Severity:** High
- **Detail:** `(session.session_templates as unknown as { name: string })?.name ?? 'Workout'` -- a double-cast coercion with a silent fallback. Violates `error-handling.md` §Adapter Boundary Fallbacks: "should log at warn level when the fallback triggers for fields expected to be non-nullable." A null/mismatched join fires the notification with "Workout is scheduled for today" and nothing is logged.
- **Fix:**
  ```typescript
  const rawTemplate = session.session_templates as unknown as { name: string } | null
  if (!rawTemplate?.name) {
    console.warn(
      '[session-reminder-browser] session_templates join returned no name for session:',
      session.id,
    )
  }
  const sessionName = rawTemplate?.name ?? 'Workout'
  ```
- **Relates to:** error-handling.md §Adapter Boundary Fallbacks
- **Status:** ✅ Fixed
- **Resolution:** Extracted to `rawTemplate`, added `console.warn('[session-reminder-browser] session_templates join returned no name for session:', session.id)` when name is missing (`use-session-reminder-browser.ts:~122`)

### Missing Tasks

#### [TASK] P16-009: Test coverage for Supabase query error branches

- **File:** `src/hooks/__tests__/use-session-reminder-browser.test.ts`
- **Severity:** Medium
- **Detail:** Five distinct Supabase error branches (`activationErr`, `blockErr`, `weekErr`, `sessErr`, `logErr`) in `use-session-reminder-browser.ts` have no test coverage. The outer try/catch provides a safety net against crashes, but per `error-handling.md` the per-query `[module-name]` error logs exist precisely for observability -- a refactor could silently remove them. One test on the `activationErr` path validates the pattern; the `makeQueryBuilder` helper already exists in the test file.
- **Relates to:** A-007, A-008
- **Status:** ✅ Task created
- **Resolution:** Added as S008-T in Steps.md Phase 4

### Fix-Now (continued)

#### [FIX] P16-010: `BrowserPermissionStatus` listener leak on unmount race

- **File:** `src/components/profile/notification-settings.tsx:~277-292`
- **Severity:** Medium
- **Detail:** If the component unmounts between `permissions.query()` resolving and the `.then()` callback executing, `status` is never assigned in the outer scope, so `s.onchange` is attached to a handler that calls `setPermission` on an unmounted component. The listener is never cleaned up in this race path. React 18 suppresses the setState-after-unmount warning, but the `PermissionStatus` listener persists as a GC issue for the session lifetime.
- **Fix:** Use an `unmounted` flag guard inside the `.then()` callback before assigning `s.onchange`.
- **Status:** ✅ Fixed
- **Resolution:** Added `unmounted` boolean flag; `.then()` checks `if (unmounted) return` before assigning `s.onchange`; cleanup sets `unmounted = true` (`notification-settings.tsx:~270`)

## Test Coverage Notes

All 14 spec assertions (A-001 through A-014) are covered. Notable gaps:

- The five Supabase error branches (`activationErr`, `blockErr`, `weekErr`, `sessErr`, `logErr`) in `use-session-reminder-browser.ts` have no test coverage.
- `sendRestTimerNotification` lacks a "Notification API unavailable" guard test (present for `sendSessionReminderNotification`).

## Resolution Checklist

- [x] All [FIX] findings resolved (P16-001 through P16-008, P16-010)
- [x] All [TASK] findings added to Steps.md (P16-009)
- [x] All [ADR] findings have ADRs created or dismissed (none)
- [x] All [RULE] findings applied or dismissed (none)
- [ ] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-15
**Session:** review-resolve -- F022 browser notification error handling fixes

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 9      | 9        |
| [TASK]    | 1      | 1        |
| [ADR]     | 0      | 0        |
| [RULE]    | 0      | 0        |
| **Total** | **10** | **10**   |
