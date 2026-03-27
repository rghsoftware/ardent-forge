import { describe, it, expect } from 'vitest'
import { preferredUnitsSchema, userProfileSchema, oneRepMaxHistorySchema } from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseUserProfile = {
  id: 'user-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  exerciseMaxes: {
    'ex-squat': {
      weight: { value: 405, unit: 'lb' },
      testedAt: '2025-01-10T00:00:00Z',
      estimated: false,
    },
  },
  maxReps: { 'ex-pullup': 15 },
  preferredUnits: 'IMPERIAL',
}

const baseOneRepMaxHistory = {
  id: 'ormh-1',
  createdAt: '2025-01-01T00:00:00Z',
  userId: 'user-1',
  exerciseId: 'ex-squat',
  weight: { value: 405, unit: 'lb' },
  estimated: false,
  recordedAt: '2025-01-15T10:30:00Z',
}

// ---------------------------------------------------------------------------
// PreferredUnits enum
// ---------------------------------------------------------------------------

describe('PreferredUnits enum', () => {
  it('accepts IMPERIAL', () => {
    expect(preferredUnitsSchema.safeParse('IMPERIAL').success).toBe(true)
  })

  it('accepts METRIC', () => {
    expect(preferredUnitsSchema.safeParse('METRIC').success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(preferredUnitsSchema.safeParse('STONE').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(preferredUnitsSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// UserProfile schema
// ---------------------------------------------------------------------------

describe('UserProfile schema', () => {
  it('accepts valid user profile', () => {
    expect(userProfileSchema.safeParse(baseUserProfile).success).toBe(true)
  })

  it('accepts profile with optional bodyweight', () => {
    const withBw = { ...baseUserProfile, bodyweight: { value: 200, unit: 'lb' } }
    expect(userProfileSchema.safeParse(withBw).success).toBe(true)
  })

  it('accepts profile with optional trainingAge', () => {
    const withAge = { ...baseUserProfile, trainingAge: { seconds: 94608000 } }
    expect(userProfileSchema.safeParse(withAge).success).toBe(true)
  })

  it('accepts empty exerciseMaxes map', () => {
    const empty = { ...baseUserProfile, exerciseMaxes: {} }
    expect(userProfileSchema.safeParse(empty).success).toBe(true)
  })

  it('accepts empty maxReps map', () => {
    const empty = { ...baseUserProfile, maxReps: {} }
    expect(userProfileSchema.safeParse(empty).success).toBe(true)
  })

  it('rejects maxReps with zero value (must be positive integer)', () => {
    const bad = { ...baseUserProfile, maxReps: { 'ex-pullup': 0 } }
    expect(userProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects maxReps with negative value', () => {
    const bad = { ...baseUserProfile, maxReps: { 'ex-pullup': -5 } }
    expect(userProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects maxReps with non-integer value', () => {
    const bad = { ...baseUserProfile, maxReps: { 'ex-pullup': 12.5 } }
    expect(userProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid preferredUnits', () => {
    const bad = { ...baseUserProfile, preferredUnits: 'STONE' }
    expect(userProfileSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects exerciseMaxes with invalid oneRepMax (zero weight)', () => {
    const bad = {
      ...baseUserProfile,
      exerciseMaxes: {
        'ex-squat': {
          weight: { value: 0, unit: 'lb' },
          testedAt: '2025-01-10T00:00:00Z',
          estimated: false,
        },
      },
    }
    expect(userProfileSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// OneRepMaxHistory schema
// ---------------------------------------------------------------------------

describe('OneRepMaxHistory schema', () => {
  it('accepts valid one rep max history entry', () => {
    expect(oneRepMaxHistorySchema.safeParse(baseOneRepMaxHistory).success).toBe(true)
  })

  it('accepts estimated entry', () => {
    const estimated = { ...baseOneRepMaxHistory, estimated: true }
    expect(oneRepMaxHistorySchema.safeParse(estimated).success).toBe(true)
  })

  it('rejects missing userId', () => {
    const { userId: _, ...noUserId } = baseOneRepMaxHistory as Record<string, unknown>
    expect(oneRepMaxHistorySchema.safeParse(noUserId).success).toBe(false)
  })

  it('rejects missing exerciseId', () => {
    const { exerciseId: _, ...noExId } = baseOneRepMaxHistory as Record<string, unknown>
    expect(oneRepMaxHistorySchema.safeParse(noExId).success).toBe(false)
  })

  it('rejects missing recordedAt', () => {
    const { recordedAt: _, ...noRecAt } = baseOneRepMaxHistory as Record<string, unknown>
    expect(oneRepMaxHistorySchema.safeParse(noRecAt).success).toBe(false)
  })

  it('rejects zero weight (inherited from weightSchema)', () => {
    const bad = {
      ...baseOneRepMaxHistory,
      weight: { value: 0, unit: 'lb' },
    }
    expect(oneRepMaxHistorySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative weight', () => {
    const bad = {
      ...baseOneRepMaxHistory,
      weight: { value: -100, unit: 'kg' },
    }
    expect(oneRepMaxHistorySchema.safeParse(bad).success).toBe(false)
  })

  it('strips updatedAt when passed (appendOnlyEntity has no updatedAt)', () => {
    const withUpdatedAt = { ...baseOneRepMaxHistory, updatedAt: '2025-01-02T00:00:00Z' }
    const result = oneRepMaxHistorySchema.safeParse(withUpdatedAt)
    expect(result.success).toBe(true)
    if (result.success) {
      expect('updatedAt' in result.data).toBe(false)
    }
  })
})
