// src/lib/program-position.ts
// Pure functions for computing a program position from a calendar date.

import type { Block, BlockWeek } from '@/domain/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ProgramPosition = { blockOrdinal: number; weekNumber: number }

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Derive the current block ordinal and block-local week number from the
 * relationship between a program's start date and today's date.
 *
 * Walks blocks in ordinal order, accumulating weeks until the computed
 * global week falls within a block's range. Clamps to the last week of
 * the last block when the program has been exceeded.
 *
 * Returns block 1, week 1 when:
 * - The start date is in the future (daysSinceStart < 0)
 * - The blocks array is empty
 * - No block has any associated BlockWeek entries
 */
export function computePositionFromDate(
  startDate: string,
  today: string,
  blocks: Block[],
  blockWeeks: BlockWeek[],
): ProgramPosition {
  const fallback: ProgramPosition = { blockOrdinal: 1, weekNumber: 1 }

  // --- Guard: no blocks means nothing to compute against ---
  if (blocks.length === 0) return fallback

  // --- Parse dates and compute day offset ---
  const startMs = new Date(startDate + 'T00:00:00').getTime()
  const todayMs = new Date(today + 'T00:00:00').getTime()
  const daysSinceStart = Math.floor((todayMs - startMs) / MS_PER_DAY)

  // Start date in the future -- clamp to the beginning
  if (daysSinceStart < 0) return fallback

  // Global week: week 1 = days 0-6, week 2 = days 7-13, etc.
  const globalWeek = Math.floor(daysSinceStart / 7) + 1

  // --- Walk blocks in ordinal order ---
  const sorted = [...blocks].sort((a, b) => a.ordinal - b.ordinal)

  let accumulated = 0

  for (const block of sorted) {
    const weeksForBlock = blockWeeks.filter((w) => w.blockId === block.id)
    const maxWeek = weeksForBlock.reduce((max, w) => Math.max(max, w.weekNumber), 0)

    // Skip blocks with no weeks (treat as zero-duration)
    if (maxWeek === 0) continue

    if (globalWeek <= accumulated + maxWeek) {
      return {
        blockOrdinal: block.ordinal,
        weekNumber: globalWeek - accumulated,
      }
    }

    accumulated += maxWeek
  }

  // --- Global week exceeds total program weeks -- clamp to last valid position ---
  // Walk backwards through sorted blocks to find the last block with weeks
  for (let i = sorted.length - 1; i >= 0; i--) {
    const block = sorted[i]
    const weeksForBlock = blockWeeks.filter((w) => w.blockId === block.id)
    const maxWeek = weeksForBlock.reduce((max, w) => Math.max(max, w.weekNumber), 0)

    if (maxWeek > 0) {
      return { blockOrdinal: block.ordinal, weekNumber: maxWeek }
    }
  }

  // Every block had zero weeks -- fall back to start
  return fallback
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns true when the given position actually exists in the program
 * structure: a block with the given ordinal exists AND a BlockWeek with the
 * given weekNumber exists for that block's ID.
 */
export function validateProgramPosition(
  blockOrdinal: number,
  weekNumber: number,
  blocks: Block[],
  blockWeeks: BlockWeek[],
): boolean {
  const block = blocks.find((b) => b.ordinal === blockOrdinal)
  if (!block) return false

  return blockWeeks.some((w) => w.blockId === block.id && w.weekNumber === weekNumber)
}
