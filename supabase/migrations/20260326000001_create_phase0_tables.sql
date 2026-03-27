-- =============================================================================
-- Migration: Create Phase 0 Tables
-- Description: Core tables for workout logging, exercise dictionary, user
--              profiles, and 1RM history tracking.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. exercises
--    Shared exercise dictionary plus user-created custom exercises.
--    Invariant EX-1: name must be 1-100 characters.
-- ---------------------------------------------------------------------------
CREATE TABLE exercises (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 100),
    aliases             JSONB       NOT NULL DEFAULT '[]',
    category            TEXT        NOT NULL CHECK (category IN (
                            'BARBELL', 'DUMBBELL', 'KETTLEBELL', 'BODYWEIGHT',
                            'MACHINE', 'CABLE', 'CARDIO', 'PLYOMETRIC', 'LOADED_CARRY'
                        )),
    movement_pattern    TEXT        NOT NULL CHECK (movement_pattern IN (
                            'SQUAT', 'HINGE', 'PUSH', 'PULL',
                            'CARRY', 'ROTATE', 'GAIT', 'ISOMETRIC'
                        )),
    muscle_groups       JSONB       NOT NULL CHECK (muscle_groups ? 'primary' AND muscle_groups ? 'secondary'),
    is_bilateral        BOOLEAN     NOT NULL DEFAULT true,
    supports_1rm        BOOLEAN     NOT NULL DEFAULT false,
    equipment_required  JSONB       NOT NULL DEFAULT '[]',
    is_custom           BOOLEAN     NOT NULL DEFAULT false,
    user_id             UUID        REFERENCES auth.users ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT exercises_custom_user_check CHECK (
        (is_custom = true AND user_id IS NOT NULL) OR
        (is_custom = false AND user_id IS NULL)
    )
);

COMMENT ON TABLE exercises IS 'Exercise dictionary: built-in (is_custom=false) and user-created (is_custom=true) exercises.';
COMMENT ON COLUMN exercises.user_id IS 'NULL for built-in exercises; set to owning user for custom exercises.';
COMMENT ON COLUMN exercises.muscle_groups IS 'JSONB object with "primary" and "secondary" arrays of MuscleGroup values.';
COMMENT ON COLUMN exercises.aliases IS 'JSONB array of alternative search terms for the exercise.';
COMMENT ON COLUMN exercises.equipment_required IS 'JSONB array of Equipment enum values required for the exercise.';

-- ---------------------------------------------------------------------------
-- 2. user_profiles
--    User settings, preferred units, bodyweight, training maxes.
--    Primary key references auth.users so every profile is 1:1 with a user.
-- ---------------------------------------------------------------------------
CREATE TABLE user_profiles (
    id                  UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    display_name        TEXT,
    preferred_units     TEXT        NOT NULL DEFAULT 'IMPERIAL' CHECK (preferred_units IN (
                            'IMPERIAL', 'METRIC'
                        )),
    bodyweight          JSONB,
    training_age        JSONB,
    exercise_maxes      JSONB       NOT NULL DEFAULT '{}',
    max_reps            JSONB       NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'User settings and training data. One row per auth.users entry.';
COMMENT ON COLUMN user_profiles.display_name IS 'User-facing display name. Optional.';
COMMENT ON COLUMN user_profiles.bodyweight IS 'JSONB Weight object: {"value": number, "unit": "lb"|"kg"}.';
COMMENT ON COLUMN user_profiles.training_age IS 'JSONB Duration object: {"seconds": number}.';
COMMENT ON COLUMN user_profiles.exercise_maxes IS 'JSONB map of exerciseId to OneRepMax objects.';
COMMENT ON COLUMN user_profiles.max_reps IS 'JSONB map of exerciseId to max reps count (positive integer).';

-- ---------------------------------------------------------------------------
-- 3. workout_logs
--    A completed or in-progress training session.
--    Invariant L-1: started_at is required (NOT NULL).
--    Invariant L-6: perceived_difficulty must be 1-10 when present.
--    Note: session_template_id has no FK constraint yet; session_templates
--    table constraint deferred: table not yet created.
-- ---------------------------------------------------------------------------
CREATE TABLE workout_logs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    title                   TEXT,
    started_at              TIMESTAMPTZ NOT NULL,
    completed_at            TIMESTAMPTZ,
    session_template_id     UUID,
    program_context         JSONB,
    perceived_difficulty    INTEGER     CHECK (perceived_difficulty BETWEEN 1 AND 10),
    bodyweight_at_session   JSONB,
    overall_notes            TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT workout_logs_completion_check CHECK (
        completed_at IS NULL OR completed_at > started_at
    )
);

COMMENT ON TABLE workout_logs IS 'Training sessions. completed_at=NULL means the workout is in progress.';
COMMENT ON COLUMN workout_logs.session_template_id IS 'FK to session_templates (constraint deferred: table not yet created). NULL for ad-hoc workouts.';
COMMENT ON COLUMN workout_logs.program_context IS 'JSONB ProgramContext: {"programId","blockId","weekNumber","dayLabel"}.';
COMMENT ON COLUMN workout_logs.bodyweight_at_session IS 'JSONB Weight object recorded at time of workout.';
COMMENT ON COLUMN workout_logs.title IS 'Optional user-defined workout title (e.g. "Monday Upper Body").';

-- ---------------------------------------------------------------------------
-- 4. logged_activity_groups
--    Groups of activities within a workout (superset, circuit, etc.).
--    user_id is denormalized from workout_logs for RLS performance.
-- ---------------------------------------------------------------------------
CREATE TABLE logged_activity_groups (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_log_id      UUID        NOT NULL REFERENCES workout_logs ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    group_type          TEXT        NOT NULL CHECK (group_type IN (
                            'STRAIGHT_SETS', 'SUPERSET', 'CIRCUIT',
                            'COMPLEX', 'EMOM', 'AMRAP', 'COUPLET'
                        )),
    ordinal             INTEGER     NOT NULL CHECK (ordinal >= 1),
    completion_time     JSONB,
    actual_rounds_completed INTEGER CHECK (actual_rounds_completed >= 1),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE logged_activity_groups IS 'Activity groups within a workout. user_id denormalized for RLS.';
COMMENT ON COLUMN logged_activity_groups.completion_time IS 'JSONB Duration object: {"seconds": number}.';

-- ---------------------------------------------------------------------------
-- 5. logged_activities
--    Individual exercises logged within an activity group.
--    user_id is denormalized for RLS performance.
-- ---------------------------------------------------------------------------
CREATE TABLE logged_activities (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    logged_group_id     UUID        NOT NULL REFERENCES logged_activity_groups ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    exercise_id         UUID        NOT NULL REFERENCES exercises ON DELETE RESTRICT,
    ordinal             INTEGER     NOT NULL CHECK (ordinal >= 1),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE logged_activities IS 'Exercises within an activity group. user_id denormalized for RLS.';
COMMENT ON COLUMN logged_activities.exercise_id IS 'References exercises table. RESTRICT prevents deleting exercises in use.';

-- ---------------------------------------------------------------------------
-- 6. logged_sets
--    Individual sets recorded for a logged activity.
--    Invariant L-3: set_number >= 1.
--    Invariant L-7: rpe must be 1-10 when present.
--    user_id is denormalized for RLS performance.
-- ---------------------------------------------------------------------------
CREATE TABLE logged_sets (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    logged_activity_id  UUID        NOT NULL REFERENCES logged_activities ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    set_number          INTEGER     NOT NULL CHECK (set_number >= 1),
    set_type            TEXT        NOT NULL CHECK (set_type IN (
                            'WORKING', 'WARMUP', 'DROP',
                            'AMRAP', 'PEAK', 'BACKOFF'
                        )),
    prescribed          JSONB,
    actual_reps         INTEGER     CHECK (actual_reps >= 0),
    actual_weight       JSONB,
    actual_duration     JSONB,
    actual_distance     JSONB,
    actual_pace         JSONB,
    actual_heart_rate   INTEGER     CHECK (actual_heart_rate > 0),
    ruck_load           JSONB,
    elevation_gain      JSONB,
    rpe                 NUMERIC     CHECK (rpe BETWEEN 1 AND 10 AND rpe * 2 = FLOOR(rpe * 2)),
    completed           BOOLEAN     NOT NULL DEFAULT false,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT logged_sets_completed_check CHECK (
        completed = false OR (
            actual_reps IS NOT NULL OR
            actual_weight IS NOT NULL OR
            actual_duration IS NOT NULL OR
            actual_distance IS NOT NULL OR
            actual_heart_rate IS NOT NULL
        )
    )
);

COMMENT ON TABLE logged_sets IS 'Individual sets within a logged activity. user_id denormalized for RLS.';
COMMENT ON COLUMN logged_sets.prescribed IS 'JSONB Prescription: what the program prescribed for this set.';
COMMENT ON COLUMN logged_sets.actual_weight IS 'JSONB Weight object: {"value": number, "unit": "lb"|"kg"}.';
COMMENT ON COLUMN logged_sets.actual_duration IS 'JSONB Duration object: {"seconds": number}.';
COMMENT ON COLUMN logged_sets.actual_distance IS 'JSONB Distance object: {"value": number, "unit": "mi"|"km"|"m"|"yd"}.';
COMMENT ON COLUMN logged_sets.actual_pace IS 'JSONB Pace object: {"minutesPerUnit": number, "unit": "mi"|"km"}.';
COMMENT ON COLUMN logged_sets.rpe IS 'Rate of Perceived Exertion, 1-10 scale. Half-step values only (e.g. 7.5) enforced by CHECK constraint.';

-- ---------------------------------------------------------------------------
-- 7. one_rep_max_history
--    Historical 1RM records. Insert-only per invariant PR-2.
--    Invariant PR-1: weight must be positive (enforced via JSONB CHECK
--    constraint on the weight column).
-- ---------------------------------------------------------------------------
CREATE TABLE one_rep_max_history (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
    exercise_id         UUID        NOT NULL REFERENCES exercises ON DELETE RESTRICT,
    weight              JSONB       NOT NULL CHECK (
        weight ? 'value' AND weight ? 'unit'
        AND weight->>'value' ~ '^\d+(\.\d+)?$'
        AND (weight->>'value')::numeric > 0
        AND weight->>'unit' IN ('lb', 'kg')
    ),
    estimated           BOOLEAN     NOT NULL DEFAULT false,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE one_rep_max_history IS 'Append-only 1RM history. Per PR-2, rows are never updated or deleted.';
COMMENT ON COLUMN one_rep_max_history.weight IS 'JSONB Weight object: {"value": number, "unit": "lb"|"kg"}. Positive value enforced by CHECK constraint (PR-1).';
COMMENT ON COLUMN one_rep_max_history.estimated IS 'True if this 1RM was calculated from a rep-max formula rather than directly tested.';
