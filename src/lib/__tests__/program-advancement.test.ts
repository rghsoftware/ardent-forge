import { computeNextProgramPosition } from '../program-advancement'
import type { Block, BlockWeek } from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers -- minimal factories for Block and BlockWeek
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<Block>): Block {
  return {
    id: `block-${overrides.ordinal ?? 1}`,
    programId: 'prog-1',
    name: `Block ${overrides.ordinal ?? 1}`,
    ordinal: 1,
    durationWeeks: 4,
    blockType: 'ACCUMULATION',
    ...overrides,
  }
}

function makeBlockWeek(blockId: string, weekNumber: number): BlockWeek {
  return {
    id: `bw-${blockId}-w${weekNumber}`,
    blockId,
    weekNumber,
  }
}

/**
 * Build an array of BlockWeeks for a given block, spanning weekNumber 1..count.
 */
function makeWeeksForBlock(block: Block, count: number): BlockWeek[] {
  return Array.from({ length: count }, (_, i) => makeBlockWeek(block.id, i + 1))
}

// ===========================================================================
// computeNextProgramPosition
// ===========================================================================

describe('computeNextProgramPosition', () => {
  it('advances to next week when mid-block (week 2 of 4)', () => {
    const block = makeBlock({ ordinal: 1, durationWeeks: 4 })
    const weeks = makeWeeksForBlock(block, 4)

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 2 },
      [block],
      weeks,
    )

    expect(result).toEqual({ action: 'advance-week', newWeekNumber: 3 })
  })

  it('advances to next block when at last week of current block', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 4 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 3 })
    const weeks = [...makeWeeksForBlock(block1, 4), ...makeWeeksForBlock(block2, 3)]

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 4 },
      [block1, block2],
      weeks,
    )

    expect(result).toEqual({ action: 'advance-block', newBlockOrdinal: 2, newWeekNumber: 1 })
  })

  it('returns program-complete when at last week of only block', () => {
    const block = makeBlock({ ordinal: 1, durationWeeks: 3 })
    const weeks = makeWeeksForBlock(block, 3)

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 3 },
      [block],
      weeks,
    )

    expect(result).toEqual({ action: 'program-complete' })
  })

  it('advances to next block from single-week block', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 1 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 4 })
    const weeks = [...makeWeeksForBlock(block1, 1), ...makeWeeksForBlock(block2, 4)]

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 1 },
      [block1, block2],
      weeks,
    )

    expect(result).toEqual({ action: 'advance-block', newBlockOrdinal: 2, newWeekNumber: 1 })
  })

  it('handles non-sequential block ordinals (1, 3, 5)', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 2 })
    const block3 = makeBlock({ id: 'b3', ordinal: 3, durationWeeks: 2 })
    const block5 = makeBlock({ id: 'b5', ordinal: 5, durationWeeks: 2 })
    const weeks = [
      ...makeWeeksForBlock(block1, 2),
      ...makeWeeksForBlock(block3, 2),
      ...makeWeeksForBlock(block5, 2),
    ]

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 2 },
      [block1, block3, block5],
      weeks,
    )

    // Should jump to ordinal 3, not ordinal 2 which does not exist
    expect(result).toEqual({ action: 'advance-block', newBlockOrdinal: 3, newWeekNumber: 1 })
  })

  it('advances to next block when current block has zero weeks', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 0 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 4 })
    // block1 has no BlockWeek rows at all
    const weeks = makeWeeksForBlock(block2, 4)

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 1 },
      [block1, block2],
      weeks,
    )

    expect(result).toEqual({ action: 'advance-block', newBlockOrdinal: 2, newWeekNumber: 1 })
  })

  it('returns program-complete when current block has zero weeks and no next block', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 0 })
    // No BlockWeek rows for this block

    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 1, currentWeekNumber: 1 },
      [block],
      [],
    )

    expect(result).toEqual({ action: 'program-complete' })
  })

  it('returns program-complete when current block ordinal not found', () => {
    const block = makeBlock({ ordinal: 2 })
    const weeks = makeWeeksForBlock(block, 4)

    // Activation references ordinal 99 which does not exist
    const result = computeNextProgramPosition(
      { currentBlockOrdinal: 99, currentWeekNumber: 1 },
      [block],
      weeks,
    )

    expect(result).toEqual({ action: 'program-complete' })
  })
})
