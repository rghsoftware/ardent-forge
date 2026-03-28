-- 004_programs.sql
-- Program structure tables: programs, blocks, block_weeks, scheduled_sessions,
-- and program_activations for structured training periodization.
-- All timestamps (created_at, updated_at) stored as INTEGER (Unix epoch seconds). Dates (start_date) stored as TEXT (YYYY-MM-DD).

-- ============================================================
-- Programs
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    name                TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
    description         TEXT,
    source              TEXT NOT NULL CHECK(source IN ('CUSTOM','IMPORTED','SHARED','MARKETPLACE','AI_GENERATED','COACH_ASSIGNED','TEMPLATE')),
    duration_weeks      INTEGER,
    is_public           INTEGER NOT NULL DEFAULT 0,
    created_by          TEXT,
    created_at          INTEGER,
    updated_at          INTEGER
);

-- ============================================================
-- Blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
    id                  TEXT PRIMARY KEY,
    program_id          TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name                TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
    ordinal             INTEGER NOT NULL CHECK(ordinal >= 1),
    duration_weeks      INTEGER NOT NULL CHECK(duration_weeks >= 1),
    block_type          TEXT NOT NULL CHECK(block_type IN ('ACCUMULATION','INTENSIFICATION','REALIZATION','DELOAD','TEST')),
    created_at          INTEGER,
    updated_at          INTEGER,
    UNIQUE (program_id, ordinal)
);

-- ============================================================
-- Block Weeks
-- ============================================================
CREATE TABLE IF NOT EXISTS block_weeks (
    id                  TEXT PRIMARY KEY,
    block_id            TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    week_number         INTEGER NOT NULL CHECK(week_number >= 1),
    created_at          INTEGER,
    updated_at          INTEGER,
    UNIQUE (block_id, week_number)
);

-- ============================================================
-- Scheduled Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_sessions (
    id                      TEXT PRIMARY KEY,
    block_week_id           TEXT NOT NULL REFERENCES block_weeks(id) ON DELETE CASCADE,
    day_of_week             INTEGER CHECK(day_of_week >= 0 AND day_of_week <= 6),
    day_label               TEXT NOT NULL CHECK(length(day_label) >= 1),
    session_type            TEXT NOT NULL CHECK(session_type IN ('STRENGTH','CONDITIONING','SE','MIXED')),
    session_template_id     TEXT NOT NULL REFERENCES session_templates(id) ON DELETE RESTRICT,
    notes                   TEXT,
    created_at              INTEGER,
    updated_at              INTEGER
);

-- ============================================================
-- Program Activations
-- ============================================================
CREATE TABLE IF NOT EXISTS program_activations (
    id                          TEXT PRIMARY KEY,
    user_id                     TEXT NOT NULL UNIQUE,
    program_id                  TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    current_block_ordinal       INTEGER NOT NULL DEFAULT 1 CHECK(current_block_ordinal >= 1),
    current_week_number         INTEGER NOT NULL DEFAULT 1 CHECK(current_week_number >= 1),
    start_date                  TEXT NOT NULL,
    created_at                  INTEGER,
    updated_at                  INTEGER
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_programs_user ON programs(user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_program ON blocks(program_id);
CREATE INDEX IF NOT EXISTS idx_block_weeks_block ON block_weeks(block_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_week ON scheduled_sessions(block_week_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_sessions_template ON scheduled_sessions(session_template_id);
CREATE INDEX IF NOT EXISTS idx_program_activations_program ON program_activations(program_id);

-- ============================================================
-- Sync metadata registration
-- ============================================================
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES
  ('programs'),
  ('blocks'),
  ('block_weeks'),
  ('scheduled_sessions'),
  ('program_activations');
