import { useState } from 'react'
import { Plus } from 'lucide-react'
import { WorkoutHeader } from '@/components/workout/workout-header'
import { WorkoutPausedBar } from '@/components/workout/workout-paused-bar'
import { ErrorBanner } from '@/components/workout/error-banner'
import { WorkoutHeaderMenu } from '@/components/workout/workout-header-menu'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'
import { ProgramContextBanner } from '@/components/workout/program-context-banner'
import { RestView } from '@/components/workout/rest-view'
import { RestTimerBanner } from '@/components/workout/rest-timer-banner'
import { UndoBanner } from '@/components/workout/undo-banner'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import { CardioPanel } from '@/components/workout/cardio-panel'
import { RuckPanel } from '@/components/workout/ruck-panel'
import { CircuitPanel } from '@/components/workout/circuit-panel'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getExerciseModality, DEFAULT_CIRCUIT_REPS } from '@/lib/workout-utils'
import type { Exercise, LoggedSet, SetType } from '@/domain/types'
import type { LoggedActivityGroupWithActivities, UndoAction } from '@/stores/active-workout-store'

type ProgramBannerProps = {
  programName?: string
  blockName?: string
  weekNumber: number
  dayLabel?: string
}

interface StrengthWorkoutViewProps {
  workoutLog: { id: string; userId: string }
  loggedGroups: LoggedActivityGroupWithActivities[]
  elapsedSeconds: number
  isPauseSupported: boolean
  isPaused: boolean
  handlePause: () => void
  handleResume: () => void
  handleFinish: () => Promise<void>
  handleDiscard: () => Promise<void>
  handleAddExercise: (exercise: Exercise) => Promise<void>
  handleConfirmSet: (
    loggedActivityId: string,
    setNumber: number,
    weight: string,
    reps: string,
    setType: SetType,
  ) => Promise<void>
  handleUndoSet: () => Promise<void>
  handleUnconfirmSet: (loggedActivityId: string, setId: string) => Promise<void>
  handleMarkDone: (activityId: string) => void
  handleExpandDone: (activityId: string) => void
  isBroadcasting: boolean
  publishFocus: () => void
  publishUnfocus: () => void
  isFinishing: boolean
  isDiscarding: boolean
  isConfirmingSet: boolean
  isProgrammedWorkout: boolean
  firstWorkoutCompleted: boolean
  confirmedSetCount: number
  activeFocusId: string | null
  allActivitiesDone: boolean
  skippedActivityIds: Set<string>
  expandedDoneActivityIds: Set<string>
  exerciseMap: Record<string, Exercise>
  restTimer: { remaining: number; total: number } | null
  restMinimized: boolean
  setRestMinimized: (minimized: boolean) => void
  undoAction: UndoAction | null
  pendingInputs: Record<string, boolean>
  setPendingInputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  programBannerProps: ProgramBannerProps | null
  confirmSet: (
    loggedActivityId: string,
    setData: Omit<LoggedSet, 'id'>,
    restSeconds?: number,
    exerciseName?: string,
  ) => Promise<unknown>
  deleteSet: (activityId: string, setId: string) => Promise<void>
  removeActivity: (activityId: string) => Promise<void>
  skipRest: () => void
  adjustRest: (delta: number) => void
}

export function StrengthWorkoutView({
  workoutLog,
  loggedGroups,
  elapsedSeconds,
  isPauseSupported,
  isPaused,
  handlePause,
  handleResume,
  handleFinish,
  handleDiscard,
  handleAddExercise,
  handleConfirmSet,
  handleUndoSet,
  handleUnconfirmSet,
  handleMarkDone,
  handleExpandDone,
  isBroadcasting,
  publishFocus,
  publishUnfocus,
  isFinishing,
  isDiscarding,
  isConfirmingSet,
  isProgrammedWorkout,
  firstWorkoutCompleted,
  confirmedSetCount,
  activeFocusId,
  allActivitiesDone,
  skippedActivityIds,
  expandedDoneActivityIds,
  exerciseMap,
  restTimer,
  restMinimized,
  setRestMinimized,
  undoAction,
  pendingInputs,
  setPendingInputs,
  programBannerProps,
  confirmSet,
  deleteSet,
  removeActivity,
  skipRest,
  adjustRest,
}: StrengthWorkoutViewProps) {
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const exerciseNames = Object.fromEntries(Object.entries(exerciseMap).map(([k, v]) => [k, v.name]))

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {pageError && <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />}

      {/* Sticky header with timer + paused-state action bar */}
      <div className="sticky top-0 z-50">
        <WorkoutHeader
          elapsedSeconds={elapsedSeconds}
          isPaused={isPauseSupported && isPaused}
          onPause={isPauseSupported ? handlePause : undefined}
          onResume={isPauseSupported ? handleResume : undefined}
          actions={
            <WorkoutHeaderMenu
              isBroadcasting={isBroadcasting}
              publishFocus={publishFocus}
              publishUnfocus={publishUnfocus}
            />
          }
        />
        <WorkoutPausedBar
          isPaused={isPauseSupported && isPaused}
          onResume={handleResume}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          canFinish={confirmedSetCount > 0}
          onDiscard={() => setShowDiscardDialog(true)}
          showFinishHelper={confirmedSetCount === 0}
        />
      </div>

      {/* Program context banner -- only visible in SET mode, and only
          until the first confirmed set orients the user. */}
      {!restTimer && programBannerProps && confirmedSetCount === 0 && (
        <ProgramContextBanner
          programName={programBannerProps.programName}
          blockName={programBannerProps.blockName}
          weekNumber={programBannerProps.weekNumber}
          dayLabel={programBannerProps.dayLabel}
        />
      )}

      {/* REST mode (full-page): shown when rest is active and not minimized. */}
      {restTimer && !restMinimized && (
        <RestView
          restTimer={restTimer}
          loggedGroups={loggedGroups}
          exerciseNames={exerciseNames}
          onSkip={skipRest}
          onAdjust={adjustRest}
          onMinimize={() => setRestMinimized(true)}
        />
      )}

      {/* REST mode (minimized): compact sticky banner with expand + skip. */}
      {restTimer && restMinimized && (
        <RestTimerBanner
          remaining={restTimer.remaining}
          total={restTimer.total}
          onExpand={() => setRestMinimized(false)}
          onSkip={skipRest}
        />
      )}

      {/* SET mode: only the active exercise block renders (hard focus). */}
      {(!restTimer || restMinimized) && (
        <>
          <div className="flex flex-1 flex-col gap-7 px-0 pt-2">
            {loggedGroups.map((group) => {
              // Group-level rendering: circuits render once per group
              if (group.groupType === 'CIRCUIT') {
                const circuitExercises = group.activities.map((a) => ({
                  name: exerciseNames[a.exerciseId] ?? 'Unknown',
                  targetReps: DEFAULT_CIRCUIT_REPS,
                }))
                // Hard focus: only render the active block in SET mode.
                if (group.id !== activeFocusId) return null
                return (
                  <div key={group.id} className="flex flex-1 flex-col">
                    <CircuitPanel
                      exercises={circuitExercises}
                      rounds={3}
                      onExerciseDone={async (exerciseIndex, round, actualReps) => {
                        const activity = group.activities[exerciseIndex]
                        if (!activity) {
                          console.error('[strength-workout-view] onExerciseDone: no activity at index', { exerciseIndex, round, groupId: group.id })
                          setPageError('Failed to record circuit set. Please log it manually.')
                          return
                        }
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
                          console.error('[strength-workout-view] Failed to log circuit set:', err)
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

                // Cardio and ruck activities do not have a collapsed done state --
                // hide them when skipped.
                if (
                  skippedActivityIds.has(activity.id) &&
                  (modality === 'cardio' || modality === 'ruck')
                ) {
                  return null
                }

                // Cardio panel
                if (modality === 'cardio' && exercise) {
                  return (
                    <div key={activity.id}>
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
                              actualHeartRate: data.heartRate
                                ? parseInt(data.heartRate, 10)
                                : undefined,
                            })
                          } catch (err) {
                            console.error('[strength-workout-view] cardio confirmSet:', err)
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
                    <div key={activity.id}>
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
                            console.error('[strength-workout-view] ruck confirmSet:', err)
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

                // Carry-forward prescribed values for the pending input row.
                const lastSetWithPrescription = [...activity.sets]
                  .reverse()
                  .find((s) => s.prescribed != null)
                const nextPrescribedWeight =
                  lastSetWithPrescription?.prescribed?.weight ?? undefined
                const nextPrescribedReps = lastSetWithPrescription?.prescribed?.reps ?? undefined

                // Show a pending input row by default for the first set; subsequent
                // rows require an explicit ADD SET tap. Don't add a pending row if
                // there's already an unconfirmed (completed: false) set in the list --
                // that happens when the user un-confirms a set.
                const hasUncompletedSets = activity.sets.some((s) => !s.completed)
                if (
                  (confirmedSets.length === 0 && !hasUncompletedSets) ||
                  pendingInputs[activity.id]
                ) {
                  const nextSetNumber = setRows.length + 1
                  setRows.push({
                    id: `pending-${activity.id}-${nextSetNumber}`,
                    setNumber: nextSetNumber,
                    weight:
                      lastConfirmedSet?.actualWeight?.value?.toString() ??
                      nextPrescribedWeight?.value?.toString(),
                    reps:
                      lastConfirmedSet?.actualReps?.toString() ??
                      (nextPrescribedReps != null ? String(nextPrescribedReps) : undefined),
                    confirmed: false,
                    prescribedWeight: nextPrescribedWeight,
                    prescribedReps: nextPrescribedReps,
                    isPending: true,
                  })
                }

                const isDone =
                  skippedActivityIds.has(activity.id) &&
                  !expandedDoneActivityIds.has(activity.id)

                return (
                  <div key={activity.id}>
                    <ExerciseBlock
                      exerciseName={exercise?.name ?? 'Unknown Exercise'}
                      sets={setRows}
                      loggedActivityId={activity.id}
                      onConfirmSet={handleConfirmSet}
                      isConfirming={isConfirmingSet}
                      isBodyweight={exercise?.category === 'BODYWEIGHT'}
                      isActive={activity.id === activeFocusId}
                      isDone={isDone}
                      onExpandToggle={() => handleExpandDone(activity.id)}
                      onAddSet={() =>
                        setPendingInputs((prev) => ({ ...prev, [activity.id]: true }))
                      }
                      onDeleteSet={(setId) => {
                        if (setId.startsWith('pending-')) {
                          setPendingInputs((prev) => ({ ...prev, [activity.id]: false }))
                        } else {
                          deleteSet(activity.id, setId).catch((err) => {
                            console.error('[workout-page] deleteSet failed:', { activityId: activity.id, setId, err })
                            setPageError('Failed to delete set. Please try again.')
                          })
                        }
                      }}
                      onUnconfirmSet={handleUnconfirmSet}
                      onSkipExercise={() => handleMarkDone(activity.id)}
                      onRemoveExercise={() => {
                        removeActivity(activity.id).catch((err) => {
                          console.error('[workout-page] removeActivity failed:', { activityId: activity.id, err })
                          setPageError('Failed to remove exercise. Please try again.')
                        })
                      }}
                    />
                  </div>
                )
              })
            })}
          </div>

          {/* Sticky footer -- single forward action for free-form workouts.
          Programmed workouts render no footer (the flow is predetermined). */}
          {!isProgrammedWorkout && (
            <div className="sticky bottom-0 z-40 bg-surface-anvil px-4 pt-3 pb-4">
              {allActivitiesDone && (
                <p className="mb-3 bg-surface-pit/40 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-ember">
                  ALL EXERCISES DONE -- READY TO FINISH?
                </p>
              )}
              {loggedGroups.length === 0 && !firstWorkoutCompleted && (
                <OnboardingHint hintKey="workout-add-exercise">
                  Tap below to add your first exercise.
                </OnboardingHint>
              )}
              <Button
                variant="molten"
                size="lg"
                onClick={() => setShowAddExercise(true)}
                className="min-h-14 w-full text-sm font-bold uppercase tracking-widest"
              >
                <Plus className="h-4 w-4" />
                Add exercise
              </Button>
            </div>
          )}
        </>
      )}

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
