-- =============================================================================
-- Migration: Create Chat Tables
-- Description: Conversations, participants, messages, and media attachments
--              for the chat domain. Implements invariants CH-1 (membership
--              gating), CH-2 (direct conversation uniqueness), CH-7 (append-
--              only messages), and supports CH-4 (workout snapshots via JSON
--              content). No UI -- pure data layer for Steps 22-25.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. conversations
--    A conversation is either a direct (1:1) chat or a group chat optionally
--    linked to an accountability group. The type column gates downstream
--    logic (e.g. direct conversations enforce unique participant pairs via
--    CH-2 partial index on conversation_participants).
-- ---------------------------------------------------------------------------
create table conversations (
    id          uuid        primary key default gen_random_uuid(),
    type        text        not null check (type in ('direct', 'group')),
    title       text,
    group_id    uuid        references accountability_groups(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table conversations is 'Chat conversations. Type is either direct (1:1) or group.';
comment on column conversations.type is 'Conversation kind: direct (exactly 2 participants) or group.';
comment on column conversations.title is 'Optional display title. Typically null for direct, set for group.';
comment on column conversations.group_id is 'Optional link to an accountability group. NULL for direct conversations.';

-- ---------------------------------------------------------------------------
-- 2. conversation_participants
--    Links users to conversations. Active participation is determined by
--    left_at IS NULL. The unique constraint on (conversation_id, user_id)
--    prevents duplicate membership. CH-2 is enforced by a separate partial
--    unique index using canonical participant ordering (see section 6).
-- ---------------------------------------------------------------------------
create table conversation_participants (
    id              uuid        primary key default gen_random_uuid(),
    conversation_id uuid        not null references conversations(id) on delete cascade,
    user_id         uuid        not null references auth.users(id) on delete cascade,
    last_read_at    timestamptz,
    is_archived     boolean     not null default false,
    joined_at       timestamptz not null default now(),
    left_at         timestamptz,
    unique (conversation_id, user_id)
);

comment on table conversation_participants is 'Membership records linking users to conversations with read tracking and archive state.';
comment on column conversation_participants.conversation_id is 'Parent conversation. Cascade-deletes when the conversation is removed.';
comment on column conversation_participants.user_id is 'Participating user. Cascade-deletes when the user is removed.';
comment on column conversation_participants.last_read_at is 'Timestamp of the last message the user has read in this conversation. NULL if unread.';
comment on column conversation_participants.is_archived is 'Whether the user has archived this conversation. Defaults to false.';
comment on column conversation_participants.joined_at is 'Timestamp when the user joined the conversation.';
comment on column conversation_participants.left_at is 'Timestamp when the user left the conversation. NULL while active.';

-- ---------------------------------------------------------------------------
-- 3. messages
--    Chat messages within a conversation. Messages are append-only per CH-7:
--    no UPDATE or DELETE RLS policies are created. The content column stores
--    plain text for text messages or a JSON WorkoutSnapshot for workout
--    messages. Media/file messages may have no text content.
-- ---------------------------------------------------------------------------
create table messages (
    id              uuid        primary key default gen_random_uuid(),
    conversation_id uuid        not null references conversations(id) on delete cascade,
    sender_id       uuid        references auth.users(id) on delete set null,
    message_type    text        not null check (message_type in ('text', 'workout', 'media', 'file', 'system')),
    content         text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

comment on table messages is 'Chat messages. Append-only per CH-7: no update or delete policies.';
comment on column messages.conversation_id is 'Parent conversation. Cascade-deletes when the conversation is removed.';
comment on column messages.sender_id is 'Message author. NULL for system-generated messages. Set null on user deletion.';
comment on column messages.message_type is 'Message kind: text, workout (JSON snapshot), media, file, or system.';
comment on column messages.content is 'Message body. Plain text or JSON (workout snapshots). NULL for media/file-only messages.';

-- ---------------------------------------------------------------------------
-- 4. media_attachments
--    Metadata-only records for media attached to messages. Binary data lives
--    in Cloudflare Stream (video) or Supabase Storage (images/files) -- no
--    BLOB columns here (TA-12). Status tracks the processing pipeline.
-- ---------------------------------------------------------------------------
create table media_attachments (
    id                  uuid        primary key default gen_random_uuid(),
    message_id          uuid        not null references messages(id) on delete cascade,
    provider            text        not null check (provider in ('cloudflare_stream', 'supabase_storage')),
    provider_asset_id   text,
    media_type          text        not null check (media_type in ('video', 'image', 'file')),
    original_filename   text,
    mime_type           text,
    thumbnail_url       text,
    playback_url        text,
    duration_seconds    integer,
    file_size_bytes     bigint,
    status              text        not null default 'processing' check (status in ('processing', 'ready', 'failed')),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table media_attachments is 'Metadata for media attached to chat messages. No binary data stored (TA-12).';
comment on column media_attachments.message_id is 'Parent message. Cascade-deletes when the message is removed.';
comment on column media_attachments.provider is 'Storage backend: cloudflare_stream (video) or supabase_storage (images/files).';
comment on column media_attachments.provider_asset_id is 'Provider-specific asset identifier (e.g. Cloudflare Stream video UID).';
comment on column media_attachments.media_type is 'Content category: video, image, or file.';
comment on column media_attachments.original_filename is 'Original filename as uploaded by the user.';
comment on column media_attachments.mime_type is 'MIME type of the uploaded file (e.g. video/mp4, image/jpeg).';
comment on column media_attachments.thumbnail_url is 'URL to a generated thumbnail for preview display.';
comment on column media_attachments.playback_url is 'URL for playback (video) or download (file).';
comment on column media_attachments.duration_seconds is 'Duration in seconds for video attachments. NULL for images/files.';
comment on column media_attachments.file_size_bytes is 'File size in bytes.';
comment on column media_attachments.status is 'Processing pipeline state: processing, ready, or failed.';

-- ---------------------------------------------------------------------------
-- 5. Indices
-- ---------------------------------------------------------------------------

-- Primary query path: messages by conversation, ordered chronologically
create index idx_messages_conversation_created
    on messages(conversation_id, created_at);

-- Conversation list sorted by most recently active
create index idx_conversations_updated
    on conversations(updated_at desc);

-- Active participants lookup (used by RLS policies and conversation queries)
create index idx_cp_user_active
    on conversation_participants(user_id)
    where left_at is null;

-- Participant lookup by conversation (used by RLS subqueries)
create index idx_cp_conversation
    on conversation_participants(conversation_id);

-- Media lookup by parent message
create index idx_media_message
    on media_attachments(message_id);

-- ---------------------------------------------------------------------------
-- 6. Direct conversation uniqueness (CH-2)
--    Prevents duplicate direct conversations between the same two users.
--    Participant UUIDs live in conversation_participants (a separate table),
--    so a simple unique index on conversations is not sufficient. Instead
--    we use a helper function + BEFORE INSERT trigger:
--    1. direct_conversation_pair(uuid) computes the canonical pair string
--       using LEAST/GREATEST on participant user_ids.
--    2. enforce_direct_conversation_uniqueness() fires on participant
--       INSERT and rejects the row if another direct conversation already
--       has the same canonical pair.
-- ---------------------------------------------------------------------------

-- Helper function: given a conversation_id, returns the canonical pair of
-- active participant user_ids as 'smaller_uuid::larger_uuid'.
-- Returns NULL when there are fewer than 2 active participants.
-- Marked STABLE because it reads from tables but is deterministic for a given state.
create or replace function direct_conversation_pair(p_conversation_id uuid)
returns text
language sql stable as $$
    select least(a.user_id::text, b.user_id::text) || '::' || greatest(a.user_id::text, b.user_id::text)
    from conversation_participants a
    join conversation_participants b
        on a.conversation_id = b.conversation_id
       and a.user_id < b.user_id
       and b.left_at is null
    where a.conversation_id = p_conversation_id
      and a.left_at is null
$$;

comment on function direct_conversation_pair(uuid) is 'Returns canonical user pair string for a direct conversation. Used by CH-2 uniqueness enforcement trigger.';

-- Trigger function: on INSERT into conversation_participants, if the parent
-- conversation is type = 'direct', check that no other direct conversation
-- exists with the same canonical pair.
create or replace function enforce_direct_conversation_uniqueness()
returns trigger
language plpgsql as $$
declare
    conv_type text;
    pair_key text;
    existing_count integer;
begin
    -- Only enforce for direct conversations
    select type into conv_type
    from conversations
    where id = new.conversation_id;

    if conv_type != 'direct' then
        return new;
    end if;

    -- Compute the canonical pair for this conversation after the new participant
    -- We need both participants, so check if we now have exactly 2
    pair_key := direct_conversation_pair(new.conversation_id);

    if pair_key is not null then
        -- Check if another direct conversation already has this pair
        select count(*) into existing_count
        from conversations c
        where c.type = 'direct'
          and c.id != new.conversation_id
          and direct_conversation_pair(c.id) = pair_key;

        if existing_count > 0 then
            raise exception 'A direct conversation between these two users already exists (CH-2)'
                using errcode = 'unique_violation';
        end if;
    end if;

    return new;
end;
$$;

comment on function enforce_direct_conversation_uniqueness() is 'BEFORE INSERT trigger on conversation_participants enforcing CH-2: no duplicate direct conversations between the same user pair.';

create trigger enforce_direct_conversation_uniqueness_trigger
    before insert on conversation_participants
    for each row execute function enforce_direct_conversation_uniqueness();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    CH-1: All chat data gated by active conversation membership.
--    CH-7: Messages are append-only (no UPDATE/DELETE policies).
-- ---------------------------------------------------------------------------

-- conversations: only participants can see their conversations
alter table conversations enable row level security;

create policy "conversations_select_participant"
    on conversations for select
    using (
        exists (
            select 1 from conversation_participants
            where conversation_participants.conversation_id = conversations.id
              and conversation_participants.user_id = auth.uid()
              and conversation_participants.left_at is null
        )
    );

-- conversation_participants: visible to fellow active participants
alter table conversation_participants enable row level security;

create policy "cp_select_fellow_participant"
    on conversation_participants for select
    using (
        exists (
            select 1 from conversation_participants cp2
            where cp2.conversation_id = conversation_participants.conversation_id
              and cp2.user_id = auth.uid()
              and cp2.left_at is null
        )
    );

create policy "cp_insert_self_or_group_member"
    on conversation_participants for insert
    with check (
        -- User adding themselves to a conversation
        user_id = auth.uid()
        -- Or an active participant adding someone to a group conversation
        or (
            exists (
                select 1 from conversations c
                where c.id = conversation_participants.conversation_id
                  and c.type = 'group'
            )
            and exists (
                select 1 from conversation_participants cp_self
                where cp_self.conversation_id = conversation_participants.conversation_id
                  and cp_self.user_id = auth.uid()
                  and cp_self.left_at is null
            )
        )
    );

create policy "cp_update_own_participation"
    on conversation_participants for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- messages: only active participants can read; only active participants can insert their own messages
alter table messages enable row level security;

create policy "messages_select_participant"
    on messages for select
    using (
        exists (
            select 1 from conversation_participants
            where conversation_participants.conversation_id = messages.conversation_id
              and conversation_participants.user_id = auth.uid()
              and conversation_participants.left_at is null
        )
    );

create policy "messages_insert_active_participant"
    on messages for insert
    with check (
        sender_id = auth.uid()
        and exists (
            select 1 from conversation_participants
            where conversation_participants.conversation_id = messages.conversation_id
              and conversation_participants.user_id = auth.uid()
              and conversation_participants.left_at is null
        )
    );

-- CH-7: No UPDATE or DELETE policies on messages = append-only for regular users.
-- Service role can still modify if needed for admin operations.

-- media_attachments: gated by participation in the parent message's conversation
alter table media_attachments enable row level security;

create policy "media_select_via_message"
    on media_attachments for select
    using (
        exists (
            select 1 from messages m
            join conversation_participants cp
                on cp.conversation_id = m.conversation_id
            where m.id = media_attachments.message_id
              and cp.user_id = auth.uid()
              and cp.left_at is null
        )
    );

create policy "media_insert_via_message"
    on media_attachments for insert
    with check (
        exists (
            select 1 from messages m
            join conversation_participants cp
                on cp.conversation_id = m.conversation_id
            where m.id = media_attachments.message_id
              and cp.user_id = auth.uid()
              and cp.left_at is null
        )
    );

-- ---------------------------------------------------------------------------
-- 8. Triggers: automatic updated_at
--    Reuses the shared update_updated_at_column() trigger function from
--    20260326000004_add_triggers.sql.
-- ---------------------------------------------------------------------------
create trigger set_conversations_updated_at before update on conversations
    for each row execute function update_updated_at_column();

create trigger set_messages_updated_at before update on messages
    for each row execute function update_updated_at_column();

create trigger set_media_attachments_updated_at before update on media_attachments
    for each row execute function update_updated_at_column();
