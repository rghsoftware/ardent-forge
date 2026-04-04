import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import { getAdapter } from '@/lib/adapter'
import { DAY_ABBREVIATIONS } from './constants'
import type { DayOfWeek } from './constants'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import type { SetScheme } from '@/domain/types'
import type { SessionDraft } from './builder-state'

// ---------------------------------------------------------------------------
// Set scheme formatting helpers
// ---------------------------------------------------------------------------

export function formatSetsReps(scheme: SetScheme): string {
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

export function formatLoad(
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

export function formatLoadSpec(load: {
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

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}S`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins}:00`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Helper: flatten template groups into ordered activities
// ---------------------------------------------------------------------------

export function buildGroupedActivities(
  templateFull: SessionTemplateFull,
): Array<{ exerciseId: string; setScheme: SetScheme }> {
  const { groups, activities } = templateFull
  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)
  const result: Array<{ exerciseId: string; setScheme: SetScheme }> = []

  for (const group of sortedGroups) {
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

// ---------------------------------------------------------------------------
// Hook: batch-fetch full session templates by ID
// ---------------------------------------------------------------------------

export function useSessionTemplatesFull(templateIds: string[]) {
  const results = useQueries({
    queries: templateIds.map((id) => ({
      queryKey: ['session-template-full', id],
      queryFn: () => getAdapter().getSessionTemplateFull(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    })),
  })

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
// Inline session type badge styles
// ---------------------------------------------------------------------------

const SESSION_TYPE_BADGE: Record<string, string> = {
  STRENGTH: 'bg-ember/10 text-ember',
  CONDITIONING: 'bg-quenched/10 text-quenched',
  SE: 'bg-arc/10 text-arc',
  MIXED: 'bg-bone-white/10 text-bone-white',
  EVENT: 'bg-ember/15 text-ember',
}

// ---------------------------------------------------------------------------
// WeekInlinePreview -- session exercise details rendered inline
// ---------------------------------------------------------------------------

interface WeekInlinePreviewProps {
  sessions: SessionDraft[]
}

export function WeekInlinePreview({ sessions }: WeekInlinePreviewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()

  const templateIds = useMemo(
    () => [
      ...new Set(sessions.filter((s) => s.dayOfWeek !== null).map((s) => s.sessionTemplateId)),
    ],
    [sessions],
  )
  const templates = useSessionTemplatesFull(templateIds)
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const exerciseMaxes = profile?.exerciseMaxes ?? {}

  const assigned = useMemo(() => {
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    return sessions
      .filter((s) => s.dayOfWeek !== null)
      .sort((a, b) => dayOrder.indexOf(a.dayOfWeek!) - dayOrder.indexOf(b.dayOfWeek!))
  }, [sessions])

  if (assigned.length === 0) return null

  const isLoading = templateIds.length > 0 && templates.size === 0

  if (isLoading) {
    return (
      <div className="py-2 text-center text-[11px] text-warm-ash/40">
        Loading session details...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-warm-ash/10 pt-2">
      {assigned.map((session) => {
        const templateFull = templates.get(session.sessionTemplateId)
        if (!templateFull) return null

        const dayLabel = DAY_ABBREVIATIONS[session.dayOfWeek as DayOfWeek]

        if (session.sessionType === 'EVENT') {
          const eventMeta = templateFull.template.eventMetadata
          return (
            <div
              key={session.clientId}
              className="border-l-2 border-ember bg-surface-charcoal px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
                  {dayLabel}
                </span>
                <Icon name="flag" size={10} fill className="shrink-0 text-ember" />
                <span className="font-display text-[11px] font-medium uppercase tracking-wider text-ember">
                  {session.templateName ?? 'Unnamed'}
                </span>
              </div>
              {eventMeta?.eventDate && (
                <span className="mt-0.5 block text-[10px] tracking-wider text-warm-ash/70">
                  {new Date(eventMeta.eventDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          )
        }

        const activities = buildGroupedActivities(templateFull)
        if (activities.length === 0) return null

        return (
          <div key={session.clientId} className="flex flex-col">
            <div className="flex items-center gap-1.5 bg-surface-charcoal px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
                {dayLabel}
              </span>
              <span className="text-[11px] font-medium text-bone-white">
                {session.templateName ?? 'Unnamed'}
              </span>
              <span
                className={`px-1 py-px text-[9px] font-medium uppercase tracking-wider ${
                  SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'
                }`}
              >
                {session.sessionType}
              </span>
            </div>
            {activities.map((activity, idx) => (
              <div
                key={`${session.clientId}-${idx}`}
                className={`grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1 ${
                  idx % 2 === 0 ? 'bg-surface-gunmetal' : 'bg-surface-charcoal'
                }`}
              >
                <span className="text-[11px] text-bone-white/80">
                  {exerciseMap.get(activity.exerciseId) ?? 'Unknown'}
                </span>
                <span className="text-right font-display text-[11px] text-bone-white/80">
                  {formatSetsReps(activity.setScheme)}
                </span>
                <span className="w-16 text-right font-display text-[11px] text-bone-white/60">
                  {formatLoad(activity.setScheme, exerciseMaxes, activity.exerciseId)}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
