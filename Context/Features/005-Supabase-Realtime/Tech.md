# Tech: Supabase Realtime Integration (Step 22)

**Feature:** 005-Supabase-Realtime
**Created:** 2026-04-02
**Spec:** [Spec.md](./Spec.md)

---

## Architecture Overview

Three new modules, one adapter interface change, and a set of TanStack Query hooks.

```
┌─────────────────────────────────────────────────────────┐
│  React Layer                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ useMessages  │  │useSendMessage│  │useTyping     │  │
│  │ (infinite)   │  │ (mutation)   │  │Indicator     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         ▼                 ▼                 ▼           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  src/hooks/use-chat.ts  (all chat hooks)        │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                               │
├─────────────────────────┼───────────────────────────────┤
│  Transport Layer        │                               │
│         ┌───────────────┴───────────────┐               │
│         ▼                               ▼               │
│  ┌──────────────────┐   ┌──────────────────────────┐    │
│  │ DataAdapter      │   │ RealtimeManager          │    │
│  │ (existing)       │   │ src/lib/realtime-manager  │    │
│  │                  │   │                          │    │
│  │ getMessages()    │   │ subscribeConversation()  │    │
│  │ sendMessage()    │   │ unsubscribeConversation()│    │
│  │ getMessagesSince │   │ broadcastMessage()       │    │
│  │ ...              │   │ broadcastTyping()        │    │
│  └──────────────────┘   │ onMessage(cb)            │    │
│                         │ onTyping(cb)             │    │
│                         │ unsubscribeAll()         │    │
│                         │ catchUpThenSubscribe()   │    │
│                         └──────────┬───────────────┘    │
│                                    │                    │
│                                    ▼                    │
│                         ┌──────────────────────────┐    │
│                         │ Supabase JS Realtime     │    │
│                         │ .channel() / .on() /     │    │
│                         │ .send() / .subscribe()   │    │
│                         └──────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Decisions

### D1: RealtimeManager as standalone imperative module

**Decision:** `src/lib/realtime-manager.ts` is a plain TypeScript module with no React or framework dependencies.

**Options considered:**
1. React Context provider wrapping the channel lifecycle
2. Zustand store managing subscriptions
3. Standalone module with imperative API

**Choice:** Option 3. The WebSocket lifecycle (connect, subscribe, unsubscribe, reconnect) is inherently imperative and should not be coupled to React's render cycle. Hooks consume the module; the module does not know about hooks. This also enables a future Tauri-native WebSocket backend without touching React code.

**Interface sketch:**

```typescript
interface RealtimeManager {
  // Channel lifecycle
  subscribe(conversationId: string): void
  unsubscribe(conversationId: string): void
  unsubscribeAll(): void

  // Broadcast
  broadcastMessage(conversationId: string, payload: MessageBroadcastPayload): Promise<void>
  broadcastTyping(conversationId: string, userId: string, userName: string): void

  // Event callbacks (set by hooks)
  onMessage: ((conversationId: string, payload: MessageBroadcastPayload) => void) | null
  onTyping: ((conversationId: string, userId: string, userName: string) => void) | null

  // Reconnection
  handleForeground(): Promise<void>
  handleBackground(): void

  // Cleanup
  destroy(): void
}
```

The module is a singleton created via `createRealtimeManager(supabaseClient, adapter)` and destroyed on auth state change. It is NOT a class -- it is a closure returning the interface, keeping internal state (active channels map, typing debounce timers) private.

### D2: Cursor-based pagination for messages (adapter interface change)

**Decision:** Replace the offset-based `getMessages(conversationId, limit, offset)` with a cursor-based method.

**New signature:**

```typescript
// On DataAdapter interface:
getMessages(
  conversationId: string,
  options: { before?: string; limit: number }
): Promise<Message[]>
```

Where `before` is an ISO 8601 timestamp cursor. When `before` is undefined, returns the newest `limit` messages. When `before` is provided, returns the `limit` messages with `created_at < before`, ordered newest-first (descending). The hook reverses into ascending order for display.

**Why cursor over offset:** Offset-based pagination breaks when new messages are inserted (the offset shifts, causing duplicates or skips). Chat is a high-insert-rate table. Keyset pagination on `(created_at, id)` is stable under inserts. The activity feed already uses this pattern.

**Migration path:** The current `getMessages(conversationId, limit, offset)` has zero callers in the codebase (no chat hooks or UI exist yet). The signature can be changed in place without a deprecation period. Both adapters (Supabase, Tauri) and the Rust command need updating.

**Supabase implementation:**
```typescript
async getMessages(conversationId: string, options: { before?: string; limit: number }): Promise<Message[]> {
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

**Rust command change:**
```rust
pub async fn get_messages(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    before: Option<i64>,  // epoch seconds, replaces offset
    limit: Option<i64>,
) -> Result<Vec<MessageRow>, AppError>
```

SQL: `SELECT * FROM messages WHERE conversation_id = ? AND (? IS NULL OR created_at < ?) ORDER BY created_at DESC LIMIT ?`, then reverse in Rust before returning.

### D3: Broadcast channel topic naming

**Decision:** Channel topic per conversation: `chat:{conversationId}`

Example: `chat:550e8400-e29b-41d4-a716-446655440000`

Two event types per channel:
- `message` -- new message notification
- `typing` -- typing indicator

Channel configuration:
```typescript
supabase.channel(`chat:${conversationId}`, {
  config: {
    broadcast: { ack: false, self: false },
    private: false,
  },
})
```

- `ack: false` -- fire-and-forget for both message and typing broadcasts. The DB insert is the source of truth for messages; the broadcast is a notification to update the cache. If the broadcast is lost, the catch-up query will recover it.
- `self: false` -- the sender already has the message in cache (optimistic update). No need to receive own broadcast.
- `private: false` -- channel authorization is not enforced at the Realtime layer. RLS on the `messages` table is the security boundary. The broadcast payload contains only lightweight metadata (message ID, preview), not the full message content. A malicious subscriber would see only IDs and previews of messages they could not fetch via the API.

### D4: Broadcast payload shapes

**Message broadcast payload:**

```typescript
interface MessageBroadcastPayload {
  message_id: string
  conversation_id: string
  sender_id: string
  message_type: MessageType
  preview: string        // first 100 chars of content
  created_at: string     // ISO 8601, server timestamp
}
```

Validated via Zod schema before cache insertion. Malformed payloads are logged and discarded.

**Typing broadcast payload:**

```typescript
interface TypingBroadcastPayload {
  user_id: string
  user_name: string
}
```

No Zod validation needed -- typing payloads are ephemeral and never persisted or inserted into cache.

### D5: Typing indicator implementation

**Sending:** Debounced to max 1 broadcast per 2 seconds per conversation. Uses a simple timestamp check (`Date.now() - lastTypingSent > 2000`). No trailing edge -- if the user stops typing, no "stopped typing" event is sent. The receiver handles timeout.

**Receiving:** Each received typing event resets a 3-second timer per (conversationId, userId). When the timer expires, the typing indicator is cleared. Own typing events are filtered out (`self: false` on channel config handles this, but also guard in callback for defense in depth).

**State:** Typing state is managed in a `Map<string, Map<string, { userName: string; timeout: NodeJS.Timeout }>>` inside the RealtimeManager (outer key: conversationId, inner key: userId). The manager exposes `getTypingUsers(conversationId): Array<{ userId: string; userName: string }>` for hooks to read.

### D6: Catch-up-then-subscribe reconnection

**Trigger:** The RealtimeManager's `handleForeground()` method, called by platform-specific foreground detection.

**Sequence:**

1. For each conversation the user is subscribed to (tracked in `activeConversations` set):
2. Call `adapter.getMessagesSince(conversationId, lastKnownTimestamp)` where `lastKnownTimestamp` is the `created_at` of the most recent message in the TanStack Query cache for that conversation.
3. Merge results into the query cache, deduplicating by message ID.
4. Update unread counts.
5. Re-subscribe to Broadcast channels.

**Deduplication:** Before inserting a catch-up message into the infinite query cache, check if a message with the same ID already exists in any page. Skip if found.

**Platform detection wiring** (outside RealtimeManager, in app initialization):

```typescript
// Browser mode
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    realtimeManager.handleBackground()
  } else {
    realtimeManager.handleForeground()
  }
})

// Tauri mode (Tauri v2 window events)
import { getCurrentWindow } from '@tauri-apps/api/window'
const win = getCurrentWindow()
win.onFocusChanged(({ payload: focused }) => {
  if (focused) {
    realtimeManager.handleForeground()
  } else {
    realtimeManager.handleBackground()
  }
})
```

### D7: TanStack Query integration

**Query key scheme:**

| Hook | Query Key | Type |
|------|-----------|------|
| `useConversations` | `['conversations']` | `useQuery` |
| `useConversation` | `['conversations', id]` | `useQuery` |
| `useMessages` | `['messages', conversationId]` | `useInfiniteQuery` |
| `useUnreadCounts` | `['unread-counts']` | `useQuery` |
| `useFindDirectConversation` | `['conversations', 'direct', otherUserId]` | `useQuery` |

**Note on SyncListener compatibility:** The existing SyncListener invalidates by table name: `queryClient.invalidateQueries({ queryKey: [data.table] })`. For the `messages` table, this will invalidate `['messages', ...]` keys automatically. For conversations, `['conversations', ...]` keys will be invalidated. For unread counts, we need the key to start with a table name or add a custom mapping. Using `['unread-counts']` means sync events won't auto-invalidate it, but that's acceptable -- unread counts are updated via Realtime broadcasts and explicit mutations, not sync.

**Infinite query structure for messages:**

```typescript
useInfiniteQuery({
  queryKey: ['messages', conversationId],
  queryFn: ({ pageParam }) =>
    getAdapter().getMessages(conversationId, {
      before: pageParam,
      limit: MESSAGE_PAGE_SIZE,
    }),
  initialPageParam: undefined as string | undefined,
  getPreviousPageParam: (firstPage) => {
    // "Previous" = older messages (scroll up)
    if (firstPage.length < MESSAGE_PAGE_SIZE) return undefined
    return firstPage[0]?.createdAt
  },
  getNextPageParam: () => undefined, // No "next" -- new messages come via Realtime
  enabled: !!conversationId,
  select: (data) => ({
    ...data,
    // Flatten all pages into a single ascending array for rendering
    pages: data.pages,
    allMessages: data.pages.flat(),
  }),
})
```

**Realtime message append to infinite query cache:**

```typescript
// Inside the onMessage callback wired by the useMessages hook:
queryClient.setQueryData<InfiniteData<Message[]>>(
  ['messages', conversationId],
  (old) => {
    if (!old) return old
    // Deduplicate
    const lastPage = old.pages[old.pages.length - 1]
    if (lastPage.some((m) => m.id === newMessage.id)) return old
    // Append to last page
    return {
      ...old,
      pages: [
        ...old.pages.slice(0, -1),
        [...lastPage, newMessage],
      ],
    }
  }
)
```

### D8: Optimistic send with client-generated UUID

**Flow:**

1. `useSendMessage` generates a UUID client-side (`crypto.randomUUID()`).
2. `onMutate`: Cancel in-flight message queries, snapshot cache, insert optimistic message with `syncStatus: 'pending'` and the client UUID as `id`, `createdAt` set to `new Date().toISOString()`.
3. The mutation calls `adapter.sendMessage(conversationId, messageType, content)` which returns the server-assigned message (with server `created_at` and `id`).
4. Concurrently, `realtimeManager.broadcastMessage(conversationId, payload)` sends the broadcast.
5. `onError`: Roll back cache to snapshot.
6. `onSettled`: Invalidate `['messages', conversationId]` to refetch and get server ordering (CH-5 re-sort).

**Note:** The adapter's `sendMessage` already generates a UUID server-side. For optimistic matching, we insert the optimistic message into the cache with a temp ID (`optimistic-{uuid}`), and the `onSettled` invalidation replaces it with the real server data.

---

## Stack-Specific Details

### TypeScript / React

**New files:**
- `src/lib/realtime-manager.ts` -- Broadcast channel lifecycle, typing state, catch-up
- `src/lib/realtime-schemas.ts` -- Zod schemas for broadcast payloads
- `src/hooks/use-chat.ts` -- All chat TanStack Query hooks
- `src/lib/foreground-detector.ts` -- Platform-agnostic foreground/background detection

**Modified files:**
- `src/lib/data-adapter.ts` -- Change `getMessages` signature to cursor-based
- `src/lib/supabase-adapter.ts` -- Update `getMessages` implementation
- `src/lib/tauri-adapter.ts` -- Update `getMessages` implementation
- `src/test/mocks/data-adapter.ts` -- Update mock
- `src/components/sync-listener.tsx` -- Possibly add unread-counts invalidation mapping (if needed)

### Rust / Tauri

**Modified files:**
- `src-tauri/src/commands/chat.rs` -- Change `get_messages` to cursor-based (`before` param replaces `offset`)
- `src-tauri/src/lib.rs` -- No new commands to register (same command, different params)

### Supabase

**No new migrations.** All tables and RLS policies were created in Step 21. The Realtime Broadcast feature operates at the client level -- it does not require database changes.

---

## Integration Points

### With existing sync engine (Tauri mode)

The Rust sync engine's `postgres_changes` WebSocket subscription and the new client-side Broadcast channels are independent systems:

- **Sync engine** (Rust): Replicates table data between Supabase Postgres and local SQLite. Operates on `INSERT/UPDATE/DELETE` events for all `SYNCABLE_TABLES`. Emits `sync:data_changed` Tauri events that trigger TanStack Query invalidation.
- **Realtime Broadcast** (JS): Delivers lightweight message notifications for UX responsiveness. Does not touch SQLite. Does not interact with the sync engine.

When a message is sent in Tauri mode:
1. `sendMessage` adapter inserts into local SQLite (via Tauri command) with `sync_status: 'pending'`.
2. Broadcast notification sent via JS Realtime client.
3. Sync engine's push loop picks up the pending message and pushes to Supabase.
4. Sync engine emits `sync:data_changed` for `messages` table.
5. SyncListener invalidates `['messages', ...]` queries.

This means messages will appear twice in the cache invalidation path (once from Broadcast, once from sync). The deduplication logic in the Broadcast handler (check by message ID) prevents visual duplicates.

### With auth state changes

On logout (`resetAdapter()` / `resetSupabaseClient()`):
1. `realtimeManager.destroy()` -- calls `supabase.removeAllChannels()`, clears all internal state.
2. TanStack Query cache is cleared (existing behavior in auth flow).
3. On next login, a new `RealtimeManager` instance is created.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Broadcast messages lost during brief disconnection | Missed messages, stale UI | Catch-up query on foreground fills gaps; `onSettled` invalidation on send provides eventual consistency |
| High-frequency typing broadcasts cause rate limiting | Typing indicators stop working | Debounce to 1 per 2s already limits volume; Supabase rate limits are per-channel, not global |
| Channel count scales with conversation count | Resource consumption | Subscribe only to conversations with recent activity (not all); unsubscribe on background; Supabase allows 100 concurrent channels per client |
| `created_at` cursor collision (two messages at same timestamp) | Missed message in pagination | Use compound cursor `(created_at, id)` in SQL with tie-breaking: `WHERE (created_at < ? OR (created_at = ? AND id < ?))` |
| Tauri WebView kills WebSocket on Android background | Realtime stops working | Catch-up-then-subscribe pattern recovers on foreground; future follow-up: Rust-native WebSocket keepalive |
| Adapter interface change breaks existing code | Compilation errors | Zero existing callers of `getMessages` -- safe to change in place |

---

## ADR

One architectural decision record for the cursor-based pagination change, since it modifies the established adapter interface contract.

See: [Context/Decisions/ADR-005-cursor-based-message-pagination.md](../Decisions/ADR-005-cursor-based-message-pagination.md)
