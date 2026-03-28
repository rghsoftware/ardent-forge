-- 001_initial_schema.sql
-- Phase 0: Core workout logging tables for Ardent Forge
-- All timestamps stored as INTEGER (Unix epoch seconds)
-- Booleans stored as INTEGER (0/1)
-- JSON values stored as TEXT

PRAGMA foreign_keys = ON;

-- ============================================================
-- Exercises
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    aliases         TEXT,              -- JSON array of search terms
    category        TEXT NOT NULL,     -- enum: BARBELL, DUMBBELL, etc.
    movement_pattern TEXT,             -- enum: PUSH, PULL, HINGE, etc.
    muscle_groups   TEXT,              -- JSON array
    is_bilateral    INTEGER,           -- boolean
    supports_1rm    INTEGER,           -- boolean
    equipment_required TEXT,           -- JSON array
    is_custom       INTEGER DEFAULT 0, -- boolean
    created_at      INTEGER,
    updated_at      INTEGER
);

-- ============================================================
-- Workout Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_logs (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT,
    title                 TEXT,
    started_at            INTEGER NOT NULL,
    completed_at          INTEGER,
    session_template_id   TEXT,
    program_context       TEXT,        -- JSON
    overall_notes         TEXT,
    perceived_difficulty  INTEGER,     -- 1-10
    bodyweight_at_session TEXT,        -- JSON Weight
    created_at            INTEGER,
    updated_at            INTEGER
);

-- ============================================================
-- Logged Activity Groups
-- ============================================================
CREATE TABLE IF NOT EXISTS logged_activity_groups (
    id                       TEXT PRIMARY KEY,
    workout_log_id           TEXT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    user_id                  TEXT,
    group_type               TEXT NOT NULL,  -- enum
    ordinal                  INTEGER NOT NULL,
    actual_rounds_completed  INTEGER,
    completion_time          TEXT,           -- JSON Duration
    created_at               INTEGER,
    updated_at               INTEGER
);

-- ============================================================
-- Logged Activities
-- ============================================================
CREATE TABLE IF NOT EXISTS logged_activities (
    id              TEXT PRIMARY KEY,
    logged_group_id TEXT NOT NULL REFERENCES logged_activity_groups(id) ON DELETE CASCADE,
    user_id         TEXT,
    exercise_id     TEXT NOT NULL REFERENCES exercises(id),
    ordinal         INTEGER NOT NULL,
    notes           TEXT,
    created_at      INTEGER,
    updated_at      INTEGER
);

-- ============================================================
-- Logged Sets
-- ============================================================
CREATE TABLE IF NOT EXISTS logged_sets (
    id                  TEXT PRIMARY KEY,
    logged_activity_id  TEXT NOT NULL REFERENCES logged_activities(id) ON DELETE CASCADE,
    user_id             TEXT,
    set_number          INTEGER NOT NULL,
    set_type            TEXT NOT NULL,     -- enum
    prescribed          TEXT,              -- JSON
    actual_reps         INTEGER,
    actual_weight       TEXT,              -- JSON Weight
    actual_duration     TEXT,              -- JSON Duration
    actual_distance     TEXT,              -- JSON Distance
    actual_pace         TEXT,              -- JSON Pace
    actual_heart_rate   INTEGER,
    ruck_load           TEXT,              -- JSON Weight
    elevation_gain      TEXT,              -- JSON Distance
    rpe                 INTEGER,           -- 1-10
    completed           INTEGER,           -- boolean
    notes               TEXT,
    created_at          INTEGER,
    updated_at          INTEGER
);

-- ============================================================
-- User Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id               TEXT PRIMARY KEY,
    display_name     TEXT,
    preferred_units  TEXT DEFAULT 'IMPERIAL',
    bodyweight       TEXT,              -- JSON Weight
    training_age     TEXT,              -- JSON Duration
    exercise_maxes   TEXT,              -- JSON map of exerciseId -> OneRepMax
    max_reps         TEXT,              -- JSON map of exerciseId -> int
    created_at       INTEGER,
    updated_at       INTEGER
);

-- ============================================================
-- One Rep Max History
-- ============================================================
CREATE TABLE IF NOT EXISTS one_rep_max_history (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    exercise_id  TEXT NOT NULL,
    weight       TEXT NOT NULL,         -- JSON Weight
    estimated    INTEGER,               -- boolean
    recorded_at  INTEGER NOT NULL,
    created_at   INTEGER
);

-- ============================================================
-- Indices
-- ============================================================

-- Exercise indices
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_movement ON exercises(movement_pattern);
CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name);

-- Workout log indices
CREATE INDEX IF NOT EXISTS idx_workout_logs_user ON workout_logs(user_id, started_at DESC);

-- Logged activity group indices
CREATE INDEX IF NOT EXISTS idx_logged_activity_groups_log ON logged_activity_groups(workout_log_id);

-- Logged activity indices
CREATE INDEX IF NOT EXISTS idx_logged_activities_group ON logged_activities(logged_group_id);
CREATE INDEX IF NOT EXISTS idx_logged_activities_exercise ON logged_activities(exercise_id);

-- Logged set indices
CREATE INDEX IF NOT EXISTS idx_logged_sets_activity ON logged_sets(logged_activity_id);

-- One rep max history indices
CREATE INDEX IF NOT EXISTS idx_one_rep_max_history_user_exercise ON one_rep_max_history(user_id, exercise_id, recorded_at ASC);
