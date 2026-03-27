-- =============================================================================
-- Migration: Add Row Level Security Policies
-- Description: Enable RLS on all Phase 0 tables and create policies enforcing
--              user data isolation via auth.uid().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- exercises
-- Built-in exercises (is_custom=false) are readable by everyone.
-- Custom exercises are only accessible to their creator.
-- ---------------------------------------------------------------------------
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_select"
    ON exercises FOR SELECT
    USING (is_custom = false OR user_id = auth.uid());

-- NOTE: Built-in exercises (is_custom=false, user_id=NULL) can only be inserted
-- via service_role key (which bypasses RLS). Application code must use service_role for seeding.
CREATE POLICY "exercises_insert"
    ON exercises FOR INSERT
    WITH CHECK (is_custom = true AND user_id = auth.uid());

CREATE POLICY "exercises_update"
    ON exercises FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "exercises_delete"
    ON exercises FOR DELETE
    USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- user_profiles
-- Users can only access their own profile (id = auth.uid()).
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_all"
    ON user_profiles FOR ALL
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- workout_logs
-- Users can only access their own workout logs.
-- user_id = auth.uid() enforces owner-only access. When sharing features are added (Step 17-18), additional policies will allow coaches read access while preserving write restrictions.
-- ---------------------------------------------------------------------------
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_logs_all"
    ON workout_logs FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- logged_activity_groups
-- Uses the denormalized user_id column for RLS performance.
-- Avoids a JOIN to workout_logs on every row access.
-- user_id = auth.uid() enforces owner-only access. When sharing features are added (Step 17-18), additional policies will allow coaches read access while preserving write restrictions.
-- ---------------------------------------------------------------------------
ALTER TABLE logged_activity_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logged_activity_groups_all"
    ON logged_activity_groups FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- logged_activities
-- Uses the denormalized user_id column for RLS performance.
-- Avoids a JOIN through logged_activity_groups to workout_logs.
-- user_id = auth.uid() enforces owner-only access. When sharing features are added (Step 17-18), additional policies will allow coaches read access while preserving write restrictions.
-- ---------------------------------------------------------------------------
ALTER TABLE logged_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logged_activities_all"
    ON logged_activities FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- logged_sets
-- Uses the denormalized user_id column for RLS performance.
-- Avoids a multi-level JOIN through the activity hierarchy.
-- user_id = auth.uid() enforces owner-only access. When sharing features are added (Step 17-18), additional policies will allow coaches read access while preserving write restrictions.
-- ---------------------------------------------------------------------------
ALTER TABLE logged_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logged_sets_all"
    ON logged_sets FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- one_rep_max_history
-- Users can only access their own 1RM history.
-- PR-2: append-only -- only SELECT and INSERT allowed. UPDATE and DELETE
-- are blocked at the RLS level and additionally by a trigger in migration 4.
-- ---------------------------------------------------------------------------
ALTER TABLE one_rep_max_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "one_rep_max_history_select"
    ON one_rep_max_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "one_rep_max_history_insert"
    ON one_rep_max_history FOR INSERT
    WITH CHECK (user_id = auth.uid());
