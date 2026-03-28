import type {
  BlockType,
  ProgramSource,
  SessionType,
  Program,
  Block,
  BlockWeek,
  ScheduledSession,
} from '@/domain/types'
import type { ProgramFull } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Draft types -- local builder state with client-side UUIDs
// ---------------------------------------------------------------------------

export type SessionDraft = {
  clientId: string
  dayOfWeek: number | null // 0-6 (Sun-Sat), null if unscheduled
  dayLabel: string
  sessionType: SessionType
  sessionTemplateId: string
  templateName?: string // denormalized for display
}

export type WeekDraft = {
  clientId: string
  weekNumber: number
  sessions: SessionDraft[]
}

export type BlockDraft = {
  clientId: string
  name: string
  ordinal: number
  durationWeeks: number
  blockType: BlockType
  weeks: WeekDraft[]
}

export type ProgramDraft = {
  id?: string // present when editing an existing program
  name: string
  description: string
  source: ProgramSource
  blocks: BlockDraft[]
}

// ---------------------------------------------------------------------------
// Day-of-week labels
// ---------------------------------------------------------------------------

const DAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

// ---------------------------------------------------------------------------
// Helper: create empty draft
// ---------------------------------------------------------------------------

export function createEmptyDraft(): ProgramDraft {
  return {
    name: '',
    description: '',
    source: 'CUSTOM',
    blocks: [
      {
        clientId: crypto.randomUUID(),
        name: 'Block 1',
        ordinal: 1,
        durationWeeks: 1,
        blockType: 'ACCUMULATION',
        weeks: [
          {
            clientId: crypto.randomUUID(),
            weekNumber: 1,
            sessions: [],
          },
        ],
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

export function addBlock(draft: ProgramDraft, blockType: BlockType): ProgramDraft {
  const ordinal = draft.blocks.length + 1
  const newBlock: BlockDraft = {
    clientId: crypto.randomUUID(),
    name: `Block ${ordinal}`,
    ordinal,
    durationWeeks: 1,
    blockType,
    weeks: [
      {
        clientId: crypto.randomUUID(),
        weekNumber: 1,
        sessions: [],
      },
    ],
  }
  return { ...draft, blocks: [...draft.blocks, newBlock] }
}

export function removeBlock(draft: ProgramDraft, clientId: string): ProgramDraft {
  const filtered = draft.blocks.filter((b) => b.clientId !== clientId)
  const renumbered = filtered.map((b, i) => ({ ...b, ordinal: i + 1 }))
  return { ...draft, blocks: renumbered }
}

export function reorderBlocks(
  draft: ProgramDraft,
  fromIndex: number,
  toIndex: number,
): ProgramDraft {
  const blocks = [...draft.blocks]
  const [moved] = blocks.splice(fromIndex, 1)
  blocks.splice(toIndex, 0, moved)
  const renumbered = blocks.map((b, i) => ({ ...b, ordinal: i + 1 }))
  return { ...draft, blocks: renumbered }
}

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------

export function addWeekToBlock(draft: ProgramDraft, blockClientId: string): ProgramDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => {
      if (block.clientId !== blockClientId) return block
      const newWeek: WeekDraft = {
        clientId: crypto.randomUUID(),
        weekNumber: block.weeks.length + 1,
        sessions: [],
      }
      const weeks = [...block.weeks, newWeek]
      return { ...block, weeks, durationWeeks: weeks.length }
    }),
  }
}

export function removeWeekFromBlock(
  draft: ProgramDraft,
  blockClientId: string,
  weekClientId: string,
): ProgramDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => {
      if (block.clientId !== blockClientId) return block
      // Guard: blocks must have at least 1 week
      if (block.weeks.length <= 1) return block
      const weeks = block.weeks
        .filter((w) => w.clientId !== weekClientId)
        .map((w, i) => ({ ...w, weekNumber: i + 1 }))
      return { ...block, weeks, durationWeeks: weeks.length }
    }),
  }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function assignSession(
  draft: ProgramDraft,
  weekClientId: string,
  dayOfWeek: number,
  templateId: string,
  templateName: string,
  sessionType: SessionType,
): ProgramDraft {
  const newSession: SessionDraft = {
    clientId: crypto.randomUUID(),
    dayOfWeek,
    dayLabel: DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`,
    sessionType,
    sessionTemplateId: templateId,
    templateName,
  }

  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      weeks: block.weeks.map((week) => {
        if (week.clientId !== weekClientId) return week
        // Replace existing session on the same day, or add new
        const withoutDay = week.sessions.filter((s) => s.dayOfWeek !== dayOfWeek)
        return { ...week, sessions: [...withoutDay, newSession] }
      }),
    })),
  }
}

export function removeSession(
  draft: ProgramDraft,
  weekClientId: string,
  sessionClientId: string,
): ProgramDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      weeks: block.weeks.map((week) => {
        if (week.clientId !== weekClientId) return week
        return { ...week, sessions: week.sessions.filter((s) => s.clientId !== sessionClientId) }
      }),
    })),
  }
}

// ---------------------------------------------------------------------------
// Copy week
// ---------------------------------------------------------------------------

export function copyWeek(
  draft: ProgramDraft,
  sourceWeekClientId: string,
  targetWeekClientIds: string[],
): ProgramDraft {
  // Find the source week across all blocks
  let sourceSessions: SessionDraft[] = []
  for (const block of draft.blocks) {
    const sourceWeek = block.weeks.find((w) => w.clientId === sourceWeekClientId)
    if (sourceWeek) {
      sourceSessions = sourceWeek.sessions
      break
    }
  }

  if (sourceSessions.length === 0) return draft

  const targetSet = new Set(targetWeekClientIds)

  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      weeks: block.weeks.map((week) => {
        if (!targetSet.has(week.clientId)) return week
        // Deep-copy sessions with fresh clientIds
        const copiedSessions = sourceSessions.map((s) => ({
          ...s,
          clientId: crypto.randomUUID(),
        }))
        return { ...week, sessions: copiedSessions }
      }),
    })),
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateDraft(draft: ProgramDraft): string[] {
  const errors: string[] = []

  if (!draft.name.trim()) {
    errors.push('Program name is required')
  }

  if (draft.blocks.length === 0) {
    errors.push('At least one block is required')
  }

  for (const block of draft.blocks) {
    if (block.weeks.length === 0) {
      errors.push(`Block "${block.name}" must have at least one week`)
    }
  }

  // Verify ordinals are sequential
  for (let i = 0; i < draft.blocks.length; i++) {
    if (draft.blocks[i].ordinal !== i + 1) {
      errors.push(
        `Block ordinals are not sequential (expected ${i + 1}, got ${draft.blocks[i].ordinal})`,
      )
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Build save payload
// ---------------------------------------------------------------------------

export function buildSavePayload(
  draft: ProgramDraft,
  userId: string,
):
  | {
      mode: 'create'
      program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>
      blocks: Array<{
        block: Omit<Block, 'id' | 'programId'>
        weeks: Array<{
          week: Omit<BlockWeek, 'id' | 'blockId'>
          sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
        }>
      }>
    }
  | {
      mode: 'update'
      program: Program
      blocks: Array<{
        block: Omit<Block, 'programId'>
        weeks: Array<{
          week: Omit<BlockWeek, 'blockId'>
          sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
        }>
      }>
    } {
  const blocksPayload = draft.blocks.map((block) => ({
    block: {
      ...(draft.id ? { id: block.clientId } : {}),
      name: block.name,
      ordinal: block.ordinal,
      durationWeeks: block.durationWeeks,
      blockType: block.blockType,
    },
    weeks: block.weeks.map((week) => ({
      week: {
        ...(draft.id ? { id: week.clientId } : {}),
        weekNumber: week.weekNumber,
      },
      sessions: week.sessions.map((session) => ({
        dayOfWeek: session.dayOfWeek ?? undefined,
        dayLabel: session.dayLabel,
        sessionType: session.sessionType,
        sessionTemplateId: session.sessionTemplateId,
      })),
    })),
  }))

  if (draft.id) {
    // Update mode: program has full entity shape
    const now = new Date().toISOString()
    return {
      mode: 'update' as const,
      program: {
        id: draft.id,
        userId,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        source: draft.source,
        durationWeeks: draft.blocks.reduce((sum, b) => sum + b.durationWeeks, 0),
        isPublic: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      blocks: blocksPayload as Array<{
        block: Omit<Block, 'programId'>
        weeks: Array<{
          week: Omit<BlockWeek, 'blockId'>
          sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
        }>
      }>,
    }
  }

  // Create mode
  return {
    mode: 'create' as const,
    program: {
      userId,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      source: draft.source,
      durationWeeks: draft.blocks.reduce((sum, b) => sum + b.durationWeeks, 0),
      isPublic: false,
      createdBy: userId,
    },
    blocks: blocksPayload as Array<{
      block: Omit<Block, 'id' | 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'id' | 'blockId'>
        sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
      }>
    }>,
  }
}

// ---------------------------------------------------------------------------
// Hydrate draft from ProgramFull (edit mode)
// ---------------------------------------------------------------------------

export function hydrateDraft(programFull: ProgramFull): ProgramDraft {
  const { program, blocks, blockWeeks, scheduledSessions } = programFull

  // Group weeks by blockId
  const weeksByBlock = new Map<string, BlockWeek[]>()
  for (const week of blockWeeks) {
    const existing = weeksByBlock.get(week.blockId) ?? []
    existing.push(week)
    weeksByBlock.set(week.blockId, existing)
  }

  // Group sessions by blockWeekId
  const sessionsByWeek = new Map<string, ScheduledSession[]>()
  for (const session of scheduledSessions) {
    const existing = sessionsByWeek.get(session.blockWeekId) ?? []
    existing.push(session)
    sessionsByWeek.set(session.blockWeekId, existing)
  }

  const blockDrafts: BlockDraft[] = blocks
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((block) => {
      const weeks = (weeksByBlock.get(block.id) ?? [])
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((week) => {
          const sessions = (sessionsByWeek.get(week.id) ?? []).map(
            (session): SessionDraft => ({
              clientId: crypto.randomUUID(),
              dayOfWeek: session.dayOfWeek ?? null,
              dayLabel: session.dayLabel,
              sessionType: session.sessionType,
              sessionTemplateId: session.sessionTemplateId,
            }),
          )

          return {
            clientId: crypto.randomUUID(),
            weekNumber: week.weekNumber,
            sessions,
          } satisfies WeekDraft
        })

      return {
        clientId: crypto.randomUUID(),
        name: block.name,
        ordinal: block.ordinal,
        durationWeeks: block.durationWeeks,
        blockType: block.blockType,
        weeks,
      } satisfies BlockDraft
    })

  return {
    id: program.id,
    name: program.name,
    description: program.description ?? '',
    source: program.source,
    blocks: blockDrafts,
  }
}
