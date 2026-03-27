-- =============================================================================
-- Migration: Add Database Triggers
-- Description: Automatic updated_at timestamps, denormalized user_id
--              consistency enforcement, and PR-2 immutability on 1RM history.
-- Depends on: 20260326000001_create_phase0_tables.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Automatic updated_at trigger function
--    Applied to all tables with an updated_at column.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON workout_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON logged_activity_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON logged_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON logged_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. Denormalized user_id consistency triggers
--    Ensures child table user_id matches parent table user_id on INSERT/UPDATE.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_user_id_match_workout()
RETURNS TRIGGER AS $$
DECLARE
  parent_user_id UUID;
BEGIN
  SELECT user_id INTO parent_user_id FROM workout_logs WHERE id = NEW.workout_log_id;
  IF parent_user_id IS NULL THEN
    RAISE EXCEPTION 'Parent workout_log (%) not found', NEW.workout_log_id;
  END IF;
  IF NEW.user_id != parent_user_id THEN
    RAISE EXCEPTION 'user_id (%) does not match parent workout_log user_id', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_logged_activity_groups_user_match
  BEFORE INSERT OR UPDATE ON logged_activity_groups
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_match_workout();

CREATE OR REPLACE FUNCTION enforce_user_id_match_group()
RETURNS TRIGGER AS $$
DECLARE
  parent_user_id UUID;
BEGIN
  SELECT user_id INTO parent_user_id FROM logged_activity_groups WHERE id = NEW.logged_group_id;
  IF parent_user_id IS NULL THEN
    RAISE EXCEPTION 'Parent logged_activity_groups (%) not found', NEW.logged_group_id;
  END IF;
  IF NEW.user_id != parent_user_id THEN
    RAISE EXCEPTION 'user_id (%) does not match parent logged_activity_groups user_id', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_logged_activities_user_match
  BEFORE INSERT OR UPDATE ON logged_activities
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_match_group();

CREATE OR REPLACE FUNCTION enforce_user_id_match_activity()
RETURNS TRIGGER AS $$
DECLARE
  parent_user_id UUID;
BEGIN
  SELECT user_id INTO parent_user_id FROM logged_activities WHERE id = NEW.logged_activity_id;
  IF parent_user_id IS NULL THEN
    RAISE EXCEPTION 'Parent logged_activities (%) not found', NEW.logged_activity_id;
  END IF;
  IF NEW.user_id != parent_user_id THEN
    RAISE EXCEPTION 'user_id (%) does not match parent logged_activities user_id', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_logged_sets_user_match
  BEFORE INSERT OR UPDATE ON logged_sets
  FOR EACH ROW EXECUTE FUNCTION enforce_user_id_match_activity();

-- ---------------------------------------------------------------------------
-- 3. PR-2 immutability trigger for one_rep_max_history
--    Blocks UPDATE and DELETE to enforce append-only semantics.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_1rm_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '1RM history records are immutable (invariant PR-2). Only INSERT is allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_1rm_no_update
  BEFORE UPDATE ON one_rep_max_history
  FOR EACH ROW EXECUTE FUNCTION prevent_1rm_mutation();

CREATE TRIGGER trg_1rm_no_delete
  BEFORE DELETE ON one_rep_max_history
  FOR EACH ROW EXECUTE FUNCTION prevent_1rm_mutation();
