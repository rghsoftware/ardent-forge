import { describe, it, expect } from 'vitest'
import {
  programSourceSchema,
  blockTypeSchema,
  programSchema,
  blockSchema,
  blockWeekSchema,
  scheduledSessionSchema,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseProgram = {
  id: 'prog-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  userId: 'user-1',
  name: '5/3/1 BBB',
  source: 'CUSTOM',
  durationWeeks: 16,
  isPublic: false,
  createdBy: 'user-1',
}

const baseBlock = {
  id: 'block-1',
  programId: 'prog-1',
  name: 'Accumulation',
  ordinal: 1,
  durationWeeks: 4,
  blockType: 'ACCUMULATION',
}

const baseBlockWeek = {
  id: 'bw-1',
  blockId: 'block-1',
  weekNumber: 1,
}

const baseScheduledSession = {
  id: 'ss-1',
  blockWeekId: 'bw-1',
  dayOfWeek: 1,
  dayLabel: 'Monday',
  sessionType: 'STRENGTH',
  sessionTemplateId: 'st-1',
}

// ---------------------------------------------------------------------------
// ProgramSource enum
// ---------------------------------------------------------------------------

describe('ProgramSource enum', () => {
  const validValues = [
    'CUSTOM',
    'IMPORTED',
    'SHARED',
    'MARKETPLACE',
    'AI_GENERATED',
    'COACH_ASSIGNED',
    'TEMPLATE',
  ] as const

  it.each(validValues)('accepts valid value "%s"', (value) => {
    expect(programSourceSchema.safeParse(value).success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(programSourceSchema.safeParse('UNKNOWN').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(programSourceSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BlockType enum
// ---------------------------------------------------------------------------

describe('BlockType enum', () => {
  const validValues = ['ACCUMULATION', 'INTENSIFICATION', 'REALIZATION', 'DELOAD', 'TEST'] as const

  it.each(validValues)('accepts valid value "%s"', (value) => {
    expect(blockTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(blockTypeSchema.safeParse('PEAK').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(blockTypeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Program schema
// ---------------------------------------------------------------------------

describe('Program schema', () => {
  it('accepts valid program', () => {
    expect(programSchema.safeParse(baseProgram).success).toBe(true)
  })

  it('rejects empty name (min 1)', () => {
    const bad = { ...baseProgram, name: '' }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects zero durationWeeks (must be positive)', () => {
    const bad = { ...baseProgram, durationWeeks: 0 }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative durationWeeks', () => {
    const bad = { ...baseProgram, durationWeeks: -4 }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts optional durationWeeks (undefined)', () => {
    const { durationWeeks: _, ...noDuration } = baseProgram as Record<string, unknown>
    expect(programSchema.safeParse(noDuration).success).toBe(true)
  })

  it('accepts optional description', () => {
    const withDesc = { ...baseProgram, description: 'Wendler 5/3/1 Boring But Big' }
    expect(programSchema.safeParse(withDesc).success).toBe(true)
  })

  it('rejects missing userId (I4: required)', () => {
    const { userId: _, ...noUserId } = baseProgram as Record<string, unknown>
    expect(programSchema.safeParse(noUserId).success).toBe(false)
  })

  it('rejects empty userId (entityId min 1)', () => {
    const bad = { ...baseProgram, userId: '' }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing createdBy (required)', () => {
    const { createdBy: _, ...noCreatedBy } = baseProgram as Record<string, unknown>
    expect(programSchema.safeParse(noCreatedBy).success).toBe(false)
  })

  it('rejects empty createdBy (entityId min 1)', () => {
    const bad = { ...baseProgram, createdBy: '' }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid source enum', () => {
    const bad = { ...baseProgram, source: 'PIRATED' }
    expect(programSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// P-1: Block ordinal must be a positive integer
// ---------------------------------------------------------------------------

describe('Block schema (P-1)', () => {
  it('accepts valid block', () => {
    expect(blockSchema.safeParse(baseBlock).success).toBe(true)
  })

  it('rejects empty name (min 1)', () => {
    const bad = { ...baseBlock, name: '' }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects ordinal of 0 (P-1: must be positive)', () => {
    const bad = { ...baseBlock, ordinal: 0 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative ordinal', () => {
    const bad = { ...baseBlock, ordinal: -1 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer ordinal', () => {
    const bad = { ...baseBlock, ordinal: 1.5 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects zero durationWeeks (must be positive)', () => {
    const bad = { ...baseBlock, durationWeeks: 0 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative durationWeeks', () => {
    const bad = { ...baseBlock, durationWeeks: -2 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer durationWeeks', () => {
    const bad = { ...baseBlock, durationWeeks: 3.5 }
    expect(blockSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BlockWeek schema
// ---------------------------------------------------------------------------

describe('BlockWeek schema', () => {
  it('accepts valid block week', () => {
    expect(blockWeekSchema.safeParse(baseBlockWeek).success).toBe(true)
  })

  it('rejects zero weekNumber (must be positive)', () => {
    const bad = { ...baseBlockWeek, weekNumber: 0 }
    expect(blockWeekSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative weekNumber', () => {
    const bad = { ...baseBlockWeek, weekNumber: -1 }
    expect(blockWeekSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ScheduledSession schema -- dayOfWeek must be 0-6
// ---------------------------------------------------------------------------

describe('ScheduledSession schema', () => {
  it('accepts valid scheduled session', () => {
    expect(scheduledSessionSchema.safeParse(baseScheduledSession).success).toBe(true)
  })

  it('accepts dayOfWeek of 0 (Sunday)', () => {
    const sunday = { ...baseScheduledSession, dayOfWeek: 0 }
    expect(scheduledSessionSchema.safeParse(sunday).success).toBe(true)
  })

  it('accepts dayOfWeek of 6 (Saturday)', () => {
    const saturday = { ...baseScheduledSession, dayOfWeek: 6 }
    expect(scheduledSessionSchema.safeParse(saturday).success).toBe(true)
  })

  it('rejects dayOfWeek of 7 (out of range)', () => {
    const bad = { ...baseScheduledSession, dayOfWeek: 7 }
    expect(scheduledSessionSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative dayOfWeek', () => {
    const bad = { ...baseScheduledSession, dayOfWeek: -1 }
    expect(scheduledSessionSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts optional dayOfWeek (undefined)', () => {
    const { dayOfWeek: _, ...noDay } = baseScheduledSession as Record<string, unknown>
    expect(scheduledSessionSchema.safeParse(noDay).success).toBe(true)
  })

  it('rejects missing sessionTemplateId', () => {
    const { sessionTemplateId: _, ...noTemplate } = baseScheduledSession as Record<string, unknown>
    expect(scheduledSessionSchema.safeParse(noTemplate).success).toBe(false)
  })

  it('rejects invalid sessionType enum', () => {
    const bad = { ...baseScheduledSession, sessionType: 'YOGA' }
    expect(scheduledSessionSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts optional notes', () => {
    const withNotes = { ...baseScheduledSession, notes: 'Deload week' }
    expect(scheduledSessionSchema.safeParse(withNotes).success).toBe(true)
  })
})
