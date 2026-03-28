import type { Program, Block, BlockWeek, ScheduledSession } from '@/domain/types'

type ProgramSeed = {
  program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>
  blocks: Array<{
    block: Omit<Block, 'id' | 'programId'>
    weeks: Array<{
      week: Omit<BlockWeek, 'id' | 'blockId'>
      sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
    }>
  }>
}

/**
 * Tactical Barbell Operator I/A -- 3-Week Cluster
 *
 * The Operator template is the core TB strength program.
 * Uses 3 strength sessions per week with a rotating 3-week progression.
 * Strength days: Monday (A), Wednesday (B), Friday (A) week 1, etc.
 */
export function createTBOperator3Week(
  userId: string,
  sessionTemplateIds: { strength: string; conditioning: string },
): ProgramSeed {
  return {
    program: {
      userId,
      name: 'TB Operator - 3 Week Cluster',
      description: 'Tactical Barbell Operator program. 3-week strength cluster with conditioning.',
      source: 'TEMPLATE',
      durationWeeks: 3,
      isPublic: false,
      createdBy: userId,
    },
    blocks: [
      {
        block: {
          name: 'Strength Block',
          ordinal: 1,
          durationWeeks: 3,
          blockType: 'ACCUMULATION',
        },
        weeks: [1, 2, 3].map((weekNumber) => ({
          week: { weekNumber },
          sessions: [
            {
              dayOfWeek: 1, // Monday
              dayLabel: 'Day A',
              sessionType: 'STRENGTH',
              sessionTemplateId: sessionTemplateIds.strength,
            },
            {
              dayOfWeek: 3, // Wednesday
              dayLabel: 'Day B',
              sessionType: 'CONDITIONING',
              sessionTemplateId: sessionTemplateIds.conditioning,
            },
            {
              dayOfWeek: 5, // Friday
              dayLabel: 'Day A',
              sessionType: 'STRENGTH',
              sessionTemplateId: sessionTemplateIds.strength,
            },
          ],
        })),
      },
    ],
  }
}

/**
 * Tactical Barbell Fighter -- 3-Week Cluster
 *
 * The Fighter template is for operators with high conditioning demands.
 * Uses 2 strength sessions per week, leaving more capacity for conditioning.
 */
export function createTBFighter(
  userId: string,
  sessionTemplateIds: { strength: string },
): ProgramSeed {
  return {
    program: {
      userId,
      name: 'TB Fighter - 3 Week Cluster',
      description:
        'Tactical Barbell Fighter template. 2 strength sessions/week for high conditioning load.',
      source: 'TEMPLATE',
      durationWeeks: 3,
      isPublic: false,
      createdBy: userId,
    },
    blocks: [
      {
        block: {
          name: 'Strength Block',
          ordinal: 1,
          durationWeeks: 3,
          blockType: 'ACCUMULATION',
        },
        weeks: [1, 2, 3].map((weekNumber) => ({
          week: { weekNumber },
          sessions: [
            {
              dayOfWeek: 1, // Monday
              dayLabel: 'Day A',
              sessionType: 'STRENGTH',
              sessionTemplateId: sessionTemplateIds.strength,
            },
            {
              dayOfWeek: 4, // Thursday
              dayLabel: 'Day B',
              sessionType: 'STRENGTH',
              sessionTemplateId: sessionTemplateIds.strength,
            },
          ],
        })),
      },
    ],
  }
}
