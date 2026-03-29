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
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE share_links IS 'Read-only share links for programs and workout logs (invariant SH-8).';
COMMENT ON COLUMN share_links.token IS 'Unique opaque token used in share URLs. Indexed for fast lookups.';
COMMENT ON COLUMN share_links.entity_type IS 'Type of shared entity: PROGRAM or WORKOUT_LOG.';
COMMENT ON COLUMN share_links.entity_id IS 'UUID of the shared entity (program or workout log).';
COMMENT ON COLUMN share_links.created_by IS 'User who created this share link. Cascade-deletes when user is removed.';
COMMENT ON COLUMN share_links.is_active IS 'Whether the link is currently active. Deactivated links return nothing.';
COMMENT ON COLUMN share_links.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN share_links.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 2. Indices
-- ---------------------------------------------------------------------------

-- token lookups (UNIQUE constraint creates an implicit index, but we add
-- an explicit one for clarity and to match the codebase convention)
CREATE INDEX idx_share_links_token ON share_links(token);

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
    created_at  TIMESTAMPTZ
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
        sl.created_at
    FROM share_links sl
    WHERE sl.token = lookup_token
      AND sl.is_active = true;
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
      AND entity_type = 'PROGRAM';

    IF v_entity_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Build full program hierarchy
    SELECT jsonb_build_object(
        'program', row_to_json(p.*),
        'blocks', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'block', row_to_json(b.*),
                    'weeks', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'week', row_to_json(bw.*),
                                'sessions', (
                                    SELECT COALESCE(jsonb_agg(row_to_json(ss.*)), '[]'::jsonb)
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
                    'template', row_to_json(st.*),
                    'activityGroups', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'group', row_to_json(ag.*),
                                'activities', (
                                    SELECT COALESCE(jsonb_agg(row_to_json(a.*)), '[]'::jsonb)
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
      AND entity_type = 'WORKOUT_LOG';

    IF v_entity_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Build workout hierarchy excluding private fields
    SELECT jsonb_build_object(
        'workoutLog', (
            SELECT jsonb_build_object(
                'id', wl.id,
                'userId', wl.user_id,
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
                    'group', row_to_json(lag_.*),
                    'activities', (
                        SELECT COALESCE(jsonb_agg(
                            jsonb_build_object(
                                'activity', row_to_json(la.*),
                                'sets', (
                                    SELECT COALESCE(jsonb_agg(row_to_json(ls.*)), '[]'::jsonb)
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
