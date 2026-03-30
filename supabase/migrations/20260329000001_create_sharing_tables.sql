-- =============================================================================
-- Migration: Create Sharing Tables
-- Description: Accountability groups, group members, group invites, and direct
--              connections for the sharing and coaching feature set.
--              Implements invariants SH-1 through SH-9 from docs/06-invariants.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. accountability_groups
--    A small group of users sharing training accountability. Groups support
--    optional coach roles with asymmetric read/write visibility. The owner
--    (user_id) is the user who created the group and has full admin rights.
--    Invariant SH-4: max 20 members, max 3 coaches (enforced via trigger on
--    group_members). Max 5 groups per user enforced at the adapter layer.
-- ---------------------------------------------------------------------------
CREATE TABLE accountability_groups (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description         TEXT,
    data_retention_days INTEGER     NOT NULL DEFAULT 30 CHECK (data_retention_days BETWEEN 1 AND 90),
    created_by          UUID        NOT NULL REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE accountability_groups IS 'Accountability groups for mutual training visibility and optional coaching.';
COMMENT ON COLUMN accountability_groups.id IS 'Primary key. Auto-generated UUID.';
COMMENT ON COLUMN accountability_groups.user_id IS 'Group owner/creator. Has full admin rights over the group.';
COMMENT ON COLUMN accountability_groups.name IS 'Group display name. Must be 1-200 characters.';
COMMENT ON COLUMN accountability_groups.description IS 'Optional free-text description of the group purpose.';
COMMENT ON COLUMN accountability_groups.data_retention_days IS 'Days to retain a departed member''s data in group view. 1-90, default 30.';
COMMENT ON COLUMN accountability_groups.created_by IS 'User who originally created the group. Audit trail field.';
COMMENT ON COLUMN accountability_groups.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN accountability_groups.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 2. group_members
--    Membership records linking users to accountability groups. Each member
--    has a role (COACH or MEMBER) determining their visibility and write
--    permissions within the group.
--    Invariant SH-4: max 20 members per group, max 3 coaches per group.
--    Invariant SH-9: share_history_before_join controls pre-join log visibility.
-- ---------------------------------------------------------------------------
CREATE TABLE group_members (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id                    UUID        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
    user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role                        TEXT        NOT NULL CHECK (role IN ('COACH', 'MEMBER')),
    share_history_before_join   BOOLEAN     NOT NULL DEFAULT false,
    joined_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);

COMMENT ON TABLE group_members IS 'Membership records linking users to accountability groups with role-based permissions.';
COMMENT ON COLUMN group_members.id IS 'Primary key. Auto-generated UUID.';
COMMENT ON COLUMN group_members.group_id IS 'Parent group. Cascade-deletes when the group is removed.';
COMMENT ON COLUMN group_members.user_id IS 'The member user. Cascade-deletes when the user is removed.';
COMMENT ON COLUMN group_members.role IS 'Member role: COACH (read all, write programs) or MEMBER (read peers only).';
COMMENT ON COLUMN group_members.share_history_before_join IS 'Whether pre-join workout history is visible to the group. Default false. Invariant SH-9.';
COMMENT ON COLUMN group_members.joined_at IS 'Timestamp when the user joined the group.';
COMMENT ON COLUMN group_members.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN group_members.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 3. group_invites
--    Invite codes for joining an accountability group. Codes follow the
--    format AF-{8 alphanumeric}. Invites can be revoked and have an
--    expiration date.
--    Invariant SH-5: code uniqueness enforced via UNIQUE constraint;
--    expiration checked at query time.
-- ---------------------------------------------------------------------------
CREATE TABLE group_invites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    UUID        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
    code        TEXT        NOT NULL UNIQUE DEFAULT ('AF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
    created_by  UUID        NOT NULL REFERENCES auth.users(id),
    expires_at  TIMESTAMPTZ NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE group_invites IS 'Invite codes for joining accountability groups. Codes are revocable and time-limited.';
COMMENT ON COLUMN group_invites.id IS 'Primary key. Auto-generated UUID.';
COMMENT ON COLUMN group_invites.group_id IS 'Target group. Cascade-deletes when the group is removed.';
COMMENT ON COLUMN group_invites.code IS 'Unique invite code in AF-XXXXXXXX format. Auto-generated from UUID.';
COMMENT ON COLUMN group_invites.created_by IS 'Coach or owner who created the invite.';
COMMENT ON COLUMN group_invites.expires_at IS 'Expiration timestamp. Invite is invalid after this time.';
COMMENT ON COLUMN group_invites.is_active IS 'Whether the invite is currently active. Set to false to revoke.';
COMMENT ON COLUMN group_invites.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN group_invites.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 4. direct_connections
--    Peer-to-peer accountability links between two users. Connections are
--    mutual once accepted: both users see each other's workout logs.
--    Write access is independently grantable per direction.
--    Invariant SH-6: mutual visibility when status is ACTIVE.
-- ---------------------------------------------------------------------------
CREATE TABLE direct_connections (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status                  TEXT        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DECLINED')),
    requester_grants_write  BOOLEAN     NOT NULL DEFAULT false,
    recipient_grants_write  BOOLEAN     NOT NULL DEFAULT false,
    accepted_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (requester_id, recipient_id),
    CHECK (requester_id != recipient_id),
    CHECK (status != 'ACTIVE' OR accepted_at IS NOT NULL)
);

COMMENT ON TABLE direct_connections IS 'Peer-to-peer accountability links with optional per-direction write access.';
COMMENT ON COLUMN direct_connections.id IS 'Primary key. Auto-generated UUID.';
COMMENT ON COLUMN direct_connections.requester_id IS 'User who initiated the connection request.';
COMMENT ON COLUMN direct_connections.recipient_id IS 'User who received the connection request.';
COMMENT ON COLUMN direct_connections.status IS 'Connection lifecycle: PENDING, ACTIVE, or DECLINED.';
COMMENT ON COLUMN direct_connections.requester_grants_write IS 'Whether the requester grants write access to the recipient. Default false.';
COMMENT ON COLUMN direct_connections.recipient_grants_write IS 'Whether the recipient grants write access to the requester. Default false.';
COMMENT ON COLUMN direct_connections.accepted_at IS 'Timestamp when the connection was accepted. NULL until status becomes ACTIVE.';
COMMENT ON COLUMN direct_connections.created_at IS 'Row creation timestamp.';
COMMENT ON COLUMN direct_connections.updated_at IS 'Row last-modified timestamp. Auto-updated by trigger.';

-- ---------------------------------------------------------------------------
-- 5. Indices
--    Recommendations from docs/05-domain-model.md Query Optimization Notes.
-- ---------------------------------------------------------------------------
CREATE INDEX idx_group_members_group       ON group_members(group_id);
CREATE INDEX idx_group_members_user        ON group_members(user_id);
CREATE INDEX idx_group_invites_code        ON group_invites(code);
CREATE INDEX idx_group_invites_group       ON group_invites(group_id);
CREATE INDEX idx_direct_connections_req    ON direct_connections(requester_id);
CREATE INDEX idx_direct_connections_rec    ON direct_connections(recipient_id);
CREATE INDEX idx_direct_connections_pair   ON direct_connections(requester_id, recipient_id);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------

-- accountability_groups: owner or any member can read; only owner can mutate
ALTER TABLE accountability_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accountability_groups_select"
    ON accountability_groups FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = accountability_groups.id
              AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "accountability_groups_insert"
    ON accountability_groups FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND created_by = auth.uid()
    );

CREATE POLICY "accountability_groups_update"
    ON accountability_groups FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "accountability_groups_delete"
    ON accountability_groups FOR DELETE
    USING (user_id = auth.uid());

-- group_members: visible to fellow group members; insertable by coaches or self-join
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select"
    ON group_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members gm2
            WHERE gm2.group_id = group_members.group_id
              AND gm2.user_id = auth.uid()
        )
    );

CREATE POLICY "group_members_insert"
    ON group_members FOR INSERT
    WITH CHECK (
        -- A user inserting themselves (joining via invite, handled at function level)
        user_id = auth.uid()
        -- Or a COACH in the group adding a member
        OR EXISTS (
            SELECT 1 FROM group_members gm_coach
            WHERE gm_coach.group_id = group_members.group_id
              AND gm_coach.user_id = auth.uid()
              AND gm_coach.role = 'COACH'
        )
    );

CREATE POLICY "group_members_update"
    ON group_members FOR UPDATE
    USING (
        -- Member can update their own record (e.g. share_history_before_join)
        user_id = auth.uid()
        -- Or a COACH in the group can update member roles
        OR EXISTS (
            SELECT 1 FROM group_members gm_coach
            WHERE gm_coach.group_id = group_members.group_id
              AND gm_coach.user_id = auth.uid()
              AND gm_coach.role = 'COACH'
        )
    );

CREATE POLICY "group_members_delete"
    ON group_members FOR DELETE
    USING (
        -- Member can leave (delete own record)
        user_id = auth.uid()
        -- Or a COACH in the group can remove members
        OR EXISTS (
            SELECT 1 FROM group_members gm_coach
            WHERE gm_coach.group_id = group_members.group_id
              AND gm_coach.user_id = auth.uid()
              AND gm_coach.role = 'COACH'
        )
    );

-- group_invites: visible to coaches and the invite creator
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_invites_select"
    ON group_invites FOR SELECT
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_invites.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'COACH'
        )
    );

CREATE POLICY "group_invites_insert"
    ON group_invites FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_invites.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'COACH'
        )
    );

CREATE POLICY "group_invites_update"
    ON group_invites FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_invites.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'COACH'
        )
    );

CREATE POLICY "group_invites_delete"
    ON group_invites FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = group_invites.group_id
              AND group_members.user_id = auth.uid()
              AND group_members.role = 'COACH'
        )
    );

-- direct_connections: both parties can see and manage the connection
ALTER TABLE direct_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "direct_connections_select"
    ON direct_connections FOR SELECT
    USING (
        requester_id = auth.uid()
        OR recipient_id = auth.uid()
    );

CREATE POLICY "direct_connections_insert"
    ON direct_connections FOR INSERT
    WITH CHECK (requester_id = auth.uid());

CREATE POLICY "direct_connections_update"
    ON direct_connections FOR UPDATE
    USING (
        requester_id = auth.uid()
        OR recipient_id = auth.uid()
    );

CREATE POLICY "direct_connections_delete"
    ON direct_connections FOR DELETE
    USING (
        requester_id = auth.uid()
        OR recipient_id = auth.uid()
    );

-- ---------------------------------------------------------------------------
-- 7. Triggers: automatic updated_at
--    Reuses the shared update_updated_at_column() trigger function from
--    20260326000004_add_triggers.sql.
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_accountability_groups_updated_at BEFORE UPDATE ON accountability_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_group_members_updated_at BEFORE UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_group_invites_updated_at BEFORE UPDATE ON group_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_direct_connections_updated_at BEFORE UPDATE ON direct_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. Group size enforcement trigger
--    Invariant SH-4: max 20 members per group, max 3 coaches per group.
--    NOTE: max 5 groups per user is enforced at the adapter/service layer,
--    not at the database level, to avoid cross-table counting in a trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_group_size_limits()
RETURNS TRIGGER AS $$
DECLARE
    member_count INTEGER;
    coach_count  INTEGER;
BEGIN
    -- Count existing members in the group
    SELECT count(*) INTO member_count
    FROM group_members
    WHERE group_id = NEW.group_id;

    IF member_count >= 20 THEN
        RAISE EXCEPTION 'Group has reached the maximum of 20 members (SH-4)'
            USING ERRCODE = 'check_violation';
    END IF;

    -- If the new member is a coach, check coach limit
    IF NEW.role = 'COACH' THEN
        SELECT count(*) INTO coach_count
        FROM group_members
        WHERE group_id = NEW.group_id
          AND role = 'COACH';

        IF coach_count >= 3 THEN
            RAISE EXCEPTION 'Group has reached the maximum of 3 coaches (SH-4)'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_group_size_limits() IS 'BEFORE INSERT trigger on group_members enforcing SH-4: max 20 members, max 3 coaches per group.';

CREATE TRIGGER enforce_group_size_limits_trigger
    BEFORE INSERT ON group_members
    FOR EACH ROW EXECUTE FUNCTION enforce_group_size_limits();

-- ---------------------------------------------------------------------------
-- Trigger: prevent_role_self_escalation
-- Blocks a non-coach member from promoting their own role.
-- A member may update their own record (e.g. share_history_before_join), but
-- only a COACH in the group may change the role column. (PE-1 fix)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- If the role column is not changing, allow the update.
    IF NEW.role = OLD.role THEN
        RETURN NEW;
    END IF;

    -- Role is changing: the acting user must be a COACH in this group.
    IF NOT EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = NEW.group_id
          AND gm.user_id = auth.uid()
          AND gm.role = 'COACH'
    ) THEN
        RAISE EXCEPTION 'Only a coach may change member roles in this group.';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_role_self_escalation() IS 'BEFORE UPDATE trigger on group_members preventing non-coach members from escalating their own role (PE-1 / SH-2 enforcement).';

CREATE TRIGGER prevent_role_self_escalation_trigger
    BEFORE UPDATE ON group_members
    FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();
