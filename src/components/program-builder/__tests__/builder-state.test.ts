import { describe, it, expect } from 'vitest'
import type { ProgramFull } from '@/lib/data-adapter'
import type { DayOfWeek } from '../constants'
import {
  createEmptyDraft,
  addBlock,
  removeBlock,
  reorderBlocks,
  addWeekToBlock,
  removeWeekFromBlock,
  assignSession,
  removeSession,
  copyWeek,
  updateSession,
  validateDraft,
  buildSavePayload,
  hydrateDraft,
} from '../builder-state'
import type { ProgramDraft, BlockDraft, WeekDraft, SessionDraft } from '../builder-state'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let counter = 0
function nextId(): string {
  counter += 1
  return `test-id-${counter}`
}

function makeSession(overrides?: Partial<SessionDraft>): SessionDraft {
  return {
    clientId: nextId(),
    dayOfWeek: 1,
    dayLabel: 'Monday',
    sessionType: 'STRENGTH',
    sessionTemplateId: 'tpl-1',
    templateName: 'Upper Body',
    ...overrides,
  }
}

function makeWeek(overrides?: Partial<WeekDraft>): WeekDraft {
  return {
    clientId: nextId(),
    weekNumber: 1,
    sessions: [],
    ...overrides,
  }
}

function makeBlock(overrides?: Partial<BlockDraft>): BlockDraft {
  return {
    clientId: nextId(),
    name: 'Block 1',
    ordinal: 1,
    blockType: 'ACCUMULATION',
    weeks: [makeWeek()],
    ...overrides,
  }
}

function makeProgramDraft(overrides?: Partial<ProgramDraft>): ProgramDraft {
  return {
    name: 'Test Program',
    description: 'A test program',
    source: 'CUSTOM',
    blocks: [makeBlock()],
    ...overrides,
  }
}

function makeProgramFull(): ProgramFull {
  return {
    program: {
      id: 'prog-db-1',
      createdAt: '2025-06-01T00:00:00Z',
      updatedAt: '2025-06-15T00:00:00Z',
      userId: 'user-1',
      name: 'Saved Program',
      description: 'Persisted program',
      source: 'CUSTOM',
      durationWeeks: 2,
      isPublic: false,
      createdBy: 'user-1',
    },
    blocks: [
      {
        id: 'block-db-1',
        programId: 'prog-db-1',
        name: 'Accumulation',
        ordinal: 1,
        durationWeeks: 2,
        blockType: 'ACCUMULATION',
      },
    ],
    blockWeeks: [
      { id: 'bw-db-1', blockId: 'block-db-1', weekNumber: 1 },
      { id: 'bw-db-2', blockId: 'block-db-1', weekNumber: 2 },
    ],
    scheduledSessions: [
      {
        id: 'ss-db-1',
        blockWeekId: 'bw-db-1',
        dayOfWeek: 1,
        dayLabel: 'Monday',
        sessionType: 'STRENGTH',
        sessionTemplateId: 'tpl-db-1',
      },
      {
        id: 'ss-db-2',
        blockWeekId: 'bw-db-2',
        dayOfWeek: 3,
        dayLabel: 'Wednesday',
        sessionType: 'CONDITIONING',
        sessionTemplateId: 'tpl-db-2',
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// createEmptyDraft
// ---------------------------------------------------------------------------

describe('createEmptyDraft', () => {
  it('returns a draft with one block containing one week and empty sessions', () => {
    const draft = createEmptyDraft()
    expect(draft.blocks).toHaveLength(1)
    expect(draft.blocks[0].weeks).toHaveLength(1)
    expect(draft.blocks[0].weeks[0].sessions).toEqual([])
  })

  it('sets block ordinal to 1 and weekNumber to 1', () => {
    const draft = createEmptyDraft()
    expect(draft.blocks[0].ordinal).toBe(1)
    expect(draft.blocks[0].weeks[0].weekNumber).toBe(1)
  })

  it('sets blockType to ACCUMULATION', () => {
    const draft = createEmptyDraft()
    expect(draft.blocks[0].blockType).toBe('ACCUMULATION')
  })

  it('has empty name, empty description, and source CUSTOM', () => {
    const draft = createEmptyDraft()
    expect(draft.name).toBe('')
    expect(draft.description).toBe('')
    expect(draft.source).toBe('CUSTOM')
  })

  it('generates unique clientIds for block and week', () => {
    const draft = createEmptyDraft()
    expect(draft.blocks[0].clientId).toBeTruthy()
    expect(draft.blocks[0].weeks[0].clientId).toBeTruthy()
    expect(draft.blocks[0].clientId).not.toBe(draft.blocks[0].weeks[0].clientId)
  })
})

// ---------------------------------------------------------------------------
// addBlock
// ---------------------------------------------------------------------------

describe('addBlock', () => {
  it('adds a block with the next sequential ordinal', () => {
    const draft = makeProgramDraft()
    const result = addBlock(draft, 'INTENSIFICATION')
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[1].ordinal).toBe(2)
    expect(result.blocks[1].blockType).toBe('INTENSIFICATION')
  })

  it('new block has one empty week with weekNumber 1', () => {
    const draft = makeProgramDraft()
    const result = addBlock(draft, 'DELOAD')
    const newBlock = result.blocks[1]
    expect(newBlock.weeks).toHaveLength(1)
    expect(newBlock.weeks[0].weekNumber).toBe(1)
    expect(newBlock.weeks[0].sessions).toEqual([])
  })

  it('does not mutate the input draft', () => {
    const draft = makeProgramDraft()
    const originalLength = draft.blocks.length
    addBlock(draft, 'REALIZATION')
    expect(draft.blocks.length).toBe(originalLength)
  })

  it('assigns a unique clientId to the new block', () => {
    const draft = makeProgramDraft()
    const result = addBlock(draft, 'TEST')
    const existingIds = draft.blocks.map((b) => b.clientId)
    expect(existingIds).not.toContain(result.blocks[1].clientId)
  })
})

// ---------------------------------------------------------------------------
// removeBlock
// ---------------------------------------------------------------------------

describe('removeBlock', () => {
  it('removes the target block by clientId', () => {
    const block1 = makeBlock({ ordinal: 1 })
    const block2 = makeBlock({ ordinal: 2 })
    const draft = makeProgramDraft({ blocks: [block1, block2] })

    const result = removeBlock(draft, block1.clientId)
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].clientId).toBe(block2.clientId)
  })

  it('renumbers remaining block ordinals sequentially starting from 1', () => {
    const block1 = makeBlock({ ordinal: 1 })
    const block2 = makeBlock({ ordinal: 2 })
    const block3 = makeBlock({ ordinal: 3 })
    const draft = makeProgramDraft({ blocks: [block1, block2, block3] })

    const result = removeBlock(draft, block2.clientId)
    expect(result.blocks[0].ordinal).toBe(1)
    expect(result.blocks[1].ordinal).toBe(2)
  })

  it('returns unchanged draft if clientId not found', () => {
    const draft = makeProgramDraft()
    const result = removeBlock(draft, 'nonexistent-id')
    expect(result.blocks).toHaveLength(draft.blocks.length)
    expect(result.blocks[0].clientId).toBe(draft.blocks[0].clientId)
  })
})

// ---------------------------------------------------------------------------
// reorderBlocks
// ---------------------------------------------------------------------------

describe('reorderBlocks', () => {
  it('swaps block positions by index', () => {
    const block1 = makeBlock({ ordinal: 1, name: 'First' })
    const block2 = makeBlock({ ordinal: 2, name: 'Second' })
    const block3 = makeBlock({ ordinal: 3, name: 'Third' })
    const draft = makeProgramDraft({ blocks: [block1, block2, block3] })

    const result = reorderBlocks(draft, 0, 2)
    expect(result.blocks[0].name).toBe('Second')
    expect(result.blocks[1].name).toBe('Third')
    expect(result.blocks[2].name).toBe('First')
  })

  it('renumbers ordinals after reorder (ordinal === position + 1)', () => {
    const block1 = makeBlock({ ordinal: 1, name: 'A' })
    const block2 = makeBlock({ ordinal: 2, name: 'B' })
    const draft = makeProgramDraft({ blocks: [block1, block2] })

    const result = reorderBlocks(draft, 1, 0)
    expect(result.blocks[0].ordinal).toBe(1)
    expect(result.blocks[1].ordinal).toBe(2)
    expect(result.blocks[0].name).toBe('B')
  })
})

// ---------------------------------------------------------------------------
// addWeekToBlock
// ---------------------------------------------------------------------------

describe('addWeekToBlock', () => {
  it('adds a week with the next sequential weekNumber to the target block', () => {
    const block = makeBlock({ weeks: [makeWeek({ weekNumber: 1 })] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = addWeekToBlock(draft, block.clientId)
    const targetBlock = result.blocks[0]
    expect(targetBlock.weeks).toHaveLength(2)
    expect(targetBlock.weeks[1].weekNumber).toBe(2)
  })

  it('does not modify other blocks', () => {
    const block1 = makeBlock({ ordinal: 1 })
    const block2 = makeBlock({ ordinal: 2 })
    const draft = makeProgramDraft({ blocks: [block1, block2] })

    const result = addWeekToBlock(draft, block1.clientId)
    expect(result.blocks[0].weeks).toHaveLength(2)
    expect(result.blocks[1].weeks).toHaveLength(1)
  })

  it('returns draft unchanged if blockClientId not found', () => {
    const draft = makeProgramDraft()
    const result = addWeekToBlock(draft, 'nonexistent-block')
    expect(result.blocks[0].weeks).toHaveLength(draft.blocks[0].weeks.length)
  })
})

// ---------------------------------------------------------------------------
// removeWeekFromBlock
// ---------------------------------------------------------------------------

describe('removeWeekFromBlock', () => {
  it('removes the target week and renumbers remaining weeks sequentially', () => {
    const week1 = makeWeek({ weekNumber: 1 })
    const week2 = makeWeek({ weekNumber: 2 })
    const week3 = makeWeek({ weekNumber: 3 })
    const block = makeBlock({ weeks: [week1, week2, week3] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = removeWeekFromBlock(draft, block.clientId, week2.clientId)
    expect(result.blocks[0].weeks).toHaveLength(2)
    expect(result.blocks[0].weeks[0].weekNumber).toBe(1)
    expect(result.blocks[0].weeks[1].weekNumber).toBe(2)
  })

  it('does not remove the last remaining week (guard)', () => {
    const week = makeWeek()
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = removeWeekFromBlock(draft, block.clientId, week.clientId)
    expect(result.blocks[0].weeks).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// assignSession
// ---------------------------------------------------------------------------

describe('assignSession', () => {
  it('assigns a session to the correct week and day', () => {
    const week = makeWeek()
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      3 as DayOfWeek,
      'tpl-99',
      'Wednesday Workout',
      'CONDITIONING',
    )

    const sessions = result.blocks[0].weeks[0].sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].dayOfWeek).toBe(3)
    expect(sessions[0].dayLabel).toBe('Wednesday')
    expect(sessions[0].sessionTemplateId).toBe('tpl-99')
    expect(sessions[0].templateName).toBe('Wednesday Workout')
    expect(sessions[0].sessionType).toBe('CONDITIONING')
  })

  it('replaces an existing session on the same day (no duplicates)', () => {
    const existingSession = makeSession({ dayOfWeek: 1, templateName: 'Old' })
    const week = makeWeek({ sessions: [existingSession] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      1 as DayOfWeek,
      'tpl-new',
      'New Monday',
      'STRENGTH',
    )

    const sessions = result.blocks[0].weeks[0].sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].templateName).toBe('New Monday')
    expect(sessions[0].sessionTemplateId).toBe('tpl-new')
  })

  it('creates a session entry with the given templateId, templateName, sessionType', () => {
    const week = makeWeek()
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      5 as DayOfWeek,
      'tpl-friday',
      'Friday Power',
      'MIXED',
    )

    const session = result.blocks[0].weeks[0].sessions[0]
    expect(session.sessionTemplateId).toBe('tpl-friday')
    expect(session.templateName).toBe('Friday Power')
    expect(session.sessionType).toBe('MIXED')
    expect(session.dayOfWeek).toBe(5)
    expect(session.dayLabel).toBe('Friday')
  })
})

// ---------------------------------------------------------------------------
// removeSession
// ---------------------------------------------------------------------------

describe('removeSession', () => {
  it('removes the target session by clientId from the correct week', () => {
    const session1 = makeSession({ dayOfWeek: 1 })
    const session2 = makeSession({ dayOfWeek: 3 })
    const week = makeWeek({ sessions: [session1, session2] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = removeSession(draft, week.clientId, session1.clientId)
    const sessions = result.blocks[0].weeks[0].sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].clientId).toBe(session2.clientId)
  })

  it('only modifies the target week (other weeks untouched)', () => {
    const sessionA = makeSession({ dayOfWeek: 1 })
    const sessionB = makeSession({ dayOfWeek: 2 })
    const week1 = makeWeek({ weekNumber: 1, sessions: [sessionA] })
    const week2 = makeWeek({ weekNumber: 2, sessions: [sessionB] })
    const block = makeBlock({ weeks: [week1, week2] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = removeSession(draft, week1.clientId, sessionA.clientId)
    expect(result.blocks[0].weeks[0].sessions).toHaveLength(0)
    expect(result.blocks[0].weeks[1].sessions).toHaveLength(1)
    expect(result.blocks[0].weeks[1].sessions[0].clientId).toBe(sessionB.clientId)
  })
})

// ---------------------------------------------------------------------------
// copyWeek
// ---------------------------------------------------------------------------

describe('copyWeek', () => {
  it('copies all sessions from source to each target week with fresh clientIds', () => {
    const session1 = makeSession({ dayOfWeek: 1, templateName: 'Mon' })
    const session2 = makeSession({ dayOfWeek: 3, templateName: 'Wed' })
    const sourceWeek = makeWeek({ weekNumber: 1, sessions: [session1, session2] })
    const targetWeek1 = makeWeek({ weekNumber: 2, sessions: [] })
    const targetWeek2 = makeWeek({ weekNumber: 3, sessions: [] })
    const block = makeBlock({ weeks: [sourceWeek, targetWeek1, targetWeek2] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, sourceWeek.clientId, [
      targetWeek1.clientId,
      targetWeek2.clientId,
    ])

    // Target weeks should have copied sessions
    const target1Sessions = result.blocks[0].weeks[1].sessions
    const target2Sessions = result.blocks[0].weeks[2].sessions
    expect(target1Sessions).toHaveLength(2)
    expect(target2Sessions).toHaveLength(2)

    // Copied sessions should have fresh clientIds (not matching source)
    const sourceIds = [session1.clientId, session2.clientId]
    for (const s of target1Sessions) {
      expect(sourceIds).not.toContain(s.clientId)
    }
    for (const s of target2Sessions) {
      expect(sourceIds).not.toContain(s.clientId)
    }

    // But content should match
    expect(target1Sessions[0].templateName).toBe('Mon')
    expect(target1Sessions[1].templateName).toBe('Wed')
  })

  it('is a no-op when source week has zero sessions', () => {
    const emptySourceWeek = makeWeek({ weekNumber: 1, sessions: [] })
    const targetWeek = makeWeek({ weekNumber: 2, sessions: [] })
    const block = makeBlock({ weeks: [emptySourceWeek, targetWeek] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, emptySourceWeek.clientId, [targetWeek.clientId])
    // Should return the same reference (no-op)
    expect(result).toBe(draft)
    expect(result.blocks[0].weeks[1].sessions).toHaveLength(0)
  })

  it('copies to multiple target weeks simultaneously', () => {
    const session = makeSession({ dayOfWeek: 5, templateName: 'Friday' })
    const source = makeWeek({ weekNumber: 1, sessions: [session] })
    const target1 = makeWeek({ weekNumber: 2 })
    const target2 = makeWeek({ weekNumber: 3 })
    const target3 = makeWeek({ weekNumber: 4 })
    const block = makeBlock({ weeks: [source, target1, target2, target3] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, source.clientId, [
      target1.clientId,
      target2.clientId,
      target3.clientId,
    ])

    expect(result.blocks[0].weeks[1].sessions).toHaveLength(1)
    expect(result.blocks[0].weeks[2].sessions).toHaveLength(1)
    expect(result.blocks[0].weeks[3].sessions).toHaveLength(1)

    // Each target should have a unique clientId for its copied session
    const allCopiedIds = [
      result.blocks[0].weeks[1].sessions[0].clientId,
      result.blocks[0].weeks[2].sessions[0].clientId,
      result.blocks[0].weeks[3].sessions[0].clientId,
    ]
    const uniqueIds = new Set(allCopiedIds)
    expect(uniqueIds.size).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// validateDraft
// ---------------------------------------------------------------------------

describe('validateDraft', () => {
  it('returns empty array for a fully valid draft', () => {
    const draft = makeProgramDraft({ name: 'Valid Program' })
    const errors = validateDraft(draft)
    expect(errors).toEqual([])
  })

  it('returns error for empty name', () => {
    const draft = makeProgramDraft({ name: '' })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'programName', message: 'Program name is required' }),
    )
  })

  it('returns error for whitespace-only name', () => {
    const draft = makeProgramDraft({ name: '   ' })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'programName', message: 'Program name is required' }),
    )
  })

  it('returns error for empty blocks array', () => {
    const draft = makeProgramDraft({ name: 'Has Name', blocks: [] })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'blocks', message: 'At least one block is required' }),
    )
  })

  it('returns error for a block with zero weeks', () => {
    const block = makeBlock({ weeks: [] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'blockWeeks',
        blockClientId: block.clientId,
        message: 'Must have at least one week',
      }),
    )
  })

  it('returns error for name over 200 characters', () => {
    const draft = makeProgramDraft({ name: 'X'.repeat(201) })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'programName',
        message: 'Program name must be 200 characters or less',
      }),
    )
  })

  it('accepts name of exactly 200 characters', () => {
    const draft = makeProgramDraft({ name: 'X'.repeat(200) })
    const errors = validateDraft(draft)
    expect(errors.find((e) => e.field === 'programName')).toBeUndefined()
  })

  it('returns error for block name over 200 characters', () => {
    const block = makeBlock({ name: 'B'.repeat(201) })
    const draft = makeProgramDraft({ name: 'Valid', blocks: [block] })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'blockName',
        blockClientId: block.clientId,
        message: 'Block name must be 200 characters or less',
      }),
    )
  })

  it('returns error for empty block name', () => {
    const block = makeBlock({ name: '' })
    const draft = makeProgramDraft({ name: 'Valid', blocks: [block] })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'blockName',
        blockClientId: block.clientId,
        message: 'Block name is required',
      }),
    )
  })

  it('returns error for whitespace-only block name', () => {
    const block = makeBlock({ name: '   ' })
    const draft = makeProgramDraft({ name: 'Valid', blocks: [block] })
    const errors = validateDraft(draft)
    expect(errors).toContainEqual(
      expect.objectContaining({
        field: 'blockName',
        blockClientId: block.clientId,
        message: 'Block name is required',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// buildSavePayload -- create mode
// ---------------------------------------------------------------------------

describe('buildSavePayload -- create mode', () => {
  it('returns mode: create when draft has no id', () => {
    const draft = makeProgramDraft({ name: 'New Program' })
    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
  })

  it('program payload does NOT include id', () => {
    const draft = makeProgramDraft({ name: 'New Program' })
    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      expect('id' in payload.program).toBe(false)
    }
  })

  it('block payloads have durationWeeks computed from weeks.length', () => {
    const week1 = makeWeek({ weekNumber: 1 })
    const week2 = makeWeek({ weekNumber: 2 })
    const block = makeBlock({ weeks: [week1, week2] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      expect(payload.blocks[0].block.durationWeeks).toBe(2)
    }
  })

  it('program durationWeeks is the sum of all block week counts', () => {
    const block1 = makeBlock({
      ordinal: 1,
      weeks: [makeWeek({ weekNumber: 1 }), makeWeek({ weekNumber: 2 })],
    })
    const block2 = makeBlock({
      ordinal: 2,
      weeks: [
        makeWeek({ weekNumber: 1 }),
        makeWeek({ weekNumber: 2 }),
        makeWeek({ weekNumber: 3 }),
      ],
    })
    const draft = makeProgramDraft({ name: 'Multi-Block', blocks: [block1, block2] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.program.durationWeeks).toBe(5)
  })

  it('trims program name and description', () => {
    const draft = makeProgramDraft({ name: '  Spaced Name  ', description: '  Desc  ' })
    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.program.name).toBe('Spaced Name')
    if (payload.mode === 'create') {
      expect(payload.program.description).toBe('Desc')
    }
  })

  it('sets description to undefined when empty after trim', () => {
    const draft = makeProgramDraft({ name: 'Test', description: '   ' })
    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.program.description).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildSavePayload -- update mode
// ---------------------------------------------------------------------------

describe('buildSavePayload -- update mode', () => {
  function makeEditDraft(): ProgramDraft {
    return {
      id: 'prog-existing-1',
      name: 'Updated Program',
      description: 'Updated desc',
      source: 'CUSTOM',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-15T00:00:00Z',
      blocks: [
        {
          clientId: 'block-existing-1',
          name: 'Phase 1',
          ordinal: 1,
          blockType: 'ACCUMULATION',
          weeks: [
            {
              clientId: 'week-existing-1',
              weekNumber: 1,
              sessions: [
                {
                  clientId: 'session-existing-1',
                  dayOfWeek: 1,
                  dayLabel: 'Monday',
                  sessionType: 'STRENGTH',
                  sessionTemplateId: 'tpl-1',
                  templateName: 'Heavy Squat',
                },
              ],
            },
          ],
        },
      ],
    }
  }

  it('returns mode: update when draft has an id', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('update')
  })

  it('program payload includes the original id', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    if (payload.mode === 'update') {
      expect(payload.program.id).toBe('prog-existing-1')
    }
  })

  it('block payloads include the original clientId as id (DB ID preservation)', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    if (payload.mode === 'update') {
      expect(payload.blocks[0].block.id).toBe('block-existing-1')
    }
  })

  it('week payloads include the original clientId as id', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    if (payload.mode === 'update') {
      expect(payload.blocks[0].weeks[0].week.id).toBe('week-existing-1')
    }
  })

  it('createdAt in program payload equals draft.createdAt', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    if (payload.mode === 'update') {
      expect(payload.program.createdAt).toBe('2025-01-01T00:00:00Z')
    }
  })

  it('updatedAt in program payload is a fresh ISO timestamp (not draft.createdAt)', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    if (payload.mode === 'update') {
      expect(payload.program.updatedAt).not.toBe('2025-01-01T00:00:00Z')
      // Verify it is a valid ISO timestamp
      const parsed = Date.parse(payload.program.updatedAt)
      expect(isNaN(parsed)).toBe(false)
    }
  })

  it('computes durationWeeks correctly in update mode', () => {
    const draft = makeEditDraft()
    const payload = buildSavePayload(draft, 'user-1')
    // 1 block with 1 week = 1
    expect(payload.program.durationWeeks).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// hydrateDraft
// ---------------------------------------------------------------------------

describe('hydrateDraft', () => {
  it('preserves original DB IDs as clientIds', () => {
    const full = makeProgramFull()
    const draft = hydrateDraft(full)

    expect(draft.blocks[0].clientId).toBe('block-db-1')
    expect(draft.blocks[0].weeks[0].clientId).toBe('bw-db-1')
    expect(draft.blocks[0].weeks[1].clientId).toBe('bw-db-2')
  })

  it('preserves createdAt and updatedAt on the returned draft', () => {
    const full = makeProgramFull()
    const draft = hydrateDraft(full)

    expect(draft.createdAt).toBe('2025-06-01T00:00:00Z')
    expect(draft.updatedAt).toBe('2025-06-15T00:00:00Z')
  })

  it('preserves program id', () => {
    const full = makeProgramFull()
    const draft = hydrateDraft(full)
    expect(draft.id).toBe('prog-db-1')
  })

  it('sorts blocks by ordinal', () => {
    const full = makeProgramFull()
    // Add a second block with ordinal 2 but place it first in the array
    full.blocks = [
      {
        id: 'block-db-2',
        programId: 'prog-db-1',
        name: 'Intensification',
        ordinal: 2,
        durationWeeks: 1,
        blockType: 'INTENSIFICATION',
      },
      full.blocks[0], // ordinal 1
    ]
    full.blockWeeks.push({ id: 'bw-db-3', blockId: 'block-db-2', weekNumber: 1 })

    const draft = hydrateDraft(full)
    expect(draft.blocks[0].ordinal).toBe(1)
    expect(draft.blocks[0].clientId).toBe('block-db-1')
    expect(draft.blocks[1].ordinal).toBe(2)
    expect(draft.blocks[1].clientId).toBe('block-db-2')
  })

  it('sorts weeks by weekNumber', () => {
    const full = makeProgramFull()
    // Reverse the blockWeeks order (week 2 before week 1)
    full.blockWeeks = [full.blockWeeks[1], full.blockWeeks[0]]

    const draft = hydrateDraft(full)
    expect(draft.blocks[0].weeks[0].weekNumber).toBe(1)
    expect(draft.blocks[0].weeks[1].weekNumber).toBe(2)
  })

  it('round-trip: all session data preserved (dayOfWeek, templateId, sessionType)', () => {
    const full = makeProgramFull()
    const draft = hydrateDraft(full)

    // Week 1 session
    const s1 = draft.blocks[0].weeks[0].sessions[0]
    expect(s1.dayOfWeek).toBe(1)
    expect(s1.dayLabel).toBe('Monday')
    expect(s1.sessionType).toBe('STRENGTH')
    expect(s1.sessionTemplateId).toBe('tpl-db-1')
    expect(s1.clientId).toBe('ss-db-1')

    // Week 2 session
    const s2 = draft.blocks[0].weeks[1].sessions[0]
    expect(s2.dayOfWeek).toBe(3)
    expect(s2.dayLabel).toBe('Wednesday')
    expect(s2.sessionType).toBe('CONDITIONING')
    expect(s2.sessionTemplateId).toBe('tpl-db-2')
    expect(s2.clientId).toBe('ss-db-2')
  })

  it('hydrates name, description, and source from the program', () => {
    const full = makeProgramFull()
    const draft = hydrateDraft(full)

    expect(draft.name).toBe('Saved Program')
    expect(draft.description).toBe('Persisted program')
    expect(draft.source).toBe('CUSTOM')
  })

  it('sets description to empty string when program description is undefined', () => {
    const full = makeProgramFull()
    full.program = { ...full.program, description: undefined }
    const draft = hydrateDraft(full)
    expect(draft.description).toBe('')
  })

  it('maps notes from ScheduledSession to SessionDraft', () => {
    const full = makeProgramFull()
    full.scheduledSessions[0] = { ...full.scheduledSessions[0], notes: 'deload set 3' }
    const draft = hydrateDraft(full)
    expect(draft.blocks[0].weeks[0].sessions[0].notes).toBe('deload set 3')
  })

  it('maps overrides from ScheduledSession to SessionDraft', () => {
    const full = makeProgramFull()
    const overrides = { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } }
    full.scheduledSessions[0] = { ...full.scheduledSessions[0], overrides }
    const draft = hydrateDraft(full)
    expect(draft.blocks[0].weeks[0].sessions[0].overrides).toEqual(overrides)
  })

  it('omits notes and overrides when not present on the ScheduledSession', () => {
    const full = makeProgramFull()
    // Default fixture has no notes or overrides
    const draft = hydrateDraft(full)
    const session = draft.blocks[0].weeks[0].sessions[0]
    expect(session.notes).toBeUndefined()
    expect(session.overrides).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// assignSession -- notes + overrides behavior
// ---------------------------------------------------------------------------

describe('assignSession -- notes and overrides', () => {
  it('clears overrides when assigning a different template', () => {
    const existingSession = makeSession({
      dayOfWeek: 1,
      sessionTemplateId: 'tpl-old',
      notes: 'keep this?',
      overrides: { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } },
    })
    const week = makeWeek({ sessions: [existingSession] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      1 as DayOfWeek,
      'tpl-new',
      'New Template',
      'STRENGTH',
    )

    const session = result.blocks[0].weeks[0].sessions[0]
    expect(session.overrides).toBeUndefined()
    expect(session.notes).toBeUndefined()
  })

  it('preserves notes when re-assigning the same template', () => {
    const existingSession = makeSession({
      dayOfWeek: 1,
      sessionTemplateId: 'tpl-1',
      notes: 'deload set 3',
      overrides: { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } },
    })
    const week = makeWeek({ sessions: [existingSession] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      1 as DayOfWeek,
      'tpl-1',
      'Upper Body',
      'STRENGTH',
    )

    const session = result.blocks[0].weeks[0].sessions[0]
    expect(session.notes).toBe('deload set 3')
    // Overrides are always cleared on assign (fresh start for the template)
    expect(session.overrides).toBeUndefined()
  })

  it('does not carry notes when assigning to a day with no prior session', () => {
    const week = makeWeek({ sessions: [] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = assignSession(
      draft,
      week.clientId,
      2 as DayOfWeek,
      'tpl-1',
      'Upper Body',
      'STRENGTH',
    )

    const session = result.blocks[0].weeks[0].sessions[0]
    expect(session.notes).toBeUndefined()
    expect(session.overrides).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildSavePayload -- notes + overrides in session payload
// ---------------------------------------------------------------------------

describe('buildSavePayload -- notes and overrides', () => {
  it('includes notes in session payload when present', () => {
    const session = makeSession({ dayOfWeek: 1, notes: 'deload set 3' })
    const week = makeWeek({ weekNumber: 1, sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      const sessionPayload = payload.blocks[0].weeks[0].sessions[0]
      expect(sessionPayload.notes).toBe('deload set 3')
    }
  })

  it('includes serialized overrides in session payload when present', () => {
    const overrides = { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } }
    const session = makeSession({ dayOfWeek: 1, overrides })
    const week = makeWeek({ weekNumber: 1, sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      const sessionPayload = payload.blocks[0].weeks[0].sessions[0]
      expect(sessionPayload.overrides).toEqual(overrides)
    }
  })

  it('omits notes from session payload when not present', () => {
    const session = makeSession({ dayOfWeek: 1 })
    const week = makeWeek({ weekNumber: 1, sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      const sessionPayload = payload.blocks[0].weeks[0].sessions[0]
      expect('notes' in sessionPayload).toBe(false)
    }
  })

  it('omits overrides from session payload when not present', () => {
    const session = makeSession({ dayOfWeek: 1 })
    const week = makeWeek({ weekNumber: 1, sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ name: 'Test', blocks: [block] })

    const payload = buildSavePayload(draft, 'user-1')
    expect(payload.mode).toBe('create')
    if (payload.mode === 'create') {
      const sessionPayload = payload.blocks[0].weeks[0].sessions[0]
      expect('overrides' in sessionPayload).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// copyWeek -- notes + overrides propagation
// ---------------------------------------------------------------------------

describe('copyWeek -- notes and overrides propagation', () => {
  it('propagates notes with copied sessions', () => {
    const session = makeSession({ dayOfWeek: 1, notes: 'deload set 3' })
    const sourceWeek = makeWeek({ weekNumber: 1, sessions: [session] })
    const targetWeek = makeWeek({ weekNumber: 2, sessions: [] })
    const block = makeBlock({ weeks: [sourceWeek, targetWeek] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, sourceWeek.clientId, [targetWeek.clientId])
    const copiedSession = result.blocks[0].weeks[1].sessions[0]
    expect(copiedSession.notes).toBe('deload set 3')
  })

  it('propagates overrides with copied sessions', () => {
    const overrides = { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } }
    const session = makeSession({ dayOfWeek: 1, overrides })
    const sourceWeek = makeWeek({ weekNumber: 1, sessions: [session] })
    const targetWeek = makeWeek({ weekNumber: 2, sessions: [] })
    const block = makeBlock({ weeks: [sourceWeek, targetWeek] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, sourceWeek.clientId, [targetWeek.clientId])
    const copiedSession = result.blocks[0].weeks[1].sessions[0]
    expect(copiedSession.overrides).toEqual(overrides)
  })

  it('copied sessions get fresh clientIds but retain notes and overrides', () => {
    const overrides = { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } }
    const session = makeSession({ dayOfWeek: 3, notes: 'heavy day', overrides })
    const sourceWeek = makeWeek({ weekNumber: 1, sessions: [session] })
    const targetWeek = makeWeek({ weekNumber: 2, sessions: [] })
    const block = makeBlock({ weeks: [sourceWeek, targetWeek] })
    const draft = makeProgramDraft({ blocks: [block] })

    const result = copyWeek(draft, sourceWeek.clientId, [targetWeek.clientId])
    const copiedSession = result.blocks[0].weeks[1].sessions[0]

    expect(copiedSession.clientId).not.toBe(session.clientId)
    expect(copiedSession.notes).toBe('heavy day')
    expect(copiedSession.overrides).toEqual(overrides)
  })
})

// ---------------------------------------------------------------------------
// updateSession
// ---------------------------------------------------------------------------

describe('updateSession', () => {
  it('replaces a session in the target week by clientId', () => {
    const session = makeSession({ dayOfWeek: 1, templateName: 'Old Name' })
    const week = makeWeek({ sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const updated: SessionDraft = { ...session, templateName: 'New Name', notes: 'added note' }
    const result = updateSession(draft, week.clientId, updated)

    const resultSession = result.blocks[0].weeks[0].sessions[0]
    expect(resultSession.templateName).toBe('New Name')
    expect(resultSession.notes).toBe('added note')
    expect(resultSession.clientId).toBe(session.clientId)
  })

  it('does not modify sessions in other weeks', () => {
    const sessionA = makeSession({ dayOfWeek: 1 })
    const sessionB = makeSession({ dayOfWeek: 2 })
    const week1 = makeWeek({ weekNumber: 1, sessions: [sessionA] })
    const week2 = makeWeek({ weekNumber: 2, sessions: [sessionB] })
    const block = makeBlock({ weeks: [week1, week2] })
    const draft = makeProgramDraft({ blocks: [block] })

    const updated: SessionDraft = { ...sessionA, notes: 'updated' }
    const result = updateSession(draft, week1.clientId, updated)

    expect(result.blocks[0].weeks[0].sessions[0].notes).toBe('updated')
    expect(result.blocks[0].weeks[1].sessions[0]).toEqual(sessionB)
  })

  it('does not mutate the input draft', () => {
    const session = makeSession({ dayOfWeek: 1 })
    const week = makeWeek({ sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const updated: SessionDraft = { ...session, notes: 'changed' }
    updateSession(draft, week.clientId, updated)

    expect(draft.blocks[0].weeks[0].sessions[0].notes).toBeUndefined()
  })

  it('leaves sessions unchanged when clientId does not match any session', () => {
    const session = makeSession({ dayOfWeek: 1 })
    const week = makeWeek({ sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const ghost: SessionDraft = { ...session, clientId: 'nonexistent-id', notes: 'nope' }
    const result = updateSession(draft, week.clientId, ghost)

    expect(result.blocks[0].weeks[0].sessions[0]).toEqual(session)
  })

  it('can add overrides to a session that had none', () => {
    const session = makeSession({ dayOfWeek: 1 })
    const week = makeWeek({ sessions: [session] })
    const block = makeBlock({ weeks: [week] })
    const draft = makeProgramDraft({ blocks: [block] })

    const overrides = { activityOverrides: { 'act-1': { exerciseId: 'new-ex-1' } } }
    const updated: SessionDraft = { ...session, overrides }
    const result = updateSession(draft, week.clientId, updated)

    expect(result.blocks[0].weeks[0].sessions[0].overrides).toEqual(overrides)
  })
})
