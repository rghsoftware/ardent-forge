import { exerciseSchema } from '@/domain/types'

const baseExercise = {
  id: 'ex-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  name: 'Barbell Back Squat',
  aliases: [],
  category: 'BARBELL',
  movementPattern: 'SQUAT',
  muscleGroups: { primary: ['QUADS'], secondary: ['GLUTES'] },
  isBilateral: true,
  supports1RM: true,
  equipmentRequired: ['BARBELL', 'SQUAT_RACK'],
  isCustom: false,
}

describe('EX-1: Exercise name must be 1-100 chars', () => {
  it('accepts a valid exercise', () => {
    expect(exerciseSchema.safeParse(baseExercise).success).toBe(true)
  })
  it('accepts name at exactly 1 char (minimum)', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, name: 'x' }).success).toBe(true)
  })
  it('accepts name at exactly 100 chars (maximum)', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, name: 'x'.repeat(100) }).success).toBe(true)
  })
  it('rejects empty name', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, name: '' }).success).toBe(false)
  })
  it('rejects name over 100 chars', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, name: 'x'.repeat(101) }).success).toBe(false)
  })
})

describe('Exercise category enum', () => {
  it('accepts all valid categories', () => {
    const validCategories = [
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
    for (const category of validCategories) {
      expect(exerciseSchema.safeParse({ ...baseExercise, category }).success).toBe(true)
    }
  })
  it('rejects invalid category', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, category: 'POWERLIFTING' }).success).toBe(
      false,
    )
  })
})

describe('Exercise movementPattern enum', () => {
  it('accepts all valid movement patterns', () => {
    const validPatterns = ['SQUAT', 'HINGE', 'PUSH', 'PULL', 'CARRY', 'ROTATE', 'GAIT', 'ISOMETRIC']
    for (const movementPattern of validPatterns) {
      expect(exerciseSchema.safeParse({ ...baseExercise, movementPattern }).success).toBe(true)
    }
  })
  it('rejects invalid movement pattern', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, movementPattern: 'JUMP' }).success).toBe(
      false,
    )
  })
})

describe('Exercise equipment enum', () => {
  it('accepts valid equipment array', () => {
    expect(
      exerciseSchema.safeParse({
        ...baseExercise,
        equipmentRequired: ['BARBELL', 'BENCH'],
      }).success,
    ).toBe(true)
  })
  it('accepts NONE as equipment', () => {
    expect(
      exerciseSchema.safeParse({
        ...baseExercise,
        category: 'BODYWEIGHT',
        equipmentRequired: ['NONE'],
      }).success,
    ).toBe(true)
  })
  it('accepts empty equipment array', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, equipmentRequired: [] }).success).toBe(true)
  })
  it('rejects invalid equipment value', () => {
    expect(
      exerciseSchema.safeParse({ ...baseExercise, equipmentRequired: ['INVALID_GEAR'] }).success,
    ).toBe(false)
  })
})

describe('Exercise muscleGroups', () => {
  it('accepts valid primary and secondary muscle groups', () => {
    expect(
      exerciseSchema.safeParse({
        ...baseExercise,
        muscleGroups: { primary: ['CHEST', 'TRICEPS'], secondary: ['SHOULDERS'] },
      }).success,
    ).toBe(true)
  })
  it('accepts empty secondary muscle groups', () => {
    expect(
      exerciseSchema.safeParse({
        ...baseExercise,
        muscleGroups: { primary: ['BACK'], secondary: [] },
      }).success,
    ).toBe(true)
  })
  it('rejects invalid muscle group', () => {
    expect(
      exerciseSchema.safeParse({
        ...baseExercise,
        muscleGroups: { primary: ['INVALID_MUSCLE'], secondary: [] },
      }).success,
    ).toBe(false)
  })
})

describe('Exercise boolean fields', () => {
  it('accepts isBilateral false', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, isBilateral: false }).success).toBe(true)
  })
  it('accepts supports1RM false', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, supports1RM: false }).success).toBe(true)
  })
  it('accepts isCustom true', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, isCustom: true }).success).toBe(true)
  })
  it('rejects non-boolean isBilateral', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, isBilateral: 'yes' }).success).toBe(false)
  })
})

describe('Exercise aliases', () => {
  it('accepts exercise with aliases', () => {
    expect(
      exerciseSchema.safeParse({ ...baseExercise, aliases: ['Squat', 'Back Squat'] }).success,
    ).toBe(true)
  })
  it('accepts exercise with empty aliases array', () => {
    expect(exerciseSchema.safeParse({ ...baseExercise, aliases: [] }).success).toBe(true)
  })
})
