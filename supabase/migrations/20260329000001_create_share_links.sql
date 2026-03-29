-- =============================================================================
-- Migration: Create Share Links
-- Description: Read-only share links for programs and workout logs. Includes
--              the share_links table with RLS, SECURITY DEFINER RPC functions
--              for public token resolution and shared entity retrieval.
-- Depends on: 20260326000001_create_phase0_tables.sql (workout_logs hierarchy)
--             20260328000001_create_session_template_tables.sql (session templates)
--             20260328000002_create_program_tables.sql (program hierarchy)
-- Invariant SH-8: stateless, no ongoing relationship
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. share_links table
--    Read-only share links for programs and workout logs.
--    Token is a unique, opaque string used in URLs.
-- ---------------------------------------------------------------------------
CREATE TABLE share_links (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token           TEXT        NOT NULL UNIQUE,
    entity_type     TEXT        NOT NULL CHECK (entity_type IN ('PROGRAM', 'WORKOUT_LOG')),
    entity_id       UUID        NOT NULL,
    created_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ         -- NULL means no expiry; non-NULL enforces time-limited links
);

COMMENT ON TABLE share_links IS 'Read-only share links for programs and workout logs (invariant SH-8).';
COMMENT ON COLUMN share_links.token IS 'Unique opaque token used in share URLs. Indexed for fast lookups.';
COMMENT ON COLUMN share_links.entity_type IS 'Type of shared entity: PROGRAM or WORKOUT_LOG.';
COMMENT ON COLUMN share_links.entity_id IS 'UUID of the shared entity (program or workout log).';
COMMENT ON COLUMN share_links.created_by IS 'User who created this share link. Cascade-deletes when user is removed.';
COMMENT ON COLUMN share_links.is_active IS 'Whether the link is currently active. Deactivated links return nothing.';
COMMENT ON COLUMN share_links.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN share_links.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';
COMMENT ON COLUMN share_links.expires_at IS 'Optional expiry. NULL = perpetual. Active links with expires_at < now() are treated as expired.';

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------

-- listing a user's share links
CREATE INDEX idx_share_links_created_by ON share_links(created_by);

-- checking existing links for a specific entity
CREATE INDEX idx_share_links_entity ON share_links(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
--    Only the link creator can manage their own share links.
--    Public access to shared content is handled by SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_select"
    ON share_links FOR SELECT
    USING (created_by = auth.uid());

CREATE POLICY "share_links_insert"
    ON share_links FOR INSERT
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "share_links_update"
    ON share_links FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "share_links_delete"
    ON share_links FOR DELETE
    USING (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Trigger: automatic updated_at
--    Reuses the shared update_updated_at_column() trigger function.
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_share_links_updated_at BEFORE UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. RPC: resolve_share_link
--    Resolves a token to its share link metadata. SECURITY DEFINER so
--    unauthenticated (anon) callers can look up active links.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION resolve_share_link(lookup_token TEXT)
RETURNS TABLE (
    id          UUID,
    token       TEXT,
    entity_type TEXT,
    entity_id   UUID,
    is_active   BOOLEAN,
    created_at  TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.id,
        sl.token,
        sl.entity_type,
        sl.entity_id,
        sl.is_active,
        sl.created_at,
        sl.expires_at
    FROM share_links sl
    WHERE sl.token = lookup_token
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > now());
END;
$$;

COMMENT ON FUNCTION resolve_share_link(TEXT) IS 'Resolves an active share link token to its metadata. SECURITY DEFINER for public access.';

-- ---------------------------------------------------------------------------
-- 6. RPC: get_shared_program
--    Returns the full program hierarchy as JSONB for a valid share token.
--    Session templates are found via scheduled_sessions (there is no direct
--    program_id FK on session_templates).
--    SECURITY DEFINER for public (anon) access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_shared_program(lookup_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entity_id UUID;
    v_result    JSONB;
BEGIN
    -- Validate token and entity type
    SELECT entity_id INTO v_entity_id
    FROM share_links
    WHERE token = lookup_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND entity_type = 'PROGRAM';

    IF v_entity_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Build full program hierarchy
    SELECT jsonb_build_object(
        'program', jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'description', p.description,
            'source', p.source,
            'duration_weeks', p.duration_weeks,
            'is_public', p.is_public,
            'created_at', p.created_at,
            'updated_at', p.updated_at
        ),
        'blocks', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'block', jsonb_build_object(
                        'id', b.id,
                        'program_id', b.program_id,
                        'name', b.name,
                        'ordinal', b.ordinal,
                        'duration_weeks', b.duration_weeks,
                        'block_type', b.block_type
                    ),
                    'weeks', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'week', jsonb_build_object(
                                    'id', bw.id,
                                    'block_id', bw.block_id,
                                    'week_number', bw.week_number
                                ),
                                'sessions', (
                                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                        'id', ss.id,
                                        'block_week_id', ss.block_week_id,
                                        'day_of_week', ss.day_of_week,
                                        'day_label', ss.day_label,
                                        'session_type', ss.session_type,
                                        'session_template_id', ss.session_template_id,
                                        'notes', ss.notes
                                    )), '[]'::jsonb)
                                    FROM scheduled_sessions ss
                                    WHERE ss.block_week_id = bw.id
                                )
                            )
                            ORDER BY bw.week_number
                        ), '[]'::jsonb)
                        FROM block_weeks bw
                        WHERE bw.block_id = b.id
                    )
                )
                ORDER BY b.ordinal
            ), '[]'::jsonb)
            FROM blocks b
            WHERE b.program_id = p.id
        ),
        'sessionTemplates', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'template', jsonb_build_object(
                        'id', st.id,
                        'name', st.name,
                        'notes', st.notes,
                        'created_at', st.created_at,
                        'updated_at', st.updated_at
                    ),
                    'activityGroups', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'group', jsonb_build_object(
                                    'id', ag.id,
                                    'session_template_id', ag.session_template_id,
                                    'name', ag.name,
                                    'ordinal', ag.ordinal
                                ),
                                'activities', (
                                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                        'id', a.id,
                                        'activity_group_id', a.activity_group_id,
                                        'exercise_id', a.exercise_id,
                                        'ordinal', a.ordinal,
                                        'set_scheme', a.set_scheme
                                    )), '[]'::jsonb)
                                    FROM activities a
                                    WHERE a.activity_group_id = ag.id
                                )
                            )
                            ORDER BY ag.ordinal
                        ), '[]'::jsonb)
                        FROM activity_groups ag
                        WHERE ag.session_template_id = st.id
                    )
                )
            ), '[]'::jsonb)
            FROM session_templates st
            WHERE st.id IN (
                SELECT DISTINCT ss2.session_template_id
                FROM scheduled_sessions ss2
                JOIN block_weeks bw2 ON bw2.id = ss2.block_week_id
                JOIN blocks b2 ON b2.id = bw2.block_id
                WHERE b2.program_id = p.id
            )
        )
    ) INTO v_result
    FROM programs p
    WHERE p.id = v_entity_id;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_shared_program(TEXT) IS 'Returns the full program hierarchy (blocks, weeks, sessions, templates, activities) as JSONB for a valid share token. SECURITY DEFINER for public access.';

-- ---------------------------------------------------------------------------
-- 7. RPC: get_shared_workout
--    Returns a workout log hierarchy as JSONB for a valid share token.
--    Private fields (perceived_difficulty, bodyweight_at_session,
--    overall_notes) are excluded from the response.
--    SECURITY DEFINER for public (anon) access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_shared_workout(lookup_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entity_id UUID;
    v_result    JSONB;
BEGIN
    -- Validate token and entity type
    SELECT entity_id INTO v_entity_id
    FROM share_links
    WHERE token = lookup_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND entity_type = 'WORKOUT_LOG';

    IF v_entity_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Build workout hierarchy excluding private fields
    SELECT jsonb_build_object(
        'workoutLog', (
            SELECT jsonb_build_object(
                'id', wl.id,
                'title', wl.title,
                'startedAt', wl.started_at,
                'completedAt', wl.completed_at,
                'sessionTemplateId', wl.session_template_id,
                'programContext', wl.program_context,
                'status', CASE
                    WHEN wl.completed_at IS NOT NULL THEN 'COMPLETED'
                    ELSE 'IN_PROGRESS'
                END,
                'durationSeconds', CASE
                    WHEN wl.completed_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (wl.completed_at - wl.started_at))::integer
                    ELSE NULL
                END,
                'createdAt', wl.created_at,
                'updatedAt', wl.updated_at
            )
            FROM workout_logs wl
            WHERE wl.id = v_entity_id
        ),
        'activityGroups', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'group', jsonb_build_object(
                        'id', lag_.id,
                        'workout_log_id', lag_.workout_log_id,
                        'name', lag_.name,
                        'ordinal', lag_.ordinal
                    ),
                    'activities', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'activity', jsonb_build_object(
                                    'id', la.id,
                                    'logged_group_id', la.logged_group_id,
                                    'exercise_id', la.exercise_id,
                                    'ordinal', la.ordinal
                                ),
                                'sets', (
                                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                        'id', ls.id,
                                        'logged_activity_id', ls.logged_activity_id,
                                        'set_number', ls.set_number,
                                        'reps_completed', ls.reps_completed,
                                        'weight_kg', ls.weight_kg,
                                        'duration_seconds', ls.duration_seconds,
                                        'distance_meters', ls.distance_meters,
                                        'notes', ls.notes,
                                        'completed_at', ls.completed_at
                                    )), '[]'::jsonb)
                                    FROM logged_sets ls
                                    WHERE ls.logged_activity_id = la.id
                                )
                            )
                            ORDER BY la.ordinal
                        ), '[]'::jsonb)
                        FROM logged_activities la
                        WHERE la.logged_group_id = lag_.id
                    )
                )
                ORDER BY lag_.ordinal
            ), '[]'::jsonb)
            FROM logged_activity_groups lag_
            WHERE lag_.workout_log_id = v_entity_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_shared_workout(TEXT) IS 'Returns a workout log hierarchy (activity groups, activities, sets) as JSONB for a valid share token. Excludes private fields. SECURITY DEFINER for public access.';

-- ---------------------------------------------------------------------------
-- 8. Grants -- allow anon and authenticated roles to call public RPCs
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION resolve_share_link(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shared_program(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shared_workout(TEXT) TO anon, authenticated;
