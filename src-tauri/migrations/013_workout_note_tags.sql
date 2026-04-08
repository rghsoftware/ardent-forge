-- 013_workout_note_tags.sql
-- Feature 020: Workout Notes — add note_tags column to workout log hierarchy.
-- SQLite has no native array type, so tags are stored as a JSON-encoded array
-- string (e.g. '["FORM BREAKDOWN","GRINDY"]'), matching the precedent set by
-- workout_logs.bodyweight_at_session and workout_logs.program_context.
-- Mirrors the Supabase TEXT[] column added in the same release.

ALTER TABLE workout_logs
    ADD COLUMN note_tags TEXT NOT NULL DEFAULT '[]';

ALTER TABLE logged_activities
    ADD COLUMN note_tags TEXT NOT NULL DEFAULT '[]';

ALTER TABLE logged_sets
    ADD COLUMN note_tags TEXT NOT NULL DEFAULT '[]';
