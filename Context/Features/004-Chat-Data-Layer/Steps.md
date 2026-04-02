# Steps: Chat Data Layer (Step 21)

**Feature:** 004-Chat-Data-Layer
**Created:** 2026-04-02
**Spec:** [Spec.md](./Spec.md)
**Execution:** `/build` (tasks are isolated by stack, no real-time coordination needed)

---

## Team Composition

| Agent | Role | Stack |
|-------|------|-------|
| `db-engineer` | Supabase migration, RLS policies, indices | SQL / Supabase |
| `rust-engineer` | SQLite migration, Row structs, Tauri commands, sync engine | Rust / Tauri |
| `domain-engineer` | Zod schemas, DB row types, data mappers, adapter interface, adapter implementations, mock adapter | TypeScript |
| `quality-engineer` | Validation of all deliverables against Spec testable assertions | All |

---

## Wave 1: Foundation (parallel)

### S001: Supabase Migration -- Chat Tables, RLS, Indices
**Agent:** `db-engineer`
**Files:** `supabase/migrations/20260402000002_create_chat_tables.sql`
**Depends on:** none
**Blocked by:** none

Create a single Supabase migration with:

**Tables (follow existing migration conventions -- lowercase SQL, inline FKs, `gen_random_uuid()` PKs):**

1. `conversations`
   - `id uuid primary key default gen_random_uuid()`
   - `type text not null` CHECK IN (`'direct'`, `'group'`)
   - `title text` (nullable, for group conversations)
   - `group_id uuid references groups(id) on delete set null` (nullable)
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

2. `conversation_participants`
   - `id uuid primary key default gen_random_uuid()`
   - `conversation_id uuid not null references conversations(id) on delete cascade`
   - `user_id uuid not null references auth.users(id) on delete cascade`
   - `last_read_at timestamptz`
   - `is_archived boolean not null default false`
   - `joined_at timestamptz not null default now()`
   - `left_at timestamptz` (nullable)
   - UNIQUE `(conversation_id, user_id)`
   - Unique partial index for direct conversations (CH-2): canonical ordering of participant pair

3. `messages`
   - `id uuid primary key default gen_random_uuid()`
   - `conversation_id uuid not null references conversations(id) on delete cascade`
   - `sender_id uuid references auth.users(id) on delete set null` (nullable for system messages)
   - `message_type text not null` CHECK IN (`'text'`, `'workout'`, `'media'`, `'file'`, `'system'`)
   - `content text` (nullable -- media/file messages may have no text)
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

4. `media_attachments`
   - `id uuid primary key default gen_random_uuid()`
   - `message_id uuid not null references messages(id) on delete cascade`
   - `provider text not null` CHECK IN (`'cloudflare_stream'`, `'supabase_storage'`)
   - `provider_asset_id text`
   - `media_type text not null` CHECK IN (`'video'`, `'image'`, `'file'`)
   - `original_filename text`
   - `mime_type text`
   - `thumbnail_url text`
   - `playback_url text`
   - `duration_seconds integer`
   - `file_size_bytes bigint`
   - `status text not null default 'processing'` CHECK IN (`'processing'`, `'ready'`, `'failed'`)
   - `created_at timestamptz not null default now()`
   - `updated_at timestamptz not null default now()`

**RLS policies (all four tables get `alter table xxx enable row level security`):**

| Table | Op | Policy Name | Rule |
|-------|----|------------|------|
| `conversations` | SELECT | `conversations_select_participant` | EXISTS active participant row for `auth.uid()` |
| `conversation_participants` | SELECT | `cp_select_fellow_participant` | User is active participant in same conversation |
| `conversation_participants` | INSERT | `cp_insert_self_or_group_member` | `user_id = auth.uid()` OR user is active participant adding to a group conversation |
| `messages` | SELECT | `messages_select_participant` | User is active participant in message's conversation |
| `messages` | INSERT | `messages_insert_active_participant` | User is active participant (`left_at IS NULL`) AND `sender_id = auth.uid()` |
| `messages` | UPDATE | NONE | CH-7: no update policy = append-only |
| `messages` | DELETE | NONE | CH-7: no delete policy = append-only |
| `media_attachments` | SELECT | `media_select_via_message` | User is participant in parent message's conversation |
| `media_attachments` | INSERT | `media_insert_via_message` | User is participant in parent message's conversation |

**Indices:**
- `idx_messages_conversation_created` on `messages(conversation_id, created_at)`
- `idx_conversations_updated` on `conversations(updated_at desc)`
- `idx_cp_user_active` on `conversation_participants(user_id)` WHERE `left_at IS NULL`
- `idx_cp_conversation` on `conversation_participants(conversation_id)`
- `idx_media_message` on `media_attachments(message_id)`

**Triggers:**
- `set_conversations_updated_at` (reuse existing `update_updated_at_column()`)
- `set_messages_updated_at`
- `set_media_attachments_updated_at`

**Comments:** Add `comment on table` for all four tables.

**Acceptance:**
- Migration applies via `npx supabase db push`
- `\d conversations`, `\d messages`, etc. show expected schema
- TA-1, TA-2, TA-3, TA-4, TA-5 from Spec

---

### S002: SQLite Migration -- Chat Tables + Sync Metadata
**Agent:** `rust-engineer`
**Files:** `src-tauri/migrations/007_chat.sql`
**Depends on:** none
**Blocked by:** none

Create SQLite migration following existing conventions (`001_initial_schema.sql` pattern):

**Tables (mirror Postgres schema with SQLite type mappings):**
- `id text primary key` (UUID strings)
- Timestamps as `integer` (epoch seconds)
- Booleans as `integer` (0/1)
- All FKs as `text` (no enforced FK constraints in existing pattern)
- `messages` gets additional `sync_status text not null default 'synced'` CHECK IN (`'pending'`, `'synced'`, `'failed'`) -- SQLite-only column

**Sync metadata registration:**
```sql
insert or ignore into sync_metadata (table_name) values
  ('conversations'),
  ('conversation_participants'),
  ('messages'),
  ('media_attachments');
```

**Acceptance:**
- Migration runs on app startup without errors
- All four tables queryable
- `sync_status` column exists on `messages` only
- TA-6 from Spec

---

### S003: Zod Schemas -- Chat Domain Types
**Agent:** `domain-engineer`
**Files:**
- `src/domain/types/conversation.ts`
- `src/domain/types/message.ts`
- `src/domain/types/media.ts`
- `src/domain/types/index.ts` (update barrel export)
**Depends on:** none
**Blocked by:** none

Follow existing patterns from `exercise.ts`, `event.ts`, `sharing.ts`:
- Enums as `z.enum([...])` with paired `type` export
- Entity schemas extending `syncableEntitySchema` (conversations, participants, media) or `appendOnlyEntitySchema` (messages -- immutable)
- `entityId` for all ID and FK fields
- `isoDateTime` for all timestamps
- Optional fields use `.optional()`

**conversation.ts:**
```
conversationTypeSchema = z.enum(['direct', 'group'])
conversationSchema = syncableEntitySchema.extend({
  type: conversationTypeSchema,
  title: z.string().optional(),
  groupId: entityId.optional(),
})
conversationParticipantSchema = syncableEntitySchema.extend({
  conversationId: entityId,
  userId: entityId,
  lastReadAt: isoDateTime.optional(),
  isArchived: z.boolean(),
  joinedAt: isoDateTime,
  leftAt: isoDateTime.optional(),
})
```

**message.ts:**
```
messageTypeSchema = z.enum(['text', 'workout', 'media', 'file', 'system'])
syncStatusSchema = z.enum(['pending', 'synced', 'failed'])  // local-only
workoutSnapshotSchema = z.object({...})  // self-contained, reuses existing exercise/set schemas
messageSchema = appendOnlyEntitySchema.extend({
  conversationId: entityId,
  senderId: entityId.optional(),  // null for system messages
  messageType: messageTypeSchema,
  content: z.string().optional(),
  syncStatus: syncStatusSchema.optional(),  // only present in Tauri adapter
})
```

**media.ts:**
```
mediaProviderSchema = z.enum(['cloudflare_stream', 'supabase_storage'])
mediaTypeSchema = z.enum(['video', 'image', 'file'])
mediaStatusSchema = z.enum(['processing', 'ready', 'failed'])
mediaAttachmentSchema = syncableEntitySchema.extend({
  messageId: entityId,
  provider: mediaProviderSchema,
  providerAssetId: z.string().optional(),
  mediaType: mediaTypeSchema,
  originalFilename: z.string().optional(),
  mimeType: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  playbackUrl: z.string().url().optional(),
  durationSeconds: z.number().int().optional(),
  fileSizeBytes: z.number().int().optional(),
  status: mediaStatusSchema,
})
```

**WorkoutSnapshot:** Compose from existing schemas. A self-contained object embedding exercise info + logged sets, suitable for JSON serialization into `messages.content`. Check existing `workout-log.ts`, `exercise.ts`, `set-scheme.ts` for reusable sub-schemas.

**Acceptance:**
- All schemas compile
- Valid payloads parse, invalid reject
- Zero React/framework imports
- TA-8, TA-9, TA-14 from Spec

---

## Wave 2: Rust Layer (depends on S002)

### S004: Rust Row Structs
**Agent:** `rust-engineer`
**Files:** `src-tauri/src/models.rs`
**Depends on:** S002
**Blocked by:** S002

Add Row structs following existing patterns in `models.rs`:
- `ConversationRow`, `ConversationParticipantRow`, `MessageRow`, `MediaAttachmentRow`
- All derive `Debug, Serialize, Deserialize, sqlx::FromRow, Clone`
- Timestamps: `Option<i64>` with `serialize_optional` / `i64` with `serialize_required`
- Booleans: `i64` (0/1) for `is_archived`
- `sync_status: Option<String>` on `MessageRow` (SQLite-only)
- JSON columns (`content` on messages when it contains WorkoutSnapshot): `Option<String>`

**Acceptance:**
- Compiles
- Struct fields match SQLite schema from S002

---

### S005: Tauri Commands -- Chat Operations
**Agent:** `rust-engineer`
**Files:**
- `src-tauri/src/commands/chat.rs` (new)
- `src-tauri/src/commands/mod.rs` (add `pub mod chat;`)
- `src-tauri/src/lib.rs` (register commands in `generate_handler!`)
**Depends on:** S004
**Blocked by:** S004

Implement 10 commands following patterns from `programs.rs` and `workout_logs.rs`:

| Command | Pattern | Notes |
|---------|---------|-------|
| `create_conversation` | Transaction (insert conversation + participants) | Generate UUID, `now_unix()` timestamps, accept participant user_ids |
| `get_conversations` | Query + JOIN | Order by `updated_at DESC`, include participant info |
| `get_conversation` | Single + JOIN | Return conversation with participants |
| `send_message` | Insert | Set `sync_status = 'pending'`, generate UUID |
| `get_messages` | Paginated query | Filter by conversation_id, order by `created_at`, support limit/offset |
| `update_last_read` | Update | Set `last_read_at = now_unix()` for user+conversation |
| `get_unread_counts` | Aggregation | COUNT messages WHERE `created_at > last_read_at` per conversation |
| `leave_conversation` | Update | Set `left_at = now_unix()` |
| `save_media_attachment` | Upsert | INSERT OR REPLACE pattern |
| `toggle_archive` | Update | Toggle `is_archived` (0->1, 1->0) |

All commands: `Result<T, AppError>`, `pool: State<'_, SqlitePool>`, input validation.

**Acceptance:**
- All 10 commands compile and register
- TA-7 from Spec

---

### S006: Sync Engine Extension
**Agent:** `rust-engineer`
**Files:** `src-tauri/src/sync/mod.rs`
**Depends on:** S002
**Blocked by:** S002

Add chat tables to `SYNCABLE_TABLES`:
```rust
pub const SYNCABLE_TABLES: &[&str] = &[
    // ... existing 15 tables ...
    "conversations",
    "conversation_participants",
    "messages",
    "media_attachments",
];
```

The existing push/pull infrastructure handles these automatically:
- **Push:** `json_object()` serialization works for any table shape. Messages with `sync_status = 'pending'` will be pushed when `updated_at > last_push_at`.
- **Pull:** `coerce_value` handles timestamp/boolean/JSON coercion. LWW conflict resolution applies.
- **Queue:** Offline queue already supports INSERT/UPDATE/DELETE for any registered table.

**Note on `sync_status`:** The `sync_status` column is SQLite-only (not in Postgres). The push mechanism uses `pragma_table_info` to discover columns, so it will include `sync_status` in the JSON payload. Supabase will ignore unknown columns on upsert (`resolution=merge-duplicates` only updates known columns). On pull, Postgres rows won't have `sync_status`, so SQLite's DEFAULT `'synced'` will apply. This is the correct behavior -- pulled messages are already synced.

**Acceptance:**
- Chat tables appear in sync loop
- TA-10, TA-11 from Spec

---

## Wave 3: TypeScript Adapter Layer (depends on S001, S003, S005)

### S007: Database Row Types + Data Mappers
**Agent:** `domain-engineer`
**Files:**
- `src/lib/database.types.ts`
- `src/lib/data-mapper.ts`
**Depends on:** S003
**Blocked by:** S003

**Row interfaces in `database.types.ts`:**
- `ConversationRow`: `id: string`, `type: string`, `title: string | null`, `group_id: string | null`, `created_at: string`, `updated_at: string`
- `ConversationParticipantRow`: all columns, `is_archived: boolean`, timestamps as `string`
- `MessageRow`: all columns, `sync_status?: string` (optional -- only from Tauri)
- `MediaAttachmentRow`: all columns

**Bidirectional mappers in `data-mapper.ts`:**
- `toConversation` / `fromConversation`
- `toConversationParticipant` / `fromConversationParticipant`
- `toMessage` / `fromMessage`
- `toMediaAttachment` / `fromMediaAttachment`

Follow existing patterns:
- Zod `.parse()` for enum/JSON columns (not `as` casts)
- `row.field ?? undefined` for nullable -> optional
- `domain.field ?? null` for optional -> nullable
- Try/catch with enriched error messages for complex mappers

**Acceptance:**
- Compiles
- Round-trip: `fromXxx(toXxx(row))` preserves data
- TA-8 (schema validation at mapper boundary)

---

### S008: DataAdapter Interface Extension
**Agent:** `domain-engineer`
**Files:** `src/lib/data-adapter.ts`
**Depends on:** S003
**Blocked by:** S003

Add chat methods to the `DataAdapter` interface under a new `// ── Chat ──` section header. Follow existing grouping pattern. 13 methods:

```typescript
// ── Chat ──────────────────────────────────────────────
createConversation(type: ConversationType, participantIds: string[], title?: string, groupId?: string): Promise<Conversation>
getConversations(): Promise<Conversation[]>
getConversation(id: string): Promise<Conversation | null>
findDirectConversation(otherUserId: string): Promise<Conversation | null>
sendMessage(conversationId: string, messageType: MessageType, content?: string): Promise<Message>
getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]>
getMessagesSince(conversationId: string, since: string): Promise<Message[]>
updateLastRead(conversationId: string): Promise<void>
getUnreadCounts(): Promise<Map<string, number>>
addParticipant(conversationId: string, userId: string): Promise<ConversationParticipant>
leaveConversation(conversationId: string): Promise<void>
toggleArchive(conversationId: string): Promise<void>
saveMediaAttachment(messageId: string, attachment: Omit<MediaAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<MediaAttachment>
```

Add any needed composite types (e.g., `ConversationWithParticipants`) above the interface if methods need to return enriched shapes.

**Acceptance:**
- TypeScript compiles
- Interface is 81 methods total (68 existing + 13 new)

---

### S009: Supabase Adapter Implementation
**Agent:** `domain-engineer`
**Files:** `src/lib/supabase-adapter.ts`
**Depends on:** S001, S007, S008
**Blocked by:** S001, S007, S008

Implement all 13 chat methods in `SupabaseAdapter`. Follow existing patterns:
- `this.client.from('table').select('*')` for reads
- `.insert()` / `.update()` for writes
- Cast rows via `toXxx()` mappers
- `getCurrentUserId()` for auth context
- `findDirectConversation`: query `conversation_participants` for both users in a `'direct'` conversation
- `getUnreadCounts`: use a Supabase RPC or a query joining `conversation_participants.last_read_at` against `messages.created_at`

**Acceptance:**
- All 13 methods implemented
- Compiles
- TA-3 (RLS enforced at Supabase level)

---

### S010: Tauri Adapter Implementation
**Agent:** `domain-engineer`
**Files:** `src/lib/tauri-adapter.ts`
**Depends on:** S005, S007, S008
**Blocked by:** S005, S007, S008

Implement all 13 chat methods in `TauriAdapter`. Follow existing patterns:
- `invoke<ReturnType>('command_name', { args })` for each method
- Map Row responses through `toXxx()` mappers
- `sendMessage` should set local `syncStatus: 'pending'`

**Acceptance:**
- All 13 methods implemented
- Compiles
- Correct command names match S005

---

### S011: Mock Adapter Update
**Agent:** `domain-engineer`
**Files:** `src/test/mocks/data-adapter.ts`
**Depends on:** S008
**Blocked by:** S008

Add all 13 new methods to `createMockAdapter()` with `vi.fn()` defaults:
- List methods return `[]`
- Single-entity methods return `null`
- Void methods return `undefined`
- `getUnreadCounts` returns `new Map()`

**Acceptance:**
- `createMockAdapter()` returns full interface without TS errors
- TA-5 from Spec (mock updated)

---

## Wave 4: Validation

### S012: Quality Validation
**Agent:** `quality-engineer`
**Files:** Read-only inspection of all deliverables
**Depends on:** S001-S011
**Blocked by:** S001-S011

Validate against all 12 testable assertions from Spec:

| TA | Check |
|----|-------|
| TA-1 | Supabase migration has correct tables, columns, constraints |
| TA-2 | RLS enabled on all four tables, no anonymous access policies |
| TA-3 | SELECT policies require active participation |
| TA-4 | Direct conversation uniqueness constraint exists |
| TA-5 | No UPDATE/DELETE policies on messages |
| TA-6 | SQLite has sync_status on messages |
| TA-7 | All 10 Tauri commands registered in lib.rs |
| TA-8 | Zod schemas exist with valid/invalid discrimination |
| TA-9 | WorkoutSnapshot composes from existing schemas |
| TA-10 | Chat tables in SYNCABLE_TABLES |
| TA-11 | Sync pull handles chat tables (coerce_value covers all column types) |
| TA-12 | No BLOB columns in media_attachments |
| -- | All TypeScript compiles (`bun run build`) |
| -- | Domain types have zero React imports |
| -- | Adapter interface method count is correct |
| -- | Mock adapter implements full interface |

**Output:** Pass/fail report. No file modifications.

---

## Wave 5: Review Remediation (post-PR review)

### S013: Data Mapper Unit Tests
**Agent:** `domain-engineer`
**Files:** `src/lib/__tests__/data-mapper.test.ts`
**Depends on:** S007
**Blocked by:** none
**Source:** PR #33 review I-1

Add unit tests for the 8 new chat data mapper functions following existing patterns in
`data-mapper.test.ts`. Test round-trips (`fromXxx(toXxx(row))`) and invalid input rejection.
Minimum ~150 lines covering: `toConversation`, `toConversationParticipant`, `toMessage`,
`toMediaAttachment`, and their `from*` counterparts.

**Acceptance:**
- All mapper tests pass
- Invalid payloads rejected with Zod errors

---

### S014: Dedicated `get_messages_since` Rust Command
**Agent:** `rust-engineer`
**Files:**
- `src-tauri/src/commands/chat.rs`
- `src-tauri/src/lib.rs` (register command)
- `src/lib/tauri-adapter.ts` (use new command)
**Depends on:** S005
**Blocked by:** none
**Source:** PR #33 review I-4

Current `getMessagesSince` in TauriAdapter fetches 1000 messages client-side then filters.
Add a dedicated `get_messages_since` Rust command with `WHERE created_at > ?` at the SQL
level. Update the TauriAdapter to invoke it directly.

**Acceptance:**
- No client-side filtering for `getMessagesSince`
- SQL-level timestamp filter

---

### S015: Fix `toConversationParticipant` `updatedAt` Mapping
**Agent:** `domain-engineer`
**Files:** `src/lib/data-mapper.ts`
**Depends on:** S007
**Blocked by:** none
**Source:** PR #33 review I-5

`toConversationParticipant` maps `joined_at` to both `createdAt` and `updatedAt`.
Use `last_read_at ?? joined_at` as a better approximation for `updatedAt`, or add
proper `created_at`/`updated_at` columns to both schemas.

**Acceptance:**
- `updatedAt` reflects actual state changes

---

### S016: Improve `getUnreadCounts` Error Resilience in Supabase Adapter
**Agent:** `domain-engineer`
**Files:** `src/lib/supabase-adapter.ts`
**Depends on:** S009
**Blocked by:** none
**Source:** PR #33 review I-6

One query failure per conversation aborts all unread counts. Collect errors with
`continue` and return partial results, or batch into a single Supabase RPC.

**Acceptance:**
- Single conversation error does not zero out all badges

---

### S017: Remove `#[cfg(not(test))]` from Sync Allowlist Guards
**Agent:** `rust-engineer`
**Files:** `src-tauri/src/sync/pull.rs`, `src-tauri/src/sync/push.rs`
**Depends on:** S006
**Blocked by:** none
**Source:** PR #33 review I-7

Guards are compiled out during tests, causing test/production behavioral divergence.
Remove `#[cfg(not(test))]` and adjust tests to use allowlisted table names.

**Acceptance:**
- Tests exercise the same allowlist path as production

---

## Dependency Graph

```
Wave 1 (parallel):
  S001 (Supabase migration)  ─────────────────────┐
  S002 (SQLite migration)  ──┬─────────────────────┤
  S003 (Zod schemas)  ───────┤─────────────────────┤
                             │                     │
Wave 2 (depends on S002):    │                     │
  S004 (Rust models)  ◄──────┘                     │
  S005 (Tauri commands) ◄── S004                   │
  S006 (Sync extension) ◄── S002                   │
                                                   │
Wave 3 (depends on S001, S003, S005):              │
  S007 (DB types + mappers) ◄── S003               │
  S008 (Adapter interface) ◄── S003                │
  S009 (Supabase adapter) ◄── S001, S007, S008 ◄──┘
  S010 (Tauri adapter) ◄── S005, S007, S008
  S011 (Mock adapter) ◄── S008

Wave 4:
  S012 (Validation) ◄── ALL
```

## Execution Summary

| Metric | Value |
|--------|-------|
| Total steps | 12 |
| Agents | 3 specialists + 1 validator |
| Max parallelism | 3 (Wave 1) |
| Waves | 4 |
| Files created | ~8 new, ~8 modified |
| Recommended execution | `/build` (isolated, parallel sub-agents) |
