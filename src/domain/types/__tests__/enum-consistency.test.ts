import {
  exerciseCategorySchema,
  movementPatternSchema,
  muscleGroupSchema,
  equipmentSchema,
  groupTypeSchema,
  setTypeSchema,
  preferredUnitsSchema,
} from '@/domain/types'

// These constants represent the exact values in the SQL CHECK constraints.
// Source: supabase/migrations/20260326000001_create_phase0_tables.sql
// If either side drifts, the test will fail.
const SQL_EXERCISE_CATEGORIES = [
  'BARBELL',
  'DUMBBELL',
  'KETTLEBELL',
  'BODYWEIGHT',
  'MACHINE',
  'CABLE',
  'CARDIO',
  'PLYOMETRIC',
  'LOADED_CARRY',
]
const SQL_MOVEMENT_PATTERNS = [
  'SQUAT',
  'HINGE',
  'PUSH',
  'PULL',
  'CARRY',
  'ROTATE',
  'GAIT',
  'ISOMETRIC',
]
const SQL_GROUP_TYPES = [
  'STRAIGHT_SETS',
  'SUPERSET',
  'CIRCUIT',
  'COMPLEX',
  'EMOM',
  'AMRAP',
  'COUPLET',
]
const SQL_SET_TYPES = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']
const SQL_PREFERRED_UNITS = ['IMPERIAL', 'METRIC']

// Unique MuscleGroup values used in supabase/seed.sql
const SEED_MUSCLE_GROUPS = [
  'CHEST',
  'BACK',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
  'FOREARMS',
  'TRAPS',
  'LATS',
  'FULL_BODY',
]

// Unique Equipment values used in supabase/seed.sql
// Derived by scanning all equipment_required JSON arrays in the seed data
const SEED_EQUIPMENT = [
  'BARBELL',
  'BENCH',
  'BIKE',
  'CABLE_MACHINE',
  'DIP_BARS',
  'DUMBBELL',
  'JUMP_ROPE',
  'KETTLEBELL',
  'NONE',
  'PULL_UP_BAR',
  'ROWER',
  'SQUAT_RACK',
]

describe('SQL CHECK constraint / Zod enum parity', () => {
  it('exerciseCategorySchema options match SQL CHECK values', () => {
    expect([...exerciseCategorySchema.options].sort()).toEqual([...SQL_EXERCISE_CATEGORIES].sort())
  })

  it('movementPatternSchema options match SQL CHECK values', () => {
    expect([...movementPatternSchema.options].sort()).toEqual([...SQL_MOVEMENT_PATTERNS].sort())
  })

  it('groupTypeSchema options match SQL CHECK values', () => {
    expect([...groupTypeSchema.options].sort()).toEqual([...SQL_GROUP_TYPES].sort())
  })

  it('setTypeSchema options match SQL CHECK values', () => {
    expect([...setTypeSchema.options].sort()).toEqual([...SQL_SET_TYPES].sort())
  })

  it('preferredUnitsSchema options match SQL CHECK values', () => {
    expect([...preferredUnitsSchema.options].sort()).toEqual([...SQL_PREFERRED_UNITS].sort())
  })
})

describe('Seed data enum validation', () => {
  it('all seed muscle groups are valid MuscleGroup values', () => {
    for (const mg of SEED_MUSCLE_GROUPS) {
      expect(muscleGroupSchema.safeParse(mg).success).toBe(true)
    }
  })

  it('all seed equipment values are valid Equipment values', () => {
    for (const eq of SEED_EQUIPMENT) {
      expect(equipmentSchema.safeParse(eq).success).toBe(true)
    }
  })
})
