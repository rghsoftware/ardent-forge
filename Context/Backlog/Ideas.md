# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->

## Chat Data Layer Refinements (PR #33 review suggestions)

**Added:** 2026-04-02
**Source:** `Context/Reviews/0001-pr33-chat-data-layer-review.md` (S-1 through S-6)
**Priority:** Low -- nice-to-have before Step 23 (Chat UI)

| # | File | Improvement |
|---|------|-------------|
| S-1 | `conversation.ts` | Add `.refine()` preventing `groupId` on direct conversations |
| S-2 | `message.ts` | Add `.refine()` preventing `senderId` on system messages |
| S-3 | `media.ts` | Add `.nonnegative()` to `durationSeconds` and `fileSizeBytes` |
| S-4 | `conversation.ts` | Add temporal ordering refinement (`leftAt > joinedAt`) |
| S-5 | Supabase migration | CH-2 uniqueness trigger is O(N) per participant INSERT -- consider materialized lookup |
| S-6 | `tauri-adapter.ts` | `findDirectConversation` is N+1 with no error context in loop |
