# 009 - Display Route + Board and Focused Views: Technical Architecture

## Architecture Overview

The display route is a **subscriber-only, read-only, unauthenticated** page that consumes `DisplaySnapshot` events from the Supabase Broadcast channel `display`. It maintains an in-memory map of active sessions and renders them as either a card grid (board) or a full-screen detail view (focused).

```
Phone A ─┐                          ┌─ Board View (grid of cards)
Phone B ──┤→ Broadcast "display" →──┤→ Focused View (single user)
Phone C ─┘   channel                └─ Idle Placeholder (clock)
```

**Zero database queries.** The display never reads from Postgres or SQLite. All data arrives via ephemeral Broadcast events. If the display reloads, it publishes a `display_hello` event and phones respond by re-publishing their current snapshot.

---

## Key Technical Decisions

### TD-1: Route placement -- top-level public route

**Decision:** Create `src/routes/display.tsx` as a top-level route outside `_authenticated` layout.

**Options considered:**
1. Under `_authenticated` layout -- requires login on TV, violates PRD FR-1.2
2. Top-level public route (like `/s/$token`) -- no auth, no nav chrome
3. Separate SPA entry point -- over-engineered for one route

**Choice:** Option 2. Add `/display` to the `__root.tsx` `beforeLoad` bypass list alongside `/setup` and `/s/`.

**Trade-off:** The display still needs a Supabase client for Broadcast subscription. It will use `resolveConfig()` to get the publishable key from env vars or config store, then create a minimal client. No auth session needed -- Broadcast channels only require the publishable key.

### TD-2: State management -- dedicated Zustand store

**Decision:** Create a `display-store.ts` Zustand store for display state.

**Options considered:**
1. React component state (`useState`/`useReducer`) -- sufficient but harder to test and debug
2. Zustand store -- consistent with codebase patterns, inspectable, testable outside React
3. Reuse active-workout-store -- wrong abstraction; display is a consumer, not a producer

**Choice:** Option 2. The store holds:
- `sessions: Map<string, DisplaySnapshot>` -- active sessions keyed by `user_id`
- `focusedUserId: string | null` -- which user is focused (null = board mode)
- `connectionStatus: 'connected' | 'reconnecting' | 'disconnected'`
- `currentPage: number` -- for board pagination when 5+ sessions

**Derived state** (computed, not stored):
- `displayMode`: `'idle' | 'board' | 'focused'` -- derived from `sessions.size` and `focusedUserId`
- `totalPages`: `Math.ceil(sessions.size / 4)`
- `pageSessionIds`: array of user_ids for the current page

### TD-3: Broadcast subscription -- module-scoped manager

**Decision:** Create `src/lib/display-subscriber.ts` following the same pattern as `display-publisher.ts` and `realtime-manager.ts`.

**Pattern:**
```typescript
// Module-scoped state
let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null

export function initDisplaySubscriber(client: SupabaseClient): void
export function subscribeToDisplay(handlers: DisplayEventHandlers): void
export function publishHello(): void
export function destroyDisplaySubscriber(): void
```

**Event handlers interface:**
```typescript
interface DisplayEventHandlers {
  onSnapshot: (snapshot: DisplaySnapshot) => void
  onSessionEnded: (payload: { user_id: string }) => void
  onFocus: (payload: { user_id: string }) => void
  onUnfocus: () => void
  onHello: () => void  // Phone-side only; display publishes hello
  onStatusChange: (status: 'connected' | 'reconnecting' | 'disconnected') => void
}
```

**Validation:** All incoming payloads validated with Zod schemas from `src/domain/types/display-snapshot.ts` before dispatching to handlers. Invalid payloads logged and dropped.

### TD-4: Timer interpolation -- requestAnimationFrame

**Decision:** Use `requestAnimationFrame` for smooth timer countdown on the display.

**Options considered:**
1. `setInterval(1000)` -- simple but can drift and doesn't sync with frame rendering
2. `requestAnimationFrame` -- syncs with display refresh, calculate remaining from wall clock
3. React state update every second -- causes full re-render, wasteful

**Choice:** Option 2. When a snapshot arrives with `rest_timer.state === 'running'`:
1. Store `started_at` (ISO timestamp) and `total_seconds` from the snapshot
2. On each animation frame, compute `remaining = total_seconds - ((Date.now() - Date.parse(started_at)) / 1000)`
3. Render `Math.ceil(remaining)` as the countdown display
4. Stop when `remaining <= 0` or a new snapshot arrives with `rest_timer.state === 'idle'`

**Accuracy:** Within 1 second (NFR-D4). No Broadcast traffic during countdown.

**Implementation:** A `useTimerInterpolation(restTimerState)` hook that returns `remainingSeconds: number` and manages the rAF loop internally. The hook is used by both board cards (compact timer) and focused view (large timer).

### TD-5: Reconnection -- display_hello pattern

**Decision:** On WebSocket reconnection, the display publishes a `display_hello` event. Active phones respond by re-publishing their current snapshot.

**Flow:**
1. Supabase client detects disconnection -> store sets `connectionStatus: 'reconnecting'`
2. Client auto-reconnects (built-in Supabase behavior)
3. On reconnection success -> subscriber publishes `{ type: 'broadcast', event: 'display_hello', payload: {} }`
4. Phones listening on the same channel receive `display_hello` and call `_publishCurrentState()`
5. Display receives snapshots and rebuilds its session map
6. Store sets `connectionStatus: 'connected'`

**Phone-side change required:** Add a `display_hello` listener to the publisher that triggers a re-publish. This is a small addition to `display-publisher.ts`.

### TD-6: Grid layout -- CSS Grid with dynamic columns

**Decision:** Use CSS Grid with column count derived from session count.

| Sessions | Grid Template | Layout |
|----------|---------------|--------|
| 0 | N/A | Idle placeholder |
| 1 | `1fr` | Single card, centered, expanded |
| 2 | `1fr 1fr` | 2 columns, 1 row |
| 3 | `1fr 1fr` / `auto auto` | 2 columns, 2 rows (one cell empty) |
| 4 | `1fr 1fr` / `1fr 1fr` | 2x2 grid |
| 5+ | `1fr 1fr` / `1fr 1fr` | 2x2 grid, auto-cycling pages |

Grid is applied via Tailwind classes dynamically. Cards fill available viewport height minus the status footer (48px).

### TD-7: Page cycling -- setInterval with cleanup

**Decision:** When `sessions.size > 4`, advance `currentPage` every 10 seconds via `setInterval`.

The interval is managed in a `useEffect` tied to `totalPages > 1`. When `totalPages` drops to 1 or below, the interval is cleared and `currentPage` resets to 0. Page transition uses a CSS fade (opacity 0 -> 1, 300ms).

### TD-8: Mode transitions -- CSS transitions

**Decision:** Use CSS transitions for mode changes (300-400ms fades).

| Transition | Animation |
|-----------|-----------|
| Idle -> Board | Fade clock out (200ms), fade cards in (300ms) |
| Board -> Idle | Fade cards out (200ms), fade clock in (300ms) |
| Board -> Focused | Cards fade out (200ms), focused view fades in (300ms) |
| Focused -> Board | Focused fades out (200ms), cards fade in (300ms) |

Implemented with a `displayMode` state change that triggers CSS `opacity` and `visibility` transitions. No animation library needed.

---

## Component Architecture

```
DisplayRoute (src/routes/display.tsx)
├── DisplayShell (full viewport, manages subscription lifecycle)
│   ├── IdlePlaceholder (Step 28: simple clock; Step 29: full idle mode)
│   ├── BoardView
│   │   ├── SessionCard (per user)
│   │   │   ├── CardHeader (name, session type, elapsed)
│   │   │   ├── SetProgress (compact set list with checkmarks)
│   │   │   └── CompactRestTimer (small countdown)
│   │   └── PageIndicator (dots for 5+ sessions)
│   └── FocusedView
│       ├── FocusedHeader (name, session, elapsed time)
│       ├── ExerciseHeading (current exercise, progress)
│       ├── SetTable (PRESCRIBED / ACTUAL / STATUS columns)
│       └── LargeRestTimer (big countdown with ember-pulse)
└── ConnectionFooter (status dot, session count, focused user name)
```

**File organization:**
```
src/
├── routes/
│   └── display.tsx                    # Route definition + DisplayShell
├── components/
│   └── display/
│       ├── board-view.tsx             # Grid of session cards
│       ├── session-card.tsx           # Individual session card
│       ├── focused-view.tsx           # Full-screen single user
│       ├── set-table.tsx              # Focused view set table
│       ├── idle-placeholder.tsx       # Simple clock (Step 28)
│       ├── connection-footer.tsx      # Status bar
│       ├── rest-timer-display.tsx     # Shared timer component (compact + large)
│       └── page-indicator.tsx         # Pagination dots
├── stores/
│   └── display-store.ts              # Zustand store for display state
├── hooks/
│   └── use-timer-interpolation.ts    # rAF-based timer countdown
└── lib/
    └── display-subscriber.ts         # Broadcast channel subscription manager
```

---

## Data Flow

### Snapshot Arrival

```
Broadcast event received
  → Zod validation (displaySnapshotSchema.safeParse)
  → display-store.upsertSession(userId, snapshot)
  → React re-render via Zustand selector
  → Board card or Focused view updates
```

### Focus Command

```
Broadcast "focus" event { user_id }
  → display-store.setFocusedUser(userId)
  → displayMode derived as 'focused'
  → CSS transition: board fades out, focused fades in
  → FocusedView renders with snapshot from sessions map
```

### Session End

```
Broadcast "session_ended" event { user_id }
  → display-store.removeSession(userId)
  → If removed user was focused → clear focus → mode reverts to board or idle
  → Card removed from grid (or page count adjusts)
```

### Reconnection

```
WebSocket disconnects
  → Channel status callback fires ('CLOSED' | 'TIMED_OUT')
  → display-store.setConnectionStatus('reconnecting')
  → Supabase client auto-reconnects
  → Channel re-subscribes successfully
  → display-subscriber publishes display_hello event
  → Phones re-publish current snapshots
  → Sessions map rebuilds
  → display-store.setConnectionStatus('connected')
```

---

## Display Store API

```typescript
interface DisplayState {
  sessions: Map<string, DisplaySnapshot>
  focusedUserId: string | null
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected'
  currentPage: number
}

interface DisplayActions {
  upsertSession(userId: string, snapshot: DisplaySnapshot): void
  removeSession(userId: string): void
  setFocusedUser(userId: string | null): void
  setConnectionStatus(status: DisplayState['connectionStatus']): void
  setCurrentPage(page: number): void
  clearAllSessions(): void
}

// Derived selectors (exported as functions, not stored)
function getDisplayMode(state: DisplayState): 'idle' | 'board' | 'focused'
function getPageSessions(state: DisplayState): DisplaySnapshot[]
function getTotalPages(state: DisplayState): number
```

---

## Supabase Client for Display

The display route needs a Supabase client but no auth session. On mount:

1. Call `resolveConfig()` to get `supabaseUrl` and `supabaseKey`
2. If no config available (no env vars, no stored config), show a setup prompt directing to the main app
3. If config available, call `createClient(url, key)` with minimal options (no auth persistence needed)
4. Pass client to `initDisplaySubscriber()`

The display does NOT call `initSupabaseFromConfig()` (which sets the global singleton with auth). It creates its own minimal client instance. This avoids interfering with the main app's auth state if both are open in the same browser.

---

## Typography Sizing (Distance-Readable)

Per PRD, all text must be readable at 3+ meters on 1080p. Minimum sizes:

| Element | Font | Min Size | Tailwind Class |
|---------|------|----------|----------------|
| Clock (idle) | Space Grotesk | 8rem | Custom `text-[8rem]` |
| Rest timer (focused) | Space Grotesk | 3.5rem | `text-readout` |
| Rest timer (board card) | Space Grotesk | 1.75rem | `text-[1.75rem]` |
| User name (card) | Space Grotesk | 1.5rem | `text-[1.5rem]` |
| User name (focused header) | Space Grotesk | 2rem | `text-[2rem]` |
| Current exercise (focused) | Space Grotesk | 2.5rem | `text-[2.5rem]` |
| Current exercise (card) | Inter | 1.25rem | `text-[1.25rem]` |
| Set table text | Inter | 1.25rem | `text-[1.25rem]` |
| Exercise progress | Inter | 1rem | `text-base` |
| Status footer | Inter | 0.875rem | `text-sm` |
| Session type label | Inter | 1rem | `text-base` |
| Elapsed time | Space Grotesk | 1.25rem (card), 1.5rem (focused) | varies |

---

## Phone-Side Changes (display_hello listener)

Step 27's `display-publisher.ts` needs a small addition: listen for `display_hello` events on the channel and respond by re-publishing the current snapshot.

```typescript
// In ensureChannel(), after channel creation:
_channel.on('broadcast', { event: 'display_hello' }, () => {
  // Phone responds by re-publishing current state
  // This requires access to the active workout store's publish function
})
```

**Implementation approach:** Export a `setHelloResponder(fn: () => void)` from the publisher module. The `useDisplayBroadcast` hook sets this to a function that calls `_publishCurrentState()` from the active workout store. When `display_hello` arrives, the publisher invokes the responder if set.

---

## Portrait Handling

The display assumes landscape orientation (FR-1.6). If a portrait viewport is detected:

```css
@media (orientation: portrait) {
  .display-shell { /* show rotate message, hide display content */ }
}
```

A simple centered message: "ROTATE TO LANDSCAPE" with a `screen_rotation` Material Symbol icon. No forced orientation lock.

---

## Performance Considerations

- **Memory target:** < 50 MB (NFR-D6). No heavy libraries. No virtualization needed (max ~20 cards).
- **Render target:** < 100ms after snapshot receipt (NFR-D3). Zustand selectors ensure only affected cards re-render.
- **No unnecessary re-renders:** Timer interpolation uses rAF and updates a ref, only triggering React re-render once per second (not per frame).
- **Page cycling:** `setInterval` cleared when not needed. No leaked timers.
- **Channel cleanup:** `destroyDisplaySubscriber()` on route unmount removes the channel.

---

## Integration Points

| System | Integration | Direction |
|--------|-------------|-----------|
| display-publisher.ts | Publishes snapshots + events | Phone -> Channel |
| display-subscriber.ts (new) | Subscribes to snapshots + events | Channel -> Display |
| display-store.ts (new) | Holds display state | Internal |
| active-workout-store.ts | Responds to display_hello | Phone-side (minor change) |
| __root.tsx | Route bypass for /display | Config guard (minor change) |
| use-display-broadcast.ts | Wires hello responder | Phone-side (minor change) |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Broadcast events lost during disconnection | Medium | Sessions stale until next state change | display_hello pattern rebuilds state on reconnect |
| Timer drift > 1 second | Low | Visual inaccuracy | rAF calculates from wall clock, not increments |
| Supabase Broadcast channel limits | Low | Display stops receiving | Single channel for all events; well within limits |
| Memory leak from stale sessions | Medium | Display degrades over time | Sessions removed on `session_ended`; consider a staleness timeout (e.g., 30 min no update -> auto-remove) |
| Display and app open in same browser tab conflict | Low | Auth state interference | Display creates its own Supabase client, doesn't use global singleton |

**Staleness timeout:** If no snapshot is received for a session in 30 minutes, auto-remove it from the map. This handles the case where a phone crashes without sending `session_ended`. Implemented as a periodic check in the store or a per-session timeout.
