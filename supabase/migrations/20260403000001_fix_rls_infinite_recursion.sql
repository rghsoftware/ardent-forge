-- =============================================================================
-- Migration: Fix RLS Infinite Recursion
-- Description: The group_members and conversation_participants SELECT policies
--              self-reference their own table, causing PostgreSQL error 42P17
--              (infinite recursion). This also breaks all queries on tables
--              whose sharing policies reference group_members (workout_logs,
--              session_templates, logged_activity_groups, logged_activities,
--              logged_sets).
--
--              Fix: create SECURITY DEFINER helper functions that bypass RLS
--              for the inner membership lookups, then replace the affected
--              policies to use those helpers.
-- =============================================================================


-- ============================================================================
-- SECTION 1: SECURITY DEFINER helper functions
-- These run with the definer's privileges (bypassing RLS on the target table)
-- while still reading auth.uid() from the caller's JWT context.
-- ============================================================================

-- Helper: check if auth.uid() is a member of a given group
CREATE OR REPLACE FUNCTION is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id
          AND user_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION is_group_member(uuid) IS
    'SECURITY DEFINER helper: returns true when auth.uid() is a member of the given group. '
    'Bypasses RLS to prevent infinite recursion in group_members policies.';

-- Helper: check if auth.uid() is a COACH in a given group
CREATE OR REPLACE FUNCTION is_group_coach(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id
          AND user_id = auth.uid()
          AND role = 'COACH'
    );
$$;

COMMENT ON FUNCTION is_group_coach(uuid) IS
    'SECURITY DEFINER helper: returns true when auth.uid() is a COACH in the given group. '
    'Bypasses RLS to prevent infinite recursion in group_members policies.';

-- Helper: check if auth.uid() is an active participant of a given conversation
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = p_conversation_id
          AND user_id = auth.uid()
          AND left_at IS NULL
    );
$$;

COMMENT ON FUNCTION is_conversation_participant(uuid) IS
    'SECURITY DEFINER helper: returns true when auth.uid() is an active participant '
    'in the given conversation. Bypasses RLS to prevent infinite recursion in '
    'conversation_participants policies.';


-- ============================================================================
-- SECTION 2: Replace group_members policies
-- ============================================================================

-- DROP existing self-referencing policies
DROP POLICY IF EXISTS "group_members_select" ON group_members;
DROP POLICY IF EXISTS "group_members_insert" ON group_members;
DROP POLICY IF EXISTS "group_members_update" ON group_members;
DROP POLICY IF EXISTS "group_members_delete" ON group_members;

-- Recreate without self-reference
CREATE POLICY "group_members_select"
    ON group_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_group_member(group_members.group_id)
    );

CREATE POLICY "group_members_insert"
    ON group_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR is_group_coach(group_members.group_id)
    );

CREATE POLICY "group_members_update"
    ON group_members FOR UPDATE
    USING (
        user_id = auth.uid()
        OR is_group_coach(group_members.group_id)
    );

CREATE POLICY "group_members_delete"
    ON group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR is_group_coach(group_members.group_id)
    );


-- ============================================================================
-- SECTION 3: Replace conversation_participants policies
-- ============================================================================

-- DROP existing self-referencing policies
DROP POLICY IF EXISTS "cp_select_fellow_participant" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert_self_or_group_member" ON conversation_participants;

-- Recreate without self-reference
CREATE POLICY "cp_select_fellow_participant"
    ON conversation_participants FOR SELECT
    USING (
        is_conversation_participant(conversation_participants.conversation_id)
    );

CREATE POLICY "cp_insert_self_or_group_member"
    ON conversation_participants FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR (
            EXISTS (
                SELECT 1 FROM conversations c
                WHERE c.id = conversation_participants.conversation_id
                  AND c.type = 'group'
            )
            AND is_conversation_participant(conversation_participants.conversation_id)
        )
    );
