-- =============================================================================
-- Ardent Forge: Reviewer Account Seed Data
-- =============================================================================
-- Creates a dedicated reviewer account (review@ardentforge.app) with pre-seeded
-- workout data, programs, session templates, and history so reviewers can
-- navigate all app screens without building data from scratch.
--
-- Idempotent: uses ON CONFLICT where possible, and wraps in a transaction.
-- Run against the hosted Supabase instance via:
--   PGOPTIONS="-c app.reviewer_password=YourPasswordHere" \
--     bunx supabase db query --linked -f supabase/seed-reviewer.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Exercise ID lookups (stable references from the exercise dictionary)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  reviewer_uid UUID;
  -- Exercise IDs
  ex_back_squat       UUID := '0eb174d9-be0f-4976-a685-604493bd4f03';
  ex_bench_press      UUID := 'f7b542ab-cee6-4e32-9f47-34d960085e99';
  ex_deadlift         UUID := 'ec1956d2-5adf-403b-9b2d-0508cd4b3220';
  ex_overhead_press   UUID := '1633e23c-472c-4e2c-a662-ef9bf62d8645';
  ex_barbell_row      UUID := '29705e05-6f54-47cb-b4ec-ac87b7b70b04';
  ex_pull_up          UUID := '7f71a619-a24b-4429-86f3-8586c1675db8';
  ex_dip              UUID := 'c5ac2aa8-b157-4b3b-9c02-d6626090dace';
  ex_front_squat      UUID := '94eea0e5-3667-4bb7-8ab6-62acf312b8d7';
  ex_rdl              UUID := 'a706ae83-df7f-410c-afa9-ee5216918104';
  ex_incline_bench    UUID := '7c826c59-4f18-4175-900a-9acadafc663a';
  ex_running          UUID := 'b43938cd-5ac0-45a9-a8fe-0eeac83b613b';
  ex_rowing_machine   UUID := '9a027146-15f7-4590-8151-3f8f9c9e389c';
  ex_kb_swing         UUID := '72b3cb12-8ad0-4fb7-b3c6-10295b60a57b';
  ex_farmer_walk      UUID := 'bb386a55-3eb2-4330-b1df-32c7676fb07d';
  ex_plank            UUID := '4cec0d92-f8a7-4898-bfa1-3e6b8c7a564a';
  -- Session template IDs (deterministic)
  st_upper_str        UUID := 'a0000001-0000-4000-8000-000000000001';
  st_lower_str        UUID := 'a0000001-0000-4000-8000-000000000002';
  st_full_body        UUID := 'a0000001-0000-4000-8000-000000000003';
  st_conditioning     UUID := 'a0000001-0000-4000-8000-000000000004';
  st_deload           UUID := 'a0000001-0000-4000-8000-000000000005';
  st_event_ruck       UUID := 'a0000001-0000-4000-8000-000000000006';
  -- Activity group IDs
  ag1 UUID; ag2 UUID; ag3 UUID; ag4 UUID; ag5 UUID; ag6 UUID;
  ag7 UUID; ag8 UUID; ag9 UUID; ag10 UUID; ag11 UUID; ag12 UUID;
  ag13 UUID; ag14 UUID; ag15 UUID; ag16 UUID;
  -- Program IDs
  prog_id             UUID := 'b0000001-0000-4000-8000-000000000001';
  -- Block IDs
  blk_accum           UUID := 'c0000001-0000-4000-8000-000000000001';
  blk_intens          UUID := 'c0000001-0000-4000-8000-000000000002';
  blk_deload          UUID := 'c0000001-0000-4000-8000-000000000003';
  -- Block week IDs
  bw1 UUID; bw2 UUID; bw3 UUID; bw4 UUID; bw5 UUID; bw6 UUID; bw7 UUID;
  -- Workout log IDs
  wl1 UUID; wl2 UUID; wl3 UUID; wl4 UUID; wl5 UUID; wl6 UUID; wl7 UUID; wl8 UUID;
  -- Logged group/activity/set temp vars
  lg_id UUID; la_id UUID;
BEGIN

  -- =========================================================================
  -- 1. CREATE AUTH USER
  -- =========================================================================
  -- Insert into auth.users with email/password. GoTrue expects bcrypt hash.
  -- Password: ArdentReview2026!
  -- Check if user already exists first (email unique index, not constraint)
  SELECT id INTO reviewer_uid FROM auth.users WHERE email = 'review@ardentforge.app';

  IF reviewer_uid IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_sent_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'review@ardentforge.app',
      crypt(current_setting('app.reviewer_password'), gen_salt('bf')),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"full_name": "App Reviewer", "name": "App Reviewer"}'::jsonb,
      now(),
      now()
    )
    RETURNING id INTO reviewer_uid;
  ELSE
    UPDATE auth.users SET
      encrypted_password = crypt(current_setting('app.reviewer_password'), gen_salt('bf')),
      updated_at = now()
    WHERE id = reviewer_uid;
  END IF;

  -- Also ensure identities row exists (required by GoTrue for email login)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    reviewer_uid,
    reviewer_uid,
    (SELECT email FROM auth.users WHERE id = reviewer_uid),
    'email',
    jsonb_build_object(
      'sub', reviewer_uid::text,
      'email', 'review@ardentforge.app',
      'email_verified', true
    ),
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- =========================================================================
  -- 2. USER PROFILE
  -- =========================================================================
  INSERT INTO user_profiles (id, display_name, preferred_units, bodyweight, exercise_maxes, max_reps, display_visible)
  VALUES (
    reviewer_uid,
    'App Reviewer',
    'IMPERIAL',
    '{"value": 185, "unit": "lb"}'::jsonb,
    jsonb_build_object(
      ex_back_squat::text,   '{"value": 315, "unit": "lb"}',
      ex_bench_press::text,  '{"value": 225, "unit": "lb"}',
      ex_deadlift::text,     '{"value": 405, "unit": "lb"}',
      ex_overhead_press::text, '{"value": 155, "unit": "lb"}'
    ),
    jsonb_build_object(
      ex_pull_up::text, 15,
      ex_dip::text, 20
    ),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    preferred_units = EXCLUDED.preferred_units,
    bodyweight = EXCLUDED.bodyweight,
    exercise_maxes = EXCLUDED.exercise_maxes,
    max_reps = EXCLUDED.max_reps,
    display_visible = EXCLUDED.display_visible,
    updated_at = now();

  -- =========================================================================
  -- 3. SESSION TEMPLATES (6 templates covering all categories)
  -- =========================================================================

  -- 3a. Upper Body Strength
  INSERT INTO session_templates (id, user_id, name, description, category, scoring, rest_between_groups)
  VALUES (st_upper_str, reviewer_uid, 'Upper Body Strength', 'Heavy pressing and pulling for upper body development', 'STRENGTH', 'NONE', '{"seconds": 180}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  ag1 := gen_random_uuid(); ag2 := gen_random_uuid(); ag3 := gen_random_uuid();
  DELETE FROM activity_groups WHERE session_template_id = st_upper_str;
  INSERT INTO activity_groups (id, session_template_id, group_type, ordinal, rounds, rest_between_rounds) VALUES
    (ag1, st_upper_str, 'STRAIGHT_SETS', 1, NULL, NULL),
    (ag2, st_upper_str, 'SUPERSET', 2, 3, '{"seconds": 90}'::jsonb),
    (ag3, st_upper_str, 'STRAIGHT_SETS', 3, NULL, NULL);
  INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme) VALUES
    (ag1, ex_bench_press, 1, '{"type": "fixedSets", "sets": 4, "reps": 5, "load": {"type": "percentageOf1RM", "percentage": 0.8}, "restBetweenSets": {"seconds": 180}}'::jsonb),
    (ag2, ex_barbell_row, 1, '{"type": "fixedSets", "sets": 3, "reps": 8, "load": {"type": "rpe", "target": 7.5}, "restBetweenSets": {"seconds": 90}}'::jsonb),
    (ag2, ex_overhead_press, 2, '{"type": "fixedSets", "sets": 3, "reps": 8, "load": {"type": "rpe", "target": 7}, "restBetweenSets": {"seconds": 90}}'::jsonb),
    (ag3, ex_dip, 1, '{"type": "fixedSets", "sets": 3, "reps": {"min": 8, "max": 12}, "load": {"type": "bodyweight"}, "restBetweenSets": {"seconds": 120}}'::jsonb);

  -- 3b. Lower Body Strength
  INSERT INTO session_templates (id, user_id, name, description, category, scoring, rest_between_groups)
  VALUES (st_lower_str, reviewer_uid, 'Lower Body Strength', 'Squat and hinge focused lower body session', 'STRENGTH', 'NONE', '{"seconds": 180}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  ag4 := gen_random_uuid(); ag5 := gen_random_uuid(); ag6 := gen_random_uuid();
  DELETE FROM activity_groups WHERE session_template_id = st_lower_str;
  INSERT INTO activity_groups (id, session_template_id, group_type, ordinal, rounds, rest_between_rounds) VALUES
    (ag4, st_lower_str, 'STRAIGHT_SETS', 1, NULL, NULL),
    (ag5, st_lower_str, 'STRAIGHT_SETS', 2, NULL, NULL),
    (ag6, st_lower_str, 'SUPERSET', 3, 3, '{"seconds": 60}'::jsonb);
  INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme) VALUES
    (ag4, ex_back_squat, 1, '{"type": "fixedSets", "sets": 5, "reps": 3, "load": {"type": "percentageOf1RM", "percentage": 0.85}, "restBetweenSets": {"seconds": 240}, "lastSetAMRAP": true}'::jsonb),
    (ag5, ex_rdl, 1, '{"type": "fixedSets", "sets": 4, "reps": 8, "load": {"type": "rpe", "target": 7}, "restBetweenSets": {"seconds": 120}}'::jsonb),
    (ag6, ex_farmer_walk, 1, '{"type": "timedHold", "duration": {"seconds": 60}, "sets": 3, "restBetweenSets": {"seconds": 60}}'::jsonb),
    (ag6, ex_plank, 2, '{"type": "timedHold", "duration": {"seconds": 60}, "sets": 3, "restBetweenSets": {"seconds": 60}}'::jsonb);

  -- 3c. Full Body
  INSERT INTO session_templates (id, user_id, name, description, category, scoring, rest_between_groups)
  VALUES (st_full_body, reviewer_uid, 'Full Body Power', 'Full body session focused on compound lifts', 'STRENGTH', 'NONE', '{"seconds": 120}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  ag7 := gen_random_uuid(); ag8 := gen_random_uuid(); ag9 := gen_random_uuid();
  DELETE FROM activity_groups WHERE session_template_id = st_full_body;
  INSERT INTO activity_groups (id, session_template_id, group_type, ordinal, rounds) VALUES
    (ag7, st_full_body, 'STRAIGHT_SETS', 1, NULL),
    (ag8, st_full_body, 'STRAIGHT_SETS', 2, NULL),
    (ag9, st_full_body, 'CIRCUIT', 3, 3);
  INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme) VALUES
    (ag7, ex_deadlift, 1, '{"type": "workToMax", "targetRepRange": {"min": 1, "max": 3}}'::jsonb),
    (ag8, ex_front_squat, 1, '{"type": "fixedSets", "sets": 3, "reps": 5, "load": {"type": "rpe", "target": 8}, "restBetweenSets": {"seconds": 180}}'::jsonb),
    (ag9, ex_pull_up, 1, '{"type": "fixedSets", "sets": 3, "reps": 8, "load": {"type": "bodyweight"}, "restBetweenSets": {"seconds": 60}}'::jsonb),
    (ag9, ex_kb_swing, 2, '{"type": "fixedSets", "sets": 3, "reps": 15, "load": {"type": "absolute", "weight": {"value": 53, "unit": "lb"}}, "restBetweenSets": {"seconds": 60}}'::jsonb),
    (ag9, ex_plank, 3, '{"type": "timedHold", "duration": {"seconds": 45}, "sets": 3, "restBetweenSets": {"seconds": 30}}'::jsonb);

  -- 3d. Conditioning
  INSERT INTO session_templates (id, user_id, name, description, category, scoring, time_cap)
  VALUES (st_conditioning, reviewer_uid, 'Metabolic Conditioning', 'Mixed-modal conditioning for work capacity', 'CONDITIONING', 'FOR_TIME', '{"seconds": 1800}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  ag10 := gen_random_uuid(); ag11 := gen_random_uuid();
  DELETE FROM activity_groups WHERE session_template_id = st_conditioning;
  INSERT INTO activity_groups (id, session_template_id, group_type, ordinal) VALUES
    (ag10, st_conditioning, 'STRAIGHT_SETS', 1),
    (ag11, st_conditioning, 'AMRAP', 2);
  INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme) VALUES
    (ag10, ex_running, 1, '{"type": "cardioInterval", "workDistance": {"value": 400, "unit": "m"}, "rest": {"seconds": 90}, "rounds": 6, "modality": "RUNNING", "intensityNotes": "85% effort sprints"}'::jsonb),
    (ag11, ex_rowing_machine, 1, '{"type": "cardioSteadyState", "distance": {"value": 2000, "unit": "m"}, "modality": "ROWING", "intensityNotes": "Target sub-7:30 split"}'::jsonb);

  -- 3e. Deload
  INSERT INTO session_templates (id, user_id, name, description, category, scoring)
  VALUES (st_deload, reviewer_uid, 'Deload Recovery', 'Light session for recovery weeks', 'MIXED', 'NONE')
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  ag12 := gen_random_uuid(); ag13 := gen_random_uuid();
  DELETE FROM activity_groups WHERE session_template_id = st_deload;
  INSERT INTO activity_groups (id, session_template_id, group_type, ordinal) VALUES
    (ag12, st_deload, 'STRAIGHT_SETS', 1),
    (ag13, st_deload, 'STRAIGHT_SETS', 2);
  INSERT INTO activities (activity_group_id, exercise_id, ordinal, set_scheme) VALUES
    (ag12, ex_back_squat, 1, '{"type": "fixedSets", "sets": 3, "reps": 5, "load": {"type": "percentageOf1RM", "percentage": 0.5}, "restBetweenSets": {"seconds": 120}}'::jsonb),
    (ag12, ex_bench_press, 2, '{"type": "fixedSets", "sets": 3, "reps": 5, "load": {"type": "percentageOf1RM", "percentage": 0.5}, "restBetweenSets": {"seconds": 120}}'::jsonb),
    (ag13, ex_running, 1, '{"type": "cardioSteadyState", "duration": {"seconds": 1200}, "modality": "RUNNING", "intensityNotes": "Easy conversational pace"}'::jsonb);

  -- 3f. Event (Ruck March)
  INSERT INTO session_templates (id, user_id, name, description, category, scoring, event_metadata)
  VALUES (st_event_ruck, reviewer_uid, 'Spring Ruck Challenge', '12-mile ruck march event', 'EVENT', 'FOR_TIME',
    '{"location": "Fort Bragg, NC", "eventDate": "2026-05-15T06:00:00Z", "distance": {"value": 12, "unit": "mi"}, "cutoffTime": {"seconds": 10800}, "elevation": {"value": 1200, "unit": "ft"}}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  -- Event items for the ruck event
  DELETE FROM event_items WHERE session_template_id = st_event_ruck;
  INSERT INTO event_items (session_template_id, user_id, name, category, quantity, is_packed, sort_order) VALUES
    (st_event_ruck, reviewer_uid, 'Ruck plate (45 lb)', 'Gear', 1, true, 0),
    (st_event_ruck, reviewer_uid, 'Rucksack', 'Gear', 1, true, 1),
    (st_event_ruck, reviewer_uid, 'Hydration bladder (3L)', 'Hydration', 1, true, 2),
    (st_event_ruck, reviewer_uid, 'Electrolyte packets', 'Nutrition', 4, false, 3),
    (st_event_ruck, reviewer_uid, 'Energy gels', 'Nutrition', 3, false, 4),
    (st_event_ruck, reviewer_uid, 'Merino wool socks', 'Clothing', 2, true, 5),
    (st_event_ruck, reviewer_uid, 'Headlamp', 'Gear', 1, false, 6),
    (st_event_ruck, reviewer_uid, 'Moleskin / blister kit', 'Medical', 1, false, 7);

  -- =========================================================================
  -- 4. PROGRAM: 8-Week Strength Block
  -- =========================================================================
  INSERT INTO programs (id, user_id, name, description, source, duration_weeks, is_public, created_by)
  VALUES (prog_id, reviewer_uid, '8-Week Strength Builder', 'Periodized strength program: 3 weeks accumulation, 3 weeks intensification, 2 weeks deload/test', 'CUSTOM', 8, false, reviewer_uid)
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = now();

  -- Blocks
  DELETE FROM blocks WHERE program_id = prog_id;
  INSERT INTO blocks (id, program_id, name, ordinal, duration_weeks, block_type) VALUES
    (blk_accum,  prog_id, 'Accumulation', 1, 3, 'ACCUMULATION'),
    (blk_intens, prog_id, 'Intensification', 2, 3, 'INTENSIFICATION'),
    (blk_deload, prog_id, 'Deload and Test', 3, 2, 'DELOAD');

  -- Block weeks (3 + 3 + 2 = 8 weeks)
  bw1 := gen_random_uuid(); bw2 := gen_random_uuid(); bw3 := gen_random_uuid();
  bw4 := gen_random_uuid(); bw5 := gen_random_uuid(); bw6 := gen_random_uuid();
  bw7 := gen_random_uuid();
  INSERT INTO block_weeks (id, block_id, week_number) VALUES
    (bw1, blk_accum, 1), (bw2, blk_accum, 2), (bw3, blk_accum, 3),
    (bw4, blk_intens, 1), (bw5, blk_intens, 2), (bw6, blk_intens, 3),
    (bw7, blk_deload, 1);
  -- Week 2 of deload uses a separate UUID
  INSERT INTO block_weeks (block_id, week_number) VALUES (blk_deload, 2);

  -- Scheduled sessions (sample: 4 sessions per week in accumulation week 1)
  INSERT INTO scheduled_sessions (block_week_id, day_of_week, day_label, session_type, session_template_id, notes) VALUES
    (bw1, 1, 'Day 1 - Upper', 'STRENGTH', st_upper_str, 'Focus on bench press progression'),
    (bw1, 3, 'Day 2 - Lower', 'STRENGTH', st_lower_str, 'Heavy squat day'),
    (bw1, 4, 'Day 3 - Conditioning', 'CONDITIONING', st_conditioning, 'Keep heart rate in zone 4'),
    (bw1, 5, 'Day 4 - Full Body', 'STRENGTH', st_full_body, 'Deadlift focus');
  -- Accumulation week 2
  INSERT INTO scheduled_sessions (block_week_id, day_of_week, day_label, session_type, session_template_id) VALUES
    (bw2, 1, 'Day 1 - Upper', 'STRENGTH', st_upper_str),
    (bw2, 3, 'Day 2 - Lower', 'STRENGTH', st_lower_str),
    (bw2, 4, 'Day 3 - Conditioning', 'CONDITIONING', st_conditioning),
    (bw2, 5, 'Day 4 - Full Body', 'STRENGTH', st_full_body);
  -- Accumulation week 3
  INSERT INTO scheduled_sessions (block_week_id, day_of_week, day_label, session_type, session_template_id) VALUES
    (bw3, 1, 'Day 1 - Upper', 'STRENGTH', st_upper_str),
    (bw3, 3, 'Day 2 - Lower', 'STRENGTH', st_lower_str),
    (bw3, 5, 'Day 3 - Full Body', 'STRENGTH', st_full_body);
  -- Intensification week 1
  INSERT INTO scheduled_sessions (block_week_id, day_of_week, day_label, session_type, session_template_id) VALUES
    (bw4, 1, 'Day 1 - Upper', 'STRENGTH', st_upper_str),
    (bw4, 3, 'Day 2 - Lower', 'STRENGTH', st_lower_str),
    (bw4, 5, 'Day 3 - Full Body', 'STRENGTH', st_full_body);
  -- Deload week 1
  INSERT INTO scheduled_sessions (block_week_id, day_of_week, day_label, session_type, session_template_id) VALUES
    (bw7, 1, 'Day 1 - Light', 'MIXED', st_deload),
    (bw7, 4, 'Day 2 - Light', 'MIXED', st_deload);

  -- Program activation (user is in intensification week 2)
  INSERT INTO program_activations (user_id, program_id, current_block_ordinal, current_week_number, start_date)
  VALUES (reviewer_uid, prog_id, 2, 2, '2026-02-10')
  ON CONFLICT (user_id) DO UPDATE SET
    program_id = EXCLUDED.program_id,
    current_block_ordinal = EXCLUDED.current_block_ordinal,
    current_week_number = EXCLUDED.current_week_number,
    start_date = EXCLUDED.start_date,
    updated_at = now();

  -- =========================================================================
  -- 5. WORKOUT LOGS (8 completed workouts spanning ~5 weeks)
  -- =========================================================================
  DELETE FROM workout_logs WHERE user_id = reviewer_uid;

  -- Workout 1: Upper Body - 5 weeks ago
  wl1 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session, overall_notes,
    program_context)
  VALUES (wl1, reviewer_uid, 'Upper Body Strength', '2026-02-24T06:00:00Z', '2026-02-24T07:15:00Z', st_upper_str, 7,
    '{"value": 184, "unit": "lb"}'::jsonb, 'Felt strong today. Bench press moved well.',
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 1, 'dayLabel', 'Day 1 - Upper'));

  -- Log group 1: Bench Press (straight sets)
  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl1, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal)
  VALUES (la_id, lg_id, reviewer_uid, ex_bench_press, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, prescribed, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"reps": 5, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.8}}'::jsonb, 5, '{"value": 180, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', '{"reps": 5, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.8}}'::jsonb, 5, '{"value": 180, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', '{"reps": 5, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.8}}'::jsonb, 5, '{"value": 180, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 4, 'WORKING', '{"reps": 5, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.8}}'::jsonb, 4, '{"value": 180, "unit": "lb"}'::jsonb, 9, true);

  -- Log group 2: Superset (barbell row + OHP)
  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal, actual_rounds_completed)
  VALUES (lg_id, wl1, reviewer_uid, 'SUPERSET', 2, 3);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_barbell_row, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 8, '{"value": 155, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 8, '{"value": 155, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', 7, '{"value": 155, "unit": "lb"}'::jsonb, 8, true);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_overhead_press, 2);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 8, '{"value": 105, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 8, '{"value": 105, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 3, 'WORKING', 6, '{"value": 105, "unit": "lb"}'::jsonb, 8.5, true);

  -- Log group 3: Dips
  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl1, reviewer_uid, 'STRAIGHT_SETS', 3);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_dip, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 12, true),
    (la_id, reviewer_uid, 2, 'WORKING', 10, true),
    (la_id, reviewer_uid, 3, 'WORKING', 9, true);

  -- Workout 2: Lower Body - 5 weeks ago
  wl2 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session,
    program_context)
  VALUES (wl2, reviewer_uid, 'Lower Body Strength', '2026-02-26T06:00:00Z', '2026-02-26T07:30:00Z', st_lower_str, 8,
    '{"value": 185, "unit": "lb"}'::jsonb,
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 1, 'dayLabel', 'Day 2 - Lower'));

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl2, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_back_squat, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, prescribed, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"reps": 3, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.85}}'::jsonb, 3, '{"value": 265, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', '{"reps": 3, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.85}}'::jsonb, 3, '{"value": 265, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', '{"reps": 3, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.85}}'::jsonb, 3, '{"value": 265, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 4, 'WORKING', '{"reps": 3, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.85}}'::jsonb, 3, '{"value": 265, "unit": "lb"}'::jsonb, 8.5, true),
    (la_id, reviewer_uid, 5, 'AMRAP', '{"reps": 3, "loadSpec": {"type": "percentageOf1RM", "percentage": 0.85}}'::jsonb, 5, '{"value": 265, "unit": "lb"}'::jsonb, 9, true);

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl2, reviewer_uid, 'STRAIGHT_SETS', 2);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_rdl, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 8, '{"value": 225, "unit": "lb"}'::jsonb, 6.5, true),
    (la_id, reviewer_uid, 2, 'WORKING', 8, '{"value": 225, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 3, 'WORKING', 8, '{"value": 225, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 4, 'WORKING', 8, '{"value": 225, "unit": "lb"}'::jsonb, 8, true);

  -- Workout 3: Conditioning - 4 weeks ago
  wl3 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty,
    program_context)
  VALUES (wl3, reviewer_uid, 'Metabolic Conditioning', '2026-02-27T17:00:00Z', '2026-02-27T17:45:00Z', st_conditioning, 9,
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 1, 'dayLabel', 'Day 3 - Conditioning'));

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl3, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_running, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_distance, actual_duration, actual_heart_rate, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 85}'::jsonb, 172, true),
    (la_id, reviewer_uid, 2, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 87}'::jsonb, 175, true),
    (la_id, reviewer_uid, 3, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 88}'::jsonb, 178, true),
    (la_id, reviewer_uid, 4, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 90}'::jsonb, 180, true),
    (la_id, reviewer_uid, 5, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 92}'::jsonb, 182, true),
    (la_id, reviewer_uid, 6, 'WORKING', '{"value": 400, "unit": "m"}'::jsonb, '{"seconds": 95}'::jsonb, 185, true);

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl3, reviewer_uid, 'AMRAP', 2);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_rowing_machine, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_distance, actual_duration, actual_heart_rate, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"value": 2000, "unit": "m"}'::jsonb, '{"seconds": 448}'::jsonb, 168, true);

  -- Workout 4: Full Body - 4 weeks ago
  wl4 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session,
    program_context, overall_notes)
  VALUES (wl4, reviewer_uid, 'Full Body Power', '2026-02-28T06:00:00Z', '2026-02-28T07:20:00Z', st_full_body, 8,
    '{"value": 185, "unit": "lb"}'::jsonb,
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 1, 'dayLabel', 'Day 4 - Full Body'),
    'Hit a new deadlift PR at 415. Felt like there was more in the tank.');

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl4, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_deadlift, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed, notes) VALUES
    (la_id, reviewer_uid, 1, 'WARMUP', 5, '{"value": 135, "unit": "lb"}'::jsonb, 3, true, NULL),
    (la_id, reviewer_uid, 2, 'WARMUP', 3, '{"value": 225, "unit": "lb"}'::jsonb, 4, true, NULL),
    (la_id, reviewer_uid, 3, 'WARMUP', 2, '{"value": 315, "unit": "lb"}'::jsonb, 5.5, true, NULL),
    (la_id, reviewer_uid, 4, 'WORKING', 1, '{"value": 365, "unit": "lb"}'::jsonb, 7, true, NULL),
    (la_id, reviewer_uid, 5, 'WORKING', 1, '{"value": 395, "unit": "lb"}'::jsonb, 8.5, true, NULL),
    (la_id, reviewer_uid, 6, 'PEAK', 1, '{"value": 415, "unit": "lb"}'::jsonb, 9.5, true, 'New PR! Lockout was solid.');

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal)
  VALUES (lg_id, wl4, reviewer_uid, 'STRAIGHT_SETS', 2);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_front_squat, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 8, true);

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal, actual_rounds_completed)
  VALUES (lg_id, wl4, reviewer_uid, 'CIRCUIT', 3, 3);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_pull_up, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 8, true),
    (la_id, reviewer_uid, 2, 'WORKING', 7, true),
    (la_id, reviewer_uid, 3, 'WORKING', 6, true);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_kb_swing, 2);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 15, '{"value": 53, "unit": "lb"}'::jsonb, true),
    (la_id, reviewer_uid, 2, 'WORKING', 15, '{"value": 53, "unit": "lb"}'::jsonb, true),
    (la_id, reviewer_uid, 3, 'WORKING', 12, '{"value": 53, "unit": "lb"}'::jsonb, true);

  -- Workout 5: Upper Body week 2 - 3.5 weeks ago
  wl5 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session,
    program_context)
  VALUES (wl5, reviewer_uid, 'Upper Body Strength', '2026-03-03T06:00:00Z', '2026-03-03T07:10:00Z', st_upper_str, 6,
    '{"value": 184, "unit": "lb"}'::jsonb,
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 2, 'dayLabel', 'Day 1 - Upper'));

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal) VALUES (lg_id, wl5, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_bench_press, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 4, 'WORKING', 5, '{"value": 185, "unit": "lb"}'::jsonb, 8.5, true);

  -- Workout 6: Lower Body week 3 - 2.5 weeks ago
  wl6 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session,
    program_context)
  VALUES (wl6, reviewer_uid, 'Lower Body Strength', '2026-03-12T06:00:00Z', '2026-03-12T07:25:00Z', st_lower_str, 8,
    '{"value": 186, "unit": "lb"}'::jsonb,
    jsonb_build_object('programId', prog_id, 'blockId', blk_accum, 'weekNumber', 3, 'dayLabel', 'Day 2 - Lower'));

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal) VALUES (lg_id, wl6, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_back_squat, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 3, '{"value": 275, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 2, 'WORKING', 3, '{"value": 275, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 3, 'WORKING', 3, '{"value": 275, "unit": "lb"}'::jsonb, 8.5, true),
    (la_id, reviewer_uid, 4, 'WORKING', 3, '{"value": 275, "unit": "lb"}'::jsonb, 9, true),
    (la_id, reviewer_uid, 5, 'AMRAP', 4, '{"value": 275, "unit": "lb"}'::jsonb, 9.5, true);

  -- Workout 7: Intensification Upper - 1.5 weeks ago
  wl7 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty,
    program_context)
  VALUES (wl7, reviewer_uid, 'Upper Body Strength', '2026-03-24T06:00:00Z', '2026-03-24T07:05:00Z', st_upper_str, 7,
    jsonb_build_object('programId', prog_id, 'blockId', blk_intens, 'weekNumber', 1, 'dayLabel', 'Day 1 - Upper'));

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal) VALUES (lg_id, wl7, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_bench_press, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 3, '{"value": 195, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 3, '{"value": 195, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', 3, '{"value": 195, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 4, 'WORKING', 2, '{"value": 195, "unit": "lb"}'::jsonb, 9, true);

  -- Workout 8: Lower Body most recent - 3 days ago
  wl8 := gen_random_uuid();
  INSERT INTO workout_logs (id, user_id, title, started_at, completed_at, session_template_id, perceived_difficulty, bodyweight_at_session,
    program_context, overall_notes)
  VALUES (wl8, reviewer_uid, 'Lower Body Strength', '2026-04-01T06:00:00Z', '2026-04-01T07:20:00Z', st_lower_str, 7,
    '{"value": 185, "unit": "lb"}'::jsonb,
    jsonb_build_object('programId', prog_id, 'blockId', blk_intens, 'weekNumber', 2, 'dayLabel', 'Day 2 - Lower'),
    'Back squat felt smoother at heavier weight. Keeping RPE honest.');

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal) VALUES (lg_id, wl8, reviewer_uid, 'STRAIGHT_SETS', 1);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_back_squat, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 3, '{"value": 285, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 2, 'WORKING', 3, '{"value": 285, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 3, 'WORKING', 3, '{"value": 285, "unit": "lb"}'::jsonb, 8.5, true),
    (la_id, reviewer_uid, 4, 'WORKING', 3, '{"value": 285, "unit": "lb"}'::jsonb, 9, true),
    (la_id, reviewer_uid, 5, 'AMRAP', 5, '{"value": 285, "unit": "lb"}'::jsonb, 9.5, true);

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal) VALUES (lg_id, wl8, reviewer_uid, 'STRAIGHT_SETS', 2);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_rdl, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_reps, actual_weight, rpe, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', 8, '{"value": 235, "unit": "lb"}'::jsonb, 7, true),
    (la_id, reviewer_uid, 2, 'WORKING', 8, '{"value": 235, "unit": "lb"}'::jsonb, 7.5, true),
    (la_id, reviewer_uid, 3, 'WORKING', 8, '{"value": 235, "unit": "lb"}'::jsonb, 8, true),
    (la_id, reviewer_uid, 4, 'WORKING', 8, '{"value": 235, "unit": "lb"}'::jsonb, 8.5, true);

  lg_id := gen_random_uuid();
  INSERT INTO logged_activity_groups (id, workout_log_id, user_id, group_type, ordinal, actual_rounds_completed) VALUES (lg_id, wl8, reviewer_uid, 'SUPERSET', 3, 3);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_farmer_walk, 1);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_weight, actual_duration, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"value": 70, "unit": "lb"}'::jsonb, '{"seconds": 60}'::jsonb, true),
    (la_id, reviewer_uid, 2, 'WORKING', '{"value": 70, "unit": "lb"}'::jsonb, '{"seconds": 55}'::jsonb, true),
    (la_id, reviewer_uid, 3, 'WORKING', '{"value": 70, "unit": "lb"}'::jsonb, '{"seconds": 52}'::jsonb, true);
  la_id := gen_random_uuid();
  INSERT INTO logged_activities (id, logged_group_id, user_id, exercise_id, ordinal) VALUES (la_id, lg_id, reviewer_uid, ex_plank, 2);
  INSERT INTO logged_sets (logged_activity_id, user_id, set_number, set_type, actual_duration, completed) VALUES
    (la_id, reviewer_uid, 1, 'WORKING', '{"seconds": 60}'::jsonb, true),
    (la_id, reviewer_uid, 2, 'WORKING', '{"seconds": 55}'::jsonb, true),
    (la_id, reviewer_uid, 3, 'WORKING', '{"seconds": 50}'::jsonb, true);

  -- =========================================================================
  -- 6. ONE REP MAX HISTORY (progression over time)
  -- =========================================================================
  INSERT INTO one_rep_max_history (user_id, exercise_id, weight, estimated, recorded_at) VALUES
    -- Back Squat progression
    (reviewer_uid, ex_back_squat, '{"value": 295, "unit": "lb"}'::jsonb, true,  '2026-01-15T12:00:00Z'),
    (reviewer_uid, ex_back_squat, '{"value": 305, "unit": "lb"}'::jsonb, true,  '2026-02-01T12:00:00Z'),
    (reviewer_uid, ex_back_squat, '{"value": 315, "unit": "lb"}'::jsonb, true,  '2026-02-26T12:00:00Z'),
    -- Bench Press progression
    (reviewer_uid, ex_bench_press, '{"value": 210, "unit": "lb"}'::jsonb, true, '2026-01-15T12:00:00Z'),
    (reviewer_uid, ex_bench_press, '{"value": 220, "unit": "lb"}'::jsonb, true, '2026-02-10T12:00:00Z'),
    (reviewer_uid, ex_bench_press, '{"value": 225, "unit": "lb"}'::jsonb, true, '2026-03-03T12:00:00Z'),
    -- Deadlift progression
    (reviewer_uid, ex_deadlift, '{"value": 385, "unit": "lb"}'::jsonb, false, '2026-01-20T12:00:00Z'),
    (reviewer_uid, ex_deadlift, '{"value": 395, "unit": "lb"}'::jsonb, true,  '2026-02-15T12:00:00Z'),
    (reviewer_uid, ex_deadlift, '{"value": 405, "unit": "lb"}'::jsonb, true,  '2026-02-28T12:00:00Z'),
    (reviewer_uid, ex_deadlift, '{"value": 415, "unit": "lb"}'::jsonb, false, '2026-02-28T12:30:00Z'),
    -- Overhead Press progression
    (reviewer_uid, ex_overhead_press, '{"value": 145, "unit": "lb"}'::jsonb, true, '2026-01-15T12:00:00Z'),
    (reviewer_uid, ex_overhead_press, '{"value": 150, "unit": "lb"}'::jsonb, true, '2026-02-10T12:00:00Z'),
    (reviewer_uid, ex_overhead_press, '{"value": 155, "unit": "lb"}'::jsonb, true, '2026-03-10T12:00:00Z');

  -- =========================================================================
  -- 7. ACCOUNTABILITY GROUP (for sharing/social screens)
  -- =========================================================================
  DECLARE
    grp_id UUID := gen_random_uuid();
  BEGIN
    INSERT INTO accountability_groups (id, user_id, name, description, data_retention_days, created_by)
    VALUES (grp_id, reviewer_uid, 'Strength Squad', 'Training accountability group for the review team', 60, reviewer_uid);

    INSERT INTO group_members (group_id, user_id, role, share_history_before_join)
    VALUES (grp_id, reviewer_uid, 'COACH', true);

    INSERT INTO group_invites (group_id, created_by, expires_at, is_active)
    VALUES (grp_id, reviewer_uid, now() + interval '30 days', true);
  END;

  RAISE NOTICE 'Reviewer account seeded successfully. UID: %', reviewer_uid;
END;
$$;

COMMIT;
