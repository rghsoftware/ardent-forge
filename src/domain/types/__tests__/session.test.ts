import { describe, it, expect } from 'vitest'
import {
  groupTypeSchema,
  scoringTypeSchema,
  sessionTypeSchema,
  sessionTemplateSchema,
  activitySchema,
  activityGroupSchema,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseSessionTemplate = {
  id: 'st-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userId: 'user-1',
  name: 'Upper Body Strength',
  category: 'STRENGTH',
  scoring: 'NONE',
}

const baseActivity = {
  id: 'act-1',
  exerciseId: 'ex-bench',
  setScheme: {
    type: 'fixedSets',
    sets: 3,
    reps: 5,
    load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
  },
  ordinal: 1,
}

const baseActivityGroup = {
  id: 'ag-1',
  sessionTemplateId: 'st-1',
  groupType: 'STRAIGHT_SETS',
  ordinal: 1,
  activities: [baseActivity],
}

// ---------------------------------------------------------------------------
// GroupType enum
// ---------------------------------------------------------------------------

describe('GroupType enum', () => {
  const validValues = [
    'STRAIGHT_SETS',
    'SUPERSET',
    'CIRCUIT',
    'COMPLEX',
    'EMOM',
    'AMRAP',
    'COUPLET',
  ] as const

  it.each(validValues)('accepts valid value "%s"', (value) => {
    expect(groupTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(groupTypeSchema.safeParse('DROPSET').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(groupTypeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ScoringType enum
// ---------------------------------------------------------------------------

describe('ScoringType enum', () => {
  const validValues = [
    'NONE',
    'FOR_TIME',
    'TIME',
    'FOR_REPS',
    'ROUNDS_PLUS_REPS',
    'FOR_DISTANCE',
    'LOAD',
  ] as const

  it.each(validValues)('accepts valid value "%s"', (value) => {
    expect(scoringTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(scoringTypeSchema.safeParse('POINTS').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(scoringTypeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SessionType enum
// ---------------------------------------------------------------------------

describe('SessionType enum', () => {
  const validValues = ['STRENGTH', 'CONDITIONING', 'SE', 'MIXED'] as const

  it.each(validValues)('accepts valid value "%s"', (value) => {
    expect(sessionTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(sessionTypeSchema.safeParse('CARDIO').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(sessionTypeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SessionTemplate schema
// ---------------------------------------------------------------------------

describe('SessionTemplate schema', () => {
  it('accepts valid session template', () => {
    expect(sessionTemplateSchema.safeParse(baseSessionTemplate).success).toBe(true)
  })

  it('accepts session template with optional timeCap', () => {
    const withTimeCap = { ...baseSessionTemplate, timeCap: { seconds: 1200 } }
    expect(sessionTemplateSchema.safeParse(withTimeCap).success).toBe(true)
  })

  it('rejects name with empty string (min 1)', () => {
    const bad = { ...baseSessionTemplate, name: '' }
    expect(sessionTemplateSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid category enum', () => {
    const bad = { ...baseSessionTemplate, category: 'YOGA' }
    expect(sessionTemplateSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid scoring enum', () => {
    const bad = { ...baseSessionTemplate, scoring: 'POINTS' }
    expect(sessionTemplateSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// P-5: Activity ordinal must be a positive integer
// ---------------------------------------------------------------------------

describe('P-5: Activity schema', () => {
  it('accepts valid activity', () => {
    expect(activitySchema.safeParse(baseActivity).success).toBe(true)
  })

  it('accepts activity with optional notes', () => {
    const withNotes = { ...baseActivity, notes: 'Pause at bottom' }
    expect(activitySchema.safeParse(withNotes).success).toBe(true)
  })

  it('rejects ordinal of 0 (must be positive)', () => {
    const bad = { ...baseActivity, ordinal: 0 }
    expect(activitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative ordinal', () => {
    const bad = { ...baseActivity, ordinal: -1 }
    expect(activitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer ordinal', () => {
    const bad = { ...baseActivity, ordinal: 1.5 }
    expect(activitySchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// P-4 / P-6: ActivityGroup constraints
// ---------------------------------------------------------------------------

describe('ActivityGroup schema', () => {
  it('accepts valid activity group', () => {
    expect(activityGroupSchema.safeParse(baseActivityGroup).success).toBe(true)
  })

  it('accepts activity group with rounds >= 1 (P-6)', () => {
    const withRounds = { ...baseActivityGroup, rounds: 3 }
    expect(activityGroupSchema.safeParse(withRounds).success).toBe(true)
  })

  it('accepts activity group without rounds (null/undefined is valid per P-6)', () => {
    const { rounds: _, ...noRounds } = baseActivityGroup as Record<string, unknown>
    expect(activityGroupSchema.safeParse(noRounds).success).toBe(true)
  })

  it('rejects empty activities array (P-4: min 1)', () => {
    const bad = { ...baseActivityGroup, activities: [] }
    expect(activityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects rounds of 0 (P-6: must be >= 1)', () => {
    const bad = { ...baseActivityGroup, rounds: 0 }
    expect(activityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative rounds', () => {
    const bad = { ...baseActivityGroup, rounds: -1 }
    expect(activityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts optional restBetweenRounds', () => {
    const withRest = { ...baseActivityGroup, restBetweenRounds: { seconds: 120 } }
    expect(activityGroupSchema.safeParse(withRest).success).toBe(true)
  })

  it('accepts optional restBetweenActivities', () => {
    const withRest = { ...baseActivityGroup, restBetweenActivities: { seconds: 60 } }
    expect(activityGroupSchema.safeParse(withRest).success).toBe(true)
  })
})
