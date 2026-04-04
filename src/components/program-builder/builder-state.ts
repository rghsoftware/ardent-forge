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
import { DAY_LABELS } from './constants'
import type { DayOfWeek } from './constants'

// ---------------------------------------------------------------------------
// Draft types -- local builder state with client-side UUIDs
// ---------------------------------------------------------------------------

export type SessionDraft = {
  clientId: string
  dayOfWeek: DayOfWeek | null // 0-6 where 0=Sunday through 6=Saturday (JS convention); UI renders Mon-Sun order. null if unscheduled
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
  blockType: BlockType
  weeks: WeekDraft[]
}

export type ProgramDraft = {
  id?: string // present when editing an existing program
  name: string
  description: string
  source: ProgramSource
  createdAt?: string // preserved from DB in edit mode
  updatedAt?: string // preserved from DB in edit mode
  blocks: BlockDraft[]
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
      return { ...block, weeks }
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
      return { ...block, weeks }
    }),
  }
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function assignSession(
  draft: ProgramDraft,
  weekClientId: string,
  dayOfWeek: DayOfWeek,
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

  // No-op: copying an empty week has no effect
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

export type ValidationError = {
  field: 'programName' | 'blocks' | 'blockName' | 'blockWeeks'
  blockClientId?: string
  message: string
}

export function validateDraft(draft: ProgramDraft): ValidationError[] {
  const errors: ValidationError[] = []

  if (!draft.name.trim()) {
    errors.push({ field: 'programName', message: 'Program name is required' })
  } else if (draft.name.trim().length > 200) {
    errors.push({ field: 'programName', message: 'Program name must be 200 characters or less' })
  }

  if (draft.blocks.length === 0) {
    errors.push({ field: 'blocks', message: 'At least one block is required' })
  }

  for (const block of draft.blocks) {
    if (block.name.trim().length === 0) {
      errors.push({
        field: 'blockName',
        blockClientId: block.clientId,
        message: 'Block name is required',
      })
    } else if (block.name.trim().length > 200) {
      errors.push({
        field: 'blockName',
        blockClientId: block.clientId,
        message: 'Block name must be 200 characters or less',
      })
    }

    if (block.weeks.length === 0) {
      errors.push({
        field: 'blockWeeks',
        blockClientId: block.clientId,
        message: 'Must have at least one week',
      })
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Build save payload
// ---------------------------------------------------------------------------

type SessionPayload = Omit<ScheduledSession, 'id' | 'blockWeekId'>

type CreateBlockPayload = {
  block: Omit<Block, 'id' | 'programId'>
  weeks: Array<{
    week: Omit<BlockWeek, 'id' | 'blockId'>
    sessions: SessionPayload[]
  }>
}

type UpdateBlockPayload = {
  block: Omit<Block, 'programId'>
  weeks: Array<{
    week: Omit<BlockWeek, 'blockId'>
    sessions: SessionPayload[]
  }>
}

function buildSessionsPayload(sessions: SessionDraft[]): SessionPayload[] {
  return sessions.map((session) => ({
    dayOfWeek: session.dayOfWeek ?? undefined,
    dayLabel: session.dayLabel,
    sessionType: session.sessionType,
    sessionTemplateId: session.sessionTemplateId,
  }))
}

function buildCreateBlocksPayload(blocks: BlockDraft[]): CreateBlockPayload[] {
  return blocks.map((block) => ({
    block: {
      name: block.name,
      ordinal: block.ordinal,
      durationWeeks: block.weeks.length,
      blockType: block.blockType,
    },
    weeks: block.weeks.map((week) => ({
      week: {
        weekNumber: week.weekNumber,
      },
      sessions: buildSessionsPayload(week.sessions),
    })),
  }))
}

function buildUpdateBlocksPayload(blocks: BlockDraft[]): UpdateBlockPayload[] {
  return blocks.map((block) => ({
    block: {
      id: block.clientId,
      name: block.name,
      ordinal: block.ordinal,
      durationWeeks: block.weeks.length,
      blockType: block.blockType,
    },
    weeks: block.weeks.map((week) => ({
      week: {
        id: week.clientId,
        weekNumber: week.weekNumber,
      },
      sessions: buildSessionsPayload(week.sessions),
    })),
  }))
}

export function buildSavePayload(
  draft: ProgramDraft,
  userId: string,
):
  | {
      mode: 'create'
      program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>
      blocks: CreateBlockPayload[]
    }
  | {
      mode: 'update'
      program: Program
      blocks: UpdateBlockPayload[]
    } {
  const totalDurationWeeks = draft.blocks.reduce((sum, b) => sum + b.weeks.length, 0)

  if (draft.id) {
    const now = new Date().toISOString()
    return {
      mode: 'update' as const,
      program: {
        id: draft.id,
        userId,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        source: draft.source,
        durationWeeks: totalDurationWeeks,
        isPublic: false,
        createdBy: userId,
        createdAt: draft.createdAt ?? now,
        updatedAt: now,
      },
      blocks: buildUpdateBlocksPayload(draft.blocks),
    }
  }

  return {
    mode: 'create' as const,
    program: {
      userId,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      source: draft.source,
      durationWeeks: totalDurationWeeks,
      isPublic: false,
      createdBy: userId,
    },
    blocks: buildCreateBlocksPayload(draft.blocks),
  }
}

// ---------------------------------------------------------------------------
// Hydrate draft from ProgramFull (edit mode)
// Preserves original DB IDs as clientIds so buildSavePayload sends correct
// IDs in update mode rather than fabricating new ones.
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
              clientId: session.id,
              dayOfWeek: (session.dayOfWeek as DayOfWeek) ?? null,
              dayLabel: session.dayLabel,
              sessionType: session.sessionType,
              sessionTemplateId: session.sessionTemplateId,
            }),
          )

          return {
            clientId: week.id,
            weekNumber: week.weekNumber,
            sessions,
          } satisfies WeekDraft
        })

      return {
        clientId: block.id,
        name: block.name,
        ordinal: block.ordinal,
        blockType: block.blockType,
        weeks,
      } satisfies BlockDraft
    })

  return {
    id: program.id,
    name: program.name,
    description: program.description ?? '',
    source: program.source,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    blocks: blockDrafts,
  }
}
