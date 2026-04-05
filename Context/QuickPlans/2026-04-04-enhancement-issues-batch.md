# Quick Plan: Batch Enhancement Issues

**Task:** Address all open GitHub issues labeled "enhancement" (#31, #39-#42, #46-#49, #51)
**Goal:** Close out review-sourced polish, perf, and small feature items in one session
**Branch:** `chore/enhancements` (from `develop`)

---

## Pre-Flight: Already Resolved Items

Research shows the following items from Group 4 (#42/#49) and Group 5 (#51) are **already implemented**:

| Issue Item                                        | Status | Evidence                                             |
| ------------------------------------------------- | ------ | ---------------------------------------------------- |
| S009: Extract TYPING_EXPIRY_MS/TYPING_DEBOUNCE_MS | Done   | `realtime-manager.ts` L17/L20                        |
| S010: Extract toMessageFromBroadcast mapper       | Done   | `realtime-schemas.ts` L53-62                         |
| S011: Remove empty SUBSCRIBED branch              | Done   | Branch does not exist in current code                |
| S013: Log error before visibilitychange fallback  | Done   | `foreground-detector.ts` L115-123                    |
| S015: Extract MessagePaginationOptions interface  | Done   | `data-adapter.ts` L97-102                            |
| S016: Flatten .then() to async/await              | Done   | `foreground-detector.ts` uses async/await throughout |
| S017: Add z.string().max(200) to user_name        | Done   | `realtime-schemas.ts` L29                            |
| S018: Fix getSession() comment                    | Done   | Comment does not exist; auth uses useAuth()          |
| S019: Migrate useBlockedUsers to Zustand          | Done   | `use-blocked-users.ts` wraps `useBlockedUsersStore`  |

**Action:** Close issues #42 and #49 (all items resolved). Update #51 to remove S019 (done).

---

## Remaining Work

### Wave 1 -- Parallel (no file conflicts)

#### Agent A: Zod Refinements (Issues #40/#47)

**Files:** `src/domain/types/conversation.ts`, `src/domain/types/message.ts`, `src/domain/types/media.ts`

1. `conversation.ts` -- Add `.refine()` preventing `groupId` on direct conversations:
   - When `type === 'direct'`, `groupId` must be undefined
   - Apply to `conversationSchema` (L15-21)

2. `conversation.ts` -- Add temporal ordering refinement:
   - `leftAt > joinedAt` when both are present
   - Apply to `conversationParticipantSchema` (L27-35)

3. `message.ts` -- Add `.refine()` preventing `senderId` on system messages:
   - When `messageType === 'system'`, `senderId` must be undefined
   - Apply to `messageSchema` (L93-100)

4. `media.ts` -- Add `.nonnegative()` to numeric fields:
   - `durationSeconds: z.number().int().nonnegative().optional()`
   - `fileSizeBytes: z.number().int().nonnegative().optional()`
   - Apply to `mediaAttachmentSchema` (L30-43)

**Verification:** `bun run build` passes (type check); existing tests pass.

#### Agent B: Realtime Remaining Polish (Issues #42/#49 leftovers)

**Files:** `src/lib/realtime-manager.ts`

1. S012: Simplify `clearAllTyping` iteration (L113-120) -- review and simplify if possible
2. S014: `broadcastTyping` `.catch(() => {})` at L289-296 swallows errors silently. Per project error-handling conventions, add `[realtime-manager]` prefixed logging.

**Verification:** `bun run build` passes.

#### Agent C: Chat UI -- Archive Button (Issue #51, remaining item S020)

**Files:** `src/components/chat/conversation-header.tsx`, parent component(s)

1. Investigate whether `onArchive` prop is wired to real functionality in the parent
2. If archive is not implemented upstream, remove the "Archive" menu option from the dropdown (both group and direct branches) to avoid a no-op button
3. If archive IS implemented, verify it works and close S020

**Verification:** Archive button either works or is removed. No silent no-ops.

#### Agent D: Event Route + Badge Navigation (Issue #31)

**Files:** `src/components/event-builder/event-countdown-badge.tsx`, new `src/routes/_authenticated/events.$templateId.tsx`

1. Create `src/routes/_authenticated/events.$templateId.tsx` with a minimal event detail page (placeholder content is fine -- the route just needs to exist)
2. Update `event-countdown-badge.tsx`:
   - Remove `_templateId` destructuring rename, use `templateId` directly
   - Update `handleNavigate` to navigate to `/events/$templateId`
   - Remove the TODO comment
3. Follow existing route patterns (see `_authenticated/groups.$groupId.tsx` as reference)

**Verification:** `bun run build` passes; navigating from badge reaches the new route.

### Wave 2 -- Sequential (shared adapter files)

#### Agent E: getUnreadCounts N+1 Fix (Issues #39/#46)

**Files:** `src/lib/supabase-adapter.ts`

Current state (L2082-2122): loops over participations, fires one COUNT query per conversation.

**Approach -- batch with single query:**

- Build a single query that counts unread messages per conversation using `.in('conversation_id', conversationIds)` with group-by, or
- Use a Supabase RPC function for server-side aggregation
- Preserve the existing behavior: exclude own messages, handle null `last_read_at` (count all)
- Keep `console.warn` + partial results on per-conversation errors

**Verification:** `bun run build` passes; manual test confirms unread counts still display correctly.

#### Agent F: Chat Query Optimizations (Issues #41/#48)

**Files:** `src/lib/tauri-adapter.ts`, `supabase/migrations/` (new migration)

1. **findDirectConversation N+1** (`tauri-adapter.ts` L2129-2148):
   - Currently fetches all conversations, then calls `get_conversation` per direct conv
   - Add error context to the loop (wrap in try/catch with `[tauri-adapter]` prefix)
   - Consider a batched approach if a Rust command supports it, otherwise document the limitation

2. **CH-2 uniqueness trigger O(N)** (migration SQL):
   - Current trigger calls `direct_conversation_pair()` on every existing direct conversation per INSERT
   - Create a new migration that adds a materialized lookup (e.g., `direct_conversation_pairs` table or a functional index)
   - Ensure the trigger uses the index for O(1) lookup instead of full scan

**Verification:** `bun run build` passes; `npx supabase db push` applies cleanly.

---

## Post-Implementation

1. Close duplicate issues: #42 (dup of #49), #41 (dup of #48), #40 (dup of #47), #39 (dup of #46)
2. Close resolved issues with commit references
3. Run `bun run build && bun run test` for final validation

---

## Risks

| Risk                                                  | Mitigation                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Zod `.refine()` breaks existing data parsing          | Test with real data; refinements only reject clearly invalid combinations |
| CH-2 migration changes break uniqueness enforcement   | Test with local Supabase; verify trigger still prevents duplicate directs |
| getUnreadCounts batch query returns different results | Compare output against current N+1 approach with test data                |
| Event route placeholder is too bare                   | Minimal is fine -- issue only asks for the route to exist for navigation  |
