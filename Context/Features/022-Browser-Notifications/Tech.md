# Tech Plan: Browser Notifications (Phase 1)

**Spec:** Context/Features/022-Browser-Notifications/Spec.md
**Stacks involved:** React 19 / TypeScript

## Architecture Overview

The existing notification system is dual-mode: Tauri code paths use `tauri-plugin-notification` and Rust background workers; browser code paths use the Web Notifications API directly. Phase 1 extends the browser code paths for two notification types that currently either fire nothing (rest timer) or are gated behind a "requires native app" message (session reminders).

Three layers are touched:

1. **`notification-service.ts`** -- gains two new functions (`sendRestTimerNotification`, `sendSessionReminderNotification`) following the existing `sendPrNotification` pattern.
2. **`active-workout-store.ts`** -- gains a minimal extension to its browser rest timer path so callers can register an expiry callback.
3. **New files** -- `use-session-reminder-browser.ts` (polling hook) and settings UI changes to `notification-settings.tsx`.

No Rust, Tauri, Supabase schema, or service worker changes.

```
active-workout-store (browser tickRest → _onRestExpired callback)
       │
       ▼
notification-service.sendRestTimerNotification()
       │
       ▼
Web Notifications API (Notification.permission === 'granted')

authenticated layout
       │ mounts
       ▼
use-session-reminder-browser (setInterval 60s)
       │ polls Supabase directly
       ▼
notification-service.sendSessionReminderNotification()
       │
       ▼
Web Notifications API
```

## Key Decisions

### D-1: Rest timer expiry detection

**Problem:** The browser path of `startRestTimer` in `active-workout-store.ts` runs a `setInterval` → `tickRest()`. When `remaining` reaches 0, `tickRest()` clears the interval and sets `restTimer: null`. A notification must fire at that moment but the store should not import notification-service (violates separation of concerns). Skip and expiry both set `restTimer: null`, so a store subscriber cannot distinguish them.

**Options considered:**

- **Option A: Store subscriber with prev/curr diff** -- Subscribe to store outside the store, fire notification when `restTimer` transitions from non-null to null. Cannot distinguish skip from expiry without additional store state. Rejected.
- **Option B: Add `restTimerExpiredAt` field** -- Store records expiry timestamp distinct from skip. Works but adds permanent state for a transient event; every consumer must null-check. Rejected.
- **Option C: `onExpired` callback on `startRestTimer` (chosen)** -- Extend `startRestTimer` signature with an optional `onExpired?: () => void`. Store it in a module-level `_onRestExpired` variable (same pattern as existing `_restInterval`). Call it in `tickRest()` when expiry fires; clear it on `skipRest()` and `cleanup()`. Callers wire the notification at the call site. Distinguishes expiry from skip precisely because `skipRest()` clears the callback without calling it.

**Chosen:** Option C

**Rationale:** Minimal store surface change; no new store fields; skip/expiry distinction is preserved; the notification wiring is the caller's concern, not the store's. Consistent with the module-level variable pattern already used for `_restInterval`, `_unlistenTick`, and `_unlistenExpired`.

**Implementation sketch:**

```typescript
// active-workout-store.ts additions
let _onRestExpired: (() => void) | null = null

// startRestTimer extended signature:
startRestTimer(seconds, exerciseName?, setNumber?, onExpired?)
// browser path stores: _onRestExpired = onExpired ?? null

// tickRest() when newRemaining <= 0 (browser path only):
_onRestExpired?.()
_onRestExpired = null

// skipRest() and cleanup(): clear without calling
_onRestExpired = null
```

---

### D-2: Session reminder polling architecture

**Problem:** The Rust session reminder is a 60-second background loop. An equivalent browser implementation must run in JS without blocking the main thread, must start post-auth, and must clean up on sign-out.

**Options considered:**

- **Option A: `useEffect` + `setInterval` in authenticated layout** -- Simple; lifecycle tied to React mount/unmount. Automatically starts when layout mounts (post-auth) and stops when it unmounts (sign-out). Idiomatic React.
- **Option B: Dedicated hook `use-session-reminder-browser.ts`** -- Same mechanics as A but encapsulated. Easier to test, easier to disable in Tauri mode, clear ownership. No meaningful difference from A at runtime.
- **Option C: Module-level singleton** -- Starts once, not tied to React lifecycle. Harder to test; requires explicit start/stop calls at auth boundaries; not idiomatic.

**Chosen:** Option B (dedicated hook)

**Rationale:** Encapsulation makes the polling logic testable in isolation. The hook mounts in the authenticated layout (which already handles auth boundaries) and returns void -- no render output. Tauri mode guard (`if (isTauri()) return`) makes it a no-op in the native app without any conditional hook violation.

**"Reminded today" state:** Module-level variable `let _lastRemindedDate: string | null` (ISO date `YYYY-MM-DD`). Survives hook remounts (e.g., layout key changes) but resets on full page reload -- acceptable since the Rust implementation resets on app restart too.

**Supabase queries:** Direct Supabase client calls (not TanStack Query) since this is polling logic, not cached UI state. Three queries mirror the Rust logic:

1. Active program activation -- `program_activations` table
2. Today's scheduled session -- join `blocks → block_weeks → scheduled_sessions → session_templates` filtered by `day_of_week` matching JS `Date.getDay()` format
3. Workout logged today -- `workout_logs` filtered by `started_at` in today's UTC day range

`advanceMinutes` is not consumed by the Rust implementation (marked TODO in `session_reminder.rs:104`). The JS implementation matches Rust behavior: fires once per day within a 06:00-20:59 window. `advanceMinutes` will be implemented in a future pass when a session-scheduled-time field is added.

---

### D-3: Browser permission status reactivity

**Problem:** `Notification.permission` is a string property that does not emit events. The settings UI needs to reflect permission state without polling.

**Options considered:**

- **Option A: Read once on component mount** -- Simple. Permission changes require a page reload to reflect. Acceptable since browsers do not allow granting from in-page UI after denial; the user must go to browser settings then reload.
- **Option B: `navigator.permissions.query({ name: 'notifications' })` + `onchange`** -- Returns a `PermissionStatus` object with an `onchange` handler. Fires when permission changes without a reload. Supported in Chrome, Firefox, Edge; Safari 16+ (partial -- may not fire `onchange` in all cases).
- **Option C: `visibilitychange` polling** -- Poll on tab focus. More compatible than Option B but reads are synchronous and cheap.

**Chosen:** Option B with Option A fallback

**Rationale:** `PermissionStatus.onchange` covers the primary browsers and is the correct API for this. A fallback to mount-time read handles Safari gaps. The settings component will use a `useEffect` that calls `navigator.permissions.query`, subscribes to `onchange`, and falls back gracefully if the API is unavailable.

```typescript
// Pattern:
useEffect(() => {
  if (!('permissions' in navigator)) return
  navigator.permissions
    .query({ name: 'notifications' as PermissionName })
    .then((status) => {
      setPermission(status.state as NotificationPermission)
      status.onchange = () => setPermission(status.state as NotificationPermission)
    })
    .catch((err) => console.warn('[notification-settings] Permission query failed:', err))
}, [])
```

---

### D-4: Permission request triggers

**Problem:** Decide when to call `Notification.requestPermission()` for newly covered notification types.

**Options considered:**

- **Option A: Master toggle only (existing behavior)** -- Permission is requested when the master notifications toggle is turned on. Per-type toggles do not trigger re-requests.
- **Option B: Per-type toggle requests** -- Request permission individually when each type's toggle is enabled.

**Chosen:** Option A (no change to existing behavior)

**Rationale:** The master toggle is already the user's declaration of intent to receive notifications. Requesting on per-type toggles is surprising UX -- the user has already granted intent. The one addition: the rest timer and session reminder notification functions will call `Notification.requestPermission()` contextually if `Notification.permission === 'default'` at the moment of the first would-be notification, matching the existing `sendPrNotification` pattern. This covers the case where permission was never explicitly requested.

## Stack-Specific Details

### React / TypeScript

**Files to modify:**

| File                                               | Change                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/stores/active-workout-store.ts`               | Add `onExpired?` param to `startRestTimer`; add `_onRestExpired` module-level var; call in `tickRest()`, clear in `skipRest()` + `cleanup()` |
| `src/lib/notification-service.ts`                  | Add `sendRestTimerNotification()` and `sendSessionReminderNotification()` functions                                                          |
| `src/components/profile/notification-settings.tsx` | Add `BrowserPermissionStatus` sub-component; update session reminder copy; reactive permission state                                         |

**Files to create:**

| File                                        | Purpose                                              |
| ------------------------------------------- | ---------------------------------------------------- |
| `src/hooks/use-session-reminder-browser.ts` | 60-second polling hook for browser session reminders |

**Files to mount the new hook:**

The authenticated layout (or whichever top-level component wraps authenticated routes) gains a `<BrowserSessionReminder />` component or direct hook call. Identify the exact mount point during implementation (TanStack Router's authenticated layout file).

**Patterns to follow:**

- `.claude/rules/react-typescript.md` -- functional components, hooks, `useEffect` cleanup
- `.claude/rules/error-handling.md` -- bracketed module prefix, no bare catch, guard clauses
- `.claude/rules/state-management.md` -- module-scope setter validation
- Existing `sendPrNotification` pattern in `notification-service.ts` for new send functions

**Dependencies:** No new packages. Uses `@tauri-apps/api/core` (already installed) for `isTauri()` guard; native `Notification` and `navigator.permissions` browser APIs.

## Integration Points

**Store → Notification service:** The `onExpired` callback passed to `startRestTimer` closes over the exercise/set context and calls `sendRestTimerNotification`. The call site (the component that calls `startRestTimer`) is responsible for reading current prefs and providing them to the callback.

**Hook → Supabase:** `use-session-reminder-browser.ts` imports the project's Supabase client directly. No new adapter methods are needed -- raw `from().select()` calls mirror the Rust queries.

**Hook → Notification service:** The hook calls `sendSessionReminderNotification(sessionName, prefs)` after all conditions pass.

**Settings UI → Permission API:** `notification-settings.tsx` subscribes to `PermissionStatus.onchange` and reflects state in a read-only display sub-component. No writes to the Notifications API permission -- browsers control that.

## Risks & Unknowns

- **Risk:** JS `setInterval` for the rest timer backup is already in `tickRest()` and is 1-second granular. If the tab is heavily throttled (background throttling in modern browsers), the timer may drift and the notification may fire late.
  - **Mitigation:** Acceptable for Phase 1; document as a known limitation. Phase 2 (service worker) resolves this.

- **Risk:** Safari's partial `PermissionStatus.onchange` support means the permission status badge may not update reactively for Safari users.
  - **Mitigation:** The fallback reads `Notification.permission` on mount. Safari users see correct state after page load; it may not update live. Acceptable.

- **Risk:** Session reminder Supabase queries may fail if the user's auth session has expired mid-tab.
  - **Mitigation:** Wrap in `try/catch` with `[session-reminder-browser]` prefix log. Silently skip that poll cycle on error -- same behavior as the Rust `log::warn` non-fatal path.

- **Unknown:** Exact mount point for the session reminder hook in the authenticated layout. TanStack Router's file-based route structure places the authenticated layout in a specific route file.
  - **Resolution:** Implementer reads the route tree during implementation; locate the `_authenticated` layout route.

- **Unknown:** Whether the Supabase `workout_logs` table uses UTC timestamps or local time for the `started_at` column. The Rust code converts local date to a Unix epoch range using the local timezone. The JS implementation should match.
  - **Resolution:** Check the Supabase migration or existing workout log adapter code during implementation.

## Testing Strategy

- **`active-workout-store`**: Unit test the `onExpired` callback: verify it fires on natural expiry and does NOT fire on `skipRest()`. Extend existing store tests in `__tests__/`.
- **`notification-service`**: Unit test `sendRestTimerNotification` and `sendSessionReminderNotification` with a mocked `Notification` global. Verify preference/quiet-hours gating.
- **`use-session-reminder-browser`**: Unit test the poll logic in isolation by injecting a mock Supabase client and mock `sendSessionReminderNotification`. Verify: fires once per day, skips on quiet hours, skips if already logged, skips outside time window.
- **`notification-settings`**: Component test for the `BrowserPermissionStatus` display in each permission state (`granted`, `denied`, `default`). Verify the "requires native app" string is absent in browser mode.

Detailed test tasks are in Steps.md.
