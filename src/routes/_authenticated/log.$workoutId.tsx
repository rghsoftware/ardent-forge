import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useExercises } from '@/hooks/use-exercises'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useProgramFull } from '@/hooks/use-programs'
import { detectPersonalRecords } from '@/lib/pr-detection'
import { WorkoutHeader } from '@/components/workout/workout-header'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'
import { ProgramContextBanner } from '@/components/workout/program-context-banner'
import { RestTimerOverlay } from '@/components/workout/rest-timer-overlay'
import { UndoBanner } from '@/components/workout/undo-banner'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import { CardioPanel } from '@/components/workout/cardio-panel'
import { RuckPanel } from '@/components/workout/ruck-panel'
import { CircuitPanel } from '@/components/workout/circuit-panel'
import { WorkoutSummary } from '@/components/workout/workout-summary'
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
    addExercise,
    skipRest,
    adjustRest,
    isConfirmingSet,
    isFinishing,
    isDiscarding,
  } = useActiveWorkout()

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
  }, [workoutLog, loggedGroups, finishWorkout, programBannerProps, userProfile, exerciseNames])

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

  return (
    <div className="flex min-h-screen flex-col bg-surface-anvil pb-20">
      {/* Dismissible error banner */}
      {pageError && (
        <div
          role="alert"
          className="fixed top-0 inset-x-0 z-50 bg-red-600 px-4 py-2 text-sm text-white flex justify-between items-center"
        >
          <span>{pageError}</span>
          <button onClick={() => setPageError(null)} className="text-white font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Sticky header with timer and FINISH */}
      <WorkoutHeader
        elapsedSeconds={elapsedSeconds}
        onFinish={handleFinish}
        isFinishing={isFinishing}
        canFinish={confirmedSetCount > 0}
      />

      {/* Program context banner for programmed workouts */}
      {programBannerProps && (
        <ProgramContextBanner
          programName={programBannerProps.programName}
          blockName={programBannerProps.blockName}
          weekNumber={programBannerProps.weekNumber}
          dayLabel={programBannerProps.dayLabel}
        />
      )}

      {/* Exercise blocks */}
      <div className="flex flex-col gap-[1.75rem] px-0 pt-2">
        {loggedGroups.map((group) =>
          group.activities.map((activity) => {
            const exercise = exerciseMap[activity.exerciseId]
            const modality = getExerciseModality(exercise, group.groupType)

            // Cardio panel
            if (modality === 'cardio' && exercise) {
              return (
                <CardioPanel
                  key={activity.id}
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
              )
            }

            // Ruck panel
            if (modality === 'ruck') {
              return (
                <RuckPanel
                  key={activity.id}
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
              )
            }

            // Circuit panel (rendered at group level)
            if (modality === 'circuit') {
              const circuitExercises = group.activities.map((a) => ({
                name: exerciseNames[a.exerciseId] ?? 'Unknown',
                targetReps: DEFAULT_CIRCUIT_REPS,
              }))
              return (
                <CircuitPanel
                  key={group.id}
                  exercises={circuitExercises}
                  rounds={3}
                  onComplete={async (completedRounds) => {
                    // Log a single set per activity summarizing the circuit
                    const results = await Promise.allSettled(
                      group.activities.map((a) =>
                        confirmSet(a.id, {
                          loggedActivityId: a.id,
                          setNumber: 1,
                          setType: 'WORKING',
                          completed: true,
                          actualReps: completedRounds * DEFAULT_CIRCUIT_REPS,
                        }),
                      ),
                    )
                    if (results.some((r) => r.status === 'rejected')) {
                      setPageError('Some circuit sets could not be saved.')
                    }
                  }}
                />
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
              <ExerciseBlock
                key={activity.id}
                exerciseName={exercise?.name ?? 'Unknown Exercise'}
                sets={setRows}
                loggedActivityId={activity.id}
                onConfirmSet={handleConfirmSet}
                isConfirming={isConfirmingSet}
              />
            )
          }),
        )}
      </div>

      {/* Add exercise button (hidden for programmed workouts) */}
      {!isProgrammedWorkout && (
        <div className="px-4 pt-6 pb-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowAddExercise(true)}
            className="min-h-12 w-full"
          >
            + Add exercise
          </Button>
        </div>
      )}

      {/* Discard button */}
      <div className="px-4 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDiscardDialog(true)}
          className="w-full text-xs text-warning-flare"
        >
          Discard workout
        </Button>
      </div>

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
            <DialogTitle className="text-xs text-warning-flare">
              Discard Workout
            </DialogTitle>
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
