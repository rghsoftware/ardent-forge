import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { SetScheme } from '@/domain/types'
import type { SessionTemplateFull } from '@/lib/data-adapter'

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
