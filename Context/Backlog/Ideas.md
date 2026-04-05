# Ideas Backlog

Ideas and enhancements for future consideration. Add entries via the backlog-add
skill. Prioritize via the backlog-prioritize skill.

<!-- Add new ideas below this line -->

## Chat Data Layer Refinements (PR #33 review suggestions)

**Added:** 2026-04-02
**Updated:** 2026-04-04 -- S-1 through S-5 resolved in PR #71; S-6 partially addressed (error context added, N+1 remains)
**Source:** `Context/Reviews/0001-pr33-chat-data-layer-review.md` (S-1 through S-6)
**Priority:** Low

| #   | File               | Improvement                                                                            | Status           |
| --- | ------------------ | -------------------------------------------------------------------------------------- | ---------------- |
| S-1 | `conversation.ts`  | Add `.refine()` preventing `groupId` on direct conversations                           | Done (PR #71)    |
| S-2 | `message.ts`       | Add `.refine()` preventing `senderId` on system messages                               | Done (PR #71)    |
| S-3 | `media.ts`         | Add `.nonnegative()` to `durationSeconds` and `fileSizeBytes`                          | Done (PR #71)    |
| S-4 | `conversation.ts`  | Add temporal ordering refinement (`leftAt > joinedAt`)                                 | Done (PR #71)    |
| S-5 | Supabase migration | CH-2 uniqueness trigger is O(N) per participant INSERT -- consider materialized lookup | Done (PR #71)    |
| S-6 | `tauri-adapter.ts` | `findDirectConversation` is N+1 with no error context in loop                          | Partial (PR #71) |

## P9-010: Domain type tests for conversation, message, media

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Priority:** High

The project has domain type tests for exercise, program, session, etc. but none for
conversation, message, or media. The new refinements encode business rules that, if broken,
allow invalid data through silently. Test cases needed: direct conv + groupId (reject),
group conv + groupId (pass), leftAt > joinedAt (pass/reject/equal boundary), system msg

- senderId (reject), negative duration/fileSize (reject), zero values (pass).

## P9-011: Test for getUnreadCounts batching behavior

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Priority:** Medium

No existing test for `getUnreadCounts`. The behavioral change from sequential to
`Promise.allSettled` changes error semantics. Test cases: all succeed, one fails
(partial), empty participations, null last_read_at.
