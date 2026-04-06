# Spec: Supabase Realtime Integration (Step 22)

**Feature:** 005-Supabase-Realtime
**Status:** Draft
**Created:** 2026-04-02
**Source:** `docs/implementation-plan.md` Step 22, `docs/12-prd-chat.md` (Message Ordering and Delivery, Offline Behavior), `docs/07-architecture.md` (Supabase Realtime Integration), `docs/06-invariants.md` CH-1..CH-8

---

## Overview

Wire up Supabase Realtime Broadcast channels for live message delivery and typing indicators in the chat feature. Implement the catch-up-then-subscribe reconnection pattern, build TanStack Query hooks for all chat data operations, and add connection-aware channel lifecycle management. No new UI components in this step -- pure data/transport plumbing that Step 23 (Chat UI) consumes.

## Problem Statement

Step 21 delivered the chat persistence layer (tables, RLS, adapters, sync engine registration), but there is no mechanism for connected participants to see messages in real time. Without Realtime, the app would require manual refresh or polling to discover new messages. Typing indicators, unread count updates, and responsive chat UX all depend on a working Broadcast channel layer and corresponding TanStack Query hooks.

## User Stories

1. **As a user**, when someone sends me a message while I have chat open, I see it appear within 500ms without refreshing.
2. **As a user**, when I am composing a message, other participants in the conversation see a typing indicator.
3. **As a user**, when I return to the app after being away (backgrounded or offline), I see all messages I missed without duplicates.
4. **As a user**, my unread badge count updates in real time when new messages arrive in conversations I am not currently viewing.
5. **As a user on Tauri mobile**, the Realtime experience works identically to browser mode (WebView-based subscription).
6. **As a developer**, I can use `useMessages(conversationId)` with infinite query pagination and automatic Realtime appends.
7. **As a developer**, I can call `useSendMessage()` and have both the DB insert and Broadcast notification happen atomically from the caller's perspective.

## Requirements

### Must Have (P0)

| ID  | Requirement                                                                                                                           | Invariant | Verification                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| M1  | Broadcast channel per conversation using conversation ID as topic                                                                     | --        | Channel subscribes successfully for active conversation                       |
| M2  | Channel lifecycle: subscribe on chat entry, unsubscribe on chat exit and app background                                               | --        | DevTools shows no lingering subscriptions after navigation                    |
| M3  | Sending a message performs DB insert via adapter AND broadcasts event on channel                                                      | CH-5      | Remote participant receives broadcast within 500ms                            |
| M4  | Broadcast `message` event payload includes `message_id`, `conversation_id`, `sender_id`, `message_type`, `preview`, `created_at`      | --        | Payload shape matches spec                                                    |
| M5  | On receiving a `message` broadcast, append to local TanStack Query cache (no re-fetch)                                                | --        | Message appears without network request                                       |
| M6  | Typing indicator: ephemeral broadcast, debounced to max 1 per 2s, displayed for 3s after last received event, not shown for own input | --        | Indicator appears/disappears per timing spec                                  |
| M7  | Catch-up-then-subscribe on reconnection: fetch `getMessagesSince(conversation_id, last_read_at)` THEN subscribe to channel            | --        | No missed messages after offline gap; no duplicates                           |
| M8  | Deduplication: if a message from catch-up already exists in cache, skip it                                                            | --        | No duplicate message IDs in rendered list                                     |
| M9  | `useConversations()` hook: fetches conversation list via adapter                                                                      | --        | Returns conversations, re-fetches on invalidation                             |
| M10 | `useConversation(id)` hook: fetches single conversation via adapter                                                                   | --        | Returns conversation or null                                                  |
| M11 | `useMessages(conversationId)` hook: infinite query with cursor-based pagination, newest page receives Realtime appends                | --        | Scroll-up loads older pages; new messages append to bottom                    |
| M12 | `useUnreadCounts()` hook: returns per-conversation unread counts, updated in real time                                                | --        | Badge increments on remote message arrival                                    |
| M13 | `useSendMessage()` mutation: calls adapter + broadcasts, with optimistic insert into cache                                            | CH-5      | Message appears instantly with pending state, re-sorts on server confirmation |
| M14 | Channel subscriptions cleaned up on component unmount and auth state change                                                           | --        | No memory leaks or orphaned subscriptions                                     |
| M15 | Works in both browser mode (Supabase JS client) and Tauri WebView mode                                                                | --        | Both environments subscribe and receive broadcasts                            |

### Should Have (P1)

| ID  | Requirement                                                                                  | Invariant | Verification                                          |
| --- | -------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| S1  | `useUpdateLastRead(conversationId)` mutation to mark conversation as read                    | --        | `last_read_at` updated, unread count decrements       |
| S2  | Connection state awareness: detect online/offline transitions, trigger catch-up on reconnect | --        | Going offline then online triggers catch-up query     |
| S3  | Broadcast payload validation via Zod before cache insertion                                  | --        | Malformed payloads logged and discarded, not inserted |
| S4  | Exponential backoff on channel subscription failure                                          | --        | Failed subscription retries with increasing delay     |
| S5  | `useLeaveConversation()` and `useToggleArchive()` mutations                                  | --        | Leave unsubscribes from channel; archive updates list |
| S6  | `useFindDirectConversation(userId)` query for "open or create" flow                          | --        | Returns existing or null                              |
| S7  | `useCreateConversation()` mutation that auto-subscribes to the new channel                   | --        | New conversation immediately receives broadcasts      |
| S8  | Unread count update on Broadcast message skips conversations where the user is the sender    | --        | Sending a message does not increment own unread count |

### Won't Have (this step)

| ID  | Exclusion                                                           | Reason                                          |
| --- | ------------------------------------------------------------------- | ----------------------------------------------- |
| W1  | Chat UI components (conversation list, message list, compose bar)   | Step 23                                         |
| W2  | Media upload flows or Cloudflare Stream integration                 | Step 24                                         |
| W3  | Retention/cleanup Edge Function                                     | Step 25                                         |
| W4  | Push notifications                                                  | Deferred per PRD                                |
| W5  | Supabase Presence (online status indicators)                        | Not in PRD scope                                |
| W6  | Rust-native WebSocket for Tauri (use WebView client first per plan) | Follow-up if Android background kills WebSocket |
| W7  | Message edit or delete                                              | Deferred per PRD (CH-7)                         |
| W8  | Read receipts beyond `last_read_at` cursor                          | Not in PRD scope                                |

## Testable Assertions

| ID    | Assertion                                                                                  | How to Test                                                                                               |
| ----- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| TA-1  | Subscribing to a conversation channel succeeds and receives a `SUBSCRIBED` status callback | Unit test: mock Supabase client, verify `.subscribe()` called with correct topic                          |
| TA-2  | Broadcasting a `message` event on a channel delivers to all other subscribers within 500ms | Integration test with two Supabase clients subscribed to same channel                                     |
| TA-3  | Typing broadcast is debounced: rapid keystrokes produce at most 1 event per 2 seconds      | Unit test: simulate rapid calls, assert broadcast count                                                   |
| TA-4  | Typing indicator clears after 3 seconds of no received events                              | Unit test: fire typing event, advance timers by 3s, assert cleared                                        |
| TA-5  | Catch-up query (`getMessagesSince`) returns messages created after `last_read_at`          | Integration test: insert messages in Supabase, call getMessagesSince, verify results                      |
| TA-6  | After catch-up + subscribe, no duplicate messages appear in query cache                    | Unit test: pre-populate cache with catch-up results, fire broadcast for same message, assert no duplicate |
| TA-7  | `useMessages` infinite query loads older pages on `fetchNextPage()`                        | Unit test: mock adapter returning pages, verify cursor advances                                           |
| TA-8  | Realtime message append inserts into the newest page of the infinite query cache           | Unit test: set up infinite query data, simulate broadcast append, verify newest page updated              |
| TA-9  | `useSendMessage` optimistic update shows message immediately with `syncStatus: 'pending'`  | Unit test: fire mutation, check cache before settlement                                                   |
| TA-10 | Channel unsubscribes on component unmount (no orphaned subscriptions)                      | Unit test: mount hook, unmount, verify `removeChannel` called                                             |
| TA-11 | Auth state change (logout) removes all active channel subscriptions                        | Unit test: simulate auth change, verify all channels removed                                              |
| TA-12 | Unread count for a conversation increments when a remote message broadcast arrives         | Unit test: simulate broadcast, verify unread count query data incremented                                 |
| TA-13 | All hooks compile and return expected TanStack Query result shapes                         | TypeScript compilation check                                                                              |
| TA-14 | Works in Tauri WebView: Supabase JS Realtime client initializes without errors             | Manual test in Tauri dev mode                                                                             |

## Resolved Questions

| ID   | Question                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1 | Channel manager architecture    | **Standalone module** (`src/lib/realtime-manager.ts`) with imperative API. Keeps WebSocket lifecycle out of React's render cycle. Testable without mounting components. Hooks consume the module; module doesn't know about hooks. Enables Tauri adapter to potentially swap in a Rust-side connection manager later without touching React.                                                                               |
| OQ-2 | Broadcast vs postgres_changes   | **Broadcast** for all chat events per PRD. The Rust sync engine's existing postgres_changes subscription handles table-level data replication -- a separate concern. Chat Broadcast operates at the UX layer. These two systems coexist without interference. postgres_changes cannot carry ephemeral typing indicators and has higher latency.                                                                            |
| OQ-3 | Pagination strategy             | **Cursor-based (keyset on `created_at` + `id`)**, paginating backwards (older messages) since chat loads newest-first and scrolls up for history. Adapter signature: `getMessages(conversationId, { before?: { createdAt, id }, limit })`. Maps to TanStack Query's `getPreviousPageParam` for infinite queries (scrolling into the past). Replaces the current offset-based `getMessages(conversationId, limit, offset)`. |
| OQ-4 | Optimistic insert on send       | **Yes, optimistic insert** with `syncStatus: 'pending'`, client-generated UUID so the cache entry can be matched to the server response, re-sort to server position on settlement (per CH-5). Matches existing optimistic update patterns in `use-workout-logs.ts`.                                                                                                                                                        |
| OQ-5 | Background/foreground detection | **Platform-agnostic callback approach.** The realtime manager accepts `onForeground` / `onBackground` callbacks. In Tauri: `tauri://focus` and `tauri://blur` window events (Tauri v2). In browser: `document.visibilitychange`. The app wires up the appropriate platform signal at initialization.                                                                                                                       |

## Dependencies

### Upstream (required before this step)

| Dependency                                    | Status   | Notes                                           |
| --------------------------------------------- | -------- | ----------------------------------------------- |
| Chat tables + RLS (Step 21, S001)             | Complete | 4 tables, RLS policies, indices                 |
| Chat adapter methods (Step 21, S008-S010)     | Complete | 13 methods on DataAdapter, both implementations |
| Chat domain types (Step 21, S003)             | Complete | Zod schemas for Conversation, Message, etc.     |
| Sync engine chat registration (Step 21, S006) | Complete | Chat tables in SYNCABLE_TABLES                  |
| Supabase client singleton                     | Complete | `src/lib/supabase.ts`, v2.100.1                 |
| TanStack Query client                         | Complete | `src/lib/query-client.ts`, v5.95.2              |

### Downstream (blocked by this step)

| Dependent            | Step | What it needs                                                                                                                           |
| -------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Chat UI              | 23   | All hooks (useConversations, useMessages, useSendMessage, useTypingIndicator, useUnreadCounts) + Realtime manager for channel lifecycle |
| Media & File Sharing | 24   | `useSendMessage` mutation (media messages go through same send flow)                                                                    |
| Retention & Cleanup  | 25   | No direct dependency, but retention must not delete messages that Realtime has not yet delivered                                        |
