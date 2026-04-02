# Spec: Chat Data Layer (Step 21)

**Feature:** 004-Chat-Data-Layer
**Status:** Draft
**Created:** 2026-04-02
**Source:** `docs/implementation-plan.md` Step 21, `docs/12-prd-chat.md`, `docs/06-invariants.md` CH-1..CH-8, `docs/08-erd.md`

---

## Overview

Build the persistence layer for the chat domain: database tables, RLS policies, Tauri commands, Zod schemas, data adapter interface, and sync engine extension. No UI in this step -- pure data plumbing that subsequent steps (22-25) build upon.

## Problem Statement

The app currently has no messaging infrastructure. Steps 22-25 (Realtime, Conversation UI, Media/File sharing, Retention) all depend on having a working data layer for conversations, messages, participants, and media attachments across both Supabase and SQLite backends. This step establishes that foundation.

## User Stories

1. **As a user (online)**, I can create a direct conversation with another user so that we can exchange messages stored in Supabase.
2. **As a user (offline via Tauri)**, I can compose and send messages that queue locally and sync when connectivity returns.
3. **As a user**, I can only see conversations and messages I actively participate in (CH-1 enforced at the database level).
4. **As a user**, I cannot create duplicate direct conversations with the same person (CH-2 enforced by unique constraint).
5. **As a coach**, when I share a workout via chat, the recipient sees a frozen snapshot that cannot modify the original log (CH-4).
6. **As a developer**, I can use a consistent adapter interface (`ChatAdapter` facet) for all chat operations regardless of backend (Supabase or Tauri).

## Requirements

### Must Have (P0)

| ID | Requirement | Invariant | Verification |
|----|-------------|-----------|-------------|
| M1 | Create `conversations`, `conversation_participants`, `messages`, `media_attachments` tables in Supabase via migration | -- | Migration applies cleanly |
| M2 | RLS policies enforce conversation membership on all CRUD operations | CH-1 | Policy tests: non-participant queries return empty |
| M3 | Direct conversation uniqueness via unique partial index on canonical participant pair | CH-2 | Duplicate insert rejected |
| M4 | Messages are append-only: no UPDATE/DELETE policies for regular users | CH-7 | RLS blocks update/delete |
| M5 | Matching SQLite tables in Tauri migration with `sync_status` column on `messages` | -- | Migration runs, schema matches |
| M6 | All 10 Tauri commands implemented (CRUD for conversations, messages, participants, media) | -- | Commands invoke and return expected types |
| M7 | `ChatAdapter` facet defined in `src/domain/` or `src/lib/data-adapter.ts` with all 13 methods | -- | TypeScript compiles |
| M8 | Supabase adapter implements all `ChatAdapter` methods | -- | Unit/integration tests pass |
| M9 | Tauri adapter implements all `ChatAdapter` methods via Tauri commands | -- | Adapter calls invoke correct commands |
| M10 | Zod schemas for Conversation, Message, MediaAttachment, WorkoutSnapshot and all sub-types | -- | Schema validation round-trips |
| M11 | Chat tables added to `SYNCABLE_TABLES` in Rust sync engine | -- | Sync loop includes chat tables |
| M12 | Offline message queueing: pending -> synced/failed state machine | -- | Messages with `sync_status = 'pending'` push on reconnect |
| M13 | Sync pull fetches new messages on reconnect (catch-up) | -- | Pull query returns messages newer than `last_pull_at` |
| M14 | Domain types (`src/domain/`) have zero React/framework dependencies | -- | Import analysis |

### Should Have (P1)

| ID | Requirement | Invariant | Verification |
|----|-------------|-----------|-------------|
| S1 | `media_attachments` includes `original_filename` and `mime_type` columns (PRD extension beyond ERD) | -- | Columns exist in both Postgres and SQLite |
| S2 | `media_type` CHECK includes `'file'` in addition to `'video'` and `'image'` (PRD spec) | -- | CHECK constraint allows 'file' |
| S3 | Database indices for performance: `idx_messages_conversation_created`, `idx_conversations_updated`, `idx_conversation_participants_user` (WHERE left_at IS NULL) | CH-5 | Indices created |
| S4 | Row types in `database.types.ts` and bidirectional mappers in `data-mapper.ts` | -- | Mappers compile and round-trip |
| S5 | Mock adapter updated with all new methods | -- | `createMockAdapter()` returns full interface |

### Won't Have (this step)

| ID | Exclusion | Reason |
|----|-----------|--------|
| W1 | Conversation UI or React components | Step 23 |
| W2 | Supabase Realtime / Broadcast channels | Step 22 |
| W3 | Media upload flows or Cloudflare Stream integration | Step 24 |
| W4 | Retention / cleanup Edge Function | Step 25 |
| W5 | Push notifications | Deferred per PRD |
| W6 | Message edit or delete | Deferred per PRD (CH-7) |
| W7 | Typing indicators | Step 22 |

## Testable Assertions

| ID | Assertion | How to Test |
|----|-----------|------------|
| TA-1 | Supabase migration creates all 4 tables with correct columns and constraints | `npx supabase db push` succeeds; `\d` shows expected schema |
| TA-2 | Unauthenticated requests to all chat tables return 401/empty | Supabase client without auth token queries chat tables |
| TA-3 | User A cannot read messages in a conversation they don't participate in | Insert message as User B, SELECT as User A returns 0 rows |
| TA-4 | Creating two direct conversations between the same pair fails on second insert | INSERT two `conversation_participants` rows with same pair in canonical order; unique violation on second |
| TA-5 | User with `left_at IS NOT NULL` cannot INSERT new messages | RLS blocks the insert |
| TA-6 | SQLite migration creates all tables with `sync_status` on messages | Tauri command `get_messages` returns rows with sync_status field |
| TA-7 | All 10 Tauri commands return expected shapes | Integration test per command |
| TA-8 | Zod schemas parse valid payloads and reject invalid ones | Unit tests with valid/invalid fixtures |
| TA-9 | WorkoutSnapshot schema serializes from existing workout types and deserializes back | Round-trip test using real workout log data |
| TA-10 | Sync engine pushes pending messages when connectivity restored | Set `sync_status = 'pending'`, trigger sync, verify Supabase has the message and local status is `'synced'` |
| TA-11 | Sync engine pulls new messages on reconnect | Insert message in Supabase, trigger pull, verify SQLite has the message |
| TA-12 | `media_attachments` only stores metadata, no binary data | Column inspection: no BLOB columns |

## Open Questions

| ID | Question | Impact | Resolution |
|----|----------|--------|------------|
| OQ-1 | PRD defines 5 message types (`text`, `workout`, `media`, `file`, `system`) but ERD defines 4 (`text`, `workout`, `media`, `system`). Should `file` be a separate type or a sub-case of `media`? | CHECK constraint definition | **Propose:** Follow PRD -- include `file` as a distinct message type since it has different upload/download semantics |
| OQ-2 | PRD adds `original_filename` and `mime_type` to `media_attachments` not in ERD. Include now? | Schema completeness | **Propose:** Yes, include both columns now to avoid a follow-up migration |
| OQ-3 | PRD lists `media_type` as `video | image` in ERD but adds `file` for document attachments. Should `media_type` CHECK include `'file'`? | CHECK constraint | **Propose:** Yes, add `'file'` to align with PRD |
| OQ-4 | Sharing tables exist in SQLite/sync_metadata but not in `SYNCABLE_TABLES`. Should chat tables follow the same partial pattern or be fully registered? | Sync completeness | **Propose:** Fully register in `SYNCABLE_TABLES` -- chat needs real offline support |
| OQ-5 | Should `sender_id` on `messages` be nullable (for system messages) or use a sentinel value? | Schema design | **Propose:** Nullable as specified in ERD -- system messages have no sender |

## Dependencies

### Upstream (required before this step)

| Dependency | Status | Notes |
|-----------|--------|-------|
| Sharing tables (groups, connections) | Complete | Step 14-15 delivered `groups`, `group_members`, `direct_connections` |
| Sync engine (Steps 8-9) | Complete | Push/pull loop operational |
| Data adapter pattern | Complete | Interface + both implementations exist |

### Downstream (blocked by this step)

| Dependent | Step | What it needs |
|-----------|------|---------------|
| Supabase Realtime Integration | 22 | Chat tables + adapter methods |
| Conversation UI | 23 | Adapter methods + Zod types |
| Media & File Sharing | 24 | `media_attachments` table + adapter |
| Retention & Cleanup | 25 | Chat tables exist |
