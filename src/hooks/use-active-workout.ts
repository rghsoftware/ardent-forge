import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import { computeNextProgramPosition } from '@/lib/program-advancement'
import { resolveSessionTemplate } from '@/lib/prescription-resolver'
import { applyOverrides } from '@/lib/override-merger'
import type {
  Exercise,
  GroupType,
  LoggedSet,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  ProgramContext,
  SessionOverrides,
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
  const storeStartProgrammedWorkout = useActiveWorkoutStore((s) => s.startProgrammedWorkout)
  const storeResumeWorkout = useActiveWorkoutStore((s) => s.resumeWorkout)
  const storeAddExercise = useActiveWorkoutStore((s) => s.addExerciseToWorkout)
  const storeConfirmSet = useActiveWorkoutStore((s) => s.confirmSet)
  const storeUpdateSetInPlace = useActiveWorkoutStore((s) => s.updateSetInPlace)
  const storeUndoLastSet = useActiveWorkoutStore((s) => s.undoLastSet)
  const storeClearUndo = useActiveWorkoutStore((s) => s.clearUndo)
  const storeFinishWorkout = useActiveWorkoutStore((s) => s.finishWorkout)
  const storeDiscardWorkout = useActiveWorkoutStore((s) => s.discardWorkout)
  const storeStartRestTimer = useActiveWorkoutStore((s) => s.startRestTimer)
  const storeSkipRest = useActiveWorkoutStore((s) => s.skipRest)
  const storeAdjustRest = useActiveWorkoutStore((s) => s.adjustRest)
  const storePauseWorkout = useActiveWorkoutStore((s) => s.pauseWorkout)
  const storeUnpauseWorkout = useActiveWorkoutStore((s) => s.unpauseWorkout)

  // ---------------------------------------------------------------------------
  // TanStack Query client (for manual invalidation after program advancement)
  // ---------------------------------------------------------------------------
  const queryClient = useQueryClient()

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
  // Note: elapsed timer interval is owned by the workout log page (Tech.md D-1).
  // Rest timer cleanup is handled by finishWorkout/discardWorkout in the store.
  // We intentionally do NOT run store.cleanup() on unmount here: this hook is
  // consumed by multiple pages (Forge, log page) and Forge→log navigation
  // unmounts Forge mid-workout, which previously killed timers.
  // ---------------------------------------------------------------------------

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
          totalPausedMs: 0,
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
   * Start a programmed workout from a session template. Resolves the template
   * into pre-filled groups/activities/sets, persists everything to DB, and
   * hydrates the Zustand store.
   */
  const startProgrammedWorkout = useCallback(
    async (
      userId: string,
      sessionTemplateId: string,
      programContext: ProgramContext,
      overrides?: SessionOverrides | null,
    ): Promise<WorkoutLog> => {
      try {
        const adapter = getAdapter()

        // 1. Fetch the full session template and user profile in parallel
        const [templateFull, userProfile] = await Promise.all([
          adapter.getSessionTemplateFull(sessionTemplateId),
          adapter.getUserProfile(userId),
        ])

        if (!templateFull) {
          throw new Error(`Session template not found: ${sessionTemplateId}`)
        }

        // 2. Resolve the template into pre-filled groups/activities/sets
        const exerciseMaxes = userProfile?.exerciseMaxes ?? {}
        const maxReps = userProfile?.maxReps ?? {}
        const preferredUnit: 'lb' | 'kg' = userProfile?.preferredUnits === 'METRIC' ? 'kg' : 'lb'

        const resolvedGroups = resolveSessionTemplate(
          templateFull,
          exerciseMaxes,
          maxReps,
          preferredUnit,
        )

        // 2b. Apply per-instance overrides (exercise swaps, set scheme changes)
        const prefilledGroups = applyOverrides(resolvedGroups, overrides, {
          exerciseMaxes,
          maxReps,
          preferredUnit,
        })

        // 3. Create WorkoutLog in DB with template and program context
        const now = new Date().toISOString()
        const log = await createWorkoutLogMutation.mutateAsync({
          userId,
          title: templateFull.template.name,
          startedAt: now,
          sessionTemplateId,
          programContext,
          totalPausedMs: 0,
        })

        // 4. Persist all groups, activities, and sets to DB and build
        //    the nested structure for the store
        const nestedGroups: LoggedActivityGroupWithActivities[] = []

        for (const prefilled of prefilledGroups) {
          // Create the group
          const savedGroup = await createLoggedActivityGroupMutation.mutateAsync({
            group: {
              workoutLogId: log.id,
              groupType: prefilled.group.groupType,
              ordinal: prefilled.group.ordinal,
            },
            userId,
          })

          const activitiesWithSets: LoggedActivityWithSets[] = []

          for (const prefilledActivity of prefilled.activities) {
            // Create the activity
            const savedActivity = await createLoggedActivityMutation.mutateAsync({
              activity: {
                loggedGroupId: savedGroup.id,
                exerciseId: prefilledActivity.activity.exerciseId,
                ordinal: prefilledActivity.activity.ordinal,
                notes: prefilledActivity.activity.notes,
              },
              userId,
            })

            // Create all pre-filled sets for this activity
            const savedSets: LoggedSet[] = []
            for (const prefilledSet of prefilledActivity.sets) {
              const savedSet = await createLoggedSetMutation.mutateAsync({
                ...prefilledSet,
                loggedActivityId: savedActivity.id,
                workoutLogId: log.id,
                userId,
              })
              savedSets.push(savedSet)
            }

            activitiesWithSets.push({
              ...savedActivity,
              sets: savedSets,
            })
          }

          nestedGroups.push({
            ...savedGroup,
            activities: activitiesWithSets,
          })
        }

        // 5. Hydrate the store with the created workout and pre-filled structure
        storeStartProgrammedWorkout(log, nestedGroups)

        return log
      } catch (err) {
        console.error('[workout] Failed to start programmed workout:', {
          sessionTemplateId,
          err,
        })
        throw err
      }
    },
    [
      createWorkoutLogMutation,
      createLoggedActivityGroupMutation,
      createLoggedActivityMutation,
      createLoggedSetMutation,
      storeStartProgrammedWorkout,
    ],
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

        // TODO: No deleteLoggedActivityGroup on adapter yet -- orphaned group will be cleaned up by next full workout delete
        const activityData: Omit<LoggedActivity, 'id'> = {
          loggedGroupId: savedGroup.id,
          exerciseId: exercise.id,
          ordinal: 1,
        }
        const savedActivity = await createLoggedActivityMutation.mutateAsync({
          activity: activityData,
          userId,
        })

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
   * Confirm a set. For programmed workouts, updates an existing pre-filled set
   * in the DB; for ad-hoc workouts, creates a new set. Updates store and starts
   * the rest timer in both cases.
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

        const currentGroups = useActiveWorkoutStore.getState().loggedGroups
        const existingSet = findPrefilledSet(currentGroups, loggedActivityId, setData.setNumber)

        let savedSet: LoggedSet
        if (existingSet) {
          // Programmed path: update the existing pre-filled set
          savedSet = await updateLoggedSetMutation.mutateAsync({
            ...existingSet,
            ...setData,
            id: existingSet.id,
            completed: true,
            workoutLogId: workoutLog.id,
            userId: workoutLog.userId,
          })
          storeUpdateSetInPlace(loggedActivityId, savedSet)
        } else {
          // Ad-hoc path: create a new set
          savedSet = await createLoggedSetMutation.mutateAsync({
            ...setData,
            workoutLogId: workoutLog.id,
            userId: workoutLog.userId,
          })
          storeConfirmSet(loggedActivityId, savedSet)
        }

        // Skip the global rest timer for zero/negative values. CircuitPanel
        // and similar self-managed timer UIs pass 0 to suppress the duplicate.
        if (restSeconds > 0) {
          storeStartRestTimer(restSeconds)
        }

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
    [
      workoutLog,
      createLoggedSetMutation,
      updateLoggedSetMutation,
      storeConfirmSet,
      storeUpdateSetInPlace,
      storeStartRestTimer,
    ],
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
   * Finish the active workout. Updates WorkoutLog.completedAt in DB,
   * advances program position if this was a programmed workout, then clears store.
   *
   * Returns `{ advancementFailed: true }` if the workout was saved but program
   * advancement could not be completed (non-fatal).
   */
  const finishWorkout = useCallback(async (): Promise<{ advancementFailed?: boolean }> => {
    try {
      if (!workoutLog) {
        throw new Error('No active workout to finish')
      }

      const now = new Date().toISOString()
      await updateWorkoutLogMutation.mutateAsync({
        ...workoutLog,
        completedAt: now,
      })

      // Advance program position if this was a programmed workout
      // TODO: Currently advances per-session. When multi-session-per-week tracking is implemented,
      // this function will check if all sessions for the week are complete before advancing.
      if (workoutLog.programContext) {
        try {
          const adapter = getAdapter()
          const activation = await adapter.getActiveProgram(workoutLog.userId)
          if (activation) {
            const programFull = await adapter.getProgramFull(activation.programId)
            if (programFull) {
              const result = computeNextProgramPosition(
                {
                  currentBlockOrdinal: activation.currentBlockOrdinal,
                  currentWeekNumber: activation.currentWeekNumber,
                },
                programFull.blocks,
                programFull.blockWeeks,
              )

              if (result.action === 'program-complete') {
                await adapter.clearActiveProgram(workoutLog.userId)
                await queryClient.invalidateQueries({
                  queryKey: ['active-program', workoutLog.userId],
                })
              } else if (result.action === 'advance-week') {
                await adapter.updateActiveProgram(workoutLog.userId, {
                  currentBlockOrdinal: activation.currentBlockOrdinal,
                  currentWeekNumber: result.newWeekNumber,
                })
                await queryClient.invalidateQueries({
                  queryKey: ['active-program', workoutLog.userId],
                })
              } else if (result.action === 'advance-block') {
                await adapter.updateActiveProgram(workoutLog.userId, {
                  currentBlockOrdinal: result.newBlockOrdinal,
                  currentWeekNumber: result.newWeekNumber,
                })
                await queryClient.invalidateQueries({
                  queryKey: ['active-program', workoutLog.userId],
                })
              }
            }
          }
        } catch (err) {
          console.error('[finishWorkout] advancement failed:', err)
          storeFinishWorkout()
          return { advancementFailed: true }
        }
      }

      storeFinishWorkout()
      return {}
    } catch (err) {
      console.error('[workout] Failed to finish workout:', {
        workoutId: workoutLog?.id,
        err,
      })
      throw err
    }
  }, [workoutLog, updateWorkoutLogMutation, queryClient, storeFinishWorkout])

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
   * Pause the active workout. Sets pausedAt locally, then persists to DB.
   */
  const pauseWorkout = useCallback(async () => {
    const current = useActiveWorkoutStore.getState().workoutLog
    if (!current || current.pausedAt) return
    storePauseWorkout()
    const updated = useActiveWorkoutStore.getState().workoutLog
    if (!updated) return
    try {
      await updateWorkoutLogMutation.mutateAsync(updated)
    } catch (err) {
      console.error('[active-workout] Failed to persist pause:', err)
      throw err
    }
  }, [storePauseWorkout, updateWorkoutLogMutation])

  /**
   * Unpause (resume) the active workout. Clears pausedAt locally, accumulates
   * totalPausedMs, then persists to DB.
   */
  const unpauseWorkout = useCallback(async () => {
    const current = useActiveWorkoutStore.getState().workoutLog
    if (!current || !current.pausedAt) return
    storeUnpauseWorkout()
    const updated = useActiveWorkoutStore.getState().workoutLog
    if (!updated) return
    try {
      await updateWorkoutLogMutation.mutateAsync(updated)
    } catch (err) {
      console.error('[active-workout] Failed to persist resume:', err)
      throw err
    }
  }, [storeUnpauseWorkout, updateWorkoutLogMutation])

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

  // Derived state: whether the active workout was started from a program template
  const isProgrammedWorkout = workoutLog?.programContext != null

  return {
    // State
    workoutLog,
    loggedGroups,
    elapsedSeconds,
    restTimer,
    undoAction,
    isActive,
    isProgrammedWorkout,

    // Bridge actions (DB + store)
    startWorkout,
    startProgrammedWorkout,
    addExercise,
    confirmSet,
    undoSet,
    finishWorkout,
    resumeWorkout,
    discardWorkout,
    pauseWorkout,
    unpauseWorkout,

    // Store-only actions (no DB side-effects)
    skipRest: storeSkipRest,
    adjustRest: storeAdjustRest,
    clearUndo: storeClearUndo,

    // Mutation loading states for UI feedback
    isStarting: createWorkoutLogMutation.isPending,
    isAddingExercise:
      createLoggedActivityGroupMutation.isPending || createLoggedActivityMutation.isPending,
    isConfirmingSet: createLoggedSetMutation.isPending || updateLoggedSetMutation.isPending,
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

/**
 * Find a pre-filled (uncompleted) set for a given activity and set number.
 * Used by confirmSet to decide whether to UPDATE an existing set (programmed
 * workout) or CREATE a new one (ad-hoc workout).
 */
function findPrefilledSet(
  loggedGroups: LoggedActivityGroupWithActivities[],
  loggedActivityId: string,
  setNumber: number,
): LoggedSet | undefined {
  for (const group of loggedGroups) {
    const activity = group.activities.find((a) => a.id === loggedActivityId)
    if (activity) {
      return activity.sets.find((s) => s.setNumber === setNumber && !s.completed)
    }
  }
  return undefined
}
