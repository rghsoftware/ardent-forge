// src/lib/prescription-resolver.ts
// Resolves a SessionTemplateFull into pre-filled LoggedSet arrays so the
// Active Workout screen can present prescribed values before the user logs
// actual performance.

import type {
  LoggedSet,
  LoggedActivity,
  LoggedActivityGroup,
  Prescription,
  SetType,
  OneRepMax,
  Weight,
  Duration,
  SetScheme,
  LoadSpec,
  Activity,
  GroupType,
} from '@/domain/types'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import { calculateWorkingWeight } from '@/lib/plate-calculator'

// ---------------------------------------------------------------------------
// Public types -- pre-filled structures ready for the active workout store
// ---------------------------------------------------------------------------

export type PrefilledSet = Omit<LoggedSet, 'id' | 'loggedActivityId'>

export type PrefilledActivity = {
  activity: Omit<LoggedActivity, 'id' | 'loggedGroupId'>
  sets: PrefilledSet[]
}

export type PrefilledGroup = {
  group: Omit<LoggedActivityGroup, 'id' | 'workoutLogId'>
  activities: PrefilledActivity[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a 0-1 fraction to the whole-number percentage that calculateWorkingWeight expects. */
function fractionToPercent(fraction: number): number {
  return fraction * 100
}

/** Build a Weight value object. */
function makeWeight(value: number, unit: 'lb' | 'kg'): Weight {
  return { value, unit }
}

/** Build a Duration value object. */
function makeDuration(seconds: number): Duration {
  return { seconds }
}

/**
 * Resolve a LoadSpec into a prescribed weight (if possible).
 * Returns undefined when the load cannot be resolved to a concrete weight
 * (e.g. RPE, bodyweight, unspecified, or missing 1RM for percentage).
 */
function resolveLoadSpec(
  loadSpec: LoadSpec,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): { weight?: Weight; notes?: string; loadSpec?: LoadSpec } {
  switch (loadSpec.type) {
    case 'absolute':
      return { weight: loadSpec.weight }

    case 'percentageOf1RM': {
      const orm = exerciseMaxes[exerciseId]
      if (orm) {
        const calculated = calculateWorkingWeight(
          orm.weight.value,
          fractionToPercent(loadSpec.percentage),
          preferredUnit,
        )
        return { weight: makeWeight(calculated, preferredUnit) }
      }
      return { loadSpec, notes: 'No 1RM on file -- enter weight manually' }
    }

    case 'rpe':
      return { loadSpec, notes: `RPE ${loadSpec.target}` }

    case 'percentMaxReps':
      return { loadSpec }

    case 'bodyweight':
      return { loadSpec }

    case 'bodyweightPlus':
      return { weight: loadSpec.additionalWeight, loadSpec }

    case 'unspecified':
      return { loadSpec }
  }
}

/**
 * Extract a plain number from a value that could be a number or a NumberRange.
 * For ranges, uses the minimum value (conservative).
 */
function resolveNumberOrRange(value: number | { min: number; max: number }): number {
  if (typeof value === 'number') return value
  return value.min
}

/** Build a single pre-filled set (not yet completed). */
function makeSet(setNumber: number, setType: SetType, prescribed?: Prescription): PrefilledSet {
  return {
    setNumber,
    setType,
    prescribed,
    completed: false,
  }
}

// ---------------------------------------------------------------------------
// Per-variant resolvers
// ---------------------------------------------------------------------------

function resolveFixedSets(
  scheme: Extract<SetScheme, { type: 'fixedSets' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const setCount = resolveNumberOrRange(scheme.sets)
  const reps = resolveNumberOrRange(scheme.reps)
  const { weight, notes, loadSpec } = resolveLoadSpec(
    scheme.load,
    exerciseId,
    exerciseMaxes,
    preferredUnit,
  )

  return Array.from({ length: setCount }, (_, i) => {
    const isLast = i === setCount - 1
    const type: SetType = isLast && scheme.lastSetAMRAP ? 'AMRAP' : 'WORKING'
    return makeSet(i + 1, type, { reps, weight, notes, loadSpec })
  })
}

function resolvePercentageSets(
  scheme: Extract<SetScheme, { type: 'percentageSets' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const orm = exerciseMaxes[exerciseId]

  return Array.from({ length: scheme.sets }, (_, i) => {
    const isLast = i === scheme.sets - 1
    const type: SetType = isLast && scheme.lastSetAMRAP ? 'AMRAP' : 'WORKING'

    if (orm) {
      const calculated = calculateWorkingWeight(
        orm.weight.value,
        fractionToPercent(scheme.percentageOf1RM),
        preferredUnit,
      )
      return makeSet(i + 1, type, {
        weight: makeWeight(calculated, preferredUnit),
        reps: scheme.reps,
      })
    }

    return makeSet(i + 1, type, {
      reps: scheme.reps,
      notes: 'No 1RM on file -- enter weight manually',
    })
  })
}

function resolveWorkToMax(
  scheme: Extract<SetScheme, { type: 'workToMax' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const warmupPercentages = [50, 60, 70, 80, 90]
  const orm = exerciseMaxes[exerciseId]
  const targetReps = resolveNumberOrRange(scheme.targetRepRange)

  const sets: PrefilledSet[] = warmupPercentages.map((pct, i) => {
    if (orm) {
      const calculated = calculateWorkingWeight(orm.weight.value, pct, preferredUnit)
      return makeSet(i + 1, 'WARMUP', {
        weight: makeWeight(calculated, preferredUnit),
        reps: targetReps,
        notes: `${pct}% warm-up`,
      })
    }
    return makeSet(i + 1, 'WARMUP', {
      reps: targetReps,
      notes: `${pct}% warm-up -- no 1RM on file`,
    })
  })

  // Peak attempt set
  sets.push(
    makeSet(warmupPercentages.length + 1, 'PEAK', {
      reps: targetReps,
      notes: 'Max attempt',
    }),
  )

  return sets
}

function resolveTimedHold(scheme: Extract<SetScheme, { type: 'timedHold' }>): PrefilledSet[] {
  return Array.from({ length: scheme.sets }, (_, i) =>
    makeSet(i + 1, 'WORKING', { duration: scheme.duration }),
  )
}

function resolveForReps(
  scheme: Extract<SetScheme, { type: 'forReps' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const prescribed: Prescription = { reps: scheme.targetReps }

  if (scheme.load) {
    const { weight, notes, loadSpec } = resolveLoadSpec(
      scheme.load,
      exerciseId,
      exerciseMaxes,
      preferredUnit,
    )
    if (weight) prescribed.weight = weight
    if (notes) prescribed.notes = notes
    if (loadSpec) prescribed.loadSpec = loadSpec
  }

  return [makeSet(1, 'WORKING', prescribed)]
}

function resolveCardioSteadyState(
  scheme: Extract<SetScheme, { type: 'cardioSteadyState' }>,
): PrefilledSet[] {
  const prescribed: Prescription = {
    notes: `${scheme.modality} steady state${scheme.intensityNotes ? ` -- ${scheme.intensityNotes}` : ''}`,
  }
  if (scheme.duration) prescribed.duration = scheme.duration
  if (scheme.distance) prescribed.distance = scheme.distance

  return [makeSet(1, 'WORKING', prescribed)]
}

function resolveCardioInterval(
  scheme: Extract<SetScheme, { type: 'cardioInterval' }>,
): PrefilledSet[] {
  return Array.from({ length: scheme.rounds }, (_, i) => {
    const prescribed: Prescription = {
      notes: `${scheme.modality} interval${scheme.intensityNotes ? ` -- ${scheme.intensityNotes}` : ''}`,
    }
    if (scheme.workDuration) prescribed.duration = scheme.workDuration
    if (scheme.workDistance) prescribed.distance = scheme.workDistance
    return makeSet(i + 1, 'WORKING', prescribed)
  })
}

function resolveRuckMarch(scheme: Extract<SetScheme, { type: 'ruckMarch' }>): PrefilledSet[] {
  const prescribed: Prescription = {
    weight: scheme.loadWeight,
    notes: `Ruck: ${scheme.loadWeight.value} ${scheme.loadWeight.unit}`,
  }
  if (scheme.duration) prescribed.duration = scheme.duration
  if (scheme.distance) prescribed.distance = scheme.distance

  return [makeSet(1, 'WORKING', prescribed)]
}

function resolveEmom(
  scheme: Extract<SetScheme, { type: 'emom' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const prescribed: Prescription = {
    reps: scheme.repsPerMinute,
    duration: makeDuration(scheme.totalMinutes * 60),
    notes: `EMOM ${scheme.totalMinutes} min -- ${scheme.repsPerMinute} reps/min`,
  }

  if (scheme.load) {
    const { weight, notes, loadSpec } = resolveLoadSpec(
      scheme.load,
      exerciseId,
      exerciseMaxes,
      preferredUnit,
    )
    if (weight) prescribed.weight = weight
    if (notes) prescribed.notes = `${prescribed.notes} (${notes})`
    if (loadSpec) prescribed.loadSpec = loadSpec
  }

  // One set per minute
  return Array.from({ length: scheme.totalMinutes }, (_, i) =>
    makeSet(i + 1, 'WORKING', prescribed),
  )
}

function resolveAmrapTimed(scheme: Extract<SetScheme, { type: 'amrapTimed' }>): PrefilledSet[] {
  return [
    makeSet(1, 'AMRAP', {
      duration: scheme.timeCap,
      notes: `AMRAP ${scheme.timeCap.seconds / 60} min`,
    }),
  ]
}

function resolveDescendingReps(
  scheme: Extract<SetScheme, { type: 'descendingReps' }>,
  exerciseId: string,
  exerciseMaxes: Record<string, OneRepMax>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  return scheme.repLadder.map((reps, i) => {
    const prescribed: Prescription = { reps }

    if (scheme.load) {
      const { weight, notes, loadSpec } = resolveLoadSpec(
        scheme.load,
        exerciseId,
        exerciseMaxes,
        preferredUnit,
      )
      if (weight) prescribed.weight = weight
      if (notes) prescribed.notes = notes
      if (loadSpec) prescribed.loadSpec = loadSpec
    }

    return makeSet(i + 1, 'WORKING', prescribed)
  })
}

function resolvePercentageOfMaxReps(
  scheme: Extract<SetScheme, { type: 'percentageOfMaxReps' }>,
  exerciseId: string,
  maxReps: Record<string, number>,
): PrefilledSet[] {
  const setCount = scheme.sets ?? 1
  const knownMax = maxReps[exerciseId]

  if (knownMax) {
    const targetReps = Math.round(knownMax * scheme.percentage)
    return Array.from({ length: setCount }, (_, i) =>
      makeSet(i + 1, 'WORKING', {
        reps: targetReps,
        notes: `${Math.round(scheme.percentage * 100)}% of max reps (${knownMax})`,
      }),
    )
  }

  return Array.from({ length: setCount }, (_, i) =>
    makeSet(i + 1, 'WORKING', {
      notes: `${Math.round(scheme.percentage * 100)}% of max reps -- no max reps on file`,
    }),
  )
}

// ---------------------------------------------------------------------------
// Main dispatcher: route each SetScheme variant to its resolver
// ---------------------------------------------------------------------------

function resolveSetsForActivity(
  activity: Activity,
  exerciseMaxes: Record<string, OneRepMax>,
  maxReps: Record<string, number>,
  preferredUnit: 'lb' | 'kg',
): PrefilledSet[] {
  const scheme = activity.setScheme
  const eid = activity.exerciseId

  switch (scheme.type) {
    case 'fixedSets':
      return resolveFixedSets(scheme, eid, exerciseMaxes, preferredUnit)
    case 'percentageSets':
      return resolvePercentageSets(scheme, eid, exerciseMaxes, preferredUnit)
    case 'workToMax':
      return resolveWorkToMax(scheme, eid, exerciseMaxes, preferredUnit)
    case 'timedHold':
      return resolveTimedHold(scheme)
    case 'forReps':
      return resolveForReps(scheme, eid, exerciseMaxes, preferredUnit)
    case 'cardioSteadyState':
      return resolveCardioSteadyState(scheme)
    case 'cardioInterval':
      return resolveCardioInterval(scheme)
    case 'ruckMarch':
      return resolveRuckMarch(scheme)
    case 'emom':
      return resolveEmom(scheme, eid, exerciseMaxes, preferredUnit)
    case 'amrapTimed':
      return resolveAmrapTimed(scheme)
    case 'descendingReps':
      return resolveDescendingReps(scheme, eid, exerciseMaxes, preferredUnit)
    case 'percentageOfMaxReps':
      return resolvePercentageOfMaxReps(scheme, eid, maxReps)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a full session template into pre-filled groups, activities, and sets.
 *
 * The output is ready to be inserted into the active workout store. Each set
 * carries a `prescribed` field describing what the program calls for; the
 * `actual*` fields remain undefined until the user logs performance.
 */
export function resolveSessionTemplate(
  templateFull: SessionTemplateFull,
  exerciseMaxes: Record<string, OneRepMax>,
  maxReps: Record<string, number>,
  preferredUnit: 'lb' | 'kg',
): PrefilledGroup[] {
  const { groups, activities } = templateFull

  // Build a lookup: groupId -> activities (sorted by ordinal)
  const activitiesByGroup = new Map<string, Activity[]>()
  for (const act of activities) {
    const list = activitiesByGroup.get(act.activityGroupId) ?? []
    list.push(act)
    activitiesByGroup.set(act.activityGroupId, list)
  }
  for (const list of activitiesByGroup.values()) {
    list.sort((a, b) => a.ordinal - b.ordinal)
  }

  // Sort groups by ordinal, then resolve each one
  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)

  return sortedGroups.map((group) => {
    const groupActivities = activitiesByGroup.get(group.id) ?? []

    const prefilledActivities: PrefilledActivity[] = groupActivities.map((act) => {
      const sets = resolveSetsForActivity(act, exerciseMaxes, maxReps, preferredUnit)
      return {
        activity: {
          exerciseId: act.exerciseId,
          ordinal: act.ordinal,
          notes: act.notes,
        },
        sets,
      }
    })

    return {
      group: {
        groupType: group.groupType as GroupType,
        ordinal: group.ordinal,
        actualRoundsCompleted: undefined,
        completionTime: undefined,
      },
      activities: prefilledActivities,
    }
  })
}
