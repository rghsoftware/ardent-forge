-- 007_chat.sql
-- Chat domain tables: conversations, conversation_participants, messages, media_attachments.
-- Mirrors the Supabase chat schema for SQLite offline support.
-- All timestamps stored as INTEGER (Unix epoch seconds). Booleans as INTEGER 0/1.
-- UUIDs stored as TEXT (generated in Rust via uuid::Uuid::new_v4()).

-- ============================================================
-- Conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL CHECK(type IN ('direct', 'group')),
    title       TEXT,
    group_id    TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- ============================================================
-- Conversation Participants
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    last_read_at    INTEGER,
    is_archived     INTEGER NOT NULL DEFAULT 0,
    joined_at       INTEGER NOT NULL,
    left_at         INTEGER,
    UNIQUE (conversation_id, user_id)
);

-- ============================================================
-- Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id       TEXT,
    message_type    TEXT NOT NULL CHECK(message_type IN ('text', 'workout', 'media', 'file', 'system')),
    content         TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    sync_status     TEXT NOT NULL DEFAULT 'synced' CHECK(sync_status IN ('pending', 'synced', 'failed'))
);

-- ============================================================
-- Media Attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS media_attachments (
    id                TEXT PRIMARY KEY,
    message_id        TEXT NOT NULL,
    provider          TEXT NOT NULL CHECK(provider IN ('cloudflare_stream', 'supabase_storage')),
    provider_asset_id TEXT,
    media_type        TEXT NOT NULL CHECK(media_type IN ('video', 'image', 'file')),
    original_filename TEXT,
    mime_type         TEXT,
    thumbnail_url     TEXT,
    playback_url      TEXT,
    duration_seconds  INTEGER,
    file_size_bytes   INTEGER,
    status            TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'failed')),
    created_at        INTEGER NOT NULL,
    updated_at        INTEGER NOT NULL
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_conversations_group ON conversations(group_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_sync_status ON messages(sync_status);

CREATE INDEX IF NOT EXISTS idx_media_attachments_message ON media_attachments(message_id);

-- ============================================================
-- Sync metadata registration
-- ============================================================
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES
  ('conversations'),
  ('conversation_participants'),
  ('messages'),
  ('media_attachments');
