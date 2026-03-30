-- 006_sharing.sql
-- Sharing tables: accountability_groups, group_members, group_invites, direct_connections.
-- Mirrors the Supabase migration 20260329000001_create_sharing_tables.sql for SQLite.
-- All timestamps stored as INTEGER (Unix epoch seconds). Booleans as INTEGER 0/1.
-- UUIDs stored as TEXT (generated in Rust via uuid::Uuid::new_v4()).

-- ============================================================
-- Accountability Groups
-- ============================================================
CREATE TABLE IF NOT EXISTS accountability_groups (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    name                TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
    description         TEXT,
    data_retention_days INTEGER NOT NULL DEFAULT 30 CHECK(data_retention_days BETWEEN 1 AND 90),
    created_by          TEXT NOT NULL,
    created_at          INTEGER,
    updated_at          INTEGER
);

-- ============================================================
-- Group Members
-- ============================================================
CREATE TABLE IF NOT EXISTS group_members (
    id                          TEXT PRIMARY KEY,
    group_id                    TEXT NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
    user_id                     TEXT NOT NULL,
    role                        TEXT NOT NULL CHECK(role IN ('COACH', 'MEMBER')),
    share_history_before_join   INTEGER NOT NULL DEFAULT 0,
    joined_at                   INTEGER,
    created_at                  INTEGER,
    updated_at                  INTEGER,
    UNIQUE (group_id, user_id)
);

-- ============================================================
-- Group Invites
-- ============================================================
CREATE TABLE IF NOT EXISTS group_invites (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
    code        TEXT NOT NULL UNIQUE,
    created_by  TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER,
    updated_at  INTEGER
);

-- ============================================================
-- Direct Connections
-- ============================================================
CREATE TABLE IF NOT EXISTS direct_connections (
    id                      TEXT PRIMARY KEY,
    requester_id            TEXT NOT NULL,
    recipient_id            TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACTIVE', 'DECLINED')),
    requester_grants_write  INTEGER NOT NULL DEFAULT 0,
    recipient_grants_write  INTEGER NOT NULL DEFAULT 0,
    accepted_at             INTEGER,
    created_at              INTEGER,
    updated_at              INTEGER,
    UNIQUE (requester_id, recipient_id),
    CHECK (requester_id != recipient_id),
    CHECK (status != 'ACTIVE' OR accepted_at IS NOT NULL)
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_accountability_groups_user ON accountability_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_invites_code ON group_invites(code);
CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id);
CREATE INDEX IF NOT EXISTS idx_direct_connections_req ON direct_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_direct_connections_rec ON direct_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_connections_pair ON direct_connections(requester_id, recipient_id);

-- ============================================================
-- Sync metadata registration
-- ============================================================
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES
  ('accountability_groups'),
  ('group_members'),
  ('group_invites'),
  ('direct_connections');
