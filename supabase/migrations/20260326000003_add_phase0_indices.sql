-- =============================================================================
-- Migration: Add Phase 0 Performance Indices
-- Description: Indices for common query patterns: exercise search, workout
--              history, active workout detection, set reconstruction, and
--              1RM timeline lookups.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Exercise indices
-- ---------------------------------------------------------------------------

-- Exercise search by name
CREATE INDEX idx_exercises_name ON exercises(name);

-- Filter exercises by category
CREATE INDEX idx_exercises_category ON exercises(category);

-- Separate built-in vs custom exercises
CREATE INDEX idx_exercises_custom ON exercises(is_custom);

-- ---------------------------------------------------------------------------
-- Workout log indices
-- ---------------------------------------------------------------------------

-- History list: most recent workouts first for a given user
CREATE INDEX idx_workout_logs_user_started ON workout_logs(user_id, started_at DESC);

-- Active workout check: quickly find in-progress workouts (L-8 enforcement)
CREATE INDEX idx_workout_logs_user_active ON workout_logs(user_id, completed_at) WHERE completed_at IS NULL;

-- Program context lookup: find workouts linked to a session template
CREATE INDEX idx_workout_logs_session_template ON workout_logs(session_template_id);

-- ---------------------------------------------------------------------------
-- Logged set/activity indices
-- ---------------------------------------------------------------------------

-- Reconstruct a workout: fetch all sets for a given activity
CREATE INDEX idx_logged_sets_activity ON logged_sets(logged_activity_id);

-- Exercise history across workouts: find all activities for an exercise
CREATE INDEX idx_logged_activities_exercise ON logged_activities(exercise_id);

-- ---------------------------------------------------------------------------
-- 1RM index
-- ---------------------------------------------------------------------------

-- 1RM timeline: retrieve history for a specific user + exercise, most recent first
CREATE INDEX idx_1rm_history_user_exercise ON one_rep_max_history(user_id, exercise_id, recorded_at DESC);
