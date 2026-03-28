// src/lib/program-advancement.ts
// Pure function for computing the next program position after completing a week.

import type { Block, BlockWeek } from '@/domain/types'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ProgramAdvancementResult =
  | { action: 'advance-week'; newWeekNumber: number }
  | { action: 'advance-block'; newBlockOrdinal: number; newWeekNumber: 1 }
  | { action: 'program-complete' }

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Given the user's current position in a program, determine what happens next:
 * advance to the next week, advance to the next block, or mark the program
 * as complete.
 *
 * Uses ordinal comparison (not array index) so non-sequential ordinals work.
 */
export function computeNextProgramPosition(
  activation: { currentBlockOrdinal: number; currentWeekNumber: number },
  programBlocks: Block[],
  blockWeeks: BlockWeek[],
): ProgramAdvancementResult {
  // 1. Find current block by ordinal
  const currentBlock = programBlocks.find((b) => b.ordinal === activation.currentBlockOrdinal)

  if (!currentBlock) {
    // Current block not found -- treat as program complete
    return { action: 'program-complete' }
  }

  // 2. Get weeks for the current block
  const weeksForBlock = blockWeeks.filter((w) => w.blockId === currentBlock.id)

  // 3. Find max week number in those weeks
  const maxWeekNumber = weeksForBlock.reduce((max, w) => Math.max(max, w.weekNumber), 0)

  // Edge case: block with zero weeks -- advance to next block
  if (maxWeekNumber === 0) {
    return advanceToNextBlock(activation.currentBlockOrdinal, programBlocks)
  }

  // 4. If not at the last week, advance within the current block
  if (activation.currentWeekNumber < maxWeekNumber) {
    return {
      action: 'advance-week',
      newWeekNumber: activation.currentWeekNumber + 1,
    }
  }

  // 5. At last week of block -- advance to next block
  return advanceToNextBlock(activation.currentBlockOrdinal, programBlocks)
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Find the next block after the given ordinal. Returns advance-block if one
 * exists, or program-complete if there are no more blocks.
 */
function advanceToNextBlock(
  currentOrdinal: number,
  programBlocks: Block[],
): ProgramAdvancementResult {
  // Find the minimum ordinal that is strictly greater than the current one
  const candidateBlocks = programBlocks.filter((b) => b.ordinal > currentOrdinal)

  if (candidateBlocks.length === 0) {
    return { action: 'program-complete' }
  }

  const nextBlock = candidateBlocks.reduce((best, b) => (b.ordinal < best.ordinal ? b : best))

  return {
    action: 'advance-block',
    newBlockOrdinal: nextBlock.ordinal,
    newWeekNumber: 1,
  }
}
