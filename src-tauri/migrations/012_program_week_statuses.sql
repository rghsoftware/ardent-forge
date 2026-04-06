-- 012_program_week_statuses.sql
-- Track per-week completion/skip status for program time-travel (F017).
-- Allows users to mark weeks as done or skipped when jumping position.

CREATE TABLE IF NOT EXISTS program_week_statuses (
    id                  TEXT PRIMARY KEY,
    activation_id       TEXT NOT NULL REFERENCES program_activations(id) ON DELETE CASCADE,
    block_ordinal       INTEGER NOT NULL,
    week_number         INTEGER NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
    created_at          INTEGER DEFAULT (unixepoch()),
    UNIQUE (activation_id, block_ordinal, week_number)
);

CREATE INDEX IF NOT EXISTS idx_program_week_statuses_activation
    ON program_week_statuses(activation_id);

-- Register for sync
INSERT OR IGNORE INTO sync_metadata (table_name) VALUES ('program_week_statuses');
