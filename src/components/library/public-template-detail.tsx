import { Icon } from '@/components/icon'
import { useSessionTemplateFull } from '@/hooks/use-session-templates'
import { useProfile } from '@/hooks/use-profile'
import { useExercises } from '@/hooks/use-exercises'
import { formatLabel } from '@/lib/utils'
import { SESSION_TYPE_BADGE } from '@/components/program-builder/constants'
import type { SetScheme } from '@/domain/types/set-scheme'
import type { ScoringType, GroupType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicTemplateDetailProps {
  templateId: string
  onBack: () => void
  onClone?: () => void
  isCloning?: boolean
}

// ---------------------------------------------------------------------------
// Display constants
// ---------------------------------------------------------------------------

const SCORING_LABELS = {
  NONE: null,
  FOR_TIME: 'For time',
  TIME: 'Time',
  FOR_REPS: 'For reps',
  ROUNDS_PLUS_REPS: 'Rounds + Reps',
  FOR_DISTANCE: 'For distance',
  LOAD: 'Load',
} satisfies Record<ScoringType, string | null>

const GROUP_TYPE_BADGE = {
  STRAIGHT_SETS: 'bg-surface-gunmetal text-bone-white',
  SUPERSET: 'bg-ember/10 text-ember',
  CIRCUIT: 'bg-quenched/10 text-quenched',
  COMPLEX: 'bg-arc/10 text-arc',
  EMOM: 'bg-forge/10 text-forge',
  AMRAP: 'bg-forge/10 text-forge',
  COUPLET: 'bg-ember/10 text-ember',
} satisfies Record<GroupType, string>

// ---------------------------------------------------------------------------
// Set scheme summary helper
// ---------------------------------------------------------------------------

function formatNumberRange(val: unknown): string {
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
    const r = val as { min: number; max: number }
    return `${r.min}-${r.max}`
  }
  return '--'
}

function formatLoadSpec(load: Record<string, unknown>): string {
  switch (load.type) {
    case 'absolute': {
      const w = load.weight as { value: number; unit: string }
      return `${w.value}${w.unit}`
    }
    case 'percentageOf1RM':
      return `${Math.round((load.percentage as number) * 100)}% 1RM`
    case 'rpe':
      return `RPE ${load.target}`
    case 'percentMaxReps':
      return `${Math.round((load.percentage as number) * 100)}% max reps`
    case 'bodyweight':
      return 'BW'
    case 'bodyweightPlus': {
      const w = load.additionalWeight as { value: number; unit: string }
      return `BW + ${w.value}${w.unit}`
    }
    case 'unspecified':
      return '--'
    default:
      return '--'
  }
}

function summarizeSetScheme(scheme: SetScheme): string {
  switch (scheme.type) {
    case 'fixedSets': {
      const sets = formatNumberRange(scheme.sets)
      const reps = formatNumberRange(scheme.reps)
      const load = scheme.load
        ? formatLoadSpec(scheme.load as unknown as Record<string, unknown>)
        : ''
      const amrap = scheme.lastSetAMRAP ? ' (last AMRAP)' : ''
      return `${sets} x ${reps}${load ? ` @ ${load}` : ''}${amrap}`
    }
    case 'percentageSets': {
      const pct = Math.round(scheme.percentageOf1RM * 100)
      const amrap = scheme.lastSetAMRAP ? ' (last AMRAP)' : ''
      return `${scheme.sets} x ${scheme.reps} @ ${pct}% 1RM${amrap}`
    }
    case 'workToMax':
      return `Work to ${scheme.targetRepRange.min}-${scheme.targetRepRange.max} RM`
    case 'timedHold':
      return `${scheme.sets} x ${scheme.duration.seconds}s hold`
    case 'forReps': {
      const load = scheme.load
        ? ` @ ${formatLoadSpec(scheme.load as unknown as Record<string, unknown>)}`
        : ''
      return `${scheme.targetReps} reps${load}`
    }
    case 'cardioSteadyState': {
      const parts: string[] = []
      if (scheme.duration) parts.push(`${Math.round(scheme.duration.seconds / 60)} min`)
      if (scheme.distance) parts.push(`${scheme.distance.value} ${scheme.distance.unit}`)
      return `${formatLabel(scheme.modality)}: ${parts.join(' / ') || '--'}`
    }
    case 'cardioInterval': {
      const work = scheme.workDuration
        ? `${scheme.workDuration.seconds}s`
        : scheme.workDistance
          ? `${scheme.workDistance.value} ${scheme.workDistance.unit}`
          : '--'
      return `${scheme.rounds} x ${work} / ${scheme.rest.seconds}s rest`
    }
    case 'ruckMarch': {
      const parts: string[] = [`${scheme.loadWeight.value}${scheme.loadWeight.unit}`]
      if (scheme.duration) parts.push(`${Math.round(scheme.duration.seconds / 60)} min`)
      if (scheme.distance) parts.push(`${scheme.distance.value} ${scheme.distance.unit}`)
      return `Ruck: ${parts.join(' / ')}`
    }
    case 'emom':
      return `EMOM ${scheme.totalMinutes} min: ${scheme.repsPerMinute} reps/min`
    case 'amrapTimed':
      return `AMRAP ${Math.round(scheme.timeCap.seconds / 60)} min`
    case 'descendingReps':
      return `Descending: ${scheme.repLadder.join('-')}`
    case 'percentageOfMaxReps': {
      const pct = Math.round(scheme.percentage * 100)
      const sets = scheme.sets ? `${scheme.sets} x ` : ''
      return `${sets}${pct}% max reps`
    }
    default:
      return '--'
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton() {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
        <div className="flex animate-pulse flex-col gap-6">
          <div className="h-5 w-24 bg-surface-iron" />
          <div className="h-8 w-64 bg-surface-iron" />
          <div className="h-4 w-40 bg-surface-iron" />
          <div className="h-4 w-80 bg-surface-iron" />
          <div className="h-32 w-full bg-surface-iron" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicTemplateDetail({
  templateId,
  onBack,
  onClone,
  isCloning = false,
}: PublicTemplateDetailProps) {
  const { data, isLoading, isError } = useSessionTemplateFull(templateId)
  const displayName = useProfile(data?.template.userId)
  const { data: exercises } = useExercises()

  // Build exercise name lookup
  const exerciseNameMap = new Map(exercises?.map((e) => [e.id, e.name]) ?? [])

  // Loading state
  if (isLoading) return <Skeleton />

  // Error state
  if (isError || !data) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
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
              Failed to load template. It may have been removed or made private.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { template, groups, activities } = data
  const scoringLabel = SCORING_LABELS[template.scoring]

  // Group activities by their activityGroupId
  const activitiesByGroup = new Map<string, typeof activities>()
  for (const activity of activities) {
    const existing = activitiesByGroup.get(activity.activityGroupId) ?? []
    existing.push(activity)
    activitiesByGroup.set(activity.activityGroupId, existing)
  }

  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 lg:px-8">
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

          {/* Template header */}
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-medium text-bone-white">{template.name}</h1>

            {/* Author attribution */}
            {displayName.data && <p className="text-xs text-warm-ash">By {displayName.data}</p>}

            {/* Category badge + scoring */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 uppercase tracking-widest ${SESSION_TYPE_BADGE[template.category] ?? 'bg-surface-steel text-warm-ash'}`}
              >
                {formatLabel(template.category)}
              </span>
              {scoringLabel && <span className="text-[11px] text-warm-ash/60">{scoringLabel}</span>}
            </div>

            {/* Time cap and rest */}
            {(template.timeCap || template.restBetweenGroups) && (
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {template.timeCap && (
                  <span className="text-xs text-warm-ash">
                    Time cap: {formatDuration(template.timeCap.seconds)}
                  </span>
                )}
                {template.restBetweenGroups && (
                  <span className="text-xs text-warm-ash">
                    Rest between groups: {formatDuration(template.restBetweenGroups.seconds)}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {template.description && (
              <p className="text-sm text-warm-ash mt-1">{template.description}</p>
            )}
          </div>

          {/* Activity groups */}
          {sortedGroups.length === 0 ? (
            <p className="text-sm text-warm-ash/40 italic">No activity groups defined</p>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-xs font-medium uppercase tracking-widest text-warm-ash">
                ACTIVITY GROUPS
              </h2>

              {sortedGroups.map((group) => {
                const groupActivities = (activitiesByGroup.get(group.id) ?? []).sort(
                  (a, b) => a.ordinal - b.ordinal,
                )

                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    {/* Group header */}
                    <div className="flex items-center gap-2 bg-surface-iron px-4 py-3">
                      <span className="text-[11px] text-warm-ash/60">#{group.ordinal}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 uppercase tracking-widest ${GROUP_TYPE_BADGE[group.groupType]}`}
                      >
                        {formatLabel(group.groupType)}
                      </span>
                      {group.rounds != null && group.rounds > 1 && (
                        <span className="text-[11px] text-warm-ash/60">{group.rounds} rounds</span>
                      )}
                      {group.restBetweenRounds && (
                        <span className="text-[11px] text-warm-ash/40">
                          {formatDuration(group.restBetweenRounds.seconds)} rest between rounds
                        </span>
                      )}
                    </div>

                    {/* Activities */}
                    {groupActivities.length === 0 ? (
                      <span className="text-xs text-warm-ash/40 italic pl-4">No activities</span>
                    ) : (
                      groupActivities.map((activity, idx) => (
                        <div
                          key={activity.id}
                          className={`flex flex-col gap-1 px-4 py-2.5 ${
                            idx % 2 === 0 ? 'bg-surface-charcoal' : 'bg-surface-iron'
                          }`}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-sm tabular-nums text-warm-ash/60 w-5 text-center">
                              {activity.ordinal}
                            </span>
                            <span className="text-sm font-medium text-bone-white">
                              {exerciseNameMap.get(activity.exerciseId) ??
                                activity.exerciseId.slice(0, 8)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pl-7">
                            <span className="text-xs tabular-nums text-warm-ash">
                              {summarizeSetScheme(activity.setScheme)}
                            </span>
                          </div>
                          {activity.notes && (
                            <p className="text-xs text-warm-ash/50 italic pl-7">{activity.notes}</p>
                          )}
                        </div>
                      ))
                    )}
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
