-- =============================================================================
-- Migration: Add Public Visibility
-- Description: Adds public visibility support for programs, session templates,
--              and exercises. Includes is_public columns, RLS SELECT policies
--              for authenticated public reads, partial indexes, publish RPCs,
--              and a clone_session_template RPC for the discovery layer (F016).
-- =============================================================================


-- =========================================================================
-- SECTION 1: SCHEMA CHANGES
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 1a. session_templates: add is_public column
-- ---------------------------------------------------------------------------
ALTER TABLE session_templates
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN session_templates.is_public
    IS 'Whether the template is publicly visible for discovery. Defaults to false.';

-- ---------------------------------------------------------------------------
-- 1b. exercises: add is_public column
-- ---------------------------------------------------------------------------
ALTER TABLE exercises
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN exercises.is_public
    IS 'Whether the custom exercise is publicly visible. Only custom exercises (is_custom=true) may be public.';

-- ---------------------------------------------------------------------------
-- 1c. exercises: update constraint so is_public=true requires is_custom=true
--     Drop the old constraint and re-create with the additional guard.
-- ---------------------------------------------------------------------------
ALTER TABLE exercises
    DROP CONSTRAINT exercises_custom_user_check;

ALTER TABLE exercises
    ADD CONSTRAINT exercises_custom_user_check CHECK (
        (is_custom = true AND user_id IS NOT NULL) OR
        (is_custom = false AND user_id IS NULL AND is_public = false)
    );


-- =========================================================================
-- SECTION 2: RLS POLICIES FOR PUBLIC SELECT
-- =========================================================================

-- programs: any authenticated user can read public programs
CREATE POLICY "programs_public_select"
    ON programs FOR SELECT
    USING (is_public = true);

-- blocks: readable when parent program is public
CREATE POLICY "blocks_public_select"
    ON blocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM programs
        WHERE programs.id = blocks.program_id
          AND programs.is_public = true
    ));

-- block_weeks: readable when ancestor program is public
CREATE POLICY "block_weeks_public_select"
    ON block_weeks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM blocks
        JOIN programs ON programs.id = blocks.program_id
        WHERE blocks.id = block_weeks.block_id
          AND programs.is_public = true
    ));

-- scheduled_sessions: readable when ancestor program is public
CREATE POLICY "scheduled_sessions_public_select"
    ON scheduled_sessions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM block_weeks
        JOIN blocks ON blocks.id = block_weeks.block_id
        JOIN programs ON programs.id = blocks.program_id
        WHERE block_weeks.id = scheduled_sessions.block_week_id
          AND programs.is_public = true
    ));

-- session_templates: any authenticated user can read public templates
CREATE POLICY "session_templates_public_select"
    ON session_templates FOR SELECT
    USING (is_public = true);

-- activity_groups: readable when parent template is public
CREATE POLICY "activity_groups_public_select"
    ON activity_groups FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM session_templates
        WHERE session_templates.id = activity_groups.session_template_id
          AND session_templates.is_public = true
    ));

-- activities: readable when ancestor template is public
CREATE POLICY "activities_public_select"
    ON activities FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM activity_groups
        JOIN session_templates ON session_templates.id = activity_groups.session_template_id
        WHERE activity_groups.id = activities.activity_group_id
          AND session_templates.is_public = true
    ));

-- exercises: public custom exercises readable by any authenticated user
CREATE POLICY "exercises_public_select"
    ON exercises FOR SELECT
    USING (is_custom = true AND is_public = true);


-- =========================================================================
-- SECTION 3: PARTIAL INDEXES FOR PUBLIC QUERIES
-- =========================================================================

CREATE INDEX idx_programs_is_public
    ON programs (id) WHERE is_public = true;

CREATE INDEX idx_session_templates_is_public
    ON session_templates (id) WHERE is_public = true;

CREATE INDEX idx_exercises_is_public
    ON exercises (id) WHERE is_public = true;


-- =========================================================================
-- SECTION 4: PUBLISH RPCs
-- =========================================================================

-- ---------------------------------------------------------------------------
-- 4a. publish_program
--     Marks a program and all its referenced session templates and custom
--     exercises as public. Only the owning user may call this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION publish_program(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    -- Verify ownership
    SELECT user_id INTO v_owner_id
    FROM programs
    WHERE id = p_program_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Program not found: %', p_program_id;
    END IF;

    IF v_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Only the program owner may publish this program';
    END IF;

    -- Mark program as public
    UPDATE programs
    SET is_public = true, updated_at = now()
    WHERE id = p_program_id;

    -- Mark all session templates referenced by the program as public
    UPDATE session_templates
    SET is_public = true, updated_at = now()
    WHERE id IN (
        SELECT DISTINCT ss.session_template_id
        FROM scheduled_sessions ss
        JOIN block_weeks bw ON bw.id = ss.block_week_id
        JOIN blocks b ON b.id = bw.block_id
        WHERE b.program_id = p_program_id
    );

    -- Mark all custom exercises referenced by those templates as public
    UPDATE exercises
    SET is_public = true, updated_at = now()
    WHERE is_custom = true
      AND id IN (
        SELECT DISTINCT a.exercise_id
        FROM activities a
        JOIN activity_groups ag ON ag.id = a.activity_group_id
        JOIN session_templates st ON st.id = ag.session_template_id
        WHERE st.id IN (
            SELECT DISTINCT ss.session_template_id
            FROM scheduled_sessions ss
            JOIN block_weeks bw ON bw.id = ss.block_week_id
            JOIN blocks b ON b.id = bw.block_id
            WHERE b.program_id = p_program_id
        )
    );
END;
$$;

COMMENT ON FUNCTION publish_program(UUID)
    IS 'Publishes a program and all its referenced session templates and custom exercises. Owner-only.';

-- ---------------------------------------------------------------------------
-- 4b. publish_session_template
--     Marks a session template and all its referenced custom exercises as
--     public. Only the owning user may call this.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION publish_session_template(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    -- Verify ownership
    SELECT user_id INTO v_owner_id
    FROM session_templates
    WHERE id = p_template_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Session template not found: %', p_template_id;
    END IF;

    IF v_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Only the template owner may publish this template';
    END IF;

    -- Mark template as public
    UPDATE session_templates
    SET is_public = true, updated_at = now()
    WHERE id = p_template_id;

    -- Mark all custom exercises referenced by this template as public
    UPDATE exercises
    SET is_public = true, updated_at = now()
    WHERE is_custom = true
      AND id IN (
        SELECT DISTINCT a.exercise_id
        FROM activities a
        JOIN activity_groups ag ON ag.id = a.activity_group_id
        WHERE ag.session_template_id = p_template_id
    );
END;
$$;

COMMENT ON FUNCTION publish_session_template(UUID)
    IS 'Publishes a session template and all its referenced custom exercises. Owner-only.';


-- =========================================================================
-- SECTION 5: CLONE RPC
-- =========================================================================

-- ---------------------------------------------------------------------------
-- clone_session_template
--     Deep-copies a session template (with activity groups and activities)
--     for the calling user. Exercise references are preserved as-is.
--     Returns the new template UUID.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clone_session_template(
    p_template_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_template_id UUID;
    v_old_group_id UUID;
    v_new_group_id UUID;
BEGIN
    -- Copy the template with a new ID, owned by p_user_id, not public
    INSERT INTO session_templates (
        user_id, name, description, category,
        rest_between_groups, time_cap, scoring, is_public
    )
    SELECT
        p_user_id, name, description, category,
        rest_between_groups, time_cap, scoring, false
    FROM session_templates
    WHERE id = p_template_id
    RETURNING id INTO v_new_template_id;

    IF v_new_template_id IS NULL THEN
        RAISE EXCEPTION 'Session template not found: %', p_template_id;
    END IF;

    -- Deep-copy activity groups and their activities
    FOR v_old_group_id, v_new_group_id IN
        WITH old_groups AS (
            SELECT id, group_type, ordinal, rounds, rest_between_rounds, rest_between_activities
            FROM activity_groups WHERE session_template_id = p_template_id
        )
        INSERT INTO activity_groups (session_template_id, group_type, ordinal, rounds, rest_between_rounds, rest_between_activities)
        SELECT v_new_template_id, group_type, ordinal, rounds, rest_between_rounds, rest_between_activities
        FROM old_groups
        RETURNING (SELECT id FROM activity_groups orig
                   WHERE orig.session_template_id = p_template_id
                     AND orig.ordinal = activity_groups.ordinal) AS old_id,
                 id AS new_id
    LOOP
        INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme, notes)
        SELECT v_new_group_id, exercise_id, ordinal, set_scheme, notes
        FROM activities WHERE activity_group_id = v_old_group_id;
    END LOOP;

    RETURN v_new_template_id;
END;
$$;

COMMENT ON FUNCTION clone_session_template(UUID, UUID)
    IS 'Deep-copies a session template with all activity groups and activities. Returns the new template ID.';
