-- =============================================================================
-- Ardent Forge: Exercise Dictionary Seed Data
-- =============================================================================
-- 65 built-in exercises covering all ExerciseCategory values.
-- All enum string values match the domain type definitions exactly.
--
-- Idempotent: uses ON CONFLICT (name) DO UPDATE SET so re-running refreshes built-in data.
-- Requires a UNIQUE constraint on exercises.name (or a unique index).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- BARBELL (15 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Back Squat', '["squat", "barbell squat"]'::jsonb, 'BARBELL', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CORE"]}'::jsonb,
  true, true, '["BARBELL", "SQUAT_RACK"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Front Squat', '["front rack squat", "barbell front squat"]'::jsonb, 'BARBELL', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["CORE", "BACK"]}'::jsonb,
  true, true, '["BARBELL", "SQUAT_RACK"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Bench Press', '["flat bench", "barbell bench press"]'::jsonb, 'BARBELL', 'PUSH',
  '{"primary": ["CHEST", "TRICEPS"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, true, '["BARBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Incline Bench Press', '["incline bench", "incline barbell press"]'::jsonb, 'BARBELL', 'PUSH',
  '{"primary": ["CHEST", "SHOULDERS"], "secondary": ["TRICEPS"]}'::jsonb,
  true, false, '["BARBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Decline Bench Press', '["decline bench", "decline barbell press"]'::jsonb, 'BARBELL', 'PUSH',
  '{"primary": ["CHEST", "TRICEPS"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["BARBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Close Grip Bench Press', '["CGBP", "close grip bench"]'::jsonb, 'BARBELL', 'PUSH',
  '{"primary": ["TRICEPS", "CHEST"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["BARBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Deadlift', '["conventional deadlift", "barbell deadlift"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["HAMSTRINGS", "GLUTES", "BACK"], "secondary": ["QUADS", "FOREARMS", "TRAPS", "CORE"]}'::jsonb,
  true, true, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Sumo Deadlift', '["sumo pull", "wide stance deadlift"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["QUADS", "GLUTES", "HAMSTRINGS"], "secondary": ["BACK", "FOREARMS", "TRAPS", "CORE"]}'::jsonb,
  true, true, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Romanian Deadlift', '["RDL", "barbell RDL", "stiff leg deadlift"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["HAMSTRINGS", "GLUTES"], "secondary": ["BACK", "CORE"]}'::jsonb,
  true, false, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Overhead Press', '["OHP", "strict press", "barbell shoulder press", "military press"]'::jsonb, 'BARBELL', 'PUSH',
  '{"primary": ["SHOULDERS", "TRICEPS"], "secondary": ["CORE", "TRAPS"]}'::jsonb,
  true, true, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Barbell Row', '["bent over row", "barbell bent over row", "pendlay row"]'::jsonb, 'BARBELL', 'PULL',
  '{"primary": ["LATS", "BACK"], "secondary": ["BICEPS", "FOREARMS", "TRAPS"]}'::jsonb,
  true, false, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Power Clean', '["clean", "barbell clean"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["HAMSTRINGS", "GLUTES", "TRAPS"], "secondary": ["QUADS", "SHOULDERS", "BACK", "CORE"]}'::jsonb,
  true, true, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Hang Clean', '["hang power clean"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["HAMSTRINGS", "GLUTES", "TRAPS"], "secondary": ["QUADS", "SHOULDERS", "BACK", "CORE"]}'::jsonb,
  true, false, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Barbell Curl', '["barbell bicep curl", "standing barbell curl"]'::jsonb, 'BARBELL', 'PULL',
  '{"primary": ["BICEPS"], "secondary": ["FOREARMS"]}'::jsonb,
  true, false, '["BARBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Barbell Hip Thrust', '["hip thrust", "barbell glute bridge"]'::jsonb, 'BARBELL', 'HINGE',
  '{"primary": ["GLUTES"], "secondary": ["HAMSTRINGS", "CORE"]}'::jsonb,
  true, false, '["BARBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- DUMBBELL (10 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Bench Press', '["dumbbell press", "DB bench press", "flat dumbbell press"]'::jsonb, 'DUMBBELL', 'PUSH',
  '{"primary": ["CHEST", "TRICEPS"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["DUMBBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Row', '["single arm dumbbell row", "DB row", "one arm row"]'::jsonb, 'DUMBBELL', 'PULL',
  '{"primary": ["LATS", "BACK"], "secondary": ["BICEPS", "FOREARMS"]}'::jsonb,
  false, false, '["DUMBBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Curl', '["DB curl", "bicep curl", "standing dumbbell curl"]'::jsonb, 'DUMBBELL', 'PULL',
  '{"primary": ["BICEPS"], "secondary": ["FOREARMS"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Lateral Raise', '["side raise", "dumbbell lateral raise", "side lateral raise"]'::jsonb, 'DUMBBELL', 'PUSH',
  '{"primary": ["SHOULDERS"], "secondary": ["TRAPS"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Front Raise', '["dumbbell front raise", "front delt raise"]'::jsonb, 'DUMBBELL', 'PUSH',
  '{"primary": ["SHOULDERS"], "secondary": ["CHEST"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Lunge', '["DB lunge", "walking lunge", "dumbbell walking lunge"]'::jsonb, 'DUMBBELL', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CORE"]}'::jsonb,
  false, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Romanian Deadlift', '["dumbbell RDL", "DB RDL"]'::jsonb, 'DUMBBELL', 'HINGE',
  '{"primary": ["HAMSTRINGS", "GLUTES"], "secondary": ["BACK", "CORE"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Hammer Curl', '["dumbbell hammer curl", "neutral grip curl"]'::jsonb, 'DUMBBELL', 'PULL',
  '{"primary": ["BICEPS", "FOREARMS"], "secondary": []}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Fly', '["DB fly", "dumbbell chest fly", "flat fly"]'::jsonb, 'DUMBBELL', 'PUSH',
  '{"primary": ["CHEST"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["DUMBBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Goblet Squat', '["dumbbell goblet squat", "DB goblet squat"]'::jsonb, 'DUMBBELL', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["CORE"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- KETTLEBELL (5 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Kettlebell Swing', '["KB swing", "Russian kettlebell swing"]'::jsonb, 'KETTLEBELL', 'HINGE',
  '{"primary": ["GLUTES", "HAMSTRINGS"], "secondary": ["CORE", "SHOULDERS", "BACK"]}'::jsonb,
  true, false, '["KETTLEBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Kettlebell Goblet Squat', '["KB goblet squat"]'::jsonb, 'KETTLEBELL', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["CORE"]}'::jsonb,
  true, false, '["KETTLEBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Turkish Get-Up', '["TGU", "kettlebell get up"]'::jsonb, 'KETTLEBELL', 'PUSH',
  '{"primary": ["SHOULDERS", "CORE"], "secondary": ["GLUTES", "QUADS", "TRAPS"]}'::jsonb,
  false, false, '["KETTLEBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Kettlebell Clean and Press', '["KB clean and press", "kettlebell clean and jerk"]'::jsonb, 'KETTLEBELL', 'PUSH',
  '{"primary": ["SHOULDERS", "GLUTES"], "secondary": ["CORE", "TRICEPS", "BACK"]}'::jsonb,
  false, false, '["KETTLEBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Kettlebell Snatch', '["KB snatch"]'::jsonb, 'KETTLEBELL', 'HINGE',
  '{"primary": ["SHOULDERS", "GLUTES", "HAMSTRINGS"], "secondary": ["CORE", "TRAPS", "BACK"]}'::jsonb,
  false, false, '["KETTLEBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- BODYWEIGHT (10 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Pull-Up', '["pullup", "chin over bar"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["LATS", "BICEPS"], "secondary": ["BACK", "FOREARMS", "CORE"]}'::jsonb,
  true, false, '["PULL_UP_BAR"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Push-Up', '["pushup", "press up"]'::jsonb, 'BODYWEIGHT', 'PUSH',
  '{"primary": ["CHEST", "TRICEPS"], "secondary": ["SHOULDERS", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dip', '["parallel bar dip", "chest dip", "tricep dip"]'::jsonb, 'BODYWEIGHT', 'PUSH',
  '{"primary": ["CHEST", "TRICEPS"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["DIP_BARS"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Pistol Squat', '["single leg squat"]'::jsonb, 'BODYWEIGHT', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CORE", "CALVES"]}'::jsonb,
  false, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Muscle-Up', '["bar muscle up"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["LATS", "CHEST", "TRICEPS"], "secondary": ["BICEPS", "CORE", "SHOULDERS"]}'::jsonb,
  true, false, '["PULL_UP_BAR"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Ring Row', '["suspension row", "TRX row"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["BACK", "LATS"], "secondary": ["BICEPS", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Inverted Row', '["bodyweight row", "Australian pull-up"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["BACK", "LATS"], "secondary": ["BICEPS", "FOREARMS"]}'::jsonb,
  true, false, '["BARBELL", "SQUAT_RACK"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'L-Sit', '["L-sit hold", "parallel bar L-sit"]'::jsonb, 'BODYWEIGHT', 'ISOMETRIC',
  '{"primary": ["CORE"], "secondary": ["QUADS", "TRICEPS", "SHOULDERS"]}'::jsonb,
  true, false, '["DIP_BARS"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Box Step-Up', '["step up", "bodyweight step-up"]'::jsonb, 'BODYWEIGHT', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CALVES"]}'::jsonb,
  false, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Hanging Knee Raise', '["hanging leg raise", "knee raise"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["CORE"], "secondary": ["FOREARMS"]}'::jsonb,
  true, false, '["PULL_UP_BAR"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- MACHINE (5 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Leg Press', '["machine leg press", "45 degree leg press"]'::jsonb, 'MACHINE', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CALVES"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Lat Pulldown', '["cable lat pulldown", "wide grip pulldown"]'::jsonb, 'MACHINE', 'PULL',
  '{"primary": ["LATS"], "secondary": ["BICEPS", "BACK"]}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Seated Machine Row', '["machine row", "chest supported row machine"]'::jsonb, 'MACHINE', 'PULL',
  '{"primary": ["BACK", "LATS"], "secondary": ["BICEPS", "FOREARMS"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Leg Curl', '["machine leg curl", "hamstring curl", "lying leg curl"]'::jsonb, 'MACHINE', 'HINGE',
  '{"primary": ["HAMSTRINGS"], "secondary": ["CALVES"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Leg Extension', '["machine leg extension", "quad extension"]'::jsonb, 'MACHINE', 'SQUAT',
  '{"primary": ["QUADS"], "secondary": []}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- CABLE (5 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Face Pull', '["cable face pull", "rope face pull"]'::jsonb, 'CABLE', 'PULL',
  '{"primary": ["SHOULDERS", "TRAPS"], "secondary": ["BACK"]}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Tricep Pushdown', '["cable tricep pushdown", "rope pushdown", "tricep pressdown"]'::jsonb, 'CABLE', 'PUSH',
  '{"primary": ["TRICEPS"], "secondary": []}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Cable Row', '["seated cable row", "low cable row"]'::jsonb, 'CABLE', 'PULL',
  '{"primary": ["BACK", "LATS"], "secondary": ["BICEPS", "FOREARMS"]}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Cable Fly', '["cable chest fly", "cable crossover"]'::jsonb, 'CABLE', 'PUSH',
  '{"primary": ["CHEST"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Cable Woodchop', '["wood chop", "cable rotation", "cable chop"]'::jsonb, 'CABLE', 'ROTATE',
  '{"primary": ["CORE"], "secondary": ["SHOULDERS"]}'::jsonb,
  true, false, '["CABLE_MACHINE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- CARDIO (5 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Running', '["run", "jogging", "treadmill run"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["QUADS", "HAMSTRINGS", "CALVES"], "secondary": ["GLUTES", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Rowing Machine', '["erg", "rower", "indoor rowing", "concept 2"]'::jsonb, 'CARDIO', 'PULL',
  '{"primary": ["BACK", "LATS"], "secondary": ["QUADS", "CORE", "BICEPS"]}'::jsonb,
  true, false, '["ROWER"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Assault Bike', '["air bike", "echo bike", "fan bike"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["FULL_BODY"], "secondary": []}'::jsonb,
  true, false, '["BIKE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Jump Rope', '["skipping", "skip rope", "speed rope"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["CALVES"], "secondary": ["CORE", "SHOULDERS", "QUADS"]}'::jsonb,
  true, false, '["JUMP_ROPE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Swimming', '["swim", "pool laps", "freestyle swim"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["FULL_BODY"], "secondary": []}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- RUCKING (4 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Ruck March', '["rucking", "loaded carry walk", "weighted march", "ruck walk"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"], "secondary": ["CORE", "TRAPS", "ERECTORS"]}'::jsonb,
  true, false, '["RUCK_PLATE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Ruck Run', '["rucking run", "loaded run", "weighted run"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"], "secondary": ["CORE", "TRAPS", "ERECTORS"]}'::jsonb,
  true, false, '["RUCK_PLATE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Weighted Vest Walk', '["vest walk", "plate carrier walk", "weighted carry"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"], "secondary": ["CORE", "TRAPS"]}'::jsonb,
  true, false, '["WEIGHT_VEST"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Weighted Vest Run', '["vest run", "plate carrier run", "weighted running"]'::jsonb, 'CARDIO', 'GAIT',
  '{"primary": ["GLUTES", "HAMSTRINGS", "QUADS", "CALVES"], "secondary": ["CORE", "TRAPS"]}'::jsonb,
  true, false, '["WEIGHT_VEST"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- PLYOMETRIC (3 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Box Jump', '["plyo box jump"]'::jsonb, 'PLYOMETRIC', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["CALVES", "HAMSTRINGS", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Broad Jump', '["standing long jump", "horizontal jump"]'::jsonb, 'PLYOMETRIC', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CALVES", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Depth Jump', '["drop jump", "shock jump"]'::jsonb, 'PLYOMETRIC', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES", "CALVES"], "secondary": ["HAMSTRINGS", "CORE"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- LOADED_CARRY (3 exercises)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Farmer''s Walk', '["farmer carry", "farmers walk", "farmer''s carry"]'::jsonb, 'LOADED_CARRY', 'CARRY',
  '{"primary": ["FOREARMS", "TRAPS"], "secondary": ["CORE", "GLUTES", "QUADS"]}'::jsonb,
  true, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Suitcase Carry', '["single arm farmer carry", "one arm carry"]'::jsonb, 'LOADED_CARRY', 'CARRY',
  '{"primary": ["CORE", "FOREARMS"], "secondary": ["TRAPS", "GLUTES"]}'::jsonb,
  false, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Overhead Carry', '["waiter carry", "overhead walk"]'::jsonb, 'LOADED_CARRY', 'CARRY',
  '{"primary": ["SHOULDERS", "CORE"], "secondary": ["TRAPS", "TRICEPS"]}'::jsonb,
  false, false, '["DUMBBELL"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

-- ---------------------------------------------------------------------------
-- ADDITIONAL EXERCISES (4 exercises to reach 65 total)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Dumbbell Shoulder Press', '["DB overhead press", "seated dumbbell press", "dumbbell OHP"]'::jsonb, 'DUMBBELL', 'PUSH',
  '{"primary": ["SHOULDERS", "TRICEPS"], "secondary": ["CORE", "TRAPS"]}'::jsonb,
  true, false, '["DUMBBELL", "BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Chin-Up', '["chinup", "supinated pull-up", "underhand pull-up"]'::jsonb, 'BODYWEIGHT', 'PULL',
  '{"primary": ["BICEPS", "LATS"], "secondary": ["BACK", "FOREARMS", "CORE"]}'::jsonb,
  true, false, '["PULL_UP_BAR"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Bulgarian Split Squat', '["rear foot elevated split squat", "BSS"]'::jsonb, 'BODYWEIGHT', 'SQUAT',
  '{"primary": ["QUADS", "GLUTES"], "secondary": ["HAMSTRINGS", "CORE"]}'::jsonb,
  false, false, '["BENCH"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

INSERT INTO exercises (id, name, aliases, category, movement_pattern, muscle_groups, is_bilateral, supports_1rm, equipment_required, is_custom, user_id)
VALUES (gen_random_uuid(), 'Plank', '["front plank", "elbow plank", "plank hold"]'::jsonb, 'BODYWEIGHT', 'ISOMETRIC',
  '{"primary": ["CORE"], "secondary": ["SHOULDERS", "GLUTES"]}'::jsonb,
  true, false, '["NONE"]'::jsonb, false, NULL)
ON CONFLICT (name) DO UPDATE SET
  aliases = EXCLUDED.aliases,
  category = EXCLUDED.category,
  movement_pattern = EXCLUDED.movement_pattern,
  muscle_groups = EXCLUDED.muscle_groups,
  is_bilateral = EXCLUDED.is_bilateral,
  supports_1rm = EXCLUDED.supports_1rm,
  equipment_required = EXCLUDED.equipment_required,
  updated_at = now()
WHERE exercises.is_custom = false;

DO $$
DECLARE
  exercise_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO exercise_count FROM exercises WHERE is_custom = false;
  IF exercise_count < 65 THEN
    RAISE EXCEPTION 'Expected at least 65 built-in exercises, found %. Some inserts may have been skipped.', exercise_count;
  END IF;
END $$;

COMMIT;
