-- =============================================================================
-- Migration: Create Program Tables
-- Description: Programs, blocks, block weeks, scheduled sessions, and program
--              activations for structured training periodization.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. programs
--    A structured training program owned by a user. Programs contain ordered
--    blocks that span a defined number of weeks.
--    Invariant: name must be 1-200 characters.
-- ---------------------------------------------------------------------------
CREATE TABLE programs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description     TEXT,
    source          TEXT        NOT NULL CHECK (source IN (
                        'CUSTOM', 'IMPORTED', 'SHARED', 'MARKETPLACE',
                        'AI_GENERATED', 'COACH_ASSIGNED', 'TEMPLATE'
                    )),
    duration_weeks  INTEGER     CHECK (duration_weeks IS NULL OR duration_weeks >= 1),
    is_public       BOOLEAN     NOT NULL DEFAULT false,
    created_by      UUID        REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE programs IS 'Structured training programs containing ordered blocks for periodization.';
COMMENT ON COLUMN programs.user_id IS 'Owning user. All programs are user-scoped.';
COMMENT ON COLUMN programs.name IS 'Program display name. Must be 1-200 characters.';
COMMENT ON COLUMN programs.description IS 'Optional free-text description of the program goals and structure.';
COMMENT ON COLUMN programs.source IS 'Origin of the program: CUSTOM, IMPORTED, SHARED, MARKETPLACE, AI_GENERATED, COACH_ASSIGNED, or TEMPLATE.';
COMMENT ON COLUMN programs.duration_weeks IS 'Total program duration in weeks. NULL if open-ended.';
COMMENT ON COLUMN programs.is_public IS 'Whether the program is publicly visible. Defaults to false.';
COMMENT ON COLUMN programs.created_by IS 'Original author if the program was imported, shared, or coach-assigned.';
COMMENT ON COLUMN programs.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN programs.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 2. blocks
--    Mesocycle blocks within a program (e.g. accumulation, intensification).
--    Ordinal is unique per program to enforce ordering.
-- ---------------------------------------------------------------------------
CREATE TABLE blocks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    ordinal         INTEGER     NOT NULL CHECK (ordinal >= 1),
    duration_weeks  INTEGER     NOT NULL CHECK (duration_weeks >= 1),
    block_type      TEXT        NOT NULL CHECK (block_type IN (
                        'ACCUMULATION', 'INTENSIFICATION', 'REALIZATION',
                        'DELOAD', 'TEST'
                    )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (program_id, ordinal)
);

COMMENT ON TABLE blocks IS 'Mesocycle blocks within a program, each with a type and duration.';
COMMENT ON COLUMN blocks.program_id IS 'Parent program. Cascade-deletes when the program is removed.';
COMMENT ON COLUMN blocks.name IS 'Block display name. Must be 1-200 characters.';
COMMENT ON COLUMN blocks.ordinal IS 'Execution order within the program. Unique per program.';
COMMENT ON COLUMN blocks.duration_weeks IS 'Number of weeks this block spans. Must be at least 1.';
COMMENT ON COLUMN blocks.block_type IS 'Periodization phase: ACCUMULATION, INTENSIFICATION, REALIZATION, DELOAD, or TEST.';
COMMENT ON COLUMN blocks.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN blocks.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 3. block_weeks
--    Individual weeks within a block. Week number is unique per block.
-- ---------------------------------------------------------------------------
CREATE TABLE block_weeks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id        UUID        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
    week_number     INTEGER     NOT NULL CHECK (week_number >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (block_id, week_number)
);

COMMENT ON TABLE block_weeks IS 'Individual training weeks within a block.';
COMMENT ON COLUMN block_weeks.block_id IS 'Parent block. Cascade-deletes when the block is removed.';
COMMENT ON COLUMN block_weeks.week_number IS 'Week number within the block. Unique per block, starting at 1.';
COMMENT ON COLUMN block_weeks.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN block_weeks.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 4. scheduled_sessions
--    Sessions scheduled within a block week, linking to a session template
--    that defines the actual workout structure.
-- ---------------------------------------------------------------------------
CREATE TABLE scheduled_sessions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    block_week_id       UUID        NOT NULL REFERENCES block_weeks(id) ON DELETE CASCADE,
    day_of_week         INTEGER     CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_label           TEXT        NOT NULL,
    session_type        TEXT        NOT NULL CHECK (session_type IN (
                            'STRENGTH', 'CONDITIONING', 'SE', 'MIXED'
                        )),
    session_template_id UUID        NOT NULL REFERENCES session_templates(id),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE scheduled_sessions IS 'Sessions scheduled within a block week, each linked to a session template.';
COMMENT ON COLUMN scheduled_sessions.block_week_id IS 'Parent block week. Cascade-deletes when the week is removed.';
COMMENT ON COLUMN scheduled_sessions.day_of_week IS 'Day of week (0=Sunday through 6=Saturday, matching JavaScript Date.getDay()). NULL if unassigned.';
COMMENT ON COLUMN scheduled_sessions.day_label IS 'Human-readable day label (e.g. "Day 1", "Monday Upper").';
COMMENT ON COLUMN scheduled_sessions.session_type IS 'Session category: STRENGTH, CONDITIONING, SE (strength-endurance), or MIXED.';
COMMENT ON COLUMN scheduled_sessions.session_template_id IS 'References session_templates. Defines the workout structure for this session.';
COMMENT ON COLUMN scheduled_sessions.notes IS 'Optional coaching notes or context for this scheduled session.';
COMMENT ON COLUMN scheduled_sessions.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN scheduled_sessions.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 5. program_activations
--    Tracks which program a user is currently running and their position
--    within it. One active program per user (UNIQUE on user_id).
-- ---------------------------------------------------------------------------
CREATE TABLE program_activations (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    program_id              UUID    NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    current_block_ordinal   INTEGER NOT NULL DEFAULT 1 CHECK (current_block_ordinal >= 1),
    current_week_number     INTEGER NOT NULL DEFAULT 1 CHECK (current_week_number >= 1),
    start_date              DATE    NOT NULL DEFAULT CURRENT_DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE program_activations IS 'Tracks the currently active program for each user and their position within it.';
COMMENT ON COLUMN program_activations.user_id IS 'Owning user. UNIQUE constraint ensures one active program per user.';
COMMENT ON COLUMN program_activations.program_id IS 'The program the user is currently running.';
COMMENT ON COLUMN program_activations.current_block_ordinal IS 'Ordinal of the block the user is currently in. Starts at 1.';
COMMENT ON COLUMN program_activations.current_week_number IS 'Week number within the current block. Starts at 1.';
COMMENT ON COLUMN program_activations.start_date IS 'Date the user activated (started) this program.';
COMMENT ON COLUMN program_activations.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN program_activations.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 6. Indices
-- ---------------------------------------------------------------------------
CREATE INDEX idx_programs_user ON programs(user_id);
CREATE INDEX idx_blocks_program ON blocks(program_id);
CREATE INDEX idx_block_weeks_block ON block_weeks(block_id);
CREATE INDEX idx_scheduled_sessions_week ON scheduled_sessions(block_week_id);
CREATE INDEX idx_scheduled_sessions_template ON scheduled_sessions(session_template_id);
CREATE INDEX idx_program_activations_program ON program_activations(program_id);

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

-- programs: direct user_id check
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programs_select"
    ON programs FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "programs_insert"
    ON programs FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "programs_update"
    ON programs FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "programs_delete"
    ON programs FOR DELETE
    USING (user_id = auth.uid());

-- blocks: ownership validated via join to programs
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select"
    ON blocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = blocks.program_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "blocks_insert"
    ON blocks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = blocks.program_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "blocks_update"
    ON blocks FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = blocks.program_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "blocks_delete"
    ON blocks FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = blocks.program_id
          AND programs.user_id = auth.uid()
    ));

-- block_weeks: ownership validated via join through blocks -> programs
ALTER TABLE block_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block_weeks_select"
    ON block_weeks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM blocks
        JOIN programs ON programs.id = blocks.program_id
        WHERE blocks.id = block_weeks.block_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "block_weeks_insert"
    ON block_weeks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM blocks
        JOIN programs ON programs.id = blocks.program_id
        WHERE blocks.id = block_weeks.block_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "block_weeks_update"
    ON block_weeks FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM blocks
        JOIN programs ON programs.id = blocks.program_id
        WHERE blocks.id = block_weeks.block_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "block_weeks_delete"
    ON block_weeks FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM blocks
        JOIN programs ON programs.id = blocks.program_id
        WHERE blocks.id = block_weeks.block_id
          AND programs.user_id = auth.uid()
    ));

-- scheduled_sessions: ownership validated via join through block_weeks -> blocks -> programs
ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_sessions_select"
    ON scheduled_sessions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM block_weeks
        JOIN blocks ON blocks.id = block_weeks.block_id
        JOIN programs ON programs.id = blocks.program_id
        WHERE block_weeks.id = scheduled_sessions.block_week_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "scheduled_sessions_insert"
    ON scheduled_sessions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM block_weeks
        JOIN blocks ON blocks.id = block_weeks.block_id
        JOIN programs ON programs.id = blocks.program_id
        WHERE block_weeks.id = scheduled_sessions.block_week_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "scheduled_sessions_update"
    ON scheduled_sessions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM block_weeks
        JOIN blocks ON blocks.id = block_weeks.block_id
        JOIN programs ON programs.id = blocks.program_id
        WHERE block_weeks.id = scheduled_sessions.block_week_id
          AND programs.user_id = auth.uid()
    ));

CREATE POLICY "scheduled_sessions_delete"
    ON scheduled_sessions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM block_weeks
        JOIN blocks ON blocks.id = block_weeks.block_id
        JOIN programs ON programs.id = blocks.program_id
        WHERE block_weeks.id = scheduled_sessions.block_week_id
          AND programs.user_id = auth.uid()
    ));

-- program_activations: direct user_id check
ALTER TABLE program_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "program_activations_select"
    ON program_activations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "program_activations_insert"
    ON program_activations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "program_activations_update"
    ON program_activations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "program_activations_delete"
    ON program_activations FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. Triggers: automatic updated_at
--    Reuses the shared update_updated_at_column() trigger function.
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_blocks_updated_at BEFORE UPDATE ON blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_block_weeks_updated_at BEFORE UPDATE ON block_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_scheduled_sessions_updated_at BEFORE UPDATE ON scheduled_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_program_activations_updated_at BEFORE UPDATE ON program_activations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
