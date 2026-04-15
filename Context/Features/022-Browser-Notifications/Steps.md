# Implementation Steps: Browser Notifications (Phase 1)

**Spec:** Context/Features/022-Browser-Notifications/Spec.md
**Tech:** Context/Features/022-Browser-Notifications/Tech.md

## Progress

- **Status:** Complete
- **Current task:** --
- **Last milestone:** Feature complete -- all assertions verified, full drift check passed

## Team Orchestration

### Team Members

- **builder**
  - Role: Implements all React/TypeScript changes across store, service, hooks, and UI
  - Agent Type: frontend-specialist
  - Resume: true

- **validator**
  - Role: Read-only quality validation against Spec.md assertions and coding conventions
  - Agent Type: quality-engineer
  - Resume: false

---

## Tasks

### Phase 1: Store extension and notification service (parallel)

- [ ] S001: Extend `active-workout-store.ts` rest timer browser path with an `onExpired?` callback
  - Add module-level `let _onRestExpired: (() => void) | null = null`
  - Extend `startRestTimer` interface and implementation: `startRestTimer(seconds, exerciseName?, setNumber?, onExpired?)`
  - In the browser path of `startRestTimer`, store: `_onRestExpired = onExpired ?? null`
  - In `tickRest()` when `newRemaining <= 0` (browser path only): call `_onRestExpired?.()` then set `_onRestExpired = null` before clearing the interval
  - In `skipRest()`: set `_onRestExpired = null` (do NOT call it -- skip must not fire a notification)
  - In `cleanup()`: set `_onRestExpired = null`
  - **Assigned:** builder
  - **Depends:** none
  - **Parallel:** true

- [ ] S001-T: Test `_onRestExpired` callback behavior in `active-workout-store`
  - (callback fires exactly once when timer counts to zero in browser mode, callback is NOT called on `skipRest()`, callback is cleared before re-use when a new timer starts, `cleanup()` clears callback without calling it, Tauri path is unaffected)
  - **Assigned:** builder
  - **Depends:** S001
  - **Parallel:** false

- [ ] S002: Add `sendRestTimerNotification` and `sendSessionReminderNotification` to `notification-service.ts`
  - `sendRestTimerNotification(exerciseName: string | undefined, setNumber: number | undefined, prefs: NotificationPreferences): void` -- gates on `shouldSendNotification('restTimer', prefs)`, fires `new Notification('REST COMPLETE', { body })` using message copy from `docs/11-notification-design.md`; if `Notification.permission === 'default'`, calls `Notification.requestPermission()` before firing
  - `sendSessionReminderNotification(sessionName: string, prefs: NotificationPreferences): void` -- gates on `shouldSendNotification('sessionReminders', prefs)`, fires `new Notification` with session name; same contextual permission-request pattern
  - Both functions are no-ops when `'Notification' in window` is false or `Notification.permission === 'denied'`
  - Follow the `sendPrNotification` pattern exactly (async guard, permission check, `new Notification`)
  - **Assigned:** builder
  - **Depends:** none
  - **Parallel:** true

- [ ] S002-T: Unit test `sendRestTimerNotification` and `sendSessionReminderNotification`
  - (fires notification when permission granted and toggles on, no-op when master toggle off, no-op when type toggle off, no-op when permission denied, calls `requestPermission` when permission is default, rest timer notification is NOT blocked by quiet hours, session reminder notification IS blocked by quiet hours)
  - Mock `window.Notification` globally in test setup
  - **Assigned:** builder
  - **Depends:** S002
  - **Parallel:** false

🏁 MILESTONE: Phase 1 complete -- notification functions and store callback mechanism ready

- Verify S001-T and S002-T pass: `bun run test`
- Verify no TypeScript errors: `bun run build`

**Contracts:**

- `src/stores/active-workout-store.ts` -- Extended `startRestTimer` signature with `onExpired?` param
- `src/lib/notification-service.ts` -- New `sendRestTimerNotification` and `sendSessionReminderNotification` exports

---

### Phase 2: Session reminder hook and rest timer wiring (parallel)

- [ ] S003: Create `src/hooks/use-session-reminder-browser.ts`
  - Module-level `let _lastRemindedDate: string | null = null` (ISO `YYYY-MM-DD`) for "reminded today" guard
  - Hook returns void; is a no-op when `isTauri()` returns true
  - `useEffect` sets up a `setInterval` at 60 000 ms; cleans up on unmount
  - Each poll tick calls an async `checkAndMaybeNotify()` function that:
    1. Reads prefs via `getNotificationPreferences()`
    2. Guards: `prefs.enabled`, `prefs.sessionReminders.enabled`, not in quiet hours, current hour between 06 and 20 inclusive, `_lastRemindedDate !== today`
    3. Queries Supabase directly (not TanStack Query) for: active program activation (`program_activations`), today's scheduled session (join `blocks → block_weeks → scheduled_sessions → session_templates` filtered by JS `day_of_week`), workout logged today (`workout_logs.started_at` in today's range)
    4. If session exists and workout not logged: calls `sendSessionReminderNotification(sessionName, prefs)` and sets `_lastRemindedDate = today`
    5. If workout already logged: sets `_lastRemindedDate = today` and returns (suppress further checks)
  - Error handling: wrap Supabase calls in `try/catch`; log with `[session-reminder-browser]` prefix and return silently on error (non-fatal, matches Rust behavior)
  - Resolve the open question (Spec.md): check `workout_logs.started_at` column type in migrations to determine UTC vs local comparison -- use the same approach as `supabase-adapter.ts` existing queries
  - **Assigned:** builder
  - **Depends:** S002
  - **Parallel:** true

- [ ] S003-T: Unit test `use-session-reminder-browser` polling logic
  - (notification fires when all conditions pass, skips when master toggle off, skips when quiet hours active, skips when outside 06-20 time window, skips when workout already logged today, fires at most once per day, `_lastRemindedDate` persists across hook remounts, no-op in Tauri mode)
  - Inject mock Supabase client and mock `sendSessionReminderNotification`; use `vi.useFakeTimers()` to advance intervals
  - **Assigned:** builder
  - **Depends:** S003
  - **Parallel:** false

- [ ] S004: Wire `onExpired` callback in `src/hooks/use-active-workout.ts`
  - The `confirmSet` callback at line 395 calls `storeStartRestTimer(restSeconds)` -- extend to pass `onExpired`
  - Read prefs at call time via `getNotificationPreferences()` (async); hold in a ref or capture inside the callback closure
  - Pass `onExpired: () => sendRestTimerNotification(exerciseName, setNumber, prefs)` to `startRestTimer`
  - `exerciseName` and `setNumber` must be captured from the set/activity context available at the call site -- confirm these are in scope; if not, thread them through from the caller
  - Do not call `sendRestTimerNotification` directly in `confirmSet` -- only register the callback; the store fires it at expiry
  - **Assigned:** builder
  - **Depends:** S001, S002
  - **Parallel:** true

- [ ] S004-T: Integration test for rest timer notification wiring in `use-active-workout`
  - (onExpired callback is passed to store when restSeconds > 0, no callback passed when restSeconds <= 0, callback calls sendRestTimerNotification with correct exerciseName and setNumber)
  - Mock `active-workout-store.startRestTimer` and assert call shape; mock `notification-service`
  - **Assigned:** builder
  - **Depends:** S004
  - **Parallel:** false

🏁 MILESTONE: Phase 2 complete -- rest timer and session reminder delivery paths wired

- Verify A-001, A-003, A-004, A-007, A-008, A-009, A-010 via `bun run test`
- Manual smoke test: start a short rest timer in browser, let it expire -- confirm system notification appears

**Contracts:**

- `src/hooks/use-session-reminder-browser.ts` -- Hook ready to mount in authenticated layout

---

### Phase 3: Layout mount and settings UI (parallel)

- [ ] S005: Mount `useSessionReminderBrowser` in `src/routes/_authenticated.tsx`
  - Import and call `useSessionReminderBrowser()` inside the authenticated layout component (one call, top-level)
  - No render output; hook is a side-effect only
  - Confirm the layout unmounts on sign-out (so the `setInterval` is cleaned up automatically)
  - **Assigned:** builder
  - **Depends:** S003
  - **Parallel:** true

- [ ] S006: Update `src/components/profile/notification-settings.tsx`
  - **Remove** the "Session reminders require the native app" message (line 182-184) for browser users
  - **Add** in its place an informational note (browser mode only): "Notifications are delivered while this tab is open" -- styled with `text-[11px] leading-relaxed text-warm-ash/60`, consistent with existing copy
  - **Add** `BrowserPermissionStatus` sub-component (browser mode only, shown below master toggle section):
    - On mount, calls `navigator.permissions.query({ name: 'notifications' as PermissionName })` to get live `PermissionStatus`; subscribes to `status.onchange`; falls back to reading `Notification.permission` if Permissions API unavailable
    - Renders a read-only status label in three states:
      - `granted` -- no extra UI needed (silent)
      - `default` -- small informational note: "Enable notifications in your browser when prompted"
      - `denied` -- warning note: "Notifications are blocked. Enable them in your browser settings." (no re-request button -- browsers do not allow this after denial)
    - Conditionally render only when `!isTauri()` and `'Notification' in window`
  - Verify the existing `handleMasterToggle` permission-request flow is unchanged (D-4)
  - **Assigned:** builder
  - **Depends:** S002
  - **Parallel:** true

- [ ] S006-T: Component test for updated `NotificationSettings` in browser mode
  - (BrowserPermissionStatus renders correct copy for granted/default/denied states, "requires native app" string is absent, "tab must remain open" note is present when sessionReminders enabled, no re-request button when denied, component does not render BrowserPermissionStatus in Tauri mode)
  - Mock `isTauri()` to return false; mock `navigator.permissions.query` for each permission state
  - **Assigned:** builder
  - **Depends:** S006
  - **Parallel:** false

🏁 MILESTONE: Phase 3 complete -- feature fully wired and UI updated

- Verify A-005, A-006, A-011, A-012, A-013, A-014 via `bun run test`
- Verify `bun run lint` clean
- Verify `bun run build` (TypeScript) passes

---

### Phase 4: Validation

- [ ] S007: Quality engineer validation pass
  - Read all modified and created files
  - Verify all 14 Testable Assertions from Spec.md are covered by implementation and tests
  - Check error-handling conventions: no bare catch, all catches use `[module-name]` prefix
  - Check state-management conventions: module-level setter validation in `use-session-reminder-browser.ts`
  - Confirm "requires native app" string is absent from `notification-settings.tsx`
  - Confirm `BrowserPermissionStatus` is not rendered in Tauri mode
  - Confirm `onExpired` is NOT called by `skipRest()` or `cleanup()`
  - Flag any TODO/FIXME stubs, missing error states, or silent failures
  - **Assigned:** validator
  - **Depends:** S001-T, S002-T, S003-T, S004-T, S005, S006-T
  - **Parallel:** false

🏁 MILESTONE: Feature complete -- all assertions verified, full drift check passed

---

## Acceptance Criteria

- [ ] All 14 testable assertions from Spec.md verified (A-001 through A-014)
- [ ] `bun run test` passes with no failures
- [ ] `bun run lint` clean
- [ ] `bun run build` TypeScript check passes
- [ ] "Session reminders require the native app" string absent from codebase
- [ ] `onExpired` callback fires on natural timer expiry and is silent on skip
- [ ] No TODO/FIXME stubs in production code

## Validation Commands

```bash
bun run test          # Vitest -- all unit and component tests
bun run lint          # ESLint
bun run build         # TypeScript check + Vite build
```
