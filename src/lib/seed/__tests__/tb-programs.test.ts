import { describe, it, expect } from 'vitest'
import { createTBOperator3Week, createTBFighter } from '../tb-programs'
import { programSchema, blockSchema, blockWeekSchema, scheduledSessionSchema } from '@/domain/types'

// ===========================================================================
// Shared helpers
// ===========================================================================

const fakeUserId = 'user-seed-001'
const fakeTimestamp = '2025-01-01T00:00:00Z'
const fakeTemplateIds = { strength: 'st-str-001', conditioning: 'st-cond-001' }

// ===========================================================================
// createTBOperator3Week
// ===========================================================================

describe('createTBOperator3Week', () => {
  const seed = createTBOperator3Week(fakeUserId, fakeTemplateIds)

  it('program fields pass programSchema', () => {
    const program = {
      id: 'prog-test-001',
      createdAt: fakeTimestamp,
      updatedAt: fakeTimestamp,
      ...seed.program,
    }
    expect(programSchema.safeParse(program).success).toBe(true)
  })

  it('has exactly 1 block', () => {
    expect(seed.blocks).toHaveLength(1)
  })

  it('has exactly 3 weeks across the block', () => {
    const totalWeeks = seed.blocks.reduce((sum, b) => sum + b.weeks.length, 0)
    expect(totalWeeks).toBe(3)
  })

  it('has exactly 3 sessions per week (9 total)', () => {
    const totalSessions = seed.blocks.reduce(
      (sum, b) => sum + b.weeks.reduce((wSum, w) => wSum + w.sessions.length, 0),
      0,
    )
    expect(totalSessions).toBe(9)
  })

  it('each block passes blockSchema', () => {
    for (const b of seed.blocks) {
      const block = {
        id: 'blk-test-001',
        programId: 'prog-test-001',
        ...b.block,
      }
      expect(blockSchema.safeParse(block).success).toBe(true)
    }
  })

  it('each week passes blockWeekSchema', () => {
    for (const b of seed.blocks) {
      for (const w of b.weeks) {
        const week = {
          id: 'bw-test-001',
          blockId: 'blk-test-001',
          ...w.week,
        }
        expect(blockWeekSchema.safeParse(week).success).toBe(true)
      }
    }
  })

  it('each session passes scheduledSessionSchema', () => {
    for (const b of seed.blocks) {
      for (const w of b.weeks) {
        for (const s of w.sessions) {
          const session = {
            id: 'ss-test-001',
            blockWeekId: 'bw-test-001',
            ...s,
          }
          expect(scheduledSessionSchema.safeParse(session).success).toBe(true)
        }
      }
    }
  })
})

// ===========================================================================
// createTBFighter
// ===========================================================================

describe('createTBFighter', () => {
  const seed = createTBFighter(fakeUserId, { strength: fakeTemplateIds.strength })

  it('has exactly 1 block', () => {
    expect(seed.blocks).toHaveLength(1)
  })

  it('has exactly 3 weeks', () => {
    const totalWeeks = seed.blocks.reduce((sum, b) => sum + b.weeks.length, 0)
    expect(totalWeeks).toBe(3)
  })

  it('has exactly 2 sessions per week (6 total)', () => {
    const totalSessions = seed.blocks.reduce(
      (sum, b) => sum + b.weeks.reduce((wSum, w) => wSum + w.sessions.length, 0),
      0,
    )
    expect(totalSessions).toBe(6)
  })

  it('program fields pass programSchema', () => {
    const program = {
      id: 'prog-test-002',
      createdAt: fakeTimestamp,
      updatedAt: fakeTimestamp,
      ...seed.program,
    }
    expect(programSchema.safeParse(program).success).toBe(true)
  })
})
