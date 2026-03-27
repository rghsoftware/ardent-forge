import { useCallback, useEffect, useRef } from 'react'
import {
  useActiveWorkoutStore,
  selectIsActive,
  type LoggedActivityGroupWithActivities,
  type LoggedActivityWithSets,
} from '@/stores/active-workout-store'
import {
  useCreateWorkoutLog,
  useCreateLoggedActivityGroup,
  useCreateLoggedActivity,
  useCreateLoggedSet,
  useUpdateLoggedSet,
  useUpdateWorkoutLog,
  useDeleteWorkoutLog,
} from '@/hooks/use-workout-logs'
import { getAdapter } from '@/lib/adapter'
import { DEFAULT_REST_SECONDS } from '@/lib/workout-utils'
import type {
  Exercise,
  GroupType,
  LoggedSet,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
} from '@/domain/types'

/**
 * useActiveWorkout -- bridge hook that wraps the Zustand active workout store
 * with TanStack Query mutations for DB persistence.
 *
 * Pattern: optimistic local state in Zustand, persisted via the data adapter
 * through TanStack Query mutation hooks.
 */
export function useActiveWorkout() {
  // ---------------------------------------------------------------------------
  // Zustand store slices
  // ---------------------------------------------------------------------------
  const workoutLog = useActiveWorkoutStore((s) => s.workoutLog)
  const loggedGroups = useActiveWorkoutStore((s) => s.loggedGroups)
  const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds)
  const restTimer = useActiveWorkoutStore((s) => s.restTimer)
  const undoAction = useActiveWorkoutStore((s) => s.undoAction)
  const isActive = useActiveWorkoutStore(selectIsActive)

  // Store actions (stable references from Zustand)
  const storeStartWorkout = useActiveWorkoutStore((s) => s.startWorkout)
  const storeResumeWorkout = useActiveWorkoutStore((s) => s.resumeWorkout)
  const storeAddExercise = useActiveWorkoutStore((s) => s.addExerciseToWorkout)
  const storeConfirmSet = useActiveWorkoutStore((s) => s.confirmSet)
  const storeUndoLastSet = useActiveWorkoutStore((s) => s.undoLastSet)
  const storeClearUndo = useActiveWorkoutStore((s) => s.clearUndo)
  const storeFinishWorkout = useActiveWorkoutStore((s) => s.finishWorkout)
  const storeDiscardWorkout = useActiveWorkoutStore((s) => s.discardWorkout)
  const storeStartRestTimer = useActiveWorkoutStore((s) => s.startRestTimer)
  const storeSkipRest = useActiveWorkoutStore((s) => s.skipRest)
  const storeAdjustRest = useActiveWorkoutStore((s) => s.adjustRest)

  // ---------------------------------------------------------------------------
  // TanStack Query mutations
  // ---------------------------------------------------------------------------
  const createWorkoutLogMutation = useCreateWorkoutLog()
  const createLoggedActivityGroupMutation = useCreateLoggedActivityGroup()
  const createLoggedActivityMutation = useCreateLoggedActivity()
  const createLoggedSetMutation = useCreateLoggedSet()
  const updateLoggedSetMutation = useUpdateLoggedSet()
  const updateWorkoutLogMutation = useUpdateWorkoutLog()
  const deleteWorkoutLogMutation = useDeleteWorkoutLog()

  // ---------------------------------------------------------------------------
  // Undo expiry timer
  // ---------------------------------------------------------------------------
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Clear previous undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }

    if (undoAction) {
      const remaining = undoAction.expiresAt - Date.now()
      if (remaining <= 0) {
        storeClearUndo()
      } else {
        undoTimerRef.current = setTimeout(() => {
          storeClearUndo()
        }, remaining)
      }
    }

    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
      }
    }
  }, [undoAction, storeClearUndo])

  // ---------------------------------------------------------------------------
  // Cleanup intervals on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      useActiveWorkoutStore.getState().cleanup()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Bridge actions: DB mutation + store update
  // ---------------------------------------------------------------------------

  /**
   * Start a new ad-hoc workout. Creates WorkoutLog in DB, then initializes
   * the Zustand store with the returned entity.
   */
  const startWorkout = useCallback(
    async (userId: string) => {
      try {
        const now = new Date().toISOString()
        const log = await createWorkoutLogMutation.mutateAsync({
          userId,
          startedAt: now,
        })
        storeStartWorkout(userId, log)
        return log
      } catch (err) {
        console.error('[workout] Failed to start workout:', { err })
        throw err
      }
    },
    [createWorkoutLogMutation, storeStartWorkout],
  )

  /**
   * Add an exercise to the active workout. Creates LoggedActivityGroup and
   * LoggedActivity in DB, then updates store.
   */
  const addExercise = useCallback(
    async (exercise: Exercise, groupType: GroupType) => {
      try {
        if (!workoutLog) {
          throw new Error('No active workout to add exercise to')
        }

        const userId = workoutLog.userId
        // Read ordinal from the store at call time to avoid stale closure
        const nextOrdinal = useActiveWorkoutStore.getState().loggedGroups.length + 1

        // Create the group in DB
        const groupData: Omit<LoggedActivityGroup, 'id'> = {
          workoutLogId: workoutLog.id,
          groupType,
          ordinal: nextOrdinal,
        }
        const savedGroup = await createLoggedActivityGroupMutation.mutateAsync({
          group: groupData,
          userId,
        })

        // Create the activity in DB (with compensating delete on failure)
        let savedActivity: LoggedActivity
        try {
          const activityData: Omit<LoggedActivity, 'id'> = {
            loggedGroupId: savedGroup.id,
            exerciseId: exercise.id,
            ordinal: 1,
          }
          savedActivity = await createLoggedActivityMutation.mutateAsync({
            activity: activityData,
            userId,
          })
        } catch (activityErr) {
          // Compensating delete of orphaned group (best effort)
          try {
            const adapter = getAdapter()
            await adapter.deleteWorkoutLog(savedGroup.id)
          } catch {
            // Best effort -- the group is orphaned but not critical
          }
          throw activityErr
        }

        // Update store with DB-assigned IDs
        storeAddExercise(exercise, groupType, savedGroup, savedActivity)

        return { group: savedGroup, activity: savedActivity }
      } catch (err) {
        console.error('[workout] Failed to add exercise:', {
          workoutId: workoutLog?.id,
          exerciseId: exercise.id,
          err,
        })
        throw err
      }
    },
    [workoutLog, createLoggedActivityGroupMutation, createLoggedActivityMutation, storeAddExercise],
  )

  /**
   * Confirm a set. Creates LoggedSet in DB, updates store, starts rest timer.
   *
   * Rest timer defaults to DEFAULT_REST_SECONDS (see docs/01-prd-core.md).
   */
  const confirmSet = useCallback(
    async (
      loggedActivityId: string,
      setData: Omit<LoggedSet, 'id'>,
      restSeconds: number = DEFAULT_REST_SECONDS,
    ) => {
      try {
        if (!workoutLog) {
          throw new Error('No active workout to confirm set in')
        }

        const savedSet = await createLoggedSetMutation.mutateAsync({
          ...setData,
          workoutLogId: workoutLog.id,
          userId: workoutLog.userId,
        })

        storeConfirmSet(loggedActivityId, savedSet)
        storeStartRestTimer(restSeconds)

        return savedSet
      } catch (err) {
        console.error('[workout] Failed to confirm set:', {
          workoutId: workoutLog?.id,
          loggedActivityId,
          err,
        })
        throw err
      }
    },
    [workoutLog, createLoggedSetMutation, storeConfirmSet, storeStartRestTimer],
  )

  /**
   * Undo the last confirmed set. Sets the set's completed flag to false in
   * the DB (row is retained), but removes it from the in-memory store.
   */
  const undoSet = useCallback(async () => {
    try {
      if (!workoutLog || !undoAction) return

      // Find the set in local state to get its full data for the update
      const currentGroups = useActiveWorkoutStore.getState().loggedGroups
      const targetSet = findSetById(currentGroups, undoAction.setId)
      if (!targetSet) return

      // Mark as uncompleted in DB
      await updateLoggedSetMutation.mutateAsync({
        ...targetSet,
        completed: false,
        workoutLogId: workoutLog.id,
        userId: workoutLog.userId,
      })

      storeUndoLastSet()
    } catch (err) {
      console.error('[workout] Failed to undo set:', {
        workoutId: workoutLog?.id,
        setId: undoAction?.setId,
        err,
      })
      throw err
    }
  }, [workoutLog, undoAction, updateLoggedSetMutation, storeUndoLastSet])

  /**
   * Finish the active workout. Updates WorkoutLog.completedAt in DB, clears store.
   */
  const finishWorkout = useCallback(async () => {
    try {
      if (!workoutLog) {
        throw new Error('No active workout to finish')
      }

      const now = new Date().toISOString()
      await updateWorkoutLogMutation.mutateAsync({
        ...workoutLog,
        completedAt: now,
      })

      storeFinishWorkout()
    } catch (err) {
      console.error('[workout] Failed to finish workout:', {
        workoutId: workoutLog?.id,
        err,
      })
      throw err
    }
  }, [workoutLog, updateWorkoutLogMutation, storeFinishWorkout])

  /**
   * Resume a workout from DB. Loads full workout data and hydrates the store.
   */
  const resumeWorkout = useCallback(
    (fullWorkout: {
      log: WorkoutLog
      groups: LoggedActivityGroup[]
      activities: LoggedActivity[]
      sets: LoggedSet[]
    }) => {
      // Build nested structure: groups > activities > sets
      const nestedGroups: LoggedActivityGroupWithActivities[] = fullWorkout.groups.map((group) => {
        const groupActivities = fullWorkout.activities.filter((a) => a.loggedGroupId === group.id)
        const activitiesWithSets: LoggedActivityWithSets[] = groupActivities.map((activity) => ({
          ...activity,
          sets: fullWorkout.sets.filter((s) => s.loggedActivityId === activity.id),
        }))
        return {
          ...group,
          activities: activitiesWithSets,
        }
      })

      // Calculate elapsed seconds from startedAt
      const startedAt = new Date(fullWorkout.log.startedAt).getTime()
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)

      storeResumeWorkout(fullWorkout.log, nestedGroups, elapsed)
    },
    [storeResumeWorkout],
  )

  /**
   * Discard the active workout. Deletes the WorkoutLog from DB, clears store.
   */
  const discardWorkout = useCallback(async () => {
    try {
      if (!workoutLog) {
        throw new Error('No active workout to discard')
      }

      await deleteWorkoutLogMutation.mutateAsync(workoutLog.id)
      storeDiscardWorkout()
    } catch (err) {
      console.error('[workout] Failed to discard workout:', {
        workoutId: workoutLog?.id,
        err,
      })
      throw err
    }
  }, [workoutLog, deleteWorkoutLogMutation, storeDiscardWorkout])

  // ---------------------------------------------------------------------------
  // Return value
  // ---------------------------------------------------------------------------

  return {
    // State
    workoutLog,
    loggedGroups,
    elapsedSeconds,
    restTimer,
    undoAction,
    isActive,

    // Bridge actions (DB + store)
    startWorkout,
    addExercise,
    confirmSet,
    undoSet,
    finishWorkout,
    resumeWorkout,
    discardWorkout,

    // Store-only actions (no DB side-effects)
    skipRest: storeSkipRest,
    adjustRest: storeAdjustRest,
    clearUndo: storeClearUndo,

    // Mutation loading states for UI feedback
    isStarting: createWorkoutLogMutation.isPending,
    isAddingExercise:
      createLoggedActivityGroupMutation.isPending || createLoggedActivityMutation.isPending,
    isConfirmingSet: createLoggedSetMutation.isPending,
    isFinishing: updateWorkoutLogMutation.isPending,
    isDiscarding: deleteWorkoutLogMutation.isPending,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findSetById(
  groups: LoggedActivityGroupWithActivities[],
  setId: string,
): LoggedSet | undefined {
  for (const group of groups) {
    for (const activity of group.activities) {
      const found = activity.sets.find((s) => s.id === setId)
      if (found) return found
    }
  }
  return undefined
}
