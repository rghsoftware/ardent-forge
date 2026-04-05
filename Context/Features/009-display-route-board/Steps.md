# 009 - Display Route + Board and Focused Views: Implementation Steps

## Team Composition

| Role | Agent | Stacks |
|------|-------|--------|
| Frontend Specialist | `frontend` | React, TypeScript, Tailwind, Zustand, TanStack Router |
| Quality Engineer | `qa` | Vitest, visual inspection, integration validation |

Single-domain feature (all frontend). No backend or database changes. Use `/build` (parallel sub-agents), not `/team-build`.

---

## Implementation Waves

### Wave 1: Foundation (no UI)

Data layer and subscription infrastructure. Must be complete before any UI work.

---

#### S001: Display Zustand Store

**Agent:** `frontend`
**Files:** `src/stores/display-store.ts`
**Dependencies:** None
**Parallel:** Yes (with S002)

Create the display state store following the pattern in `src/stores/active-workout-store.ts`.

**Store shape:**
```typescript
interface DisplayState {
  sessions: Map<string, DisplaySnapshot>
  focusedUserId: string | null
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
  currentPage: number
}
```

**Actions:**
- `upsertSession(userId, snapshot)` -- insert or replace in sessions map
- `removeSession(userId)` -- delete from map; if `userId === focusedUserId`, clear focus
- `setFocusedUser(userId | null)` -- set focused user
- `setConnectionStatus(status)` -- update connection state
- `setCurrentPage(page)` -- set current page index
- `clearAllSessions()` -- reset sessions map and focus

**Derived selectors (exported functions):**
- `getDisplayMode(state)` -- returns `'idle'` if sessions empty, `'focused'` if focusedUserId set and user in map, `'board'` otherwise
- `getPageSessions(state)` -- returns array of snapshots for current page (4 per page)
- `getTotalPages(state)` -- `Math.ceil(sessions.size / 4)`

**Staleness handling:** `upsertSession` stores a `lastSeenAt` timestamp alongside each snapshot. Export a `pruneStale(maxAgeMs)` action that removes sessions not updated within the threshold.

**Acceptance:**
- [ ] Store creates with correct initial state
- [ ] upsertSession adds and updates sessions
- [ ] removeSession clears focus if focused user removed
- [ ] getDisplayMode returns correct mode for all state combinations
- [ ] getPageSessions paginates correctly (4 per page)
- [ ] pruneStale removes old sessions

---

#### S002: Display Subscriber

**Agent:** `frontend`
**Files:** `src/lib/display-subscriber.ts`
**Dependencies:** None
**Parallel:** Yes (with S001)

Create the Broadcast channel subscriber following the pattern in `src/lib/display-publisher.ts` and `src/lib/realtime-manager.ts`.

**Module-scoped state:**
- `_client: SupabaseClient | null`
- `_channel: RealtimeChannel | null`

**Exported functions:**
- `initDisplaySubscriber(client)` -- store client reference
- `subscribeToDisplay(handlers: DisplayEventHandlers)` -- create channel, register `.on('broadcast')` listeners for each event type, subscribe
- `publishHello()` -- send `display_hello` event on channel (for reconnection)
- `getSubscriberStatus()` -- returns current connection status
- `destroyDisplaySubscriber()` -- unsubscribe, remove channel, reset state

**Event handling:**
- `workout_snapshot` -- validate with `displaySnapshotSchema.safeParse()`, call `handlers.onSnapshot`
- `session_ended` -- validate payload has `user_id` string, call `handlers.onSessionEnded`
- `focus` -- validate payload has `user_id` string, call `handlers.onFocus`
- `unfocus` -- call `handlers.onUnfocus`

**Channel status callback:** Map Supabase channel statuses to connection status:
- `SUBSCRIBED` -> call `handlers.onStatusChange('connected')`
- `TIMED_OUT` / `CHANNEL_ERROR` / `CLOSED` -> call `handlers.onStatusChange('reconnecting')`, clear `_channel` for retry
- On retry success -> publish `display_hello`, call `handlers.onStatusChange('connected')`

**Acceptance:**
- [ ] Subscribes to `display` channel with `{ broadcast: { ack: false, self: false } }`
- [ ] Validates all incoming payloads with Zod; drops invalid payloads with console.warn
- [ ] Calls correct handler for each event type
- [ ] publishHello sends broadcast event on channel
- [ ] destroyDisplaySubscriber cleans up channel
- [ ] Channel status changes dispatched to onStatusChange handler

---

#### S003: Timer Interpolation Hook

**Agent:** `frontend`
**Files:** `src/hooks/use-timer-interpolation.ts`
**Dependencies:** None
**Parallel:** Yes (with S001, S002)

Create a hook that produces a smooth countdown from a `RestTimerState` snapshot.

**Signature:** `useTimerInterpolation(restTimer: RestTimerState): number` -- returns `remainingSeconds` (integer, >= 0)

**Logic:**
- If `restTimer.state === 'idle'`, return 0
- If `restTimer.state === 'running'`:
  - Parse `started_at` as Date
  - On each rAF frame: `remaining = total_seconds - ((Date.now() - startedAtMs) / 1000)`
  - Update a ref, trigger React re-render only when `Math.ceil(remaining)` changes from previous render (use `useState` for the integer second value)
  - Clamp to 0 (never negative)
  - Cancel rAF loop when remaining reaches 0 or timer state changes to idle

**Acceptance:**
- [ ] Returns 0 when rest timer is idle
- [ ] Counts down from total_seconds when running
- [ ] Updates once per second (not per frame) in React state
- [ ] Cleans up rAF on unmount
- [ ] Handles timer state changes mid-countdown

---

#### S004: Phone-Side Hello Responder

**Agent:** `frontend`
**Files:** `src/lib/display-publisher.ts`, `src/hooks/use-display-broadcast.ts`
**Dependencies:** None
**Parallel:** Yes (with S001-S003)

Add `display_hello` listener to the existing publisher so phones re-publish their snapshot when a display reconnects.

**Changes to `display-publisher.ts`:**
- Add module-scoped `_helloResponder: (() => void) | null = null`
- Export `setHelloResponder(fn: (() => void) | null)` -- stores the callback
- In `ensureChannel()`, after channel creation, add: `_channel.on('broadcast', { event: 'display_hello' }, () => { _helloResponder?.() })`

**Changes to `use-display-broadcast.ts`:**
- After setting snapshot context, call `setHelloResponder(() => { /* trigger _publishCurrentState from store */ })`
- The responder function should call the store's internal publish. Since `_publishCurrentState` is private, expose a `republishCurrentState()` action on the active workout store that calls `_publishCurrentState()`.
- On cleanup, call `setHelloResponder(null)`

**Changes to `active-workout-store.ts`:**
- Export `republishCurrentState()` action that calls `_publishCurrentState()` if workout is active

**Acceptance:**
- [ ] Publisher listens for `display_hello` events on the channel
- [ ] When hello received and workout active, current snapshot is re-published
- [ ] When no workout active, hello is received silently (no crash)
- [ ] Responder cleared on hook cleanup

---

### Wave 1 Validation

#### S001-T: Wave 1 Unit Tests

**Agent:** `qa`
**Files:** `src/stores/__tests__/display-store.test.ts`, `src/lib/__tests__/display-subscriber.test.ts`, `src/hooks/__tests__/use-timer-interpolation.test.ts`
**Dependencies:** S001, S002, S003, S004
**Parallel:** No (must wait for all Wave 1 tasks)

Write unit tests for all Wave 1 deliverables:

**display-store tests:**
- Initial state is empty sessions, null focus, disconnected
- upsertSession adds new session, updates existing
- removeSession deletes and clears focus if focused user removed
- getDisplayMode returns idle/board/focused correctly
- getPageSessions returns correct slice for page
- pruneStale removes sessions older than threshold

**display-subscriber tests:**
- Mock Supabase client and channel
- Verify channel created with correct config
- Verify event handlers called with validated payloads
- Verify invalid payloads are dropped
- Verify publishHello sends correct event
- Verify destroy cleans up

**use-timer-interpolation tests:**
- Returns 0 for idle timer
- Counts down for running timer
- Clamps to 0

**display-publisher hello responder tests:**
- setHelloResponder stores callback
- display_hello event triggers callback
- Null responder doesn't crash

**Acceptance:**
- [ ] All tests pass
- [ ] Coverage for all store actions and derived selectors
- [ ] Coverage for subscriber event routing and validation
- [ ] Coverage for timer interpolation edge cases

---

### Wave 2: Route Shell and Board View

Core display UI. Depends on Wave 1 infrastructure.

---

#### S005: Display Route Shell

**Agent:** `frontend`
**Files:** `src/routes/display.tsx`, `src/routes/__root.tsx`, `src/components/display/connection-footer.tsx`, `src/components/display/idle-placeholder.tsx`
**Dependencies:** S001, S002

**Route file (`src/routes/display.tsx`):**
- Create TanStack Router file route at `/display`
- Full viewport: `h-dvh w-full overflow-hidden bg-surface-anvil`
- No app chrome (no nav, no sidebar, no header)
- Portrait detection: `@media (orientation: portrait)` shows "ROTATE TO LANDSCAPE" message with `screen_rotation` icon

**Lifecycle (in route component or a `DisplayShell` wrapper):**
1. On mount: call `resolveConfig()` to get Supabase URL + key
2. If no config: show message directing user to configure the app first
3. If config: create a dedicated Supabase client (`createClient(url, key)`) -- NOT the global singleton
4. Call `initDisplaySubscriber(client)`
5. Call `subscribeToDisplay(handlers)` with handlers that dispatch to `display-store`
6. Start a 30-minute staleness prune interval
7. On unmount: `destroyDisplaySubscriber()`, clear interval

**Root route change (`__root.tsx`):**
- Add `/display` to the `beforeLoad` bypass: `if (location.pathname === '/setup' || location.pathname.startsWith('/s/') || location.pathname === '/display') return`

**ConnectionFooter component:**
- Fixed bottom bar, `bg-surface-pit`, `h-12`, full width
- Left side: connection dot (green for connected, amber pulsing for reconnecting) + status text
- Right side: session count ("N active sessions") or focused user name ("Focused: Robert")
- Font: Inter `text-sm`, `text-warm-ash`

**IdlePlaceholder component (simple for Step 28):**
- Large clock: Space Grotesk, `text-[8rem]`, `text-bone-white`, centered
- Date below: Inter, `text-xl`, `text-warm-ash`
- Clock updates every second via `setInterval`
- Text: "NO ACTIVE SESSIONS" below date in `text-oxidized-edge`
- Full idle mode with schedule data deferred to Step 29

**Mode rendering logic:**
```tsx
{displayMode === 'idle' && <IdlePlaceholder />}
{displayMode === 'board' && <BoardView />}
{displayMode === 'focused' && <FocusedView />}
```

With CSS transitions: each section has `transition-opacity duration-300` and conditional `opacity-0`/`opacity-100`.

**Acceptance:**
- [ ] `/display` loads without authentication
- [ ] No nav bar, sidebar, or header visible
- [ ] Portrait orientation shows rotate message
- [ ] Supabase client created from config (not global singleton)
- [ ] Subscriber initialized and subscribed on mount
- [ ] Subscriber destroyed on unmount
- [ ] ConnectionFooter renders with correct status
- [ ] IdlePlaceholder shows clock when no sessions active
- [ ] Mode transitions have 300ms fade

---

#### S006: Board View and Session Cards

**Agent:** `frontend`
**Files:** `src/components/display/board-view.tsx`, `src/components/display/session-card.tsx`, `src/components/display/rest-timer-display.tsx`, `src/components/display/page-indicator.tsx`
**Dependencies:** S001, S003, S005

**BoardView component:**
- Reads `getPageSessions(state)` and `getTotalPages(state)` from display store
- CSS Grid layout:
  - 1 session: `grid-cols-1`, card max-width ~60%
  - 2 sessions: `grid-cols-2`
  - 3-4 sessions: `grid-cols-2 grid-rows-2`
- Grid fills viewport height minus footer (48px): `h-[calc(100dvh-3rem)]`
- When `totalPages > 1`: render PageIndicator, start 10-second `setInterval` to advance `currentPage`
- Page transition: fade out old page (200ms), fade in new page (300ms)

**SessionCard component:**
- Props: `snapshot: DisplaySnapshot`
- Background: `bg-surface-iron`, zero border-radius
- Layout (vertical stack):
  1. **Header row:** Display name (Space Grotesk, `text-[1.5rem]`, ALL-CAPS, `text-bone-white`) | Session type (Inter, `text-base`, ALL-CAPS, `text-warm-ash`) | Elapsed time (Space Grotesk, `text-[1.25rem]`, `text-warm-ash`)
  2. **Current exercise:** Inter, `text-[1.25rem]`, `text-bone-white` | "Exercise N of M" in `text-warm-ash`
  3. **Set progress:** Compact list of sets -- set number + weight x reps + checkmark (`check_circle` in `arc`) or pending dot
  4. **Rest timer:** If running, show `RestTimerDisplay` in compact mode

**RestTimerDisplay component:**
- Props: `restTimer: RestTimerState`, `variant: 'compact' | 'large'`
- Uses `useTimerInterpolation(restTimer)` hook
- Compact (board card): `bg-surface-steel`, Space Grotesk `text-[1.75rem]`, `text-ember`, inline
- Large (focused view): `bg-surface-steel`, Space Grotesk `text-readout` (3.5rem), `text-ember`, centered, `animate-ember-pulse` when < 10s
- Format: `M:SS` via existing `formatCountdown` utility
- When timer is idle (remaining === 0), component returns null

**PageIndicator component:**
- Row of dots at bottom of board (above footer)
- Active page: `bg-ember` dot (8px)
- Inactive: `bg-surface-steel` dot (8px)
- Only rendered when totalPages > 1

**Acceptance:**
- [ ] Board shows cards for all active sessions
- [ ] Grid adapts: 1 card centered, 2 in columns, 3-4 in 2x2
- [ ] Session card shows name, type, exercise, sets, timer
- [ ] Set checkmarks render in `arc` color
- [ ] Rest timer counts down smoothly
- [ ] Page cycling works at 10-second intervals for 5+ sessions
- [ ] Page indicator dots show current page
- [ ] All typography meets minimum sizing from Tech.md

---

### Wave 3: Focused View

Depends on board view components (reuses RestTimerDisplay).

---

#### S007: Focused View

**Agent:** `frontend`
**Files:** `src/components/display/focused-view.tsx`, `src/components/display/set-table.tsx`
**Dependencies:** S003, S005, S006 (for RestTimerDisplay)

**FocusedView component:**
- Reads focused user's snapshot from store: `sessions.get(focusedUserId)`
- If snapshot not found (user ended session), display store should have already cleared focus. Render nothing (mode transitions to board/idle).
- Full viewport minus footer, vertically centered content

**Layout (top to bottom):**
1. **Header bar:** Display name + session type (Space Grotesk, `text-[2rem]`, ALL-CAPS) | Elapsed time (Space Grotesk, `text-[1.5rem]`, `text-warm-ash`), right-aligned
2. **Exercise heading:** Current exercise name (Space Grotesk, `text-[2.5rem]`, centered) | "Exercise N of M" (Inter, `text-base`, `text-warm-ash`, centered)
3. **Set table:** Full set-by-set breakdown
4. **Rest timer:** Large centered timer when running

**SetTable component:**
- Props: `sets: DisplaySet[]`
- Table layout with columns: SET | PRESCRIBED | ACTUAL | STATUS
- Column headers: Inter, `text-base`, ALL-CAPS, `text-warm-ash`, `tracking-wider`
- Row styling:
  - Alternating backgrounds: `bg-surface-charcoal` / `bg-surface-anvil`
  - Row height: generous (min `3rem`) for distance readability
  - Font: Inter, `text-[1.25rem]`
  - Current set (first incomplete): `border-l-2 border-ember` left accent
  - Completed sets: `check_circle` icon in `arc` in STATUS column
  - Pending sets: empty STATUS cell
- PRESCRIBED column: `{weight} x {reps}` or "--" if no prescribed data
- ACTUAL column: `{weight} x {reps}` or "--" if not yet completed
- Weight formatting: include unit (`275 lb`, `120 kg`)

**Acceptance:**
- [ ] Focused view renders for focused user's snapshot
- [ ] Header shows name, session type, elapsed time
- [ ] Exercise heading shows current exercise at 2.5rem
- [ ] Set table renders all sets with correct columns
- [ ] Current set has ember left border accent
- [ ] Completed sets show arc checkmark
- [ ] Alternating row backgrounds
- [ ] Large rest timer displays when running with ember-pulse < 10s
- [ ] All text readable at 3+ meters

---

### Wave 3 Validation

#### S007-T: Integration Validation

**Agent:** `qa`
**Files:** Tests across all components
**Dependencies:** S005, S006, S007

**Validation checklist:**

1. **End-to-end flow test (manual or scripted):**
   - Open `/display` in a browser tab
   - From another tab, start a workout -> verify card appears on display
   - Confirm a set -> verify card updates
   - Start rest timer -> verify countdown on display
   - Push to Display -> verify focused mode activates
   - Unfocus -> verify return to board
   - End workout -> verify card removed, display returns to idle

2. **Multi-session test:**
   - Publish 2 mock snapshots with different user_ids
   - Verify 2-column grid layout
   - Publish 5 mock snapshots -> verify page cycling

3. **Reconnection test:**
   - Subscribe display, publish snapshot, verify card
   - Simulate disconnect (destroy channel)
   - Verify "Reconnecting..." in footer
   - Simulate reconnect -> verify display_hello sent
   - Publish snapshot in response -> verify card reappears

4. **Timer accuracy test:**
   - Publish snapshot with running timer (started_at = 2 min ago, total_seconds = 180)
   - Verify display shows ~60s remaining
   - Wait 10 real seconds, verify countdown advanced by ~10

5. **Visual review:**
   - All Iron & Ember tokens applied (zero radius, tonal surfaces, dual fonts)
   - Typography sizing meets distance-readable minimums
   - Connection footer renders correctly in all states
   - Portrait orientation shows rotate message
   - No scrollbars visible in any mode

**Acceptance:**
- [ ] All flow scenarios pass
- [ ] Timer interpolation accurate to within 1 second
- [ ] Grid layouts correct for 1, 2, 3, 4, and 5+ sessions
- [ ] Mode transitions smooth (300ms)
- [ ] Reconnection rebuilds state
- [ ] Visual review passes Iron & Ember compliance

---

### Wave 4: Review Follow-up Tasks

Tasks added from PR #60 review findings.

---

#### S008: Reconnection retry unit tests

**Agent:** `qa`
**Files:** `src/lib/__tests__/display-subscriber.test.ts`
**Dependencies:** S002
**Review:** P6-009

Write unit tests for the exponential backoff retry mechanism in `display-subscriber.ts`:
- Verify delay computation (2s, 4s, 8s, ... capped at 30s)
- Verify retry attempt resets on successful reconnect
- Verify retry cancellation on `destroyDisplaySubscriber()`
- Verify `publishHello()` called on reconnect (not first connect)

**Acceptance:**
- [ ] Retry delay doubles per attempt up to 30s cap
- [ ] Retry counter resets on SUBSCRIBED
- [ ] Destroy cancels pending retry timer
- [ ] publishHello fires on reconnect only

---

#### S009: `use-elapsed-time` unit tests

**Agent:** `qa`
**Files:** `src/hooks/__tests__/use-elapsed-time.test.ts`
**Dependencies:** None
**Review:** P6-010

Write unit tests for `useElapsedTime` hook using `renderHook`:
- Returns 0 at start
- Increases over time
- Resets when `startedAt` changes
- Returns 0 for invalid timestamps (NaN guard)
- Handles future timestamps gracefully

**Acceptance:**
- [ ] All test cases pass
- [ ] NaN guard tested

---

#### S010: Add `.min(1)` to string fields in display snapshot schema

**Agent:** `frontend`
**Files:** `src/domain/types/display-snapshot.ts`
**Dependencies:** None
**Review:** P6-011

Add `.min(1)` validation to `user_id`, `display_name`, `session_name`, and `current_exercise` in `displaySnapshotSchema`. Update any affected tests that use empty strings.

**Acceptance:**
- [ ] Empty strings rejected by schema
- [ ] Existing tests updated for non-empty strings
- [ ] No regression in subscriber payload validation

---

#### S011: Invalid payload tests for `session_ended` and `focus` events

**Agent:** `qa`
**Files:** `src/lib/__tests__/display-subscriber.test.ts`
**Dependencies:** S002
**Review:** P6-012

Add parameterized tests for invalid payloads on `session_ended` and `focus` events:
- Missing `user_id`
- Non-string `user_id`
- Empty payload

Verify each is dropped with a console.warn and handler is NOT called.

**Acceptance:**
- [ ] Invalid `session_ended` payloads dropped
- [ ] Invalid `focus` payloads dropped
- [ ] Parity with existing `workout_snapshot` invalid payload test

---

## Milestone Summary

| Wave | Tasks | Parallel | Description |
|------|-------|----------|-------------|
| 1 | S001, S002, S003, S004 | All parallel | Store, subscriber, timer hook, hello responder |
| 1-T | S001-T | After Wave 1 | Unit tests for all foundation code |
| 2 | S005, S006 | S005 first, then S006 | Route shell + board view |
| 3 | S007 | After S006 | Focused view |
| 3-T | S007-T | After Wave 3 | Integration validation |
| 4 | S008, S009, S010, S011 | S008-S009-S011 parallel, S010 independent | Review follow-up: tests + schema hardening |

**Total tasks:** 12 (5 build + 5 test + 2 UI build)
**Estimated new files:** 13
**Estimated changed files:** 4 (root route, display-publisher, use-display-broadcast, display-snapshot)

---

## Execution Command

```
/build .claude/tasks/009-display-route-board.md
```

Use `/build` (not `/team-build`) -- single frontend domain, no cross-agent coordination needed. Wave 1 tasks are fully parallel. Wave 2-3 are sequential due to component dependencies.
