import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { useExercises } from '@/hooks/use-exercises'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useOnboarding } from '@/hooks/use-onboarding'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useProgramFull } from '@/hooks/use-programs'
import { detectPersonalRecords } from '@/lib/pr-detection'
import { useDisplayBroadcast } from '@/hooks/use-display-broadcast'
import { WorkoutHeader } from '@/components/workout/workout-header'
import { WorkoutPausedBar } from '@/components/workout/workout-paused-bar'
import { ErrorBanner } from '@/components/workout/error-banner'
import { PushToDisplayButton } from '@/components/workout/push-to-display-button'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'
import { ProgramContextBanner } from '@/components/workout/program-context-banner'
import { RestTimerOverlay } from '@/components/workout/rest-timer-overlay'
import { UndoBanner } from '@/components/workout/undo-banner'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import { CardioPanel } from '@/components/workout/cardio-panel'
import { RuckPanel } from '@/components/workout/ruck-panel'
import { CircuitPanel } from '@/components/workout/circuit-panel'
import { WorkoutSummary } from '@/components/workout/workout-summary'
import { EventDetail } from '@/components/event-builder/event-detail'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getExerciseModality, parseNumericInput, DEFAULT_CIRCUIT_REPS } from '@/lib/workout-utils'
import type { Exercise, GroupType, PersonalRecord, SetType } from '@/domain/types'
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
    undoSet,
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

  // Display broadcast (called unconditionally -- hook manages its own cleanup)
  const { publishFocus, publishUnfocus, isBroadcasting } = useDisplayBroadcast(
    workoutLog?.userId ?? '',
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

  // Pause/resume derived state and handlers
  const isPaused = !!workoutLog?.pausedAt
  const handlePause = useCallback(() => {
    pauseWorkout().catch((err) => {
      console.error('[workout-log] Pause failed:', err)
      setPageError('Failed to pause workout. Please try again.')
    })
  }, [pauseWorkout])
  const handleResume = useCallback(() => {
    unpauseWorkout().catch((err) => {
      console.error('[workout-log] Resume failed:', err)
      setPageError('Failed to resume workout. Please try again.')
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
          }
        }
        return Math.max(0, Math.round(elapsedMs / 1000))
      } catch (err) {
        console.error('[workout-log] Failed to compute elapsed:', err)
        return 0
      }
    }

    setElapsedSeconds(computeElapsed())

    // When paused, the timer is frozen -- don't tick.
    if (pausedAt) return

    const intervalId = setInterval(() => {
      const prev = useActiveWorkoutStore.getState().elapsedSeconds
      useActiveWorkoutStore.getState().setElapsedSeconds(prev + 1)
    }, 1000)

    return () => {
      clearInterval(intervalId)
    }
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
          group.activities.some(
            (a) => a.sets.length === 0 || a.sets.some((s) => !s.completed),
          )
        if (incomplete) return group.id
      } else {
        for (const activity of group.activities) {
          lastId = activity.id
          if (activity.sets.length === 0 || activity.sets.some((s) => !s.completed)) {
            return activity.id
          }
        }
      }
    }
    return lastId
  }, [loggedGroups])

  // Refs for each renderable activity/group block, used to scroll the
  // active block into view when focus advances.
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const registerBlockRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) blockRefs.current.set(id, el)
      else blockRefs.current.delete(id)
    },
    [],
  )

  useEffect(() => {
    if (!activeFocusId) return
    const el = blockRefs.current.get(activeFocusId)
    if (!el) return
    // Browser honors prefers-reduced-motion automatically for smooth scroll.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeFocusId])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleFinish = useCallback(async () => {
    if (!workoutLog) return
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
        setPageError(
          'Workout saved, but program position could not update. Check your connection.',
        )
      }
    } catch (err) {
      console.error('[workout-page] handleFinish:', err)
      setPageError('Failed to save workout. Please try again.')
    }
  }, [workoutLog, loggedGroups, finishWorkout, programBannerProps, userProfile, exerciseNames, firstWorkoutCompleted, markFirstWorkoutCompleted])

  const handleDiscard = useCallback(async () => {
    try {
      await discardWorkout()
      setShowDiscardDialog(false)
      navigate({ to: '/' })
    } catch (err) {
      console.error('[workout-page] handleDiscard:', err)
      setPageError('Failed to discard workout.')
    }
  }, [discardWorkout, navigate])

  const handleAddExercise = useCallback(
    async (exercise: Exercise, groupType: GroupType) => {
      try {
        await addExercise(exercise, groupType)
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
      if (!workoutLog) return

      const weightValue = parseNumericInput(weight)
      const repsValue = parseNumericInput(reps)

      // Determine unit from prescription or default
      const existingSet = loggedGroups
        .flatMap((g) => g.activities)
        .find((a) => a.id === loggedActivityId)
        ?.sets.find((s) => s.setNumber === setNumber)
      const unit = existingSet?.prescribed?.weight?.unit ?? 'lb'

      try {
        await confirmSet(loggedActivityId, {
          loggedActivityId,
          setNumber,
          setType,
          completed: true,
          actualWeight: weightValue ? { value: weightValue, unit } : undefined,
          actualReps: repsValue ? Math.round(repsValue) : undefined,
        })
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

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false)
    setSummaryData(null)
    setDetectedPrs([])
    navigate({ to: '/' })
  }, [navigate])

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

  if (!workoutLog) return null

  // -----------------------------------------------------------------------
  // Event log: render EventDetail instead of exercise/set UI
  // -----------------------------------------------------------------------

  if (workoutLog.eventMetadata) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
        {pageError && <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />}

        {/* Sticky header with timer + paused-state action bar */}
        <div className="sticky top-0 z-50">
          <WorkoutHeader
            elapsedSeconds={elapsedSeconds}
            isPaused={isPaused}
            onPause={handlePause}
            onResume={handleResume}
            actions={
              <PushToDisplayButton
                userId={workoutLog.userId}
                publishFocus={publishFocus}
                publishUnfocus={publishUnfocus}
                isBroadcasting={isBroadcasting}
              />
            }
          />
          <WorkoutPausedBar
            isPaused={isPaused}
            onResume={handleResume}
            onFinish={handleFinish}
            isFinishing={isFinishing}
            canFinish={true}
            onDiscard={() => setShowDiscardDialog(true)}
            showFinishHelper={false}
          />
        </div>

        <EventDetail
          workoutLogId={workoutLog.id}
          eventMetadata={workoutLog.eventMetadata}
          interactive={true}
        />

        {/* Discard confirmation dialog */}
        <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Discard workout</DialogTitle>
              <DialogDescription>
                All logged sets will be permanently deleted. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
                {isDiscarding ? 'Discarding...' : 'Discard'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {pageError && <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />}

      {/* Sticky header with timer + paused-state action bar */}
      <div className="sticky top-0 z-50">
        <WorkoutHeader
          elapsedSeconds={elapsedSeconds}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
          actions={
            <PushToDisplayButton
              userId={workoutLog.userId}
              publishFocus={publishFocus}
              publishUnfocus={publishUnfocus}
              isBroadcasting={isBroadcasting}
            />
          }
        />
        <WorkoutPausedBar
          isPaused={isPaused}
          onResume={handleResume}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          canFinish={confirmedSetCount > 0}
          onDiscard={() => setShowDiscardDialog(true)}
          showFinishHelper={confirmedSetCount === 0}
        />
      </div>

      {/* Program context banner -- collapses after the first confirmed set
          to reclaim vertical space once the user is oriented. */}
      {programBannerProps && confirmedSetCount === 0 && (
        <ProgramContextBanner
          programName={programBannerProps.programName}
          blockName={programBannerProps.blockName}
          weekNumber={programBannerProps.weekNumber}
          dayLabel={programBannerProps.dayLabel}
        />
      )}

      {/* Exercise blocks -- flex-1 so the workout content fills the viewport */}
      <div className="flex flex-1 flex-col gap-7 px-0 pt-2">
        {loggedGroups.map((group) => {
          // Group-level rendering: circuits render once per group
          if (group.groupType === 'CIRCUIT') {
            const circuitExercises = group.activities.map((a) => ({
              name: exerciseNames[a.exerciseId] ?? 'Unknown',
              targetReps: DEFAULT_CIRCUIT_REPS,
            }))
            const isActive = group.id === activeFocusId
            return (
              <div
                key={group.id}
                ref={registerBlockRef(group.id)}
                className={cn(
                  'transition-opacity duration-300 ease-out',
                  isActive ? 'opacity-100' : 'opacity-50',
                )}
              >
              <CircuitPanel
                exercises={circuitExercises}
                rounds={3}
                onExerciseDone={async (exerciseIndex, round, actualReps) => {
                  const activity = group.activities[exerciseIndex]
                  if (!activity) return
                  try {
                    // Pass restSeconds: 0 -- CircuitPanel runs its own inter-exercise
                    // and inter-round rest, so the global rest timer must not fire.
                    await confirmSet(
                      activity.id,
                      {
                        loggedActivityId: activity.id,
                        setNumber: round,
                        setType: 'WORKING',
                        completed: true,
                        actualReps,
                      },
                      0,
                    )
                  } catch (err) {
                    console.error('[workout-log] Failed to log circuit set:', err)
                    setPageError('Failed to save circuit set.')
                  }
                }}
                onComplete={() => {
                  // Per-set logging happens in onExerciseDone; nothing to do here.
                }}
              />
              </div>
            )
          }

          return group.activities.map((activity) => {
            const exercise = exerciseMap[activity.exerciseId]
            const modality = getExerciseModality(exercise, group.groupType)
            const isActive = activity.id === activeFocusId
            const dimWrapperClass = cn(
              'transition-opacity duration-300 ease-out',
              isActive ? 'opacity-100' : 'opacity-50',
            )

            // Cardio panel
            if (modality === 'cardio' && exercise) {
              return (
                <div key={activity.id} ref={registerBlockRef(activity.id)} className={dimWrapperClass}>
                <CardioPanel
                  exercise={exercise}
                  onComplete={async (data) => {
                    try {
                      await confirmSet(activity.id, {
                        loggedActivityId: activity.id,
                        setNumber: 1,
                        setType: 'WORKING',
                        completed: true,
                        actualDuration: { seconds: data.durationSeconds },
                        actualDistance: data.distance
                          ? { value: parseFloat(data.distance), unit: 'mi' }
                          : undefined,
                        actualHeartRate: data.heartRate ? parseInt(data.heartRate, 10) : undefined,
                      })
                    } catch (err) {
                      console.error('[workout-page] cardio confirmSet:', err)
                      setPageError('Failed to save cardio session.')
                    }
                  }}
                />
                </div>
              )
            }

            // Ruck panel
            if (modality === 'ruck') {
              return (
                <div key={activity.id} ref={registerBlockRef(activity.id)} className={dimWrapperClass}>
                <RuckPanel
                  onComplete={async (data) => {
                    try {
                      await confirmSet(activity.id, {
                        loggedActivityId: activity.id,
                        setNumber: 1,
                        setType: 'WORKING',
                        completed: true,
                        actualDuration: { seconds: data.durationSeconds },
                        actualDistance: data.distance
                          ? { value: parseFloat(data.distance), unit: 'mi' }
                          : undefined,
                        ruckLoad: data.loadWeight
                          ? { value: parseFloat(data.loadWeight), unit: 'lb' }
                          : undefined,
                        elevationGain: data.elevation
                          ? { value: parseFloat(data.elevation), unit: 'm' }
                          : undefined,
                      })
                    } catch (err) {
                      console.error('[workout-page] ruck confirmSet:', err)
                      setPageError('Failed to save ruck session.')
                    }
                  }}
                />
                </div>
              )
            }

            // Standard strength exercise block
            const confirmedSets = activity.sets.filter((s) => s.completed)
            const lastConfirmedSet =
              confirmedSets.length > 0 ? confirmedSets[confirmedSets.length - 1] : undefined

            // Build set row data: confirmed sets + one empty row for the next set
            const setRows: SetRowData[] = [
              ...activity.sets.map((set, idx) => ({
                id: set.id,
                setNumber: idx + 1,
                weight: set.actualWeight?.value?.toString(),
                reps: set.actualReps?.toString(),
                confirmed: set.completed,
                prescribedWeight: set.prescribed?.weight ?? undefined,
                prescribedReps: set.prescribed?.reps ?? undefined,
              })),
            ]

            // Add an empty row for the next set to log.
            // If this is a programmed workout, inherit prescribed values from the
            // last set so the user sees the same prescription on the input row.
            const lastSetWithPrescription = [...activity.sets]
              .reverse()
              .find((s) => s.prescribed != null)
            const nextPrescribedWeight =
              lastSetWithPrescription?.prescribed?.weight ?? undefined
            const nextPrescribedReps =
              lastSetWithPrescription?.prescribed?.reps ?? undefined

            const nextSetNumber = setRows.length + 1
            setRows.push({
              id: `pending-${activity.id}-${nextSetNumber}`,
              setNumber: nextSetNumber,
              weight:
                lastConfirmedSet?.actualWeight?.value?.toString()
                ?? nextPrescribedWeight?.value?.toString(),
              reps:
                lastConfirmedSet?.actualReps?.toString()
                ?? (nextPrescribedReps != null ? String(nextPrescribedReps) : undefined),
              confirmed: false,
              prescribedWeight: nextPrescribedWeight,
              prescribedReps: nextPrescribedReps,
            })

            return (
              <div key={activity.id} ref={registerBlockRef(activity.id)} className={dimWrapperClass}>
                <ExerciseBlock
                  exerciseName={exercise?.name ?? 'Unknown Exercise'}
                  sets={setRows}
                  loggedActivityId={activity.id}
                  onConfirmSet={handleConfirmSet}
                  isConfirming={isConfirmingSet}
                  isBodyweight={exercise?.category === 'BODYWEIGHT'}
                  isActive={isActive}
                />
              </div>
            )
          })
        })}
      </div>

      {/* Add exercise button (hidden for programmed workouts) */}
      {!isProgrammedWorkout && (
        <div className="px-4 pt-6 pb-4">
          {loggedGroups.length === 0 && !firstWorkoutCompleted && (
            <OnboardingHint hintKey="workout-add-exercise">
              Tap below to add your first exercise.
            </OnboardingHint>
          )}
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowAddExercise(true)}
            className="min-h-12 w-full"
          >
            <Plus className="h-4 w-4" />
            Add exercise
          </Button>
        </div>
      )}

      {/* Rest timer overlay */}
      <RestTimerOverlay restTimer={restTimer} onSkip={skipRest} onAdjust={adjustRest} />

      {/* Undo banner (shown when rest timer is NOT active) */}
      {!restTimer && <UndoBanner undoAction={undoAction} onUndo={handleUndoSet} />}

      {/* Add exercise sheet */}
      <AddExerciseSheet
        open={showAddExercise}
        onOpenChange={setShowAddExercise}
        onExerciseSelected={handleAddExercise}
        userId={workoutLog.userId}
      />

      {/* Discard confirmation dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard workout</DialogTitle>
            <DialogDescription>
              All logged sets will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? 'Discarding...' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
