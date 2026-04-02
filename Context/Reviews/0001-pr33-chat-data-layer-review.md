---
date: 2026-04-02
pr: 33
feature: 004-Chat-Data-Layer
branch: feat/chat-data-layer
base: develop
title: feat(chat): add chat data layer + QA fixes
reviewers: claude-code (automated)
status: resolved
---

# PR #33 Review: feat(chat): add chat data layer + QA fixes

## Scope

**Files:** 31 | **Lines:** +2896 / -108

### Chat data layer (new)
- `supabase/migrations/20260402000002_create_chat_tables.sql` -- Supabase tables + RLS
- `src-tauri/migrations/007_chat.sql` -- SQLite local migration
- `src-tauri/src/commands/chat.rs` -- 10 Tauri commands
- `src-tauri/src/models.rs` -- Rust row structs
- `src/domain/types/conversation.ts`, `message.ts`, `media.ts` -- Domain types (Zod)
- `src/lib/data-adapter.ts` -- Adapter interface additions
- `src/lib/data-mapper.ts` -- 8 new mapping functions
- `src/lib/database.types.ts` -- DB row types
- `src/lib/supabase-adapter.ts` -- 13 Supabase chat methods
- `src/lib/tauri-adapter.ts` -- 13 Tauri chat methods

### QA fixes
- `src-tauri/src/sync/mod.rs`, `pull.rs`, `push.rs`, `queue.rs` -- Sync resilience fixes
- `src/components/event-builder/packing-list.tsx`, `event-template-form.tsx` -- Lint fixes
- 5 test files -- Text casing + auth mock updates
- `src/test/mocks/data-adapter.ts` -- Mock stubs for chat methods

---

## Critical Issues (must fix before merge)

### C-1: Missing INSERT policy on `conversations` table
**File:** `supabase/migrations/20260402000002_create_chat_tables.sql`
**Status:** Fixed
**Resolution:** Added `conversations_insert_authenticated` INSERT policy with `auth.uid() is not null` check.

---

### C-2: `getUnreadCounts` counts user's own messages as unread (adapter behavioral inconsistency)
**File:** `src/lib/supabase-adapter.ts` (getUnreadCounts)
**Status:** Fixed
**Resolution:** Added `.neq('sender_id', userId)` filter to the messages count query, consistent with Tauri adapter behavior.

---

### C-3: `z.url()` returns `URL` object in Zod 4, not a string
**File:** `src/domain/types/media.ts:37-38`
**Status:** Fixed
**Resolution:** Changed `z.url()` to `z.string().url()` for both `thumbnailUrl` and `playbackUrl`.

---

### C-4: SYNCABLE_TABLES guards return `Ok(())` for unrecognized tables -- silent success
**Files:** `src-tauri/src/sync/pull.rs:339-343,441-445`, `src-tauri/src/sync/push.rs:35-39`
**Status:** Fixed
**Resolution:** Changed all three guards to return `Err(...)` with descriptive messages instead of `Ok(())`.

---

### C-5: Missing UPDATE policy on `media_attachments` -- status transitions blocked
**File:** `supabase/migrations/20260402000002_create_chat_tables.sql`
**Status:** Fixed
**Resolution:** Added `media_update_via_message` UPDATE policy gated by conversation participation.

---

## Important Issues (should fix)

### I-1: Zero test coverage for ~1,800 lines of new chat code
**Status:** Task created
**Resolution:** Added as S013 in Steps.md (data mapper tests, ~150 lines following existing pattern).

Also tracked: Supabase adapter tests and Rust `#[cfg(test)]` module needed before Step 23.

---

### I-2: `send_message` Rust command has no participant check
**File:** `src-tauri/src/commands/chat.rs`
**Status:** Fixed
**Resolution:** Added participation check before message insert. Queries `conversation_participants` for active membership of `sender_id`.

---

### I-3: `create_conversation("direct")` allows != 2 participants in Tauri
**File:** `src-tauri/src/commands/chat.rs`
**Status:** Fixed
**Resolution:** Added validation: `if conversation_type == "direct" && participant_user_ids.len() != 2` returns AppError::validation.

---

### I-4: `getMessagesSince` hardcoded limit=1000 silently truncates
**File:** `src/lib/tauri-adapter.ts` (getMessagesSince)
**Status:** Task created
**Resolution:** Added as S014 in Steps.md -- dedicated `get_messages_since` Rust command with SQL-level timestamp filter.

---

### I-5: `toConversationParticipant` uses `joined_at` for both `createdAt` and `updatedAt`
**File:** `src/lib/data-mapper.ts`
**Status:** Task created
**Resolution:** Added as S015 in Steps.md -- use `last_read_at ?? joined_at` as better `updatedAt` approximation.

---

### I-6: `getUnreadCounts` N+1 queries with all-or-nothing error handling
**File:** `src/lib/supabase-adapter.ts`
**Status:** Task created
**Resolution:** Added as S016 in Steps.md -- collect errors with `continue` and return partial results, or batch into single RPC.

---

### I-7: `#[cfg(not(test))]` on allowlist guards -- sync safety never tested
**Files:** `src-tauri/src/sync/pull.rs`, `push.rs`
**Status:** Task created
**Resolution:** Added as S017 in Steps.md -- remove compile-time guard and adjust tests to use allowlisted table names.

---

## Suggestions (track for follow-up)

| # | File | Issue | Status | Resolution |
|---|------|-------|--------|------------|
| S-1 | `conversation.ts` | Add `.refine()` preventing `groupId` on direct conversations | Task created | Added to Ideas backlog |
| S-2 | `message.ts` | Add `.refine()` preventing `senderId` on system messages | Task created | Added to Ideas backlog |
| S-3 | `media.ts` | Add `.nonnegative()` to `durationSeconds` and `fileSizeBytes` | Task created | Added to Ideas backlog |
| S-4 | `conversation.ts` | Add temporal ordering refinement (`leftAt > joinedAt`) | Task created | Added to Ideas backlog |
| S-5 | Supabase migration | CH-2 uniqueness trigger is O(N) per participant INSERT -- consider materialized lookup | Task created | Added to Ideas backlog |
| S-6 | `tauri-adapter.ts` | `findDirectConversation` is N+1 with no error context in loop | Task created | Added to Ideas backlog |

---

## Strengths

- Consistent Rust error handling -- zero `unwrap()`/`expect()` in production code
- `appendOnlyEntitySchema` for messages correctly encodes CH-7 (append-only) at the type level
- `WorkoutSnapshot` cleanly implements CH-4 (frozen snapshot) -- self-contained, no live entity refs
- Data mapper `to*()` functions all wrap errors with entity ID context
- RLS on messages correctly omits UPDATE/DELETE -- CH-7 enforced at DB level
- QA fixes are clean: `return` -> `continue` in sync loop, millis -> seconds timestamp, `useMemo` for packing list
- Mock adapter correctly extended for all 13 chat methods (won't break future component tests)

---

## Resolution Summary
**Resolved at:** 2026-04-02
**Session:** Review resolution for PR #33 chat data layer

| Category | Total | Fixed | Tasks Created | Dismissed | Deferred |
|---|---|---|---|---|---|
| Critical [FIX] | 5 | 5 | -- | -- | -- |
| Important [FIX] | 2 | 2 | -- | -- | -- |
| Important [TASK] | 5 | -- | 5 | -- | -- |
| Suggestions | 6 | -- | 6 | -- | -- |
| **Total** | **18** | **7** | **11** | **0** | **0** |

---

## Related Artifacts

- Feature spec: `Context/Features/004-Chat-Data-Layer/Spec.md`
- Implementation steps: `Context/Features/004-Chat-Data-Layer/Steps.md`
- PR: `rhamilton/ardent-forge#33`
