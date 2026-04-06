-- Add overrides column for per-instance session customizations
ALTER TABLE scheduled_sessions ADD COLUMN overrides JSONB;
COMMENT ON COLUMN scheduled_sessions.overrides IS 'Per-instance activity overrides (exercise swaps, set scheme changes). NULL means no overrides.';
