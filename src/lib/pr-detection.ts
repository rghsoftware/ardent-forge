import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  UserProfile,
  PersonalRecord,
} from '@/domain/types'

/**
 * Detects personal records from a completed workout by comparing the actual
 * performance against the user's stored exercise maxes and max reps.
 *
 * Detection rules:
 * - Only completed sets are considered (warmup and drop sets are excluded)
 * - 1RM: heaviest weight where actualReps === 1, must exceed stored exerciseMaxes
 * - 3RM: heaviest weight where actualReps >= 3
 * - 5RM: heaviest weight where actualReps >= 5
 * - max-reps: highest actualReps on a bodyweight exercise, must exceed stored maxReps
 *
 * For 3RM/5RM, previousBest is always null since we don't track those separately.
 * For 1RM, previousBest comes from userProfile.exerciseMaxes.
 * For max-reps, previousBest comes from userProfile.maxReps.
 */
export function detectPersonalRecords(
  workout: {
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  },
  userProfile: UserProfile,
  exerciseNames: Record<string, string>,
): PersonalRecord[] {
  const { log, activities, sets } = workout

  // Build a lookup from loggedActivityId -> exerciseId
  const activityExerciseMap = new Map<string, string>()
  for (const activity of activities) {
    activityExerciseMap.set(activity.id, activity.exerciseId)
  }

  // Filter to only completed working sets (exclude WARMUP and DROP)
  const qualifyingSets = sets.filter(
    (s) => s.completed && s.setType !== 'WARMUP' && s.setType !== 'DROP',
  )

  // Group qualifying sets by exerciseId
  const setsByExercise = new Map<string, LoggedSet[]>()
  for (const set of qualifyingSets) {
    const exerciseId = activityExerciseMap.get(set.loggedActivityId)
    if (!exerciseId) continue

    const existing = setsByExercise.get(exerciseId)
    if (existing) {
      existing.push(set)
    } else {
      setsByExercise.set(exerciseId, [set])
    }
  }

  const records: PersonalRecord[] = []

  for (const [exerciseId, exerciseSets] of setsByExercise) {
    const exerciseName = exerciseNames[exerciseId] ?? 'Unknown Exercise'
    const storedMax = userProfile.exerciseMaxes?.[exerciseId]
    const storedMaxReps = userProfile.maxReps?.[exerciseId]

    // -- 1RM detection: heaviest weight where actualReps === 1 --
    const singleRepSets = exerciseSets.filter((s) => s.actualReps === 1 && s.actualWeight != null)
    if (singleRepSets.length > 0) {
      const best1RM = singleRepSets.reduce((max, s) =>
        s.actualWeight!.value > max.actualWeight!.value ? s : max,
      )
      const previousBest = storedMax?.weight?.value ?? null
      // Only record as PR if it exceeds the stored max (or no stored max exists)
      if (previousBest === null || best1RM.actualWeight!.value > previousBest) {
        records.push({
          exerciseId,
          exerciseName,
          type: '1RM',
          value: best1RM.actualWeight!.value,
          unit: best1RM.actualWeight!.unit,
          previousBest,
          workoutLogId: log.id,
        })
      }
    }

    // -- 3RM detection: heaviest weight where actualReps >= 3 --
    const threeRepSets = exerciseSets.filter(
      (s) => s.actualReps != null && s.actualReps >= 3 && s.actualWeight != null,
    )
    if (threeRepSets.length > 0) {
      const best3RM = threeRepSets.reduce((max, s) =>
        s.actualWeight!.value > max.actualWeight!.value ? s : max,
      )
      records.push({
        exerciseId,
        exerciseName,
        type: '3RM',
        value: best3RM.actualWeight!.value,
        unit: best3RM.actualWeight!.unit,
        previousBest: null,
        workoutLogId: log.id,
      })
    }

    // -- 5RM detection: heaviest weight where actualReps >= 5 --
    const fiveRepSets = exerciseSets.filter(
      (s) => s.actualReps != null && s.actualReps >= 5 && s.actualWeight != null,
    )
    if (fiveRepSets.length > 0) {
      const best5RM = fiveRepSets.reduce((max, s) =>
        s.actualWeight!.value > max.actualWeight!.value ? s : max,
      )
      records.push({
        exerciseId,
        exerciseName,
        type: '5RM',
        value: best5RM.actualWeight!.value,
        unit: best5RM.actualWeight!.unit,
        previousBest: null,
        workoutLogId: log.id,
      })
    }

    // -- max-reps detection: highest reps on bodyweight exercise (no weight) --
    const bodyweightSets = exerciseSets.filter(
      (s) => s.actualReps != null && s.actualWeight == null,
    )
    if (bodyweightSets.length > 0) {
      const bestReps = bodyweightSets.reduce((max, s) =>
        s.actualReps! > max.actualReps! ? s : max,
      )
      const previousBest = storedMaxReps ?? null
      // Only record as PR if it exceeds the stored max reps (or no stored value exists)
      if (previousBest === null || bestReps.actualReps! > previousBest) {
        records.push({
          exerciseId,
          exerciseName,
          type: 'max-reps',
          value: bestReps.actualReps!,
          unit: 'reps',
          previousBest,
          workoutLogId: log.id,
        })
      }
    }
  }

  return records
}
