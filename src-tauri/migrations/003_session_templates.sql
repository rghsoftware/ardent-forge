-- 003_session_templates.sql
-- Session templates, activity groups, and activities for structured workout programming.
-- All timestamps stored as INTEGER (Unix epoch seconds).
-- JSON values stored as TEXT.

-- ============================================================
-- Session Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS session_templates (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    category            TEXT NOT NULL,       -- enum: STRENGTH, CONDITIONING, SE, MIXED
    rest_between_groups TEXT,                -- JSON Duration
    time_cap            TEXT,                -- JSON Duration
    scoring             TEXT NOT NULL DEFAULT 'NONE', -- enum: NONE, FOR_TIME, etc.
    created_at          INTEGER,
    updated_at          INTEGER
);

-- ============================================================
-- Activity Groups
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_groups (
    id                      TEXT PRIMARY KEY,
    session_template_id     TEXT NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
    group_type              TEXT NOT NULL,   -- enum: STRAIGHT_SETS, SUPERSET, etc.
    ordinal                 INTEGER NOT NULL,
    rounds                  INTEGER,
    rest_between_rounds     TEXT,            -- JSON Duration
    rest_between_activities TEXT,            -- JSON Duration
    created_at              INTEGER,
    updated_at              INTEGER,
    UNIQUE (session_template_id, ordinal)
);

-- ============================================================
-- Activities
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
    id                  TEXT PRIMARY KEY,
    activity_group_id   TEXT NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE,
    exercise_id         TEXT NOT NULL REFERENCES exercises(id),
    ordinal             INTEGER NOT NULL,
    set_scheme          TEXT NOT NULL,       -- JSON SetScheme discriminated union
    notes               TEXT,
    created_at          INTEGER,
    updated_at          INTEGER,
    UNIQUE (activity_group_id, ordinal)
);

-- ============================================================
-- Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_session_templates_user ON session_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_groups_template ON activity_groups(session_template_id);
CREATE INDEX IF NOT EXISTS idx_activities_group ON activities(activity_group_id);
CREATE INDEX IF NOT EXISTS idx_activities_exercise ON activities(exercise_id);

-- ============================================================
-- Sync metadata registration
-- ============================================================
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES
  ('session_templates'),
  ('activity_groups'),
  ('activities');
