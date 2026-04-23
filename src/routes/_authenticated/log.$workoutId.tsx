import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { createForegroundDetector } from '@/lib/foreground-detector'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { useExercises } from '@/hooks/use-exercises'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useOnboarding } from '@/hooks/use-onboarding'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useProgramFull } from '@/hooks/use-programs'
import { detectPersonalRecords } from '@/lib/pr-detection'
import { useDisplayBroadcast } from '@/hooks/use-display-broadcast'
import { getActiveGymId } from '@/lib/display-realtime'
import { WorkoutSummary } from '@/components/workout/workout-summary'
import { EventWorkoutView } from '@/components/workout/event-workout-view'
import { StrengthWorkoutView } from '@/components/workout/strength-workout-view'
import { parseNumericInput } from '@/lib/workout-utils'
import type { Exercise, PersonalRecord, SetType } from '@/domain/types'
import type { LoggedActivityGroupWithActivities } from '@/stores/active-workout-store'

export const Route = createFileRoute('/_authenticated/log/$workoutId')({
  component: ActiveWorkoutPage,
})

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ActiveWorkoutPage() {
  const navigate = useNavigate()

  const {
    workoutLog,
    loggedGroups,
    isActive,
    isProgrammedWorkout,
    elapsedSeconds,
    restTimer,
    undoAction,
    confirmSet,
    unconfirmSet,
    undoSet,
    deleteSet,
    removeActivity,
    finishWorkout,
    discardWorkout,
    pauseWorkout,
    unpauseWorkout,
    addExercise,
    skipRest,
    adjustRest,
    isConfirmingSet,
    isFinishing,
    isDiscarding,
  } = useActiveWorkout()

  const skipActivity = useActiveWorkoutStore((s) => s.skipActivity)
  const skippedActivityIds = useActiveWorkoutStore((s) => s.skippedActivityIds)

  const { markFirstWorkoutCompleted } = useOnboarding()
  const firstWorkoutCompleted = useOnboardingStore((s) => s.firstWorkoutCompleted)

  const { data: allExercises = [] } = useExercises()
  const { data: userProfile } = useUserProfile(workoutLog?.userId ?? '')

  // Resolve program/block names for the banner when in programmed mode
  const programId = workoutLog?.programContext?.programId
  const { data: programFull } = useProgramFull(programId)

  const programBannerProps = useMemo(() => {
    if (!workoutLog?.programContext) return null
    const ctx = workoutLog.programContext
    const programName = programFull?.program.name
    const block = programFull?.blocks.find((b) => b.id === ctx.blockId)
    return {
      programName,
      blockName: block?.name,
      weekNumber: ctx.weekNumber,
      dayLabel: ctx.dayLabel,
    }
  }, [workoutLog?.programContext, programFull])

  // Display broadcast (called unconditionally -- hook manages its own cleanup).
  // The gym ID was set by `configureDisplayPublisher` in the start-workout
  // handler before navigation; we read it back from publisher module state
  // here so the broadcast keeps targeting the picked gym for the lifetime of
  // the workout. Direct page-load (e.g., refresh) before any pick reads as
  // null, which puts the publisher in safe Private no-op mode.
  const { publishFocus, publishUnfocus, isBroadcasting } = useDisplayBroadcast(
    workoutLog?.userId ?? '',
    getActiveGymId(),
  )

  // Exercise ID -> Exercise lookup
  const exerciseMap = useMemo(() => {
    const map: Record<string, Exercise> = {}
    for (const ex of allExercises) {
      map[ex.id] = ex
    }
    return map
  }, [allExercises])

  // Exercise ID -> name lookup for summary
  const exerciseNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const ex of allExercises) {
      names[ex.id] = ex.name
    }
    return names
  }, [allExercises])

  // Local UI state
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  // pendingInputs[activityId] = true means "show one input row for this activity"
  const [pendingInputs, setPendingInputs] = useState<Record<string, boolean>>({})
  // restMinimized collapses the full-page rest view to the RestTimerBanner strip
  const [restMinimized, setRestMinimized] = useState(false)
  // expandedDoneActivityIds tracks which done (skipped) activities the user has
  // re-expanded to add more sets. Ephemeral session UI -- not persisted.
  const [expandedDoneActivityIds, setExpandedDoneActivityIds] = useState<Set<string>>(new Set())

  // Pause/resume derived state and handlers.
  // Pause UI is hidden on the Tauri (mobile) adapter because pause-state
  // persistence to local SQLite is deferred (ADR-013, F018). Showing the
  // controls would silently lose state across app restarts.
  const isPauseSupported = !isTauri()
  const isPaused = !!workoutLog?.pausedAt
  const handlePause = useCallback(() => {
    pauseWorkout().catch((err) => {
      console.error('[workout-log] Pause failed:', err)
      // Revert the optimistic local store update so the UI matches reality.
      useActiveWorkoutStore.getState().unpauseWorkout()
      setPageError('Pause failed -- workout is still running. Check your connection.')
    })
  }, [pauseWorkout])
  const handleResume = useCallback(() => {
    unpauseWorkout().catch((err) => {
      console.error('[workout-log] Resume failed:', err)
      // Revert the optimistic local store update so the UI matches reality.
      useActiveWorkoutStore.getState().pauseWorkout()
      setPageError('Resume failed -- workout is still paused. Check your connection.')
    })
  }, [unpauseWorkout])
  // Detected personal records (computed at workout finish time)
  const [detectedPrs, setDetectedPrs] = useState<PersonalRecord[]>([])
  // Store snapshot for summary display (captured at finish time)
  const [summaryData, setSummaryData] = useState<{
    workoutLog: typeof workoutLog
    loggedGroups: LoggedActivityGroupWithActivities[]
    programName?: string
    blockName?: string
  } | null>(null)

  // Redirect to home if no active workout and not showing summary
  useEffect(() => {
    if (!isActive && !showSummary) {
      navigate({ to: '/' })
    }
  }, [isActive, showSummary, navigate])

  // restMinimized is reset to false in handleConfirmSet (below) so each new
  // rest timer starts expanded rather than relying on a useEffect to react to
  // restTimer becoming null.

  // ---------------------------------------------------------------------------
  // Elapsed timer ownership (Tech.md D-1)
  //
  // The elapsed timer interval lives here, not in the Zustand store, so that
  // navigating from the Forge page to this log page does not tear down the
  // tick. On mount / workoutLog change / pausedAt change, we:
  //   1. Recompute elapsed from startedAt - totalPausedMs - (now - pausedAt?)
  //   2. Push it into the store via setElapsedSeconds
  //   3. If not paused, start a 1s interval that increments elapsed
  //   4. Cleanup the interval on unmount / dep change
  // ---------------------------------------------------------------------------
  const workoutLogId = workoutLog?.id
  const startedAt = workoutLog?.startedAt
  const totalPausedMs = workoutLog?.totalPausedMs ?? 0
  const pausedAt = workoutLog?.pausedAt
  useEffect(() => {
    if (!workoutLogId || !startedAt) return

    const setElapsedSeconds = useActiveWorkoutStore.getState().setElapsedSeconds

    const computeElapsed = (): number => {
      try {
        const startedMs = new Date(startedAt).getTime()
        if (!Number.isFinite(startedMs)) {
          console.error('[workout-log] Invalid startedAt:', startedAt)
          setPageError('Workout timer data is corrupt. Please discard or reload.')
          return 0
        }
        const now = Date.now()
        let elapsedMs = now - startedMs - totalPausedMs
        if (pausedAt) {
          const pausedAtMs = new Date(pausedAt).getTime()
          if (Number.isFinite(pausedAtMs)) {
            elapsedMs -= now - pausedAtMs
          } else {
            console.error('[workout-log] Invalid pausedAt:', pausedAt)
            setPageError('Workout timer data is corrupt. Please discard or reload.')
          }
        }
        return Math.max(0, Math.round(elapsedMs / 1000))
      } catch (err) {
        console.error('[workout-log] Failed to compute elapsed:', err)
        setPageError('Workout timer data is corrupt. Please discard or reload.')
        return 0
      }
    }

    setElapsedSeconds(computeElapsed())

    // When paused, the timer is frozen -- don't tick.
    if (pausedAt) return

    const intervalId = setInterval(() => {
      setElapsedSeconds(computeElapsed())
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [workoutLogId, startedAt, totalPausedMs, pausedAt])

  // ---------------------------------------------------------------------------
  // Foreground detection -- snap timers when screen wakes after timeout
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!workoutLogId || !startedAt || pausedAt) return

    const detector = createForegroundDetector(
      () => {
        // Snap elapsed timer immediately rather than waiting for the next tick.
        const store = useActiveWorkoutStore.getState()
        try {
          const startedMs = new Date(startedAt).getTime()
          if (Number.isFinite(startedMs)) {
            const now = Date.now()
            const elapsedMs = now - startedMs - totalPausedMs
            store.setElapsedSeconds(Math.max(0, Math.round(elapsedMs / 1000)))
          }
        } catch {
          // Non-critical -- interval will self-correct on next tick.
        }
        // Snap rest timer to wall-clock reality, firing onExpired if needed.
        store.recalcRestTimer()
      },
      () => {},
    )
    detector.start()
    return () => detector.stop()
  }, [workoutLogId, startedAt, totalPausedMs, pausedAt])

  // Count confirmed sets to determine if FINISH should be enabled
  const confirmedSetCount = useMemo(() => {
    let count = 0
    for (const group of loggedGroups) {
      for (const activity of group.activities) {
        for (const set of activity.sets) {
          if (set.completed) count++
        }
      }
    }
    return count
  }, [loggedGroups])

  // Determine which activity (or circuit group) the user should focus on
  // right now: the first one with any incomplete set, falling back to the
  // last item once everything is logged.
  const activeFocusId = useMemo<string | null>(() => {
    let lastId: string | null = null
    for (const group of loggedGroups) {
      if (group.groupType === 'CIRCUIT') {
        lastId = group.id
        const incomplete =
          group.activities.length === 0 ||
          group.activities.some((a) => a.sets.length === 0 || a.sets.some((s) => !s.completed))
        if (incomplete) return group.id
      } else {
        for (const activity of group.activities) {
          if (skippedActivityIds.has(activity.id)) continue // treat as done
          lastId = activity.id
          if (activity.sets.length === 0 || activity.sets.some((s) => !s.completed)) {
            return activity.id
          }
        }
      }
    }
    return lastId
  }, [loggedGroups, skippedActivityIds])

  const allActivitiesDone = useMemo(
    () =>
      loggedGroups.length > 0 &&
      loggedGroups
        .filter((g) => g.groupType !== 'CIRCUIT')
        .flatMap((g) => g.activities)
        .every((a) => skippedActivityIds.has(a.id)),
    [loggedGroups, skippedActivityIds],
  )

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleFinish = useCallback(async () => {
    setPendingInputs({})
    if (!workoutLog) {
      console.error('[workout-page] handleFinish blocked: no active workoutLog in store')
      setPageError('Cannot finish workout: no active session. Please reload.')
      return
    }
    // Capture snapshot before store clears it (needed for summary even on success)
    const snapshot = {
      workoutLog: { ...workoutLog },
      loggedGroups: [...loggedGroups],
      programName: programBannerProps?.programName,
      blockName: programBannerProps?.blockName,
    }
    try {
      const result = await finishWorkout()

      setSummaryData(snapshot)
      setShowSummary(true)

      // Mark first workout as completed for onboarding
      if (!firstWorkoutCompleted) {
        markFirstWorkoutCompleted()
      }

      // Detect personal records from the captured snapshot
      if (userProfile) {
        const allActivities = snapshot.loggedGroups.flatMap((g) => g.activities)
        const allSets = allActivities.flatMap((a) => a.sets)
        const prs = detectPersonalRecords(
          {
            log: snapshot.workoutLog,
            groups: snapshot.loggedGroups,
            activities: allActivities,
            sets: allSets,
          },
          userProfile,
          exerciseNames,
        )
        setDetectedPrs(prs)
      }

      if (result?.advancementFailed) {
        setPageError('Workout saved, but program position could not update. Check your connection.')
      }
    } catch (err) {
      console.error('[workout-page] handleFinish:', err)
      setPageError('Failed to save workout. Please try again.')
    }
  }, [
    workoutLog,
    loggedGroups,
    finishWorkout,
    programBannerProps,
    userProfile,
    exerciseNames,
    firstWorkoutCompleted,
    markFirstWorkoutCompleted,
  ])

  const handleDiscard = useCallback(async () => {
    try {
      await discardWorkout()
      setShowDiscardDialog(false)
      await navigate({ to: '/' }).catch((err) => {
        console.error('[workout-page] handleDiscard navigation failed:', err)
        setPageError('Workout discarded but could not navigate home.')
      })
    } catch (err) {
      console.error('[workout-page] handleDiscard:', err)
      setPageError('Failed to discard workout.')
    }
  }, [discardWorkout, navigate])

  const handleAddExercise = useCallback(
    async (exercise: Exercise) => {
      try {
        await addExercise(exercise, 'STRAIGHT_SETS')
      } catch (err) {
        console.error('[workout-page] handleAddExercise:', err)
        setPageError('Failed to add exercise. Please try again.')
      }
    },
    [addExercise],
  )

  const handleConfirmSet = useCallback(
    async (
      loggedActivityId: string,
      setNumber: number,
      weight: string,
      reps: string,
      setType: SetType,
    ) => {
      if (!workoutLog) {
        console.error('[workout-page] handleConfirmSet blocked: no active workoutLog in store')
        setPageError('Cannot save set: no active session. Please reload.')
        return
      }

      const weightValue = parseNumericInput(weight)
      // Reps support 0 (failed sets), so use >= 0 check rather than the > 0
      // guard inside parseNumericInput. A falsy check on repsValue would coerce
      // reps=0 to null, violating the DB completed_check constraint.
      const repsRaw = parseFloat(reps)
      const repsValue = !isNaN(repsRaw) && repsRaw >= 0 ? Math.round(repsRaw) : undefined

      // Determine unit from prescription or default
      const existingSet = loggedGroups
        .flatMap((g) => g.activities)
        .find((a) => a.id === loggedActivityId)
        ?.sets.find((s) => s.setNumber === setNumber)
      const unit = existingSet?.prescribed?.weight?.unit ?? 'lb'

      try {
        // Reset minimize state before confirming so the incoming rest timer
        // always starts in the expanded view (avoids a useEffect on restTimer).
        setRestMinimized(false)
        await confirmSet(loggedActivityId, {
          loggedActivityId,
          setNumber,
          setType,
          completed: true,
          actualWeight: weightValue ? { value: weightValue, unit } : undefined,
          actualReps: repsValue != null ? repsValue : undefined,
        })
        setPendingInputs((prev) => ({ ...prev, [loggedActivityId]: false }))
      } catch (err) {
        console.error('[workout-page] handleConfirmSet:', err)
        setPageError('Failed to save set.')
      }
    },
    [workoutLog, loggedGroups, confirmSet],
  )

  const handleUndoSet = useCallback(async () => {
    try {
      await undoSet()
    } catch (err) {
      console.error('[workout-page] handleUndoSet:', err)
      setPageError('Failed to undo. The set was already saved.')
    }
  }, [undoSet])

  const handleUnconfirmSet = useCallback(
    async (loggedActivityId: string, setId: string) => {
      try {
        await unconfirmSet(loggedActivityId, setId)
      } catch (err) {
        console.error('[workout-page] handleUnconfirmSet failed:', { loggedActivityId, setId, err })
        setPageError('Failed to undo set.')
      }
    },
    [unconfirmSet],
  )

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false)
    setSummaryData(null)
    setDetectedPrs([])
    navigate({ to: '/' }).catch((err) => {
      console.error('[workout-page] handleSummaryDone navigation failed:', err)
      setPageError('Could not return to home. Please navigate manually.')
    })
  }, [navigate])

  const handleMarkDone = useCallback(
    (activityId: string) => {
      if (!activityId) {
        console.error('[workout-page] handleMarkDone called with empty activityId')
        setPageError('Could not mark exercise done. Please reload.')
        return
      }
      skipActivity(activityId)
      setPendingInputs((prev) => ({ ...prev, [activityId]: false }))
      setExpandedDoneActivityIds((prev) => {
        const next = new Set(prev)
        next.delete(activityId)
        return next
      })
    },
    [skipActivity],
  )

  const handleExpandDone = useCallback((activityId: string) => {
    if (!activityId) {
      console.error('[workout-page] handleExpandDone called with empty activityId')
      setPageError('Could not expand exercise. Please reload.')
      return
    }
    setExpandedDoneActivityIds((prev) => new Set(prev).add(activityId))
  }, [])

  // -----------------------------------------------------------------------
  // Summary view
  // -----------------------------------------------------------------------

  if (showSummary && summaryData?.workoutLog) {
    return (
      <WorkoutSummary
        workoutLog={summaryData.workoutLog}
        loggedGroups={summaryData.loggedGroups}
        exerciseNames={exerciseNames}
        onDone={handleSummaryDone}
        programName={summaryData.programName}
        blockName={summaryData.blockName}
        personalRecords={detectedPrs}
      />
    )
  }

  // -----------------------------------------------------------------------
  // Guard: no active workout
  // -----------------------------------------------------------------------

  if (!workoutLog) {
    console.error('[workout-page] Rendered without active workoutLog')
    return <div className="min-h-[100dvh] bg-surface-anvil" />
  }

  // -----------------------------------------------------------------------
  // Event log: render EventDetail instead of exercise/set UI
  // -----------------------------------------------------------------------

  if (workoutLog.eventMetadata) {
    return (
      <EventWorkoutView
        workoutLog={{ id: workoutLog.id, eventMetadata: workoutLog.eventMetadata }}
        elapsedSeconds={elapsedSeconds}
        isPauseSupported={isPauseSupported}
        isPaused={isPaused}
        handlePause={handlePause}
        handleResume={handleResume}
        handleFinish={handleFinish}
        handleDiscard={handleDiscard}
        isBroadcasting={isBroadcasting}
        publishFocus={publishFocus}
        publishUnfocus={publishUnfocus}
        isFinishing={isFinishing}
        isDiscarding={isDiscarding}
        pageError={pageError}
        setPageError={setPageError}
        showDiscardDialog={showDiscardDialog}
        setShowDiscardDialog={setShowDiscardDialog}
      />
    )
  }

  return (
    <StrengthWorkoutView
      workoutLog={{ id: workoutLog.id, userId: workoutLog.userId }}
      loggedGroups={loggedGroups}
      elapsedSeconds={elapsedSeconds}
      isPauseSupported={isPauseSupported}
      isPaused={isPaused}
      handlePause={handlePause}
      handleResume={handleResume}
      handleFinish={handleFinish}
      handleDiscard={handleDiscard}
      handleAddExercise={handleAddExercise}
      handleConfirmSet={handleConfirmSet}
      handleUndoSet={handleUndoSet}
      handleUnconfirmSet={handleUnconfirmSet}
      handleMarkDone={handleMarkDone}
      handleExpandDone={handleExpandDone}
      isBroadcasting={isBroadcasting}
      publishFocus={publishFocus}
      publishUnfocus={publishUnfocus}
      isFinishing={isFinishing}
      isDiscarding={isDiscarding}
      isConfirmingSet={isConfirmingSet}
      isProgrammedWorkout={isProgrammedWorkout}
      firstWorkoutCompleted={firstWorkoutCompleted}
      confirmedSetCount={confirmedSetCount}
      activeFocusId={activeFocusId}
      allActivitiesDone={allActivitiesDone}
      skippedActivityIds={skippedActivityIds}
      expandedDoneActivityIds={expandedDoneActivityIds}
      exerciseMap={exerciseMap}
      restTimer={restTimer}
      restMinimized={restMinimized}
      setRestMinimized={setRestMinimized}
      undoAction={undoAction}
      pendingInputs={pendingInputs}
      setPendingInputs={setPendingInputs}
      programBannerProps={programBannerProps}
      showAddExercise={showAddExercise}
      setShowAddExercise={setShowAddExercise}
      showDiscardDialog={showDiscardDialog}
      setShowDiscardDialog={setShowDiscardDialog}
      pageError={pageError}
      setPageError={setPageError}
      confirmSet={confirmSet}
      deleteSet={deleteSet}
      removeActivity={removeActivity}
      skipRest={skipRest}
      adjustRest={adjustRest}
    />
  )
}
