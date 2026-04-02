# Steps: Supabase Realtime Integration (Step 22)

**Feature:** 005-Supabase-Realtime
**Created:** 2026-04-02
**Spec:** [Spec.md](./Spec.md)
**Tech:** [Tech.md](./Tech.md)
**Execution:** `/build` (tasks are isolated by domain, no real-time agent coordination needed)

---

## Team Composition

| Agent | Role | Stack |
|-------|------|-------|
| `domain-engineer` | Broadcast schemas, RealtimeManager module, adapter interface change | TypeScript |
| `rust-engineer` | Cursor-based Rust command, Tauri adapter update | Rust / TypeScript |
| `frontend-specialist` | Foreground detector, TanStack Query hooks, ChatRealtimeListener wiring | TypeScript / React |
| `quality-engineer` | Validation of all deliverables against Spec testable assertions | All |

---

## Wave 1: Foundation (parallel)

### S001: Broadcast Payload Zod Schemas
**Agent:** `domain-engineer`
**Files:** `src/lib/realtime-schemas.ts` (new)
**Depends on:** none
**Blocked by:** none

Create Zod validation schemas for Realtime Broadcast payloads. These are consumed by the RealtimeManager to validate inbound broadcasts before inserting into the TanStack Query cache.

**`src/lib/realtime-schemas.ts`:**

```typescript
import { z } from 'zod'
import { messageTypeSchema } from '@/domain/types/message'

export const messageBroadcastPayloadSchema = z.object({
  message_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  message_type: messageTypeSchema,
  preview: z.string().max(100),
  created_at: z.string().datetime(),
})

export type MessageBroadcastPayload = z.infer<typeof messageBroadcastPayloadSchema>

export const typingBroadcastPayloadSchema = z.object({
  user_id: z.string().uuid(),
  user_name: z.string(),
})

export type TypingBroadcastPayload = z.infer<typeof typingBroadcastPayloadSchema>
```

Follow existing schema patterns -- check `src/domain/types/message.ts` and `src/domain/types/conversation.ts` for `z.string().uuid()` vs `entityId` usage. Use whichever is established.

**Acceptance:**
- Compiles
- Valid payloads parse, invalid reject
- Zero React/framework imports
- Types exported for RealtimeManager and hooks

---

### S002: Cursor-Based `getMessages` -- TypeScript Side
**Agent:** `domain-engineer`
**Files:**
- `src/lib/data-adapter.ts` (modify interface)
- `src/lib/supabase-adapter.ts` (modify implementation)
- `src/test/mocks/data-adapter.ts` (modify mock)
**Depends on:** none
**Blocked by:** none

Change the `getMessages` signature from offset-based to cursor-based per Tech.md D2.

**Interface change in `data-adapter.ts`:**

Replace:
```typescript
getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]>
```

With:
```typescript
getMessages(conversationId: string, options: { before?: string; limit: number }): Promise<Message[]>
```

Where `before` is an ISO 8601 timestamp. When `undefined`, returns the newest `limit` messages. When provided, returns messages with `created_at < before`.

**Supabase adapter implementation in `supabase-adapter.ts`:**

```typescript
async getMessages(
  conversationId: string,
  options: { before?: string; limit: number },
): Promise<Message[]> {
  let query = this.client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(options.limit)

  if (options.before) {
    query = query.lt('created_at', options.before)
  }

  const { data, error } = await query
  if (error) throw error
  return (data as MessageRow[]).map(toMessage).reverse()
}
```

Note: Query in descending order, then `.reverse()` for ascending display order.

**Mock adapter in `data-adapter.ts` (test mocks):**

Update the `getMessages` mock to accept the new signature: `vi.fn().mockResolvedValue([])`.

**Acceptance:**
- TypeScript compiles
- Supabase adapter queries with `.lt('created_at', before)` when cursor provided
- Supabase adapter returns newest N when no cursor
- Results returned in ascending `created_at` order
- Mock updated, no TS errors

---

### S003: Cursor-Based `get_messages` -- Rust + Tauri Adapter
**Agent:** `rust-engineer`
**Files:**
- `src-tauri/src/commands/chat.rs` (modify `get_messages`)
- `src/lib/tauri-adapter.ts` (modify `getMessages`)
**Depends on:** none
**Blocked by:** none

Update the Rust command and Tauri adapter to use cursor-based pagination.

**Rust command change in `chat.rs`:**

Replace `offset: Option<i64>` with `before: Option<i64>` (epoch seconds):

```rust
#[tauri::command]
pub async fn get_messages(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<MessageRow>, AppError> {
    let lim = limit.unwrap_or(50);

    let rows = if let Some(before_ts) = before {
        sqlx::query_as::<_, MessageRow>(
            "SELECT * FROM messages \
             WHERE conversation_id = ? AND created_at < ? \
             ORDER BY created_at DESC \
             LIMIT ?",
        )
        .bind(&conversation_id)
        .bind(before_ts)
        .bind(lim)
        .fetch_all(pool.inner())
        .await?
    } else {
        sqlx::query_as::<_, MessageRow>(
            "SELECT * FROM messages \
             WHERE conversation_id = ? \
             ORDER BY created_at DESC \
             LIMIT ?",
        )
        .bind(&conversation_id)
        .bind(lim)
        .fetch_all(pool.inner())
        .await?
    };

    // Reverse to ascending order for the client
    let mut rows = rows;
    rows.reverse();
    Ok(rows)
}
```

**Tauri adapter change in `tauri-adapter.ts`:**

```typescript
async getMessages(
  conversationId: string,
  options: { before?: string; limit: number },
): Promise<Message[]> {
  const before = options.before
    ? Math.floor(new Date(options.before).getTime() / 1000)
    : undefined
  const rows = await invokeCommand<TauriMessageResponse[]>('get_messages', {
    conversation_id: conversationId,
    before,
    limit: options.limit,
  })
  return rows.map((r) => toMessage(toMessageRowFromTauri(r)))
}
```

Note: Convert ISO string to epoch seconds for the Rust command (matching existing pattern in `getMessagesSince`).

**Acceptance:**
- Rust compiles
- TypeScript compiles
- Cursor-based query returns correct results
- No cursor returns newest N messages
- Results in ascending `created_at` order

---

### S004: Foreground Detector Module
**Agent:** `frontend-specialist`
**Files:** `src/lib/foreground-detector.ts` (new)
**Depends on:** none
**Blocked by:** none

Create a platform-agnostic foreground/background detection module per Tech.md D6.

**`src/lib/foreground-detector.ts`:**

```typescript
import { isTauri } from '@/lib/environment'  // check existing isTauri() location

export interface ForegroundDetector {
  start(): void
  stop(): void
}

export function createForegroundDetector(
  onForeground: () => void,
  onBackground: () => void,
): ForegroundDetector
```

**Browser implementation:** Listen to `document.visibilitychange`. When `document.hidden` transitions to `false`, call `onForeground()`. When transitioning to `true`, call `onBackground()`.

**Tauri implementation:** Use Tauri v2 window API. Check what's available:
- `getCurrentWindow().onFocusChanged()` from `@tauri-apps/api/window`
- Verify the exact API by reading `node_modules/@tauri-apps/api/src/window.ts`

If `onFocusChanged` is not available in the installed Tauri version, fall back to `visibilitychange` for both platforms (it works in WebView too).

The `start()` method registers event listeners. The `stop()` method removes them. The module does NOT know about the RealtimeManager -- it only calls the provided callbacks.

**Acceptance:**
- Compiles
- Browser mode: `visibilitychange` listener registered on `start()`, removed on `stop()`
- Tauri mode: window focus listener registered (or fallback to `visibilitychange`)
- Zero React dependencies
- Callbacks fire on foreground/background transitions

---

## Wave 2: RealtimeManager (depends on S001, S004)

### S005: RealtimeManager Module
**Agent:** `domain-engineer`
**Files:** `src/lib/realtime-manager.ts` (new)
**Depends on:** S001, S004
**Blocked by:** S001, S004

Build the core Realtime Broadcast channel manager per Tech.md D1, D3, D5, D6.

**`src/lib/realtime-manager.ts`:**

```typescript
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import type { DataAdapter } from './data-adapter'
import type { MessageBroadcastPayload, TypingBroadcastPayload } from './realtime-schemas'
import { messageBroadcastPayloadSchema } from './realtime-schemas'
import { createForegroundDetector, type ForegroundDetector } from './foreground-detector'

export interface RealtimeManager {
  subscribe(conversationId: string): void
  unsubscribe(conversationId: string): void
  unsubscribeAll(): void

  broadcastMessage(conversationId: string, payload: MessageBroadcastPayload): Promise<void>
  broadcastTyping(conversationId: string, userId: string, userName: string): void

  onMessage: ((conversationId: string, payload: MessageBroadcastPayload) => void) | null
  onTyping: ((conversationId: string, userId: string, userName: string) => void) | null

  getTypingUsers(conversationId: string): Array<{ userId: string; userName: string }>

  handleForeground(): Promise<void>
  handleBackground(): void

  destroy(): void
}

export function createRealtimeManager(
  client: SupabaseClient,
  adapter: DataAdapter,
): RealtimeManager
```

**Internal state (closure-scoped, not exposed):**
- `channels: Map<string, RealtimeChannel>` -- active channel subscriptions keyed by conversationId
- `typingState: Map<string, Map<string, { userName: string; timeout: ReturnType<typeof setTimeout> }>>` -- typing indicators per conversation per user
- `lastTypingSent: Map<string, number>` -- debounce tracking per conversation (timestamp of last sent typing event)
- `foregroundDetector: ForegroundDetector` -- platform detector instance
- `lastKnownTimestamps: Map<string, string>` -- most recent `created_at` per conversation for catch-up

**Channel lifecycle:**

`subscribe(conversationId)`:
1. If channel already exists in `channels` map, return (no-op).
2. Create channel: `client.channel(\`chat:${conversationId}\`, { config: { broadcast: { ack: false, self: false } } })`
3. Register `.on('broadcast', { event: 'message' }, handler)` -- validates payload via `messageBroadcastPayloadSchema.safeParse()`, discards on failure (log warning), calls `this.onMessage` callback.
4. Register `.on('broadcast', { event: 'typing' }, handler)` -- extracts user_id/user_name, filters own user ID, updates `typingState` map, sets 3-second timeout to clear, calls `this.onTyping` callback.
5. Call `.subscribe()` with status callback logging success/failure.
6. Store channel in `channels` map.

`unsubscribe(conversationId)`:
1. Get channel from `channels` map. If not found, return.
2. Call `client.removeChannel(channel)`.
3. Delete from `channels` map.
4. Clear typing state for this conversation.

`unsubscribeAll()`:
1. Call `client.removeAllChannels()`.
2. Clear all maps.

**Broadcasting:**

`broadcastMessage(conversationId, payload)`:
1. Get channel from `channels` map. If not subscribed, log warning and return.
2. Call `channel.send({ type: 'broadcast', event: 'message', payload })`.

`broadcastTyping(conversationId, userId, userName)`:
1. Check debounce: if `Date.now() - lastTypingSent.get(conversationId) < 2000`, return.
2. Get channel. If not subscribed, return.
3. Call `channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: userId, user_name: userName } })`.
4. Update `lastTypingSent`.

**Typing state:**

`getTypingUsers(conversationId)`:
1. Return array from `typingState.get(conversationId)` entries, mapped to `{ userId, userName }`.

**Catch-up-then-subscribe (handleForeground):**
1. For each conversationId in `channels` keys:
   a. Get `lastKnownTimestamp` for this conversation.
   b. If available, call `adapter.getMessagesSince(conversationId, lastKnownTimestamp)`.
   c. For each message returned, call `this.onMessage(conversationId, { message_id: msg.id, conversation_id: msg.conversationId, sender_id: msg.senderId ?? '', message_type: msg.messageType, preview: (msg.content ?? '').slice(0, 100), created_at: msg.createdAt })`.
2. Re-subscribe to all channels (they may have been torn down on background).

`handleBackground()`:
1. Snapshot `lastKnownTimestamps` from current state (provided by hooks via a setter).
2. Call `unsubscribeAll()` to conserve connections.

**Foreground detector wiring:**
- In `createRealtimeManager()`, create a `ForegroundDetector` with `onForeground: () => manager.handleForeground()` and `onBackground: () => manager.handleBackground()`.
- Call `detector.start()` immediately.
- On `destroy()`, call `detector.stop()` and `unsubscribeAll()`.

**Singleton access pattern** (matching existing adapter singleton in `src/lib/adapter.ts`):

```typescript
let _manager: RealtimeManager | null = null

export function getRealtimeManager(): RealtimeManager | null {
  return _manager
}

export function initRealtimeManager(client: SupabaseClient, adapter: DataAdapter): RealtimeManager {
  if (_manager) _manager.destroy()
  _manager = createRealtimeManager(client, adapter)
  return _manager
}

export function resetRealtimeManager(): void {
  _manager?.destroy()
  _manager = null
}
```

**Acceptance:**
- Compiles
- `subscribe()` creates a Supabase channel with correct topic and config
- `broadcastMessage()` sends `{ type: 'broadcast', event: 'message', payload }` on the channel
- `broadcastTyping()` debounces to max 1 per 2 seconds
- Typing state clears after 3-second timeout
- `handleForeground()` calls `getMessagesSince` then re-subscribes
- `handleBackground()` calls `unsubscribeAll()`
- `destroy()` removes all channels and stops foreground detector
- Zero React dependencies
- TA-1, TA-3, TA-4, TA-10, TA-11 from Spec

---

## Wave 3: Hooks + Wiring (depends on S002, S003, S005)

### S006: TanStack Query Chat Hooks
**Agent:** `frontend-specialist`
**Files:** `src/hooks/use-chat.ts` (new)
**Depends on:** S002, S003, S005
**Blocked by:** S002, S003, S005

Create all chat TanStack Query hooks in a single file, following existing patterns from `use-workout-logs.ts` (optimistic updates), `use-activity-feed.ts` (infinite query), and other hook files.

Read the following files before writing to match established patterns exactly:
- `src/hooks/use-activity-feed.ts` -- infinite query pattern
- `src/hooks/use-workout-logs.ts` -- optimistic mutation pattern
- `src/hooks/use-connections.ts` -- simple query + mutation pattern
- `src/hooks/use-groups.ts` -- query key conventions
- `src/lib/adapter.ts` -- `getAdapter()` usage

**Constants:**

```typescript
const MESSAGE_PAGE_SIZE = 50
```

**Query hooks:**

**`useConversations()`**
- Query key: `['conversations']`
- Query fn: `getAdapter().getConversations()`
- Simple `useQuery`, no special options.

**`useConversation(id: string)`**
- Query key: `['conversations', id]`
- Query fn: `getAdapter().getConversation(id)`
- `enabled: !!id`

**`useFindDirectConversation(otherUserId: string)`**
- Query key: `['conversations', 'direct', otherUserId]`
- Query fn: `getAdapter().findDirectConversation(otherUserId)`
- `enabled: !!otherUserId`

**`useMessages(conversationId: string)`**
- Type: `useInfiniteQuery`
- Query key: `['messages', conversationId]`
- Query fn: `({ pageParam }) => getAdapter().getMessages(conversationId, { before: pageParam, limit: MESSAGE_PAGE_SIZE })`
- `initialPageParam: undefined as string | undefined`
- `getPreviousPageParam: (firstPage) => firstPage.length < MESSAGE_PAGE_SIZE ? undefined : firstPage[0]?.createdAt`
- `getNextPageParam: () => undefined` (new messages come via Realtime, not pagination)
- `enabled: !!conversationId`
- `select`: flatten `pages` into `allMessages` for convenience: `(data) => ({ ...data, allMessages: data.pages.flat() })`

**`useUnreadCounts()`**
- Query key: `['unread-counts']`
- Query fn: `getAdapter().getUnreadCounts()`
- Returns `Map<string, number>`

**Mutation hooks:**

**`useSendMessage()`**
- Mutation fn:
  1. `const message = await getAdapter().sendMessage(conversationId, messageType, content)`
  2. `const manager = getRealtimeManager()`
  3. If manager: `await manager.broadcastMessage(conversationId, { message_id: message.id, conversation_id: conversationId, sender_id: message.senderId ?? '', message_type: message.messageType, preview: (content ?? '').slice(0, 100), created_at: message.createdAt })`
  4. Return `message`
- `onMutate`: Optimistic insert:
  1. `await queryClient.cancelQueries({ queryKey: ['messages', conversationId] })`
  2. Snapshot: `const previous = queryClient.getQueryData(['messages', conversationId])`
  3. Insert optimistic message into last page of infinite query data with `id: 'optimistic-' + crypto.randomUUID()`, `syncStatus: 'pending'`, `createdAt: new Date().toISOString()`
  4. Return `{ previous }`
- `onError`: Restore snapshot from context.
- `onSettled`: `queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })` for server re-sort (CH-5).

**`useUpdateLastRead()`**
- Mutation fn: `getAdapter().updateLastRead(conversationId)`
- `onSettled`: Invalidate `['unread-counts']`

**`useCreateConversation()`**
- Mutation fn: `getAdapter().createConversation(type, participantIds, title, groupId)`
- `onSettled`: Invalidate `['conversations']`
- After mutation success, call `getRealtimeManager()?.subscribe(newConversation.id)` to auto-subscribe.

**`useLeaveConversation()`**
- Mutation fn: `getAdapter().leaveConversation(conversationId)`
- `onMutate`: `getRealtimeManager()?.unsubscribe(conversationId)` -- unsubscribe immediately.
- `onSettled`: Invalidate `['conversations']`, `['unread-counts']`

**`useToggleArchive()`**
- Mutation fn: `getAdapter().toggleArchive(conversationId)`
- `onSettled`: Invalidate `['conversations']`

**Realtime integration hook:**

**`useRealtimeMessages(conversationId: string)`**
- A side-effect hook (no return value needed, or returns typing users).
- On mount:
  1. Get `getRealtimeManager()`. If null, return.
  2. Call `manager.subscribe(conversationId)`.
  3. Set `manager.onMessage` callback that:
     a. Checks if `conversationId` matches.
     b. Deduplicates by message ID against current cache.
     c. Appends the new message to the last page of `['messages', conversationId]` infinite query via `queryClient.setQueryData`.
     d. If the message is for a different conversation (user has multiple subscriptions), increment the unread count for that conversation via `queryClient.setQueryData(['unread-counts'], ...)`.
     e. Updates the RealtimeManager's `lastKnownTimestamps` for catch-up tracking.
  4. Set `manager.onTyping` callback that triggers a re-render (store typing state in local `useState` or read from `manager.getTypingUsers(conversationId)`).
- On unmount:
  1. Call `manager.unsubscribe(conversationId)`.
  2. Clear `manager.onMessage` and `manager.onTyping` if they are the ones we set.
- Returns `{ typingUsers: Array<{ userId: string; userName: string }> }`

**Note on onMessage callback ownership:** Since multiple `useRealtimeMessages` instances may be mounted (conversation list subscribes to multiple), the `onMessage` callback should handle ALL conversations, not just one. Consider using a single callback that dispatches by `conversationId` rather than overwriting `manager.onMessage` per hook instance. Implementation approach:
- The manager stores a Set of message callbacks rather than a single one.
- `addMessageListener(cb)` / `removeMessageListener(cb)` methods.
- Or: a single top-level `ChatRealtimeListener` component (like `SyncListener`) that subscribes to all active conversations and manages cache updates globally, with `useRealtimeMessages` being a thin hook that subscribes/unsubscribes individual conversations and reads typing state.

**Recommended approach:** Single `ChatRealtimeListener` component for global cache updates, individual `useRealtimeMessages(conversationId)` hooks for per-conversation subscription and typing state. This mirrors the existing `SyncListener` + per-route hooks pattern.

**`ChatRealtimeListener` component:**
- Mount at app level (in `main.tsx` or similar), alongside `SyncListener`.
- Initializes the RealtimeManager singleton: `initRealtimeManager(getSupabaseClient()!, getAdapter())`.
- Sets the global `onMessage` callback that updates TanStack Query caches.
- Cleans up on unmount.

**Acceptance:**
- All hooks compile
- `useMessages` returns infinite query with `fetchPreviousPage` for older messages
- `useSendMessage` performs optimistic insert + broadcast + invalidation
- `useRealtimeMessages` subscribes on mount, unsubscribes on unmount
- Realtime message appends to cache without re-fetch
- Typing users returned from `useRealtimeMessages`
- Unread counts update on remote message
- TA-6, TA-7, TA-8, TA-9, TA-10, TA-12, TA-13 from Spec

---

### S007: RealtimeManager Initialization Wiring
**Agent:** `frontend-specialist`
**Files:**
- `src/components/chat-realtime-listener.tsx` (new)
- `src/main.tsx` (mount ChatRealtimeListener)
- `src/lib/auth.tsx` (call resetRealtimeManager on logout)
**Depends on:** S005, S006
**Blocked by:** S005, S006

Wire the RealtimeManager singleton into the app lifecycle.

**`src/components/chat-realtime-listener.tsx`:**
- Follows the `SyncListener` pattern exactly.
- On mount (useEffect):
  1. `const client = getSupabaseClient()` -- if null, return (not initialized yet).
  2. `const adapter = getAdapter()` -- get current adapter.
  3. `initRealtimeManager(client, adapter)` -- creates the singleton.
  4. Get `getRealtimeManager()` and set the global `onMessage` callback:
     - Parse payload via `messageBroadcastPayloadSchema.safeParse()`.
     - On valid payload, update `['messages', conversationId]` infinite query cache (append to last page, deduplicate by ID).
     - Update `['unread-counts']` cache (increment for the conversation, unless sender is current user).
  5. Set the global `onTyping` callback (no cache update needed -- typing state is in the manager, hooks read it directly).
- On unmount: `resetRealtimeManager()`.

**`src/main.tsx`:**
- Import and mount `<ChatRealtimeListener />` alongside existing `<SyncListener />` inside the `QueryClientProvider`.

**`src/lib/auth.tsx`:**
- In the logout/signout flow (wherever `resetAdapter()` and `resetSupabaseClient()` are called), add `resetRealtimeManager()`.

**Acceptance:**
- RealtimeManager initializes on app load
- RealtimeManager destroyed on logout
- `ChatRealtimeListener` mounted in component tree
- TA-11 from Spec (auth state change cleanup)

---

## Wave 4: Validation

### S008: Quality Validation
**Agent:** `quality-engineer`
**Files:** Read-only inspection of all deliverables
**Depends on:** S001-S007
**Blocked by:** S001-S007

Validate against all 14 testable assertions from Spec:

| TA | Check |
|----|-------|
| TA-1 | `subscribe()` calls `client.channel()` with correct topic `chat:{id}` and `{ broadcast: { ack: false, self: false } }` |
| TA-2 | Broadcast send calls `channel.send({ type: 'broadcast', event: 'message', payload })` |
| TA-3 | Typing debounce: rapid calls within 2s produce only 1 `channel.send` for typing |
| TA-4 | Typing state cleared after 3s timeout (setTimeout with 3000ms) |
| TA-5 | `getMessagesSince` called in `handleForeground()` for catch-up |
| TA-6 | Cache append checks for existing message ID before inserting (deduplication) |
| TA-7 | `useMessages` uses `useInfiniteQuery` with `getPreviousPageParam` returning `firstPage[0]?.createdAt` |
| TA-8 | Realtime message append targets the last page of infinite query data |
| TA-9 | `useSendMessage.onMutate` inserts optimistic message with `'optimistic-'` prefix ID |
| TA-10 | `useRealtimeMessages` cleanup calls `manager.unsubscribe(conversationId)` |
| TA-11 | `auth.tsx` logout flow calls `resetRealtimeManager()` |
| TA-12 | `onMessage` callback increments unread count for non-sender conversations |
| TA-13 | All hooks compile: `bun run build` succeeds |
| TA-14 | No Tauri-specific imports in `realtime-manager.ts` (browser-compatible) |
| -- | `data-adapter.ts` `getMessages` signature uses `{ before?: string; limit: number }` |
| -- | Supabase adapter `getMessages` uses `.lt('created_at', before)` and `.reverse()` |
| -- | Rust `get_messages` command uses `before: Option<i64>` (no `offset` param) |
| -- | Tauri adapter converts ISO to epoch seconds for Rust command |
| -- | `foreground-detector.ts` has zero React imports |
| -- | `realtime-schemas.ts` schemas validate correct payloads and reject malformed |
| -- | `ChatRealtimeListener` mounted in `main.tsx` |
| -- | All new files use established import path aliases (`@/lib/`, `@/hooks/`, etc.) |

**Output:** Pass/fail report. No file modifications.

---

## Dependency Graph

```
Wave 1 (parallel):
  S001 (Broadcast schemas)  ──────────────┐
  S002 (Cursor getMessages - TS)  ────────┤
  S003 (Cursor get_messages - Rust)  ─────┤
  S004 (Foreground detector)  ────────────┤
                                          │
Wave 2 (depends on S001, S004):           │
  S005 (RealtimeManager) ◄── S001, S004   │
                                          │
Wave 3 (depends on S002, S003, S005):     │
  S006 (Chat hooks) ◄── S002, S003, S005  │
  S007 (Wiring) ◄── S005, S006           │
                                          │
Wave 4:                                   │
  S008 (Validation) ◄── ALL ◄────────────┘
```

## Execution Summary

| Metric | Value |
|--------|-------|
| Total steps | 8 |
| Agents | 3 specialists + 1 validator |
| Max parallelism | 4 (Wave 1) |
| Waves | 4 |
| Files created | 5 new |
| Files modified | ~6 |
| Recommended execution | `/build` (isolated, parallel sub-agents) |
