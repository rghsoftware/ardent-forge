-- =============================================================================
-- Migration: Assign Program to Member RPC
-- Description: SECURITY DEFINER function that atomically reassigns a program
--              (and its associated session_templates) from the calling coach
--              to a target group member. Validates caller is COACH, target is
--              MEMBER, and program is owned by the caller before proceeding.
-- Depends on: 20260326000001_create_phase0_tables.sql (group_members)
--             20260328000001_create_session_template_tables.sql (session_templates)
--             20260328000002_create_program_tables.sql (programs, blocks, block_weeks, scheduled_sessions)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RPC: assign_program_to_member
--    Transfers ownership of a program and its referenced session_templates
--    from the calling coach to a target group member. Runs as a single
--    transaction with three validation checks before the updates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_program_to_member(
    p_program_id   UUID,
    p_target_user_id UUID,
    p_group_id     UUID
)
RETURNS programs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_program   programs;
BEGIN
    -- Validate caller is COACH in the group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = v_caller_id
          AND role = 'COACH'
    ) THEN
        RAISE EXCEPTION 'unauthorized: caller is not a coach in this group';
    END IF;

    -- Validate target is MEMBER in the group
    IF NOT EXISTS (
        SELECT 1 FROM group_members
        WHERE group_id = p_group_id
          AND user_id = p_target_user_id
          AND role = 'MEMBER'
    ) THEN
        RAISE EXCEPTION 'unauthorized: target user is not a member of this group';
    END IF;

    -- Validate program is owned by caller
    IF NOT EXISTS (
        SELECT 1 FROM programs
        WHERE id = p_program_id
          AND user_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'not_found: program not found or not owned by caller';
    END IF;

    -- Update session_templates referenced by this program
    UPDATE session_templates
    SET user_id = p_target_user_id
    WHERE id IN (
        SELECT ss.session_template_id
        FROM scheduled_sessions ss
        JOIN block_weeks bw ON ss.block_week_id = bw.id
        JOIN blocks b ON bw.block_id = b.id
        WHERE b.program_id = p_program_id
          AND ss.session_template_id IS NOT NULL
    );

    -- Update program ownership and tag as coach-assigned
    UPDATE programs
    SET user_id = p_target_user_id,
        source = 'COACH_ASSIGNED',
        created_by = v_caller_id
    WHERE id = p_program_id
    RETURNING * INTO v_program;

    -- Clear coach's active program if it was the assigned program
    DELETE FROM program_activations
    WHERE user_id = v_caller_id
      AND program_id = p_program_id;

    RETURN v_program;
END;
$$;

COMMENT ON FUNCTION assign_program_to_member(UUID, UUID, UUID) IS 'Atomically reassigns a program and its session_templates from the calling coach to a target group member. SECURITY DEFINER with internal authorization checks.';

-- ---------------------------------------------------------------------------
-- 2. Grants -- only authenticated users may call this function
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION assign_program_to_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_program_to_member TO authenticated;
