# Bugs Backlog

Known bugs not blocking current work. Add entries via the backlog-add skill.
High-priority bugs should be addressed before starting new features.

<!-- Add new bugs below this line -->

## P9-008: Zod refinements never executed (mapper bypass)

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Priority:** High
**Files:** `src/lib/data-mapper.ts` (toConversation:701, toConversationParticipant:736, toMessage:775)

All mapper functions construct plain object literals and return them typed via structural
compatibility. They never call `.parse()`, so all `.refine()` checks and `.nonnegative()`
constraints are inert/dead code. Either call `schema.parse(result)` in the mappers, add
`.safeParse()` at the adapter boundary, or extract assertion functions for write boundaries.

## P9-009: Missing DELETE trigger for participant hard-deletes

**Added:** 2026-04-04
**Source:** `Context/Reviews/0009-pr71-enhancement-batch-review.md`
**Priority:** Medium
**Files:** `supabase/migrations/` (direct_conversation_pairs cleanup)

Cleanup trigger only fires on UPDATE (left_at NULL to non-NULL). If a participant row
is DELETEd, the pair entry becomes orphaned in `direct_conversation_pairs`, blocking
future direct conversations between those users. Add an AFTER DELETE trigger on
`conversation_participants`, or document that hard-deletes never happen.
