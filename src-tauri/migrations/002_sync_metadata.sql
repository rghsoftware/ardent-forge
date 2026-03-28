-- 002_sync_metadata.sql
-- Sync infrastructure: metadata tracking and offline queue

-- Sync metadata: tracks last push/pull timestamps per table
CREATE TABLE IF NOT EXISTS sync_metadata (
  table_name TEXT PRIMARY KEY,
  last_push_at INTEGER NOT NULL DEFAULT 0,
  last_pull_at INTEGER NOT NULL DEFAULT 0
);

-- Seed syncable tables
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES
  ('exercises'),
  ('workout_logs'),
  ('logged_activity_groups'),
  ('logged_activities'),
  ('logged_sets'),
  ('user_profiles'),
  ('one_rep_max_history');

-- Offline sync queue: stores pending changes when network unavailable
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload TEXT, -- JSON snapshot of the row
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- FIFO processing index
CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue (created_at ASC);
