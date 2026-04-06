-- ═══════════════════════════════════════════════════════════════════════════════
-- RANGER READY: Phase 0 (On-Ramp) + Phase 1 (Base Building) Seed Data
--
-- Coach pre-build pattern: all data owned by Robert (rghamilton3@gmail.com).
-- Teen's program will be reassigned via cascade UPDATE of user_id on
-- programs + session_templates when the teen creates their AF account.
--
-- IDEMPOTENT: Safe to run multiple times. All UUIDs are deterministic.
--
-- UUID Scheme:
--   e0000000-...-00X  = Custom exercises
--   b0000000-...-00X  = Phase 0 session templates
--   c0000000-...-00X  = Phase 1 session templates
--   d0000000-...-0001-00X = Phase 0 activity groups
--   d0000000-...-0002-00X = Phase 1 activity groups
--   a0000000-...-000000000001 = Program
--   a0000000-...-0001-00X = Blocks
--   a0000000-...-0002-00X = Block weeks
--
-- Known constraints (bugs found during testing):
--   - group_type: STRAIGHT_SETS not STRAIGHT
--   - forReps set_scheme: uses "targetReps" not "reps"
--   - event_metadata.eventDate: must be UTC with Z suffix, not offset
--   - event_metadata.eventUrl: must be string (empty ""), not null
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── SECTION 1: CLEANUP + EXERCISES ──────────────────────────────────────────

DO $$ DECLARE v_prog_id UUID := 'a0000000-0000-0000-0000-000000000001'; BEGIN
  DELETE FROM scheduled_sessions WHERE block_week_id IN (SELECT bw.id FROM block_weeks bw JOIN blocks b ON bw.block_id = b.id WHERE b.program_id = v_prog_id);
  DELETE FROM block_weeks WHERE block_id IN (SELECT id FROM blocks WHERE program_id = v_prog_id);
  DELETE FROM blocks WHERE program_id = v_prog_id;
  DELETE FROM programs WHERE id = v_prog_id;
  DELETE FROM activities WHERE activity_group_id IN (SELECT id FROM activity_groups WHERE session_template_id IN (SELECT id FROM session_templates WHERE id::text LIKE 'b0000000%' OR id::text LIKE 'c0000000%'));
  DELETE FROM activity_groups WHERE session_template_id IN (SELECT id FROM session_templates WHERE id::text LIKE 'b0000000%' OR id::text LIKE 'c0000000%');
  DELETE FROM session_templates WHERE id::text LIKE 'b0000000%' OR id::text LIKE 'c0000000%';
  DELETE FROM exercises WHERE id::text LIKE 'e0000000%';
END $$;

INSERT INTO exercises (id,name,aliases,category,movement_pattern,muscle_groups,is_bilateral,supports_1rm,equipment_required,is_custom,user_id,created_at,updated_at) VALUES
('e0000000-0000-0000-0000-000000000001','Air Squat','["Bodyweight Squat"]','BODYWEIGHT','SQUAT','{"primary":["QUADS","GLUTES"],"secondary":["CORE"]}',true,false,'["NONE"]',false,NULL,NOW(),NOW()),
('e0000000-0000-0000-0000-000000000002','Bodyweight Lunge','["Walking Lunge","Forward Lunge"]','BODYWEIGHT','SQUAT','{"primary":["QUADS","GLUTES"],"secondary":["HAMSTRINGS","CORE"]}',false,false,'["NONE"]',false,NULL,NOW(),NOW()),
('e0000000-0000-0000-0000-000000000003','Trap Bar Deadlift','["Hex Bar Deadlift"]','BARBELL','HINGE','{"primary":["QUADS","HAMSTRINGS","GLUTES","BACK"],"secondary":["FOREARMS","TRAPS","CORE"]}',true,true,'["BARBELL"]',false,NULL,NOW(),NOW()),
('e0000000-0000-0000-0000-000000000004','Bicycle Crunch','["Bicycle Sit-Up"]','BODYWEIGHT','ROTATE','{"primary":["CORE"],"secondary":[]}',true,false,'["NONE"]',false,NULL,NOW(),NOW()),
('e0000000-0000-0000-0000-000000000005','Back Extension','["Hyperextension"]','BODYWEIGHT','HINGE','{"primary":["BACK","GLUTES"],"secondary":["HAMSTRINGS"]}',true,false,'["NONE"]',false,NULL,NOW(),NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();


-- ─── SECTION 2: SESSION TEMPLATES + ACTIVITY GROUPS ──────────────────────────

-- Stock exercise IDs are looked up by name in Section 3 (vary per environment).

DO $$ DECLARE v_uid UUID; v_now TIMESTAMPTZ := NOW(); BEGIN

-- Look up user by email (ID varies per environment)
SELECT id INTO v_uid FROM auth.users WHERE email = 'rghamilton3@gmail.com' LIMIT 1;
IF v_uid IS NULL THEN RAISE EXCEPTION 'User rghamilton3@gmail.com not found in auth.users'; END IF;

-- Phase 0 Templates
INSERT INTO session_templates (id,user_id,name,description,category,scoring,created_at,updated_at) VALUES
('b0000000-0000-0000-0000-000000000001',v_uid,'On-Ramp: BW Circuit Wk1','Bodyweight circuit: 2 rounds × 10 reps. 60s rest between exercises.','SE','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000002',v_uid,'On-Ramp: BW Circuit Wk2','Bodyweight circuit: 2 rounds × 12 reps.','SE','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000003',v_uid,'On-Ramp: BW Circuit Wk3','Bodyweight circuit: 3 rounds × 10 reps.','SE','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000004',v_uid,'On-Ramp: BW Circuit Wk4','Bodyweight circuit: 3 rounds × 15 reps.','SE','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000005',v_uid,'On-Ramp: Walk/Jog','Walk/jog at conversational pace.','CONDITIONING','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000006',v_uid,'On-Ramp: Learn the Lifts','Barbell form: Back Squat, Bench Press, Trap Bar DL, OHP.','STRENGTH','NONE',v_now,v_now),
('b0000000-0000-0000-0000-000000000007',v_uid,'On-Ramp: Long Walk/Jog','Extended easy cardio. Outdoors preferred.','CONDITIONING','NONE',v_now,v_now);

-- Phase 1 Templates
INSERT INTO session_templates (id,user_id,name,description,category,scoring,created_at,updated_at) VALUES
('c0000000-0000-0000-0000-000000000001',v_uid,'BB: SE Circuit 3×20','SE circuit: 3 rounds × 20 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000002',v_uid,'BB: SE Circuit 2×20','SE circuit: 2 rounds × 20 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000003',v_uid,'BB: SE Circuit 3×30','SE circuit: 3 rounds × 30 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000004',v_uid,'BB: SE Circuit 2×30','SE circuit: 2 rounds × 30 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000005',v_uid,'BB: SE Circuit 3×40','SE circuit: 3 rounds × 40 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000006',v_uid,'BB: SE Circuit 2×40','SE circuit: 2 rounds × 40 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000007',v_uid,'BB: SE Circuit 1×50','SE circuit: 1 round × 50 reps.','SE','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000008',v_uid,'BB: LSS Run','Long Steady State run. 120-150 bpm.','CONDITIONING','NONE',v_now,v_now),
('c0000000-0000-0000-0000-000000000009',v_uid,'BB: Long E Session','Extended endurance. Saturday shared.','CONDITIONING','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000a',v_uid,'BB: Recovery','Light movement: walk, stretch, foam roll.','CONDITIONING','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000b',v_uid,'BB: HIC #1-10','High Intensity Conditioning. HIC 1-10 only.','CONDITIONING','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000c',v_uid,'BB: Fighter @ 75%','Fighter: 3×5 @ 75% TM.','STRENGTH','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000d',v_uid,'BB: Fighter @ 80%','Fighter: 3×5 @ 80% TM.','STRENGTH','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000e',v_uid,'BB: Fighter @ 90%','Fighter: 3×3 @ 90% TM.','STRENGTH','NONE',v_now,v_now),
('c0000000-0000-0000-0000-00000000000f',v_uid,'Operation Ruck the Bayou - 5K','5K ruck. 20 lb.','EVENT','NONE',v_now,v_now);

UPDATE session_templates SET event_metadata = '{"name":"Operation Ruck the Bayou - 5K","eventDate":"2026-05-16T13:00:00Z","location":"Houston, TX","eventUrl":"https://www.operationruckthebayou.com"}'::jsonb WHERE id = 'c0000000-0000-0000-0000-00000000000f';

-- Phase 0 Activity Groups
INSERT INTO activity_groups (id,session_template_id,group_type,ordinal,rounds,rest_between_rounds,rest_between_activities,created_at,updated_at) VALUES
('d0000000-0000-0000-0001-000000000001','b0000000-0000-0000-0000-000000000001','CIRCUIT',1,2,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0001-000000000002','b0000000-0000-0000-0000-000000000002','CIRCUIT',1,2,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0001-000000000003','b0000000-0000-0000-0000-000000000003','CIRCUIT',1,3,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0001-000000000004','b0000000-0000-0000-0000-000000000004','CIRCUIT',1,3,'{"seconds":120}','{"seconds":60}',v_now,v_now);

-- Phase 1 SE Circuit Activity Groups
INSERT INTO activity_groups (id,session_template_id,group_type,ordinal,rounds,rest_between_rounds,rest_between_activities,created_at,updated_at) VALUES
('d0000000-0000-0000-0002-000000000001','c0000000-0000-0000-0000-000000000001','CIRCUIT',1,3,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000002','c0000000-0000-0000-0000-000000000002','CIRCUIT',1,2,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000003','c0000000-0000-0000-0000-000000000003','CIRCUIT',1,3,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000004','c0000000-0000-0000-0000-000000000004','CIRCUIT',1,2,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000005','c0000000-0000-0000-0000-000000000005','CIRCUIT',1,3,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000006','c0000000-0000-0000-0000-000000000006','CIRCUIT',1,2,'{"seconds":120}','{"seconds":60}',v_now,v_now),
('d0000000-0000-0000-0002-000000000007','c0000000-0000-0000-0000-000000000007','CIRCUIT',1,1,NULL,'{"seconds":60}',v_now,v_now);

-- STRAIGHT_SETS groups (no rest_between_activities)
INSERT INTO activity_groups (id,session_template_id,group_type,ordinal,created_at,updated_at) VALUES
('d0000000-0000-0000-0001-000000000005','b0000000-0000-0000-0000-000000000005','STRAIGHT_SETS',1,v_now,v_now),
('d0000000-0000-0000-0001-000000000007','b0000000-0000-0000-0000-000000000007','STRAIGHT_SETS',1,v_now,v_now),
('d0000000-0000-0000-0002-000000000008','c0000000-0000-0000-0000-000000000008','STRAIGHT_SETS',1,v_now,v_now),
('d0000000-0000-0000-0002-000000000009','c0000000-0000-0000-0000-000000000009','STRAIGHT_SETS',1,v_now,v_now),
('d0000000-0000-0000-0002-00000000000b','c0000000-0000-0000-0000-00000000000b','STRAIGHT_SETS',1,v_now,v_now);

-- STRAIGHT_SETS groups (with rest_between_activities)
INSERT INTO activity_groups (id,session_template_id,group_type,ordinal,rest_between_activities,created_at,updated_at) VALUES
('d0000000-0000-0000-0001-000000000006','b0000000-0000-0000-0000-000000000006','STRAIGHT_SETS',1,'{"seconds":120}',v_now,v_now),
('d0000000-0000-0000-0002-00000000000c','c0000000-0000-0000-0000-00000000000c','STRAIGHT_SETS',1,'{"seconds":180}',v_now,v_now),
('d0000000-0000-0000-0002-00000000000d','c0000000-0000-0000-0000-00000000000d','STRAIGHT_SETS',1,'{"seconds":180}',v_now,v_now),
('d0000000-0000-0000-0002-00000000000e','c0000000-0000-0000-0000-00000000000e','STRAIGHT_SETS',1,'{"seconds":240}',v_now,v_now);

END $$;


-- ─── SECTION 3: ACTIVITIES ───────────────────────────────────────────────────

DO $$ DECLARE v_now TIMESTAMPTZ := NOW();
  ex_pu UUID; ex_ir UUID; ex_pl UUID; ex_rn UUID;
  ex_bsq UUID; ex_bp UUID; ex_ohp UUID; ex_dip UUID;
  ex_as UUID:='e0000000-0000-0000-0000-000000000001'; ex_lu UUID:='e0000000-0000-0000-0000-000000000002';
  ex_td UUID:='e0000000-0000-0000-0000-000000000003'; ex_bc UUID:='e0000000-0000-0000-0000-000000000004';
  ex_be UUID:='e0000000-0000-0000-0000-000000000005';
  ag_p0 UUID[]; ag_se UUID[]; se_reps INT[];
BEGIN

-- Look up stock exercise IDs by name (IDs vary per environment)
SELECT id INTO ex_pu FROM exercises WHERE name = 'Push-Up' LIMIT 1;
SELECT id INTO ex_ir FROM exercises WHERE name = 'Inverted Row' LIMIT 1;
SELECT id INTO ex_pl FROM exercises WHERE name = 'Plank' LIMIT 1;
SELECT id INTO ex_rn FROM exercises WHERE name = 'Running' LIMIT 1;
SELECT id INTO ex_bsq FROM exercises WHERE name = 'Back Squat' LIMIT 1;
SELECT id INTO ex_bp FROM exercises WHERE name = 'Bench Press' LIMIT 1;
SELECT id INTO ex_ohp FROM exercises WHERE name = 'Overhead Press' LIMIT 1;
SELECT id INTO ex_dip FROM exercises WHERE name = 'Dip' LIMIT 1;

-- Phase 0 BW Circuits: Push-Up, Air Squat, BW Lunge, Plank(timedHold), Inverted Row
ag_p0 := ARRAY['d0000000-0000-0000-0001-000000000001'::uuid,'d0000000-0000-0000-0001-000000000002'::uuid,'d0000000-0000-0000-0001-000000000003'::uuid,'d0000000-0000-0000-0001-000000000004'::uuid];
FOR i IN 1..4 LOOP DECLARE reps INT:=CASE i WHEN 1 THEN 10 WHEN 2 THEN 12 WHEN 3 THEN 10 WHEN 4 THEN 15 END; hold INT:=CASE i WHEN 1 THEN 30 WHEN 2 THEN 30 WHEN 3 THEN 45 WHEN 4 THEN 60 END; BEGIN
  INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,created_at,updated_at) VALUES
  (gen_random_uuid(),ag_p0[i],ex_pu,1,jsonb_build_object('type','forReps','targetReps',reps),v_now,v_now),
  (gen_random_uuid(),ag_p0[i],ex_as,2,jsonb_build_object('type','forReps','targetReps',reps),v_now,v_now),
  (gen_random_uuid(),ag_p0[i],ex_lu,3,jsonb_build_object('type','forReps','targetReps',reps),v_now,v_now),
  (gen_random_uuid(),ag_p0[i],ex_pl,4,jsonb_build_object('type','timedHold','duration',jsonb_build_object('seconds',hold),'sets',1),v_now,v_now),
  (gen_random_uuid(),ag_p0[i],ex_ir,5,jsonb_build_object('type','forReps','targetReps',reps),v_now,v_now);
END; END LOOP;

-- Phase 0 cardio + strength activities
INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,notes,created_at,updated_at) VALUES
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000005',ex_rn,1,'{"type":"cardioSteadyState","duration":{"seconds":1500},"modality":"RUNNING","intensityNotes":"Walk/jog. Walk when needed."}'::jsonb,'20-30 min.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000007',ex_rn,1,'{"type":"cardioSteadyState","duration":{"seconds":3600},"modality":"RUNNING","intensityNotes":"Easy walk or walk/jog."}'::jsonb,'Wk1:45-60m Wk2:50-60m Wk3-4:60m',v_now,v_now);

INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,notes,created_at,updated_at) VALUES
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000006',ex_bsq,1,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"unspecified"},"restBetweenSets":{"seconds":120}}'::jsonb,'Empty bar Wk1-2, light Wk3-4.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000006',ex_bp,2,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"unspecified"},"restBetweenSets":{"seconds":120}}'::jsonb,'Empty bar Wk1-2, light Wk3-4.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000006',ex_td,3,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"unspecified"},"restBetweenSets":{"seconds":120}}'::jsonb,'Empty trap bar Wk1-2, light Wk3-4.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0001-000000000006',ex_ohp,4,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"unspecified"},"restBetweenSets":{"seconds":120}}'::jsonb,'Empty bar Wk1-2, light Wk3-4.',v_now,v_now);

-- Phase 1 SE Circuits: Push-Up, Air Squat, Inverted Row, Bicycle Crunch, Dip, Back Extension
ag_se := ARRAY['d0000000-0000-0000-0002-000000000001'::uuid,'d0000000-0000-0000-0002-000000000002'::uuid,'d0000000-0000-0000-0002-000000000003'::uuid,'d0000000-0000-0000-0002-000000000004'::uuid,'d0000000-0000-0000-0002-000000000005'::uuid,'d0000000-0000-0000-0002-000000000006'::uuid,'d0000000-0000-0000-0002-000000000007'::uuid];
se_reps := ARRAY[20,20,30,30,40,40,50];
FOR i IN 1..7 LOOP
  INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,created_at,updated_at) VALUES
  (gen_random_uuid(),ag_se[i],ex_pu,1,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now),
  (gen_random_uuid(),ag_se[i],ex_as,2,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now),
  (gen_random_uuid(),ag_se[i],ex_ir,3,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now),
  (gen_random_uuid(),ag_se[i],ex_bc,4,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now),
  (gen_random_uuid(),ag_se[i],ex_dip,5,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now),
  (gen_random_uuid(),ag_se[i],ex_be,6,jsonb_build_object('type','forReps','targetReps',se_reps[i]),v_now,v_now);
END LOOP;

-- Phase 1 cardio + HIC activities
INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,notes,created_at,updated_at) VALUES
(gen_random_uuid(),'d0000000-0000-0000-0002-000000000008',ex_rn,1,'{"type":"cardioSteadyState","duration":{"seconds":2700},"modality":"RUNNING","intensityNotes":"Conversational pace. 120-150 bpm."}'::jsonb,'Duration varies — see session notes.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-000000000009',ex_rn,1,'{"type":"cardioSteadyState","duration":{"seconds":5400},"modality":"RUNNING","intensityNotes":"Easy pace. Push duration."}'::jsonb,'Saturday. Push boundaries.',v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000b',ex_rn,1,'{"type":"cardioInterval","workDistance":{"unit":"m","value":600},"rest":{"seconds":120},"rounds":5,"modality":"RUNNING","intensityNotes":"High effort."}'::jsonb,'Placeholder — choose from HIC #1-10.',v_now,v_now);

-- Phase 1 Fighter activities (SQ/BP/TBDL × 3 percentage variants)
INSERT INTO activities (id,activity_group_id,exercise_id,ordinal,set_scheme,created_at,updated_at) VALUES
-- @ 75%
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000c',ex_bsq,1,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.75},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000c',ex_bp,2,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.75},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000c',ex_td,3,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.75},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
-- @ 80%
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000d',ex_bsq,1,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.80},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000d',ex_bp,2,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.80},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000d',ex_td,3,'{"type":"fixedSets","sets":3,"reps":5,"load":{"type":"percentageOf1RM","percentage":0.80},"restBetweenSets":{"seconds":180}}'::jsonb,v_now,v_now),
-- @ 90%
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000e',ex_bsq,1,'{"type":"fixedSets","sets":3,"reps":3,"load":{"type":"percentageOf1RM","percentage":0.90},"restBetweenSets":{"seconds":240}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000e',ex_bp,2,'{"type":"fixedSets","sets":3,"reps":3,"load":{"type":"percentageOf1RM","percentage":0.90},"restBetweenSets":{"seconds":240}}'::jsonb,v_now,v_now),
(gen_random_uuid(),'d0000000-0000-0000-0002-00000000000e',ex_td,3,'{"type":"fixedSets","sets":3,"reps":3,"load":{"type":"percentageOf1RM","percentage":0.90},"restBetweenSets":{"seconds":240}}'::jsonb,v_now,v_now);

END $$;


-- ─── SECTION 4: PROGRAM → BLOCKS → WEEKS → SCHEDULED SESSIONS ───────────────

DO $$ DECLARE v_uid UUID; v_now TIMESTAMPTZ:=NOW();
  v_prog UUID:='a0000000-0000-0000-0000-000000000001';
  v_blk0 UUID:='a0000000-0000-0000-0001-000000000001'; v_blk1 UUID:='a0000000-0000-0000-0001-000000000002';
  w01 UUID:='a0000000-0000-0000-0002-000000000001'; w02 UUID:='a0000000-0000-0000-0002-000000000002';
  w03 UUID:='a0000000-0000-0000-0002-000000000003'; w04 UUID:='a0000000-0000-0000-0002-000000000004';
  w05 UUID:='a0000000-0000-0000-0002-000000000005'; w06 UUID:='a0000000-0000-0000-0002-000000000006';
  w07 UUID:='a0000000-0000-0000-0002-000000000007'; w08 UUID:='a0000000-0000-0000-0002-000000000008';
  w09 UUID:='a0000000-0000-0000-0002-000000000009'; w10 UUID:='a0000000-0000-0000-0002-00000000000a';
  w11 UUID:='a0000000-0000-0000-0002-00000000000b'; w12 UUID:='a0000000-0000-0000-0002-00000000000c';
  -- Phase 0 template shortcuts
  bw1 UUID:='b0000000-0000-0000-0000-000000000001'; bw2 UUID:='b0000000-0000-0000-0000-000000000002';
  bw3 UUID:='b0000000-0000-0000-0000-000000000003'; bw4 UUID:='b0000000-0000-0000-0000-000000000004';
  wj UUID:='b0000000-0000-0000-0000-000000000005'; lf UUID:='b0000000-0000-0000-0000-000000000006';
  lw UUID:='b0000000-0000-0000-0000-000000000007';
  -- Phase 1 template shortcuts
  s3x20 UUID:='c0000000-0000-0000-0000-000000000001'; s2x20 UUID:='c0000000-0000-0000-0000-000000000002';
  s3x30 UUID:='c0000000-0000-0000-0000-000000000003'; s2x30 UUID:='c0000000-0000-0000-0000-000000000004';
  s3x40 UUID:='c0000000-0000-0000-0000-000000000005'; s2x40 UUID:='c0000000-0000-0000-0000-000000000006';
  s1x50 UUID:='c0000000-0000-0000-0000-000000000007'; lss UUID:='c0000000-0000-0000-0000-000000000008';
  lge UUID:='c0000000-0000-0000-0000-000000000009'; rec UUID:='c0000000-0000-0000-0000-00000000000a';
  hic UUID:='c0000000-0000-0000-0000-00000000000b'; f75 UUID:='c0000000-0000-0000-0000-00000000000c';
  f80 UUID:='c0000000-0000-0000-0000-00000000000d'; f90 UUID:='c0000000-0000-0000-0000-00000000000e';
  evt UUID:='c0000000-0000-0000-0000-00000000000f';
BEGIN

SELECT id INTO v_uid FROM auth.users WHERE email = 'rghamilton3@gmail.com' LIMIT 1;
IF v_uid IS NULL THEN RAISE EXCEPTION 'User rghamilton3@gmail.com not found in auth.users'; END IF;

INSERT INTO programs (id,user_id,name,description,source,duration_weeks,is_public,created_by,created_at,updated_at) VALUES
(v_prog,v_uid,'Ranger Ready','60-week BCT+RASP prep. Tactical Barbell. Sedentary to selection-ready.','CUSTOM',60,false,v_uid,v_now,v_now);

INSERT INTO blocks (id,program_id,name,ordinal,duration_weeks,block_type,created_at,updated_at) VALUES
(v_blk0,v_prog,'Phase 0: On-Ramp',1,4,'ACCUMULATION',v_now,v_now),
(v_blk1,v_prog,'Phase 1: Base Building',2,8,'ACCUMULATION',v_now,v_now);

INSERT INTO block_weeks (id,block_id,week_number,created_at,updated_at) VALUES
(w01,v_blk0,1,v_now,v_now),(w02,v_blk0,2,v_now,v_now),(w03,v_blk0,3,v_now,v_now),(w04,v_blk0,4,v_now,v_now),
(w05,v_blk1,1,v_now,v_now),(w06,v_blk1,2,v_now,v_now),(w07,v_blk1,3,v_now,v_now),(w08,v_blk1,4,v_now,v_now),
(w09,v_blk1,5,v_now,v_now),(w10,v_blk1,6,v_now,v_now),(w11,v_blk1,7,v_now,v_now),(w12,v_blk1,8,v_now,v_now);

-- Aligned schedule: Mon/Fri=SE/Strength, Tue/Thu=Cardio, Wed=Gym/Recovery, Sat=Long(shared), Sun=REST
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

-- ── Phase 0: On-Ramp (4 weeks, 24 sessions) ─────────────────────────────────
INSERT INTO scheduled_sessions (id,block_week_id,day_of_week,day_label,session_type,session_template_id,notes,created_at,updated_at) VALUES
-- Week 1
(gen_random_uuid(),w01,1,'Monday','SE',bw1,NULL,v_now,v_now),(gen_random_uuid(),w01,2,'Tuesday','CONDITIONING',wj,'Walk/jog 20-30 min. 2:1 ratio.',v_now,v_now),
(gen_random_uuid(),w01,3,'Wednesday','STRENGTH',lf,'Empty bar only. Focus on form.',v_now,v_now),(gen_random_uuid(),w01,4,'Thursday','CONDITIONING',wj,'Walk/jog 20-30 min.',v_now,v_now),
(gen_random_uuid(),w01,5,'Friday','SE',bw1,NULL,v_now,v_now),(gen_random_uuid(),w01,6,'Saturday','CONDITIONING',lw,'45-60 min. Shared with mentor.',v_now,v_now),
-- Week 2
(gen_random_uuid(),w02,1,'Monday','SE',bw2,NULL,v_now,v_now),(gen_random_uuid(),w02,2,'Tuesday','CONDITIONING',wj,'Walk/jog 25-30 min. ~1:1 ratio.',v_now,v_now),
(gen_random_uuid(),w02,3,'Wednesday','STRENGTH',lf,'Empty bar. Add 5-10 lb if form OK.',v_now,v_now),(gen_random_uuid(),w02,4,'Thursday','CONDITIONING',wj,'Walk/jog 25-30 min.',v_now,v_now),
(gen_random_uuid(),w02,5,'Friday','SE',bw2,NULL,v_now,v_now),(gen_random_uuid(),w02,6,'Saturday','CONDITIONING',lw,'50-60 min. Shared.',v_now,v_now),
-- Week 3
(gen_random_uuid(),w03,1,'Monday','SE',bw3,NULL,v_now,v_now),(gen_random_uuid(),w03,2,'Tuesday','CONDITIONING',wj,'Walk/jog 30 min. Jog 10-15 min.',v_now,v_now),
(gen_random_uuid(),w03,3,'Wednesday','STRENGTH',lf,'Light weight.',v_now,v_now),(gen_random_uuid(),w03,4,'Thursday','CONDITIONING',wj,'Walk/jog 30 min.',v_now,v_now),
(gen_random_uuid(),w03,5,'Friday','SE',bw3,NULL,v_now,v_now),(gen_random_uuid(),w03,6,'Saturday','CONDITIONING',lw,'60 min. Shared.',v_now,v_now),
-- Week 4 (Checkpoint)
(gen_random_uuid(),w04,1,'Monday','SE',bw4,'Checkpoint week.',v_now,v_now),(gen_random_uuid(),w04,2,'Tuesday','CONDITIONING',wj,'Jog 15-20 min continuous.',v_now,v_now),
(gen_random_uuid(),w04,3,'Wednesday','STRENGTH',lf,'Light weight. Test form.',v_now,v_now),(gen_random_uuid(),w04,4,'Thursday','CONDITIONING',wj,'Jog 15-20 min continuous.',v_now,v_now),
(gen_random_uuid(),w04,5,'Friday','SE',bw4,NULL,v_now,v_now),(gen_random_uuid(),w04,6,'Saturday','CONDITIONING',lw,'60 min. Checkpoint: 20 min jog? Shared.',v_now,v_now);

-- ── Phase 1: Base Building — SE + Endurance (weeks 5-8) ──────────────────────
INSERT INTO scheduled_sessions (id,block_week_id,day_of_week,day_label,session_type,session_template_id,notes,created_at,updated_at) VALUES
-- Week 5 (SE 3×20 / 2×20)
(gen_random_uuid(),w05,1,'Monday','SE',s3x20,NULL,v_now,v_now),(gen_random_uuid(),w05,2,'Tuesday','CONDITIONING',lss,'E × 30 min.',v_now,v_now),
(gen_random_uuid(),w05,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w05,4,'Thursday','CONDITIONING',lss,'E × 30 min.',v_now,v_now),
(gen_random_uuid(),w05,5,'Friday','SE',s2x20,NULL,v_now,v_now),(gen_random_uuid(),w05,6,'Saturday','CONDITIONING',lge,'35-60 min. Shared.',v_now,v_now),
-- Week 6 (SE 3×30 / 2×30)
(gen_random_uuid(),w06,1,'Monday','SE',s3x30,NULL,v_now,v_now),(gen_random_uuid(),w06,2,'Tuesday','CONDITIONING',lss,'E × 40 min.',v_now,v_now),
(gen_random_uuid(),w06,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w06,4,'Thursday','CONDITIONING',lss,'E × 40 min.',v_now,v_now),
(gen_random_uuid(),w06,5,'Friday','SE',s2x30,NULL,v_now,v_now),(gen_random_uuid(),w06,6,'Saturday','CONDITIONING',lge,'45-75 min. Taper for May 16. Shared.',v_now,v_now),
-- Week 7 (SE 3×40 / 2×40 + EVENT)
(gen_random_uuid(),w07,1,'Monday','SE',s3x40,NULL,v_now,v_now),(gen_random_uuid(),w07,2,'Tuesday','CONDITIONING',lss,'E × 50 min.',v_now,v_now),
(gen_random_uuid(),w07,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w07,4,'Thursday','CONDITIONING',lss,'E × 50 min.',v_now,v_now),
(gen_random_uuid(),w07,5,'Friday','SE',s2x40,NULL,v_now,v_now),(gen_random_uuid(),w07,6,'Saturday','EVENT',evt,'★ Operation Ruck the Bayou — 5K, 20 lb',v_now,v_now),
-- Week 8 (SE 1×50)
(gen_random_uuid(),w08,1,'Monday','SE',s1x50,NULL,v_now,v_now),(gen_random_uuid(),w08,2,'Tuesday','CONDITIONING',lss,'E × 60 min.',v_now,v_now),
(gen_random_uuid(),w08,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w08,4,'Thursday','CONDITIONING',lss,'E × 60 min.',v_now,v_now),
(gen_random_uuid(),w08,5,'Friday','SE',s1x50,NULL,v_now,v_now),(gen_random_uuid(),w08,6,'Saturday','CONDITIONING',lge,'60-120 min. First 60+ min run. Shared.',v_now,v_now);

-- ── Phase 1: Base Building — Max Strength + HIC (weeks 9-12) ─────────────────
INSERT INTO scheduled_sessions (id,block_week_id,day_of_week,day_label,session_type,session_template_id,notes,created_at,updated_at) VALUES
-- Week 9 (Fighter @ 75%)
(gen_random_uuid(),w09,1,'Monday','STRENGTH',f75,'Fighter @ 75%.',v_now,v_now),(gen_random_uuid(),w09,2,'Tuesday','CONDITIONING',hic,'HIC #1-10. Basic version.',v_now,v_now),
(gen_random_uuid(),w09,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w09,4,'Thursday','CONDITIONING',lss,'E × 45-60 min.',v_now,v_now),
(gen_random_uuid(),w09,5,'Friday','STRENGTH',f75,NULL,v_now,v_now),(gen_random_uuid(),w09,6,'Saturday','CONDITIONING',lss,'E × 30-60 min. Shared.',v_now,v_now),
-- Week 10 (Fighter @ 80%)
(gen_random_uuid(),w10,1,'Monday','STRENGTH',f80,'Fighter @ 80%.',v_now,v_now),(gen_random_uuid(),w10,2,'Tuesday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w10,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w10,4,'Thursday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w10,5,'Friday','STRENGTH',f80,NULL,v_now,v_now),(gen_random_uuid(),w10,6,'Saturday','CONDITIONING',lss,'E × 30-60 min. Shared.',v_now,v_now),
-- Week 11 (Fighter @ 90%)
(gen_random_uuid(),w11,1,'Monday','STRENGTH',f90,'Fighter @ 90%. Heavy week.',v_now,v_now),(gen_random_uuid(),w11,2,'Tuesday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w11,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w11,4,'Thursday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w11,5,'Friday','STRENGTH',f90,NULL,v_now,v_now),(gen_random_uuid(),w11,6,'Saturday','CONDITIONING',lss,'E × 30-60 min. Shared.',v_now,v_now),
-- Week 12 (Fighter @ 75%, Checkpoint)
(gen_random_uuid(),w12,1,'Monday','STRENGTH',f75,'Fighter @ 75%. Checkpoint.',v_now,v_now),(gen_random_uuid(),w12,2,'Tuesday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w12,3,'Wednesday','CONDITIONING',rec,'Recovery.',v_now,v_now),(gen_random_uuid(),w12,4,'Thursday','CONDITIONING',hic,'HIC #1-10.',v_now,v_now),
(gen_random_uuid(),w12,5,'Friday','STRENGTH',f75,NULL,v_now,v_now),(gen_random_uuid(),w12,6,'Saturday','CONDITIONING',lss,'CHECKPOINT: 45-60 min jog, 25+ push-ups, 1:00 plank. Shared.',v_now,v_now);

END $$;


-- ─── VERIFICATION ────────────────────────────────────────────────────────────

SELECT 'exercises' as entity, count(*) as n FROM exercises WHERE id::text LIKE 'e0000000%'
UNION ALL SELECT 'session_templates', count(*) FROM session_templates WHERE id::text LIKE 'b0000000%' OR id::text LIKE 'c0000000%'
UNION ALL SELECT 'activity_groups', count(*) FROM activity_groups WHERE id::text LIKE 'd0000000%'
UNION ALL SELECT 'activities', count(*) FROM activities WHERE activity_group_id::text LIKE 'd0000000%'
UNION ALL SELECT 'programs', count(*) FROM programs WHERE id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'blocks', count(*) FROM blocks WHERE program_id = 'a0000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'block_weeks', count(*) FROM block_weeks WHERE block_id IN (SELECT id FROM blocks WHERE program_id = 'a0000000-0000-0000-0000-000000000001')
UNION ALL SELECT 'scheduled_sessions', count(*) FROM scheduled_sessions WHERE block_week_id IN (SELECT bw.id FROM block_weeks bw JOIN blocks b ON bw.block_id = b.id WHERE b.program_id = 'a0000000-0000-0000-0000-000000000001')
ORDER BY entity;

-- Expected verification output:
-- activities          | 80
-- activity_groups     | 20
-- block_weeks         | 12
-- blocks              | 2
-- exercises           | 5
-- programs            | 1
-- scheduled_sessions  | 72
-- session_templates   | 22
