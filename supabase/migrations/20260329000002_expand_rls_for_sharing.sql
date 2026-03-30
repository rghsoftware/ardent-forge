-- =============================================================================
-- Migration: Expand RLS Policies for Sharing
-- Description: Adds READ policies on workout/logging tables for group peers
--              and direct connections. Adds WRITE policies on program/template
--              tables for coaches. Does NOT modify or drop any existing policies.
--
-- Invariants addressed:
--   SH-1: Member owns all data (user_id = member, created_by = coach)
--   SH-2: Member always wins conflicts (last-write-wins, no special handling)
--   SH-3: Coach CANNOT modify workout logs -- no INSERT/UPDATE/DELETE policies
--          added to workout_logs, logged_activity_groups, logged_activities,
--          or logged_sets for coaches. Write access remains user_id = auth.uid().
--   SH-4: Group size limits (enforced by trigger in 20260329000001)
--   SH-5: Invite code rules (enforced by UNIQUE + expiration in 20260329000001)
--   SH-6: Connection symmetry -- both parties get SELECT on each other's data
--   SH-7: Private data stays private -- perceived_difficulty, bodyweight_at_session,
--          overall_notes (workout_logs), rpe, notes (logged_sets) are stripped at
--          the adapter layer for non-owner reads. RLS grants row-level access only;
--          the adapter omits private columns in SELECT queries for group/connection reads.
--   SH-8: Share links are stateless (handled separately via token-based lookups)
--   SH-9: History visibility opt-in -- group peer read policies enforce the
--          DATA OWNER'S share_history_before_join flag (owner_gm, not viewer_gm),
--          so the subject controls whether their pre-join history is visible.
-- =============================================================================


-- ============================================================================
-- SECTION 1: WORKOUT LOG READ ACCESS (group peers + connections)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- workout_logs: group peer read
-- Members in the same group can read each other's logs (member-to-member).
-- Coaches can read all members' logs.
-- Members CANNOT see coach logs (gm2.role != 'COACH' unless viewer is COACH).
-- Invariant SH-9: share_history_before_join controls pre-join visibility.
-- ---------------------------------------------------------------------------
CREATE POLICY "workout_logs_group_peer_read"
    ON workout_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members viewer_gm
            JOIN group_members owner_gm ON owner_gm.group_id = viewer_gm.group_id
            WHERE viewer_gm.user_id = auth.uid()
              AND owner_gm.user_id = workout_logs.user_id
              AND viewer_gm.user_id != owner_gm.user_id
              -- Members cannot see coach logs; coaches can see all member logs
              AND (viewer_gm.role = 'COACH' OR owner_gm.role != 'COACH')
              -- SH-9: respect share_history_before_join
              AND (owner_gm.share_history_before_join = true
                   OR workout_logs.started_at >= owner_gm.joined_at)
        )
    );

-- ---------------------------------------------------------------------------
-- workout_logs: direct connection read
-- Active connections grant symmetric read access to each other's logs.
-- Invariant SH-6: connection symmetry.
-- ---------------------------------------------------------------------------
CREATE POLICY "workout_logs_connection_read"
    ON workout_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_connections dc
            WHERE dc.status = 'ACTIVE'
              AND (
                  (dc.requester_id = auth.uid() AND dc.recipient_id = workout_logs.user_id)
                  OR (dc.recipient_id = auth.uid() AND dc.requester_id = workout_logs.user_id)
              )
        )
    );


-- ============================================================================
-- SECTION 2: LOGGED ACTIVITY GROUPS READ ACCESS (group peers + connections)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- logged_activity_groups: group peer read
-- Uses the denormalized user_id column for the ownership check, then joins
-- back to workout_logs only for the SH-9 started_at comparison.
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_activity_groups_group_peer_read"
    ON logged_activity_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs wl
            JOIN group_members viewer_gm ON viewer_gm.user_id = auth.uid()
            JOIN group_members owner_gm ON owner_gm.group_id = viewer_gm.group_id
              AND owner_gm.user_id = wl.user_id
            WHERE wl.id = logged_activity_groups.workout_log_id
              AND viewer_gm.user_id != owner_gm.user_id
              AND (viewer_gm.role = 'COACH' OR owner_gm.role != 'COACH')
              AND (owner_gm.share_history_before_join = true
                   OR wl.started_at >= owner_gm.joined_at)
        )
    );

-- ---------------------------------------------------------------------------
-- logged_activity_groups: direct connection read
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_activity_groups_connection_read"
    ON logged_activity_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_connections dc
            WHERE dc.status = 'ACTIVE'
              AND (
                  (dc.requester_id = auth.uid() AND dc.recipient_id = logged_activity_groups.user_id)
                  OR (dc.recipient_id = auth.uid() AND dc.requester_id = logged_activity_groups.user_id)
              )
        )
    );


-- ============================================================================
-- SECTION 3: LOGGED ACTIVITIES READ ACCESS (group peers + connections)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- logged_activities: group peer read
-- Uses denormalized user_id for the connection check. Joins through
-- logged_activity_groups -> workout_logs for the SH-9 started_at check.
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_activities_group_peer_read"
    ON logged_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM logged_activity_groups lag
            JOIN workout_logs wl ON wl.id = lag.workout_log_id
            JOIN group_members viewer_gm ON viewer_gm.user_id = auth.uid()
            JOIN group_members owner_gm ON owner_gm.group_id = viewer_gm.group_id
              AND owner_gm.user_id = wl.user_id
            WHERE lag.id = logged_activities.logged_group_id
              AND viewer_gm.user_id != owner_gm.user_id
              AND (viewer_gm.role = 'COACH' OR owner_gm.role != 'COACH')
              AND (owner_gm.share_history_before_join = true
                   OR wl.started_at >= owner_gm.joined_at)
        )
    );

-- ---------------------------------------------------------------------------
-- logged_activities: direct connection read
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_activities_connection_read"
    ON logged_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_connections dc
            WHERE dc.status = 'ACTIVE'
              AND (
                  (dc.requester_id = auth.uid() AND dc.recipient_id = logged_activities.user_id)
                  OR (dc.recipient_id = auth.uid() AND dc.requester_id = logged_activities.user_id)
              )
        )
    );


-- ============================================================================
-- SECTION 4: LOGGED SETS READ ACCESS (group peers + connections)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- logged_sets: group peer read
-- Joins through logged_activities -> logged_activity_groups -> workout_logs
-- for the SH-9 started_at check.
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_sets_group_peer_read"
    ON logged_sets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM logged_activities la
            JOIN logged_activity_groups lag ON lag.id = la.logged_group_id
            JOIN workout_logs wl ON wl.id = lag.workout_log_id
            JOIN group_members viewer_gm ON viewer_gm.user_id = auth.uid()
            JOIN group_members owner_gm ON owner_gm.group_id = viewer_gm.group_id
              AND owner_gm.user_id = wl.user_id
            WHERE la.id = logged_sets.logged_activity_id
              AND viewer_gm.user_id != owner_gm.user_id
              AND (viewer_gm.role = 'COACH' OR owner_gm.role != 'COACH')
              AND (owner_gm.share_history_before_join = true
                   OR wl.started_at >= owner_gm.joined_at)
        )
    );

-- ---------------------------------------------------------------------------
-- logged_sets: direct connection read
-- ---------------------------------------------------------------------------
CREATE POLICY "logged_sets_connection_read"
    ON logged_sets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM direct_connections dc
            WHERE dc.status = 'ACTIVE'
              AND (
                  (dc.requester_id = auth.uid() AND dc.recipient_id = logged_sets.user_id)
                  OR (dc.recipient_id = auth.uid() AND dc.requester_id = logged_sets.user_id)
              )
        )
    );


-- ============================================================================
-- SECTION 5: COACH WRITE ACCESS ON PROGRAMS
-- Invariant SH-1: user_id = member (owner), created_by = coach (author).
-- Invariant SH-3: NO write policies on workout/logging tables for coaches.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- programs: coach insert
-- A coach can create programs assigned to their group members.
-- The program's user_id must be a MEMBER in a group where auth.uid() is COACH.
-- The program's created_by must equal auth.uid() (the coach).
-- ---------------------------------------------------------------------------
CREATE POLICY "programs_coach_insert"
    ON programs FOR INSERT
    WITH CHECK (
        programs.created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = programs.user_id
              AND member_gm.role = 'MEMBER'
        )
    );

-- ---------------------------------------------------------------------------
-- programs: coach update
-- A coach can update programs owned by their group members.
-- ---------------------------------------------------------------------------
CREATE POLICY "programs_coach_update"
    ON programs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = programs.user_id
              AND member_gm.role = 'MEMBER'
        )
    );

-- ---------------------------------------------------------------------------
-- programs: coach select (read member's programs for context)
-- A coach can see programs owned by their group members.
-- ---------------------------------------------------------------------------
CREATE POLICY "programs_coach_select"
    ON programs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = programs.user_id
              AND member_gm.role = 'MEMBER'
        )
    );


-- ============================================================================
-- SECTION 6: COACH WRITE ACCESS ON SESSION TEMPLATES
-- session_templates have a direct user_id column (the member/owner).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- session_templates: coach insert
-- Coach can create templates owned by their group members.
-- ---------------------------------------------------------------------------
CREATE POLICY "session_templates_coach_insert"
    ON session_templates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = session_templates.user_id
              AND member_gm.role = 'MEMBER'
        )
    );

-- ---------------------------------------------------------------------------
-- session_templates: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "session_templates_coach_update"
    ON session_templates FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = session_templates.user_id
              AND member_gm.role = 'MEMBER'
        )
    );

-- ---------------------------------------------------------------------------
-- session_templates: coach select (read member's templates for context)
-- ---------------------------------------------------------------------------
CREATE POLICY "session_templates_coach_select"
    ON session_templates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members coach_gm
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
            WHERE coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
              AND member_gm.user_id = session_templates.user_id
              AND member_gm.role = 'MEMBER'
        )
    );


-- ============================================================================
-- SECTION 7: COACH WRITE ACCESS ON ACTIVITY GROUPS
-- activity_groups reference session_template_id. Ownership is validated by
-- joining through session_templates to get the member's user_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- activity_groups: coach insert
-- ---------------------------------------------------------------------------
CREATE POLICY "activity_groups_coach_insert"
    ON activity_groups FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM session_templates st
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE st.id = activity_groups.session_template_id
        )
    );

-- ---------------------------------------------------------------------------
-- activity_groups: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "activity_groups_coach_update"
    ON activity_groups FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM session_templates st
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE st.id = activity_groups.session_template_id
        )
    );

-- ---------------------------------------------------------------------------
-- activity_groups: coach select (read member's activity groups)
-- ---------------------------------------------------------------------------
CREATE POLICY "activity_groups_coach_select"
    ON activity_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM session_templates st
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE st.id = activity_groups.session_template_id
        )
    );


-- ============================================================================
-- SECTION 8: COACH WRITE ACCESS ON ACTIVITIES
-- activities reference activity_group_id. Ownership validated by joining
-- through activity_groups -> session_templates to get the member's user_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- activities: coach insert
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_coach_insert"
    ON activities FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM activity_groups ag
            JOIN session_templates st ON st.id = ag.session_template_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE ag.id = activities.activity_group_id
        )
    );

-- ---------------------------------------------------------------------------
-- activities: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_coach_update"
    ON activities FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM activity_groups ag
            JOIN session_templates st ON st.id = ag.session_template_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE ag.id = activities.activity_group_id
        )
    );

-- ---------------------------------------------------------------------------
-- activities: coach select (read member's activities)
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_coach_select"
    ON activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM activity_groups ag
            JOIN session_templates st ON st.id = ag.session_template_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = st.user_id
              AND member_gm.role = 'MEMBER'
            WHERE ag.id = activities.activity_group_id
        )
    );


-- ============================================================================
-- SECTION 9: COACH WRITE ACCESS ON SCHEDULED SESSIONS
-- scheduled_sessions reference block_week_id. Ownership validated by joining
-- through block_weeks -> blocks -> programs to get the member's user_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- scheduled_sessions: coach insert
-- ---------------------------------------------------------------------------
CREATE POLICY "scheduled_sessions_coach_insert"
    ON scheduled_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM block_weeks bw
            JOIN blocks b ON b.id = bw.block_id
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE bw.id = scheduled_sessions.block_week_id
        )
    );

-- ---------------------------------------------------------------------------
-- scheduled_sessions: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "scheduled_sessions_coach_update"
    ON scheduled_sessions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM block_weeks bw
            JOIN blocks b ON b.id = bw.block_id
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE bw.id = scheduled_sessions.block_week_id
        )
    );

-- ---------------------------------------------------------------------------
-- scheduled_sessions: coach select (read member's scheduled sessions)
-- ---------------------------------------------------------------------------
CREATE POLICY "scheduled_sessions_coach_select"
    ON scheduled_sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM block_weeks bw
            JOIN blocks b ON b.id = bw.block_id
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE bw.id = scheduled_sessions.block_week_id
        )
    );


-- ============================================================================
-- SECTION 10: COACH READ ACCESS ON BLOCKS AND BLOCK WEEKS
-- Coaches need to read the program structure (blocks, block_weeks) for members
-- they coach, to navigate the program hierarchy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- blocks: coach select
-- ---------------------------------------------------------------------------
CREATE POLICY "blocks_coach_select"
    ON blocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE p.id = blocks.program_id
        )
    );

-- ---------------------------------------------------------------------------
-- blocks: coach insert (coach can build program structure for members)
-- ---------------------------------------------------------------------------
CREATE POLICY "blocks_coach_insert"
    ON blocks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE p.id = blocks.program_id
        )
    );

-- ---------------------------------------------------------------------------
-- blocks: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "blocks_coach_update"
    ON blocks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE p.id = blocks.program_id
        )
    );

-- ---------------------------------------------------------------------------
-- block_weeks: coach select
-- ---------------------------------------------------------------------------
CREATE POLICY "block_weeks_coach_select"
    ON block_weeks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM blocks b
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE b.id = block_weeks.block_id
        )
    );

-- ---------------------------------------------------------------------------
-- block_weeks: coach insert
-- ---------------------------------------------------------------------------
CREATE POLICY "block_weeks_coach_insert"
    ON block_weeks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM blocks b
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE b.id = block_weeks.block_id
        )
    );

-- ---------------------------------------------------------------------------
-- block_weeks: coach update
-- ---------------------------------------------------------------------------
CREATE POLICY "block_weeks_coach_update"
    ON block_weeks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM blocks b
            JOIN programs p ON p.id = b.program_id
            JOIN group_members coach_gm ON coach_gm.user_id = auth.uid()
              AND coach_gm.role = 'COACH'
            JOIN group_members member_gm ON member_gm.group_id = coach_gm.group_id
              AND member_gm.user_id = p.user_id
              AND member_gm.role = 'MEMBER'
            WHERE b.id = block_weeks.block_id
        )
    );


-- ============================================================================
-- NOTE ON SH-3 ENFORCEMENT:
-- No INSERT, UPDATE, or DELETE policies are added for coaches on:
--   - workout_logs
--   - logged_activity_groups
--   - logged_activities
--   - logged_sets
-- Write access on these tables remains exclusively user_id = auth.uid().
-- Coaches can ONLY write to programs, session_templates, activity_groups,
-- activities, scheduled_sessions, blocks, and block_weeks.
-- ============================================================================

-- ============================================================================
-- NOTE ON SH-7 (Privacy Field Stripping):
-- The following fields are PRIVATE and must NEVER be exposed to non-owner reads:
--   - workout_logs: perceived_difficulty, bodyweight_at_session, overall_notes
--   - logged_sets: rpe, notes
-- This is enforced at the DATA ADAPTER layer, NOT at the RLS level.
-- RLS policies grant row-level SELECT access. The adapter's SELECT queries for
-- group/connection reads explicitly exclude these columns from the result set.
-- ============================================================================
