import { Icon } from '@/components/icon'
import { useProgramFull } from '@/hooks/use-programs'
import { useProfile } from '@/hooks/use-profile'
import { formatLabel } from '@/lib/utils'
import {
  SOURCE_LABELS,
  BLOCK_TYPE_STYLES,
  SESSION_TYPE_BADGE,
  DAY_ABBREVIATIONS,
} from '@/components/program-builder/constants'
import type { DayOfWeek } from '@/components/program-builder/constants'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicProgramDetailProps {
  programId: string
  onBack: () => void
  onClone?: () => void
  isCloning?: boolean
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="h-5 w-24 bg-surface-iron" />
          <div className="h-8 w-64 bg-surface-iron" />
          <div className="h-4 w-40 bg-surface-iron" />
          <div className="h-4 w-80 bg-surface-iron" />
          <div className="h-32 w-full bg-surface-iron" />
          <div className="h-32 w-full bg-surface-iron" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicProgramDetail({
  programId,
  onBack,
  onClone,
  isCloning = false,
}: PublicProgramDetailProps) {
  const { data, isLoading, isError } = useProgramFull(programId)
  const displayName = useProfile(data?.program.userId)

  // Loading state
  if (isLoading) return <Skeleton />

  // Error state
  if (isError || !data) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-6">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-12 min-w-12 items-center gap-1 text-warm-ash hover:text-bone-white"
            aria-label="Go back"
          >
            <Icon name="arrow_back" size={20} />
            <span className="text-sm">Back</span>
          </button>
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <Icon name="error" size={32} className="text-warning-flare" />
            <p className="text-sm text-warm-ash">
              Failed to load program. It may have been removed or made private.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { program, blocks, blockWeeks, scheduledSessions } = data

  // Build lookups
  const weeksByBlock = new Map<string, typeof blockWeeks>()
  for (const week of blockWeeks) {
    const existing = weeksByBlock.get(week.blockId) ?? []
    existing.push(week)
    weeksByBlock.set(week.blockId, existing)
  }

  const sessionsByWeek = new Map<string, typeof scheduledSessions>()
  for (const session of scheduledSessions) {
    const existing = sessionsByWeek.get(session.blockWeekId) ?? []
    existing.push(session)
    sessionsByWeek.set(session.blockWeekId, existing)
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.ordinal - b.ordinal)

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-12 min-w-12 items-center gap-1 self-start text-warm-ash hover:text-bone-white"
            aria-label="Go back"
          >
            <Icon name="arrow_back" size={20} />
            <span className="text-sm">Back</span>
          </button>

          {/* Program header */}
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-medium text-bone-white">{program.name}</h1>

            {/* Author attribution */}
            {displayName.data && <p className="text-xs text-warm-ash">By {displayName.data}</p>}

            {/* Source badge + duration */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-surface-gunmetal text-bone-white text-[11px] px-2 py-0.5 uppercase tracking-widest">
                {SOURCE_LABELS[program.source] ?? formatLabel(program.source)}
              </span>
              {program.durationWeeks != null && program.durationWeeks > 0 && (
                <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
                  {program.durationWeeks} {program.durationWeeks === 1 ? 'week' : 'weeks'}
                </span>
              )}
            </div>

            {/* Description */}
            {program.description && (
              <p className="text-sm text-warm-ash mt-1">{program.description}</p>
            )}
          </div>

          {/* Block structure */}
          {sortedBlocks.length === 0 ? (
            <p className="text-sm text-warm-ash/40 italic">No blocks defined</p>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-medium uppercase tracking-widest text-warm-ash">
                PROGRAM STRUCTURE
              </h2>

              {sortedBlocks.map((block) => {
                const weeks = (weeksByBlock.get(block.id) ?? []).sort(
                  (a, b) => a.weekNumber - b.weekNumber,
                )
                const blockTypeBadge = BLOCK_TYPE_STYLES[block.blockType]

                return (
                  <div key={block.id} className="flex flex-col gap-3">
                    {/* Block header */}
                    <div className="flex items-center gap-2 bg-surface-iron px-4 py-3">
                      <span className="font-display text-sm font-medium text-bone-white">
                        {block.name}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 uppercase tracking-widest ${blockTypeBadge}`}
                      >
                        {formatLabel(block.blockType)}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
                        {block.durationWeeks} {block.durationWeeks === 1 ? 'wk' : 'wks'}
                      </span>
                    </div>

                    {/* Weeks */}
                    {weeks.map((week) => {
                      const sessions = (sessionsByWeek.get(week.id) ?? []).sort((a, b) => {
                        if (a.dayOfWeek != null && b.dayOfWeek != null)
                          return a.dayOfWeek - b.dayOfWeek
                        return 0
                      })

                      return (
                        <div key={week.id} className="flex flex-col gap-2 pl-4">
                          <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
                            Week {week.weekNumber}
                          </span>

                          {sessions.length === 0 ? (
                            <span className="text-xs text-warm-ash/40 italic pl-2">
                              No sessions scheduled
                            </span>
                          ) : (
                            sessions.map((session) => (
                              <div
                                key={session.id}
                                className="flex items-center gap-2 bg-surface-charcoal px-3 py-2.5"
                              >
                                {session.dayOfWeek != null && (
                                  <span className="text-[11px] font-medium uppercase tracking-widest text-ember">
                                    {DAY_ABBREVIATIONS[session.dayOfWeek as DayOfWeek] ??
                                      `Day ${session.dayOfWeek}`}
                                  </span>
                                )}
                                <span className="text-sm text-bone-white">{session.dayLabel}</span>
                                <span
                                  className={`text-[11px] px-1.5 py-0.5 uppercase tracking-wider ${SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'}`}
                                >
                                  {formatLabel(session.sessionType)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Clone button */}
          {onClone && (
            <button
              type="button"
              onClick={onClone}
              disabled={isCloning}
              className="mt-4 w-full min-h-12 bg-forge text-on-forge text-sm font-medium uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
            >
              {isCloning ? 'Cloning...' : 'Clone to Library'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
