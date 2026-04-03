# Quick Plan: Expose Participant User IDs on Conversation

**Date:** 2026-04-03
**Branch:** fea/chat-ui

---

## Task

Add `participantUserIds: string[]` to the `Conversation` type so `ConversationDetail` can resolve the "other user" in direct conversations for display names and client-side blocking.

## Goal

- `useConversation(id)` and `useConversations()` return participant IDs alongside each conversation
- `ConversationDetail` can call `useUserProfile(otherUserId)` to get a real display name
- `isBlocked(otherUserId)` works for direct conversations

## Approach

### Step 1: Extend the domain type

`src/domain/types/conversation.ts`:
```typescript
export const conversationSchema = syncableEntitySchema.extend({
  type: conversationTypeSchema,
  title: z.string().optional(),
  groupId: entityId.optional(),
  participantUserIds: z.array(entityId).default([]),  // add this
})
```

### Step 2: Update toConversation mapper

Both adapters use a `toConversation(row)` mapper. It needs an optional second argument:
```typescript
function toConversation(row: ConversationRow, participantUserIds: string[] = []): Conversation
```

Locate the mapper in each adapter file.

### Step 3: Supabase adapter -- add participants join

In `getConversations()` -- the existing second query already fetches by conversation IDs. Add a third query (or augment with a join) to fetch `conversation_participants` for those IDs:

```sql
SELECT user_id, conversation_id
FROM conversation_participants
WHERE conversation_id IN ($ids)
  AND left_at IS NULL
```

Group results by `conversation_id`, pass to `toConversation`.

In `getConversation(id)`:
```sql
SELECT user_id FROM conversation_participants
WHERE conversation_id = $id AND left_at IS NULL
```

### Step 4: Tauri adapter -- stop discarding participant data

The Rust command already returns `TauriConversationWithParticipants` with a `participants` array. Currently:
```typescript
return results.map((r) => toConversation(toConversationRowFromTauri(r.conversation)))
//                                                                   ^^^^ discards r.participants
```

Change to pass participant user IDs:
```typescript
return results.map((r) => {
  const userIds = r.participants
    .filter((p) => p.left_at == null)
    .map((p) => p.user_id)
  return toConversation(toConversationRowFromTauri(r.conversation), userIds)
})
```

### Step 5: Use in ConversationDetail

`src/components/chat/conversation-detail.tsx` -- currently:
```typescript
const otherUserId = '' // Cannot derive without participant list
```

After this fix:
```typescript
const otherUserId = useMemo(() => {
  if (!conversation || conversation.type !== 'direct') return ''
  return conversation.participantUserIds.find((id) => id !== currentUserId) ?? ''
}, [conversation, currentUserId])
```

This unblocks `useUserProfile(otherUserId)` and `isBlocked(otherUserId)`.

## Verification

- `bun run build` passes
- `bun run lint` no new errors
- In the browser: conversation header for a direct conversation shows the other user's display name (not "Direct Message")
- Blocking a user in a direct conversation shows the block banner

## Risks

- Supabase adapter: the extra participants query adds one additional DB round-trip per `getConversations()` call. Acceptable for now; can be optimized to a JOIN if needed.
- If any existing code expects `participantUserIds` to be absent, `z.array(entityId).default([])` ensures backward compatibility with an empty array.
- `toConversation` mapper location needs to be verified -- it may be a shared function or inline in each adapter.
