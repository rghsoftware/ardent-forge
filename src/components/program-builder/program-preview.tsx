import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import { getAdapter } from '@/lib/adapter'
import type { ProgramDraft } from './builder-state'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import type { SetScheme } from '@/domain/types'
import { DAY_COLUMNS, SOURCE_LABELS } from './constants'

// ---------------------------------------------------------------------------
// Set scheme summary helpers
// ---------------------------------------------------------------------------

function formatSetsReps(scheme: SetScheme): string {
  switch (scheme.type) {
    case 'fixedSets': {
      const sets =
        typeof scheme.sets === 'number' ? `${scheme.sets}` : `${scheme.sets.min}-${scheme.sets.max}`
      const reps =
        typeof scheme.reps === 'number' ? `${scheme.reps}` : `${scheme.reps.min}-${scheme.reps.max}`
      return `${sets}x${reps}${scheme.lastSetAMRAP ? '+' : ''}`
    }
    case 'percentageSets':
      return `${scheme.sets}x${scheme.reps}${scheme.lastSetAMRAP ? '+' : ''}`
    case 'workToMax':
      return `${scheme.targetRepRange.min}-${scheme.targetRepRange.max}RM`
    case 'timedHold':
      return `${scheme.sets}x${formatSeconds(scheme.duration.seconds)}`
    case 'forReps':
      return `${scheme.targetReps} REPS`
    case 'cardioSteadyState':
      return scheme.duration ? formatSeconds(scheme.duration.seconds) : 'STEADY STATE'
    case 'cardioInterval':
      return `${scheme.rounds} ROUNDS`
    case 'ruckMarch':
      return scheme.duration ? formatSeconds(scheme.duration.seconds) : 'RUCK'
    case 'emom':
      return `EMOM ${scheme.totalMinutes}MIN`
    case 'amrapTimed':
      return `AMRAP ${formatSeconds(scheme.timeCap.seconds)}`
    case 'descendingReps':
      return scheme.repLadder.join('-')
    case 'percentageOfMaxReps':
      return `${Math.round(scheme.percentage * 100)}% MAX REPS`
    default:
      return '--'
  }
}

function formatLoad(
  scheme: SetScheme,
  exerciseMaxes: Record<
    string,
    { weight: { value: number; unit: string }; testedAt: string; estimated: boolean }
  >,
  exerciseId: string,
): string {
  if (scheme.type === 'percentageSets') {
    const maxEntry = exerciseMaxes[exerciseId]
    if (maxEntry) {
      const calculated = Math.floor((maxEntry.weight.value * scheme.percentageOf1RM) / 5) * 5
      return `${calculated}${maxEntry.weight.unit.toUpperCase()}`
    }
    return `${Math.round(scheme.percentageOf1RM * 100)}% 1RM`
  }

  if (scheme.type === 'fixedSets' || scheme.type === 'emom' || scheme.type === 'descendingReps') {
    const load = 'load' in scheme ? scheme.load : undefined
    if (!load) return '--'
    return formatLoadSpec(load)
  }

  if (scheme.type === 'forReps') {
    if (!scheme.load) return '--'
    return formatLoadSpec(scheme.load)
  }

  if (scheme.type === 'workToMax') return 'WORK TO MAX'
  if (scheme.type === 'timedHold') return 'HOLD'
  if (scheme.type === 'amrapTimed') return 'AMRAP'
  if (scheme.type === 'cardioSteadyState' || scheme.type === 'cardioInterval')
    return scheme.modality
  if (scheme.type === 'ruckMarch')
    return `${scheme.loadWeight.value}${scheme.loadWeight.unit.toUpperCase()}`
  if (scheme.type === 'percentageOfMaxReps') return `${Math.round(scheme.percentage * 100)}% MAX`

  return '--'
}

function formatLoadSpec(load: {
  type: string
  weight?: { value: number; unit: string }
  percentage?: number
  target?: number
  additionalWeight?: { value: number; unit: string }
}): string {
  switch (load.type) {
    case 'absolute':
      return load.weight ? `${load.weight.value}${load.weight.unit.toUpperCase()}` : '--'
    case 'percentageOf1RM':
      return load.percentage ? `${Math.round(load.percentage * 100)}% 1RM` : '--'
    case 'rpe':
      return load.target ? `RPE ${load.target}` : '--'
    case 'bodyweight':
      return 'BW'
    case 'bodyweightPlus':
      return load.additionalWeight
        ? `BW+${load.additionalWeight.value}${load.additionalWeight.unit.toUpperCase()}`
        : 'BW+'
    case 'percentMaxReps':
      return load.percentage ? `${Math.round(load.percentage * 100)}% MAX` : '--'
    case 'unspecified':
      return '--'
    default:
      return '--'
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}S`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins}:00`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Hook: batch-fetch full session templates for all IDs in the draft
// ---------------------------------------------------------------------------

function useSessionTemplatesFull(draft: ProgramDraft) {
  // Collect unique template IDs across all blocks/weeks/sessions
  const templateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const block of draft.blocks) {
      for (const week of block.weeks) {
        for (const session of week.sessions) {
          ids.add(session.sessionTemplateId)
        }
      }
    }
    return Array.from(ids)
  }, [draft])

  const results = useQueries({
    queries: templateIds.map((id) => ({
      queryKey: ['session-template-full', id],
      queryFn: () => getAdapter().getSessionTemplateFull(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // Build a map of id -> SessionTemplateFull
  return useMemo(() => {
    const map = new Map<string, SessionTemplateFull>()
    for (let i = 0; i < templateIds.length; i++) {
      const result = results[i]
      if (result.data) {
        map.set(templateIds[i], result.data)
      }
    }
    return map
  }, [templateIds, results])
}

// ---------------------------------------------------------------------------
// ProgramPreview
// ---------------------------------------------------------------------------

interface ProgramPreviewProps {
  draft: ProgramDraft
  open: boolean
  onClose: () => void
}

export function ProgramPreview({ draft, open, onClose }: ProgramPreviewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()

  // Fetch full template data for all referenced templates
  const sessionTemplates = useSessionTemplatesFull(draft)

  // Build exercise name lookup
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])

  const exerciseMaxes = profile?.exerciseMaxes ?? {}

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-none h-screen w-screen p-0 border-0 rounded-none bg-surface-anvil"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="h-full overflow-y-auto">
          <div className="flex items-center justify-between px-4 pt-6 pb-4">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-medium uppercase tracking-wider text-bone-white">
                {draft.name || 'UNTITLED PROGRAM'}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-surface-steel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bone-white">
                  {SOURCE_LABELS[draft.source] ?? draft.source}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="min-h-10 text-xs uppercase tracking-wider text-warm-ash hover:text-bone-white"
            >
              CLOSE PREVIEW
              <Icon name="close" size={16} />
            </Button>
          </div>

          {draft.description && (
            <div className="px-4 pb-4">
              <p className="text-sm text-warm-ash">{draft.description}</p>
            </div>
          )}

          <div className="flex flex-col gap-6 px-4 pb-8">
            {draft.blocks.map((block) => (
              <div key={block.clientId} className="bg-surface-iron">
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="font-display text-sm font-medium uppercase tracking-wider text-bone-white">
                    {block.name || 'UNTITLED BLOCK'}
                  </span>
                  <span className="bg-surface-steel px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bone-white">
                    {block.blockType}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                    {block.weeks.length} {block.weeks.length === 1 ? 'WEEK' : 'WEEKS'}
                  </span>
                </div>

                <div className="flex flex-col gap-4 px-3 pb-4">
                  {block.weeks.map((week, weekIdx) => {
                    const sessionsByDay = new Map(
                      week.sessions
                        .filter((s) => s.dayOfWeek !== null)
                        .map((s) => [s.dayOfWeek!, s]),
                    )

                    return (
                      <div key={week.clientId} className="flex flex-col gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                          WEEK {weekIdx + 1}
                        </span>

                        {/* 7-column day grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {DAY_COLUMNS.map((col) => (
                            <div
                              key={`hdr-${col.dayOfWeek}`}
                              className="text-center text-[10px] font-medium uppercase tracking-widest text-warm-ash/60"
                            >
                              {col.label}
                            </div>
                          ))}

                          {DAY_COLUMNS.map((col) => {
                            const session = sessionsByDay.get(col.dayOfWeek)

                            if (!session) {
                              return (
                                <div
                                  key={`cell-${col.dayOfWeek}`}
                                  className="min-h-[60px] bg-surface-charcoal"
                                />
                              )
                            }

                            return (
                              <div
                                key={`cell-${col.dayOfWeek}`}
                                className="flex min-h-[60px] flex-col bg-surface-charcoal p-1"
                              >
                                <span className="line-clamp-2 text-[9px] font-medium text-bone-white">
                                  {session.templateName ?? 'UNNAMED'}
                                </span>
                                <span className="mt-0.5 inline-block self-start bg-surface-steel px-1 py-0.5 text-[8px] font-medium uppercase tracking-wider text-warm-ash">
                                  {session.sessionType}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Session detail tables */}
                        {week.sessions
                          .filter((s) => s.dayOfWeek !== null)
                          .map((session) => {
                            const templateFull = sessionTemplates.get(session.sessionTemplateId)
                            if (!templateFull) return null

                            const groupedActivities = buildGroupedActivities(templateFull)
                            if (groupedActivities.length === 0) return null

                            return (
                              <div key={session.clientId} className="flex flex-col gap-0">
                                <div className="bg-surface-steel px-2 py-1.5">
                                  <span className="text-[10px] font-medium uppercase tracking-wider text-bone-white">
                                    {session.templateName ?? 'UNNAMED'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-surface-gunmetal px-2 py-1">
                                  <span className="text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    EXERCISE
                                  </span>
                                  <span className="text-right text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    SETS x REPS
                                  </span>
                                  <span className="w-20 text-right text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                                    LOAD
                                  </span>
                                </div>

                                {groupedActivities.map((activity, actIdx) => (
                                  <div
                                    key={`${session.clientId}-${actIdx}`}
                                    className={`grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 ${
                                      actIdx % 2 === 0 ? 'bg-surface-steel' : 'bg-surface-charcoal'
                                    }`}
                                  >
                                    <span className="text-xs text-bone-white">
                                      {exerciseMap.get(activity.exerciseId) ?? 'Unknown Exercise'}
                                    </span>
                                    <span className="text-right font-display text-xs text-bone-white">
                                      {formatSetsReps(activity.setScheme)}
                                    </span>
                                    <span className="w-20 text-right font-display text-xs text-bone-white">
                                      {formatLoad(
                                        activity.setScheme,
                                        exerciseMaxes,
                                        activity.exerciseId,
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helper: flatten template groups into ordered activities
// ---------------------------------------------------------------------------

function buildGroupedActivities(
  templateFull: SessionTemplateFull,
): Array<{ exerciseId: string; setScheme: SetScheme }> {
  const { groups, activities } = templateFull

  // Sort groups by ordinal
  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)

  const result: Array<{ exerciseId: string; setScheme: SetScheme }> = []

  for (const group of sortedGroups) {
    // Find activities belonging to this group, sorted by ordinal
    const groupActivities = activities
      .filter((a) => a.activityGroupId === group.id)
      .sort((a, b) => a.ordinal - b.ordinal)

    for (const activity of groupActivities) {
      result.push({
        exerciseId: activity.exerciseId,
        setScheme: activity.setScheme,
      })
    }
  }

  return result
}
