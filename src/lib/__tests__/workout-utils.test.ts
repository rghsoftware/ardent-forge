import { getExerciseModality, parseNumericInput } from '@/lib/workout-utils'
import type { Exercise } from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

const NOW = '2026-03-27T10:00:00Z'

function makeExercise(overrides?: Partial<Exercise>): Exercise {
  return {
    id: 'ex-1',
    createdAt: NOW,
    updatedAt: NOW,
    name: 'Bench Press',
    aliases: [],
    category: 'BARBELL',
    movementPattern: 'PUSH',
    muscleGroups: { primary: ['CHEST'], secondary: ['TRICEPS'] },
    isBilateral: true,
    supports1RM: true,
    equipmentRequired: ['BARBELL', 'BENCH'],
    isCustom: false,
    ...overrides,
  } as Exercise
}

// ===========================================================================
// getExerciseModality
// ===========================================================================

describe('getExerciseModality', () => {
  it('returns "circuit" when groupType is "CIRCUIT"', () => {
    expect(getExerciseModality(makeExercise(), 'CIRCUIT')).toBe('circuit')
  })

  it('returns "standard" when exercise is undefined', () => {
    expect(getExerciseModality(undefined, 'STRAIGHT_SETS')).toBe('standard')
  })

  it('returns "ruck" when exercise name contains "ruck"', () => {
    const ruckExercise = makeExercise({
      name: 'Ruck March',
      category: 'CARDIO',
      equipmentRequired: [],
    })
    expect(getExerciseModality(ruckExercise, 'STRAIGHT_SETS')).toBe('ruck')
  })

  it('returns "ruck" when equipment includes RUCK_PLATE', () => {
    const ruckExercise = makeExercise({
      name: 'Loaded Walk',
      category: 'CARDIO',
      equipmentRequired: ['RUCK_PLATE'],
    })
    expect(getExerciseModality(ruckExercise, 'STRAIGHT_SETS')).toBe('ruck')
  })

  it('returns "ruck" when equipment includes WEIGHT_VEST', () => {
    const vestExercise = makeExercise({
      name: 'Weighted Walk',
      category: 'CARDIO',
      equipmentRequired: ['WEIGHT_VEST'],
    })
    expect(getExerciseModality(vestExercise, 'STRAIGHT_SETS')).toBe('ruck')
  })

  it('returns "cardio" for a cardio exercise without ruck indicators', () => {
    const cardioExercise = makeExercise({
      name: 'Treadmill Run',
      category: 'CARDIO',
      equipmentRequired: ['TREADMILL'],
    })
    expect(getExerciseModality(cardioExercise, 'STRAIGHT_SETS')).toBe('cardio')
  })

  it('returns "standard" for a non-cardio exercise', () => {
    const standardExercise = makeExercise({
      name: 'Back Squat',
      category: 'BARBELL',
    })
    expect(getExerciseModality(standardExercise, 'STRAIGHT_SETS')).toBe('standard')
  })
})

// ===========================================================================
// parseNumericInput
// ===========================================================================

describe('parseNumericInput', () => {
  it('returns undefined for empty string', () => {
    expect(parseNumericInput('')).toBeUndefined()
  })

  it('returns undefined for "0"', () => {
    expect(parseNumericInput('0')).toBeUndefined()
  })

  it('returns undefined for "abc"', () => {
    expect(parseNumericInput('abc')).toBeUndefined()
  })

  it('returns 135.5 for "135.5"', () => {
    expect(parseNumericInput('135.5')).toBe(135.5)
  })

  it('returns 8 for "8"', () => {
    expect(parseNumericInput('8')).toBe(8)
  })

  it('returns undefined for negative numbers', () => {
    expect(parseNumericInput('-5')).toBeUndefined()
  })
})
