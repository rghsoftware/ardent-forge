import type { DisplaySnapshot, DisplaySet, RestTimerState } from '@/domain/types/display-snapshot'
import type { SessionType } from '@/domain/types/session'
import type {
  LoggedActivityGroupWithActivities,
  LoggedActivityWithSets,
} from '@/stores/active-workout-store'
import type { WorkoutLog } from '@/domain/types/workout-log'

// ---------------------------------------------------------------------------
// SnapshotContext -- external data the builder needs but cannot derive from
// the active-workout store alone (user info, exercise name resolution, etc.)
// ---------------------------------------------------------------------------

export interface SnapshotContext {
  userId: string
  displayName: string
  exerciseNameMap: Record<string, string>
  sessionType: SessionType
}

// ---------------------------------------------------------------------------
// Internal: state subset consumed by buildDisplaySnapshot
// Mirrors ActiveWorkoutState shape without coupling to Zustand store directly.
// ---------------------------------------------------------------------------

interface SnapshotSourceState {
  workoutLog: WorkoutLog | null
  loggedGroups: LoggedActivityGroupWithActivities[]
  restTimer: { remaining: number; total: number } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten all activities across every group into a single ordered list. */
function flattenActivities(
  groups: LoggedActivityGroupWithActivities[],
): LoggedActivityWithSets[] {
  return groups.flatMap((g) => g.activities)
}

/** Convert a LoggedSet into the DisplaySet wire format. */
function toDisplaySet(loggedSet: {
  setNumber: number
  prescribed?: {
    reps?: number
    weight?: { value: number; unit: string }
  }
  actualReps?: number
  actualWeight?: { value: number; unit: string }
  completed: boolean
}): DisplaySet {
  const ds: DisplaySet = {
    set_number: loggedSet.setNumber,
    completed: loggedSet.completed,
  }

  if (
    loggedSet.prescribed &&
    loggedSet.prescribed.reps !== undefined &&
    loggedSet.prescribed.weight !== undefined
  ) {
    ds.prescribed = {
      reps: loggedSet.prescribed.reps,
      weight: {
        value: loggedSet.prescribed.weight.value,
        unit: loggedSet.prescribed.weight.unit,
      },
    }
  }

  if (loggedSet.actualReps !== undefined && loggedSet.actualWeight !== undefined) {
    ds.actual = {
      reps: loggedSet.actualReps,
      weight: {
        value: loggedSet.actualWeight.value,
        unit: loggedSet.actualWeight.unit,
      },
    }
  }

  return ds
}

/** Derive a RestTimerState from the store's rest timer shape. */
function toRestTimerState(
  restTimer: { remaining: number; total: number } | null,
): RestTimerState {
  if (!restTimer) {
    return { state: 'idle' as const }
  }

  const elapsedSeconds = restTimer.total - restTimer.remaining
  const startedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString()

  return {
    state: 'running' as const,
    started_at: startedAt,
    total_seconds: restTimer.total,
  }
}

// ---------------------------------------------------------------------------
// buildDisplaySnapshot
// ---------------------------------------------------------------------------

/**
 * Pure function that projects the active-workout store state plus external
 * context into a DisplaySnapshot suitable for broadcast to remote displays.
 *
 * Precondition: the caller must verify that `state.workoutLog` is non-null
 * and that the user has opted in to display broadcasting before calling.
 *
 * @throws {Error} if state.workoutLog is null (safety guard)
 */
export function buildDisplaySnapshot(
  state: SnapshotSourceState,
  context: SnapshotContext,
): DisplaySnapshot {
  if (!state.workoutLog) {
    throw new Error('buildDisplaySnapshot requires an active workout (workoutLog must not be null)')
  }

  const allActivities = flattenActivities(state.loggedGroups)
  const totalExercises = Math.max(allActivities.length, 1)

  // Current exercise is the last activity in the last group (most recently active).
  // Falls back to sensible defaults when no activities exist yet.
  const currentActivity = allActivities.length > 0
    ? allActivities[allActivities.length - 1]
    : null

  const currentExerciseName = currentActivity
    ? (context.exerciseNameMap[currentActivity.exerciseId] ?? 'Unknown Exercise')
    : 'No Exercise'

  // exercise_index is 0-based position of the current activity in the flat list
  const exerciseIndex = allActivities.length > 0
    ? allActivities.length - 1
    : 0

  // Map the current activity's sets to the DisplaySet wire format
  const sets: DisplaySet[] = currentActivity
    ? currentActivity.sets.map(toDisplaySet)
    : []

  return {
    user_id: context.userId,
    display_name: context.displayName,
    session_name: state.workoutLog.title ?? 'Ad Hoc Workout',
    workout_started_at: state.workoutLog.startedAt,
    current_exercise: currentExerciseName,
    exercise_index: exerciseIndex,
    total_exercises: totalExercises,
    sets,
    rest_timer: toRestTimerState(state.restTimer),
    session_type: context.sessionType,
    is_visible: true,
  }
}
