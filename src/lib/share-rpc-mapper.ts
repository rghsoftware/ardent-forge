import type { ProgramFull } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Types -- the raw JSON from get_shared_program RPC (snake_case)
// ---------------------------------------------------------------------------

interface RpcProgram {
  id: string
  user_id: string
  name: string
  description?: string | null
  source: string
  duration_weeks?: number | null
  is_public?: boolean
  created_by: string
  created_at: string
  updated_at: string
}

interface RpcBlock {
  id: string
  program_id: string
  name: string
  ordinal: number
  duration_weeks: number
  block_type: string
}

interface RpcBlockWeek {
  id: string
  block_id: string
  week_number: number
}

interface RpcScheduledSession {
  id: string
  block_week_id: string
  day_of_week?: number | null
  day_label: string
  session_type: string
  session_template_id: string
  notes?: string | null
}

export interface SharedProgramRpcData {
  program: RpcProgram
  blocks: Array<{
    block: RpcBlock
    weeks: Array<{
      week: RpcBlockWeek
      sessions: RpcScheduledSession[]
    }>
  }>
  sessionTemplates: unknown
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Maps the RPC snake_case JSON into a ProgramFull shape for the clone mutation.
 */
export function mapRpcToProgramFull(raw: unknown): ProgramFull {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('program' in raw) ||
    !('blocks' in raw) ||
    !Array.isArray((raw as { blocks: unknown }).blocks)
  ) {
    throw new Error('Invalid program data received from share link RPC')
  }
  const { program: p, blocks: rpcBlocks } = raw as SharedProgramRpcData

  const blocks = rpcBlocks.map((b) => ({
    id: b.block.id,
    programId: b.block.program_id,
    name: b.block.name,
    ordinal: b.block.ordinal,
    durationWeeks: b.block.duration_weeks,
    blockType: b.block.block_type as
      | 'ACCUMULATION'
      | 'INTENSIFICATION'
      | 'REALIZATION'
      | 'DELOAD'
      | 'TEST',
  }))

  const blockWeeks = rpcBlocks.flatMap((b) =>
    b.weeks.map((w) => ({
      id: w.week.id,
      blockId: w.week.block_id,
      weekNumber: w.week.week_number,
    })),
  )

  const scheduledSessions = rpcBlocks.flatMap((b) =>
    b.weeks.flatMap((w) =>
      w.sessions.map((s) => ({
        id: s.id,
        blockWeekId: s.block_week_id,
        dayOfWeek: s.day_of_week ?? undefined,
        dayLabel: s.day_label,
        sessionType: s.session_type as 'STRENGTH' | 'CONDITIONING' | 'SE' | 'MIXED',
        sessionTemplateId: s.session_template_id,
        notes: s.notes ?? undefined,
      })),
    ),
  )

  return {
    program: {
      id: p.id,
      userId: p.user_id,
      name: p.name,
      description: p.description ?? undefined,
      source: p.source as
        | 'CUSTOM'
        | 'IMPORTED'
        | 'SHARED'
        | 'MARKETPLACE'
        | 'AI_GENERATED'
        | 'COACH_ASSIGNED'
        | 'TEMPLATE',
      durationWeeks: p.duration_weeks ?? undefined,
      isPublic: p.is_public ?? false,
      createdBy: p.created_by,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    },
    blocks,
    blockWeeks,
    scheduledSessions,
  }
}
