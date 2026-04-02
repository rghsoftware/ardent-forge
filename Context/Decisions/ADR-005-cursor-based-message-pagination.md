# ADR-005: Cursor-Based Message Pagination

**Status:** Proposed
**Date:** 2026-04-02
**Context:** Feature 005 (Supabase Realtime Integration, Step 22)

## Decision

Replace the offset-based `getMessages(conversationId, limit, offset)` adapter method with cursor-based pagination: `getMessages(conversationId, { before?: string; limit: number })`.

## Context

The `DataAdapter` interface defines `getMessages` with offset-based pagination (`limit` + `offset`). This was implemented in Step 21 across the interface, both adapters (Supabase, Tauri), the mock adapter, and the Rust Tauri command. No consumers (hooks, components, or tests) call this method yet.

Step 22 introduces TanStack Query infinite queries for chat messages, where users scroll up to load older messages. This is the first and only consumer of `getMessages`.

## Problem

Offset-based pagination is unstable in high-insert-rate tables like chat messages. When new messages are inserted while a user is scrolling through history:
- The offset shifts, causing messages to appear twice or be skipped entirely.
- `OFFSET` performance degrades linearly with depth (Postgres scans and discards `offset` rows).
- TanStack Query's infinite query model expects stable page boundaries -- offset drift breaks the `getPreviousPageParam` contract.

## Options Considered

### Option A: Keep offset-based, add dedup in hook
- Deduplicate by message ID in the hook's `select` transform.
- Simple to implement, no adapter change.
- Does not fix the skip problem (users miss messages silently).
- `OFFSET` performance degrades at scale.

### Option B: Cursor-based with `before` timestamp
- `getMessages(conversationId, { before?: string; limit })` where `before` is an ISO timestamp.
- Stable under inserts: the cursor is an immutable property of existing messages.
- Matches the existing activity feed pattern (`useInfiniteQuery` with keyset cursor).
- Constant-time query performance (index scan on `(conversation_id, created_at)`).

### Option C: Cursor-based with `before` composite key `(created_at, id)`
- Same as Option B but uses `(created_at, id)` compound cursor for tie-breaking.
- Handles the (rare) case of two messages with the same `created_at`.
- Slightly more complex cursor passing.

## Choice

**Option B with Option C as a SQL-level guard.** The adapter method accepts `before` as a single ISO timestamp (simpler API), but the SQL query uses `(created_at, id)` compound ordering internally to handle ties. If tie-breaking is never triggered (extremely likely given timestamptz precision), the simpler single-field cursor behaves identically.

## Consequences

### Positive
- Stable pagination under concurrent inserts (no duplicates, no skips).
- Constant query performance regardless of scroll depth.
- Aligns with the established activity feed infinite query pattern.
- TanStack Query's `getPreviousPageParam` works reliably.

### Negative
- Breaking change to `DataAdapter` interface, both adapter implementations, mock adapter, and Rust command.
- Offset-based random access is lost (cannot jump to "page N"). Not needed for chat.

### Migration
- Zero existing callers -- the change is safe to make in place with no deprecation.
- The `getMessagesSince` method (catch-up query) is unaffected.
