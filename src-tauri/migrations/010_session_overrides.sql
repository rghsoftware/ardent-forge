-- Add per-instance activity overrides (exercise swaps, set scheme changes). NULL = no overrides.
ALTER TABLE scheduled_sessions ADD COLUMN overrides TEXT;
