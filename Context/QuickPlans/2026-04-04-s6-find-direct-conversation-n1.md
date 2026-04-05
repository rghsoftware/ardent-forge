# Quick Plan: S-6 -- Fix findDirectConversation N+1

**Task:** Eliminate N+1 IPC calls in `TauriAdapter.findDirectConversation` and add a dedicated Rust command for optimal single-query lookup.

**Goal:** Replace the current loop of `get_conversation` calls with (A) an immediate TS fix using already-fetched participant data, then (B) a dedicated `find_direct_conversation` Rust command.

## Current Problem

`tauri-adapter.ts:2138` calls `getConversations()` (which already returns `participantUserIds` on each `Conversation`), then loops over direct conversations calling `get_conversation` individually to re-fetch participant data it already has. This is N+1 IPC roundtrips.

## Phase A: TypeScript-Only Fix (1 file)

**File:** `src/lib/tauri-adapter.ts`

Rewrite `findDirectConversation` (line 2138) to filter using the `participantUserIds` already present on the `Conversation` objects returned by `getConversations()`:

```typescript
async findDirectConversation(otherUserId: string): Promise<Conversation | null> {
  const conversations = await this.getConversations()
  return (
    conversations.find(
      (c) =>
        c.type === 'direct' &&
        c.participantUserIds.includes(this.userId) &&
        c.participantUserIds.includes(otherUserId),
    ) ?? null
  )
}
```

**Test update:** `src/lib/__tests__/tauri-adapter.test.ts:2279` -- remove the second `mockResolvedValueOnce` (the `get_conversation` mock) since only one IPC call (`get_conversations`) is made now.

## Phase B: Dedicated Rust Command (3 files)

### B1. `src-tauri/src/commands/chat.rs` -- add `find_direct_conversation`

New command following the `get_conversation` pattern (line 242). Single SQL query:

```sql
SELECT c.id, c."type", c.title, c.group_id, c.created_at, c.updated_at
FROM conversations c
JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
WHERE c."type" = 'direct'
  AND cp1.user_id = ? AND cp1.left_at IS NULL
  AND cp2.user_id = ? AND cp2.left_at IS NULL
LIMIT 1
```

Then fetch participants for the matched conversation (same pattern as `get_conversation`). Return `Option<ConversationWithParticipants>`.

### B2. `src-tauri/src/lib.rs` -- register command

Add `commands::chat::find_direct_conversation` to `generate_handler!` (after line 138).

### B3. `src/lib/tauri-adapter.ts` -- use new command

Update `findDirectConversation` to call `find_direct_conversation` instead of `getConversations`:

```typescript
async findDirectConversation(otherUserId: string): Promise<Conversation | null> {
  const result = await invokeCommand<TauriConversationWithParticipants | null>(
    'find_direct_conversation',
    { user_id: this.userId, other_user_id: otherUserId },
  )
  if (!result) return null
  const userIds = result.participants.filter((p) => p.left_at == null).map((p) => p.user_id)
  return toConversation(toConversationRowFromTauri(result.conversation), userIds)
}
```

### B4. Tests

- Update `tauri-adapter.test.ts` `findDirectConversation` tests to mock `find_direct_conversation` command
- Add test: returns conversation when both users are active participants
- Add test: returns null when no matching direct conversation
- Add test: returns null when other user has left

## Verification

- `bun run test` -- all existing + new tests pass
- `bun run build` -- TypeScript compiles clean
- `cd src-tauri && cargo check` -- Rust compiles clean
- Manual: verify `findDirectConversation` makes exactly 1 IPC call (check devtools network/console)

## Risks

- **Schema mismatch:** The SQL join must produce columns matching `ConversationRow`. Mitigated by using the exact same column list as `get_conversation`.
- **Edge case:** Two direct conversations between the same users (shouldn't happen per domain rules, but `LIMIT 1` handles it safely).

## Execution

Recommend `/impl` -- this is single-domain (Rust backend + TS adapter), no cross-domain coordination needed.
