-- Feature 018: Workout Session UX -- intentional pause/resume
-- Adds pause tracking columns to workout_logs. Additive only; existing rows
-- default to total_paused_ms = 0 and paused_at = NULL (running / not paused).

ALTER TABLE workout_logs ADD COLUMN paused_at TIMESTAMPTZ;
ALTER TABLE workout_logs ADD COLUMN total_paused_ms BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN workout_logs.paused_at IS 'Timestamp when workout was paused; NULL when running.';
COMMENT ON COLUMN workout_logs.total_paused_ms IS 'Cumulative milliseconds spent in paused state across all pause/resume cycles.';
