import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useExercises } from '@/hooks/use-exercises'
import { WorkoutHeader } from '@/components/workout/workout-header'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'
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
import type { Exercise, GroupType, SetType } from '@/domain/types'
import type { LoggedActivityGroupWithActivities } from '@/stores/active-workout-store'

export const Route = createFileRoute('/_authenticated/log/$workoutId')({
  component: ActiveWorkoutPage,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine whether an exercise should use a modality-specific panel */
function getExerciseModality(
  exercise: Exercise | undefined,
  groupType: string,
): 'cardio' | 'ruck' | 'circuit' | 'standard' {
  if (groupType === 'CIRCUIT') return 'circuit'
  if (!exercise) return 'standard'
  if (exercise.category === 'CARDIO') {
    // Check if it's a ruck exercise by name or equipment
    const isRuck =
      exercise.name.toLowerCase().includes('ruck') ||
      exercise.equipmentRequired.includes('RUCK_PLATE') ||
      exercise.equipmentRequired.includes('WEIGHT_VEST')
    if (isRuck) return 'ruck'
    return 'cardio'
  }
  return 'standard'
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function ActiveWorkoutPage() {
  const navigate = useNavigate()

  const {
    workoutLog,
    loggedGroups,
    isActive,
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
  // Store snapshot for summary display (captured at finish time)
  const [summaryData, setSummaryData] = useState<{
    workoutLog: typeof workoutLog
    loggedGroups: LoggedActivityGroupWithActivities[]
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
    // Capture data before store clears it
    setSummaryData({ workoutLog: { ...workoutLog }, loggedGroups: [...loggedGroups] })
    await finishWorkout()
    setShowSummary(true)
  }, [workoutLog, loggedGroups, finishWorkout])

  const handleDiscard = useCallback(async () => {
    await discardWorkout()
    setShowDiscardDialog(false)
    navigate({ to: '/' })
  }, [discardWorkout, navigate])

  const handleAddExercise = useCallback(
    async (exercise: Exercise, groupType: GroupType) => {
      await addExercise(exercise, groupType)
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

      const weightValue = parseFloat(weight)
      const repsValue = parseInt(reps, 10)

      await confirmSet(loggedActivityId, {
        loggedActivityId,
        setNumber,
        setType,
        completed: true,
        actualWeight:
          !isNaN(weightValue) && weightValue > 0 ? { value: weightValue, unit: 'lb' } : undefined,
        actualReps: !isNaN(repsValue) && repsValue > 0 ? repsValue : undefined,
      })
    },
    [workoutLog, confirmSet],
  )

  const handleAddSetRow = useCallback((_loggedActivityId: string) => {
    // For now, set rows are added dynamically via the exercise block.
    // The store's confirmSet handles adding completed sets.
    // An "add set" effectively means: render one more empty SetRow.
    // This is managed via local state in the rendering logic below.
  }, [])

  const handleUndoSet = useCallback(async () => {
    await undoSet()
  }, [undoSet])

  const handleSummaryDone = useCallback(() => {
    setShowSummary(false)
    setSummaryData(null)
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
      />
    )
  }

  // -----------------------------------------------------------------------
  // Guard: no active workout
  // -----------------------------------------------------------------------

  if (!workoutLog) return null

  return (
    <div className="flex min-h-screen flex-col bg-surface-anvil pb-20">
      {/* Sticky header with timer and FINISH */}
      <WorkoutHeader
        elapsedSeconds={elapsedSeconds}
        onFinish={handleFinish}
        isFinishing={isFinishing}
        canFinish={confirmedSetCount > 0}
      />

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
                  loggedActivityId={activity.id}
                  exercise={exercise}
                  onComplete={(data) => {
                    confirmSet(activity.id, {
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
                  }}
                />
              )
            }

            // Ruck panel
            if (modality === 'ruck') {
              return (
                <RuckPanel
                  key={activity.id}
                  loggedActivityId={activity.id}
                  onComplete={(data) => {
                    confirmSet(activity.id, {
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
                  }}
                />
              )
            }

            // Circuit panel (rendered at group level)
            if (modality === 'circuit') {
              const circuitExercises = group.activities.map((a) => ({
                name: exerciseNames[a.exerciseId] ?? 'Unknown',
                targetReps: 30, // Default; would come from prescription in a program-linked workout
              }))
              return (
                <CircuitPanel
                  key={group.id}
                  exercises={circuitExercises}
                  rounds={3}
                  onComplete={(completedRounds) => {
                    // Log a single set per activity summarizing the circuit
                    for (const a of group.activities) {
                      confirmSet(a.id, {
                        loggedActivityId: a.id,
                        setNumber: 1,
                        setType: 'WORKING',
                        completed: true,
                        actualReps: completedRounds * 30,
                      })
                    }
                  }}
                />
              )
            }

            // Standard strength exercise block
            const confirmedSets = activity.sets.filter((s) => s.completed)
            const lastConfirmedSet = confirmedSets.length > 0 ? confirmedSets[confirmedSets.length - 1] : undefined

            // Build set row data: confirmed sets + one empty row for the next set
            const setRows: SetRowData[] = [
              ...activity.sets.map((set, idx) => ({
                id: set.id,
                setNumber: idx + 1,
                weight: set.actualWeight?.value?.toString(),
                reps: set.actualReps?.toString(),
                confirmed: set.completed,
              })),
            ]

            // Add an empty row for the next set to log
            const nextSetNumber = setRows.length + 1
            setRows.push({
              id: `pending-${activity.id}-${nextSetNumber}`,
              setNumber: nextSetNumber,
              weight: lastConfirmedSet?.actualWeight?.value?.toString(),
              reps: lastConfirmedSet?.actualReps?.toString(),
              confirmed: false,
            })

            return (
              <ExerciseBlock
                key={activity.id}
                exerciseName={exercise?.name ?? 'Unknown Exercise'}
                sets={setRows}
                loggedActivityId={activity.id}
                onConfirmSet={handleConfirmSet}
                onAddSet={handleAddSetRow}
                isConfirming={isConfirmingSet}
              />
            )
          }),
        )}
      </div>

      {/* Add exercise button */}
      <div className="px-4 pt-6 pb-4">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => setShowAddExercise(true)}
          className="min-h-12 w-full"
        >
          + ADD EXERCISE
        </Button>
      </div>

      {/* Discard button */}
      <div className="px-4 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDiscardDialog(true)}
          className="w-full text-xs text-warning-flare"
        >
          DISCARD WORKOUT
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
            <DialogTitle className="text-xs uppercase tracking-widest text-warning-flare">
              DISCARD WORKOUT
            </DialogTitle>
            <DialogDescription>
              All logged sets will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              CANCEL
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? 'DISCARDING...' : 'DISCARD'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
