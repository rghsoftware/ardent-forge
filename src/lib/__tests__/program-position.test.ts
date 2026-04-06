import { computePositionFromDate, validateProgramPosition } from '../program-position'
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
// computePositionFromDate
// ===========================================================================

describe('computePositionFromDate', () => {
  it('returns week 1, block 1 when daysSinceStart is 0 (same day)', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 4 })
    const weeks = makeWeeksForBlock(block, 4)

    const result = computePositionFromDate('2026-01-15', '2026-01-15', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('stays in week 1 through day 6 (days 0-6 = week 1)', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 4 })
    const weeks = makeWeeksForBlock(block, 4)

    // 6 days after start = still week 1
    const result = computePositionFromDate('2026-01-15', '2026-01-21', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('advances to week 2 on day 7', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 4 })
    const weeks = makeWeeksForBlock(block, 4)

    // 7 days after start = week 2
    const result = computePositionFromDate('2026-01-15', '2026-01-22', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 2 })
  })

  it('crosses block boundary: Block 1 (3 weeks) + Block 2, day 21 = Block 2 Week 1', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 3 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 2 })
    const weeks = [...makeWeeksForBlock(block1, 3), ...makeWeeksForBlock(block2, 2)]

    // Day 21 = global week 4 (21/7 + 1 = 4). Block 1 has 3 weeks, so week 4 - 3 = week 1 of block 2.
    const result = computePositionFromDate('2026-01-15', '2026-02-05', [block1, block2], weeks)

    expect(result).toEqual({ blockOrdinal: 2, weekNumber: 1 })
  })

  it('clamps to last week of last block when past program end', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 5 })
    const weeks = makeWeeksForBlock(block, 5)

    // Day 100 = global week 15, but program only has 5 weeks
    const result = computePositionFromDate('2026-01-15', '2026-04-25', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 5 })
  })

  it('handles multi-block program with variable week counts', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 2 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 4 })
    const block3 = makeBlock({ id: 'b3', ordinal: 3, durationWeeks: 1 })
    const weeks = [
      ...makeWeeksForBlock(block1, 2),
      ...makeWeeksForBlock(block2, 4),
      ...makeWeeksForBlock(block3, 1),
    ]

    // Day 14 = global week 3. Block 1 has 2 weeks, so week 3 - 2 = week 1 of block 2.
    const result = computePositionFromDate(
      '2026-01-15',
      '2026-01-29',
      [block1, block2, block3],
      weeks,
    )

    expect(result).toEqual({ blockOrdinal: 2, weekNumber: 1 })

    // Day 35 = global week 6. Block 1 (2) + Block 2 (4) = 6. Week 6 falls within block 2.
    const result2 = computePositionFromDate(
      '2026-01-15',
      '2026-02-19',
      [block1, block2, block3],
      weeks,
    )

    expect(result2).toEqual({ blockOrdinal: 2, weekNumber: 4 })

    // Day 42 = global week 7. Block 1 (2) + Block 2 (4) = 6, so week 7 - 6 = week 1 of block 3.
    const result3 = computePositionFromDate(
      '2026-01-15',
      '2026-02-26',
      [block1, block2, block3],
      weeks,
    )

    expect(result3).toEqual({ blockOrdinal: 3, weekNumber: 1 })
  })

  it('handles single-week block correctly', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 1 })
    const weeks = makeWeeksForBlock(block, 1)

    // Day 0 = week 1
    const result = computePositionFromDate('2026-01-15', '2026-01-15', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })

    // Day 7 = past program end, clamp to week 1
    const result2 = computePositionFromDate('2026-01-15', '2026-01-22', [block], weeks)

    expect(result2).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('returns block 1, week 1 when start date is in the future', () => {
    const block = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 4 })
    const weeks = makeWeeksForBlock(block, 4)

    const result = computePositionFromDate('2026-06-01', '2026-01-15', [block], weeks)

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('returns block 1, week 1 when blocks array is empty', () => {
    const result = computePositionFromDate('2026-01-15', '2026-02-15', [], [])

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('skips zero-duration block (no BlockWeek entries) and lands in next block', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 0 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 3 })
    // block1 has zero BlockWeek rows -- treated as zero-duration
    const weeks = makeWeeksForBlock(block2, 3)

    // Day 0 = global week 1. Block 1 skipped (0 weeks), so week 1 falls in block 2.
    const result = computePositionFromDate('2026-01-15', '2026-01-15', [block1, block2], weeks)

    expect(result).toEqual({ blockOrdinal: 2, weekNumber: 1 })
  })

  it('returns fallback when all blocks have zero weeks', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 0 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 0 })

    const result = computePositionFromDate('2026-01-15', '2026-02-15', [block1, block2], [])

    expect(result).toEqual({ blockOrdinal: 1, weekNumber: 1 })
  })

  it('clamps to last block with weeks when past end of multi-block program', () => {
    const block1 = makeBlock({ id: 'b1', ordinal: 1, durationWeeks: 2 })
    const block2 = makeBlock({ id: 'b2', ordinal: 2, durationWeeks: 3 })
    const block3 = makeBlock({ id: 'b3', ordinal: 3, durationWeeks: 0 }) // zero-duration trailing block
    const weeks = [...makeWeeksForBlock(block1, 2), ...makeWeeksForBlock(block2, 3)]

    // Day 100 = way past end. Should clamp to last block with weeks (block2, week 3).
    const result = computePositionFromDate(
      '2026-01-15',
      '2026-04-25',
      [block1, block2, block3],
      weeks,
    )

    expect(result).toEqual({ blockOrdinal: 2, weekNumber: 3 })
  })
})

// ===========================================================================
// validateProgramPosition
// ===========================================================================

describe('validateProgramPosition', () => {
  const block1 = makeBlock({ id: 'v-b1', ordinal: 1, durationWeeks: 3 })
  const block2 = makeBlock({ id: 'v-b2', ordinal: 2, durationWeeks: 2 })
  const blocks = [block1, block2]
  const blockWeeks = [...makeWeeksForBlock(block1, 3), ...makeWeeksForBlock(block2, 2)]

  it('returns true for a valid position (block exists, week exists)', () => {
    expect(validateProgramPosition(1, 2, blocks, blockWeeks)).toBe(true)
    expect(validateProgramPosition(2, 1, blocks, blockWeeks)).toBe(true)
    expect(validateProgramPosition(2, 2, blocks, blockWeeks)).toBe(true)
  })

  it('returns false when block ordinal does not exist', () => {
    expect(validateProgramPosition(3, 1, blocks, blockWeeks)).toBe(false)
    expect(validateProgramPosition(99, 1, blocks, blockWeeks)).toBe(false)
  })

  it('returns false when block exists but week number does not', () => {
    // Block 1 has weeks 1-3, so week 4 is invalid
    expect(validateProgramPosition(1, 4, blocks, blockWeeks)).toBe(false)
    // Block 2 has weeks 1-2, so week 3 is invalid
    expect(validateProgramPosition(2, 3, blocks, blockWeeks)).toBe(false)
  })

  it('returns false for block ordinal 0 or negative', () => {
    expect(validateProgramPosition(0, 1, blocks, blockWeeks)).toBe(false)
    expect(validateProgramPosition(-1, 1, blocks, blockWeeks)).toBe(false)
  })

  it('returns false for week number 0 or negative', () => {
    expect(validateProgramPosition(1, 0, blocks, blockWeeks)).toBe(false)
    expect(validateProgramPosition(1, -1, blocks, blockWeeks)).toBe(false)
  })

  it('returns false with empty blocks array', () => {
    expect(validateProgramPosition(1, 1, [], blockWeeks)).toBe(false)
  })

  it('returns false with empty blockWeeks array', () => {
    expect(validateProgramPosition(1, 1, blocks, [])).toBe(false)
  })
})
