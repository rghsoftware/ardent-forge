import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useCloneProgram } from '@/hooks/use-share-links'
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

interface SharedProgramRpcData {
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps the RPC snake_case JSON into a ProgramFull shape for the clone mutation.
 */
function mapRpcToProgramFull(raw: SharedProgramRpcData): ProgramFull {
  const { program: p, blocks: rpcBlocks } = raw

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CloneProgramButtonProps {
  programData: unknown
}

export function CloneProgramButton({ programData }: CloneProgramButtonProps) {
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const cloneMutation = useCloneProgram()
  const [cloneSuccess, setCloneSuccess] = useState(false)

  const isAuthenticated = !!user && !isGuest

  const handleClone = async () => {
    if (!user) return

    try {
      const programFull = mapRpcToProgramFull(programData as SharedProgramRpcData)
      await cloneMutation.mutateAsync({ program: programFull, userId: user.id })
      setCloneSuccess(true)
      // Navigate to library after a brief moment to show the success state
      setTimeout(() => {
        navigate({ to: '/library' })
      }, 1200)
    } catch (err) {
      console.error('[clone] Failed to clone program:', err)
    }
  }

  const handleSignIn = () => {
    // Pass the current URL as a return path so the user comes back after sign-in
    navigate({ to: '/sign-in', search: { reason: undefined } })
  }

  if (cloneSuccess) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="flex items-center gap-2 text-ember">
          <Icon name="check_circle" size={20} fill />
          <span className="font-display text-sm font-medium uppercase tracking-wider">
            Program cloned to library
          </span>
        </div>
        <span className="text-xs text-warm-ash/60">Redirecting...</span>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <Button
        onClick={handleClone}
        disabled={cloneMutation.isPending}
        className="w-full min-h-12 bg-forge text-on-forge text-xs uppercase tracking-wider hover:brightness-110"
      >
        {cloneMutation.isPending ? (
          <>
            <Icon name="progress_activity" size={16} className="animate-spin" />
            Cloning...
          </>
        ) : (
          <>
            <Icon name="content_copy" size={16} />
            Clone to library
          </>
        )}
      </Button>
    )
  }

  // Unauthenticated
  return (
    <Button
      variant="secondary"
      onClick={handleSignIn}
      className="w-full min-h-12 text-xs uppercase tracking-wider"
    >
      <Icon name="login" size={16} />
      Sign in to clone
    </Button>
  )
}
