import { useMemo } from 'react'
import { SetRow } from '@/components/workout/set-row'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { NoteAffordance } from '@/components/workout/notes/note-affordance'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import type { SetType, NoteContent } from '@/domain/types'

interface SetRowData {
  id: string
  setNumber: number
  weight?: string
  reps?: string
  confirmed: boolean
  prescribedWeight?: { value: number; unit: string }
  prescribedReps?: number
  isPending?: boolean
}

interface ExerciseBlockProps {
  exerciseName: string
  sets: SetRowData[]
  loggedActivityId: string
  onConfirmSet: (
    loggedActivityId: string,
    setNumber: number,
    weight: string,
    reps: string,
    setType: SetType,
  ) => void
  isConfirming?: boolean
  isBodyweight?: boolean
  isActive?: boolean
  isDone?: boolean
  onSkipExercise?: () => void
  onExpandToggle?: () => void
  onAddSet?: () => void
  onDeleteSet?: (setId: string) => void
  onUnconfirmSet?: (loggedActivityId: string, setId: string) => void
  onRemoveExercise?: () => void
  /** Called when the user first edits the pending (pre-filled) input row. */
  onPendingDirty?: () => void
}

export function ExerciseBlock({
  exerciseName,
  sets,
  loggedActivityId,
  onConfirmSet,
  isConfirming = false,
  isBodyweight = false,
  isActive = true,
  isDone = false,
  onSkipExercise,
  onExpandToggle,
  onAddSet,
  onDeleteSet,
  onUnconfirmSet,
  onRemoveExercise,
  onPendingDirty,
}: ExerciseBlockProps) {
  const firstWorkoutCompleted = useOnboardingStore((s) => s.firstWorkoutCompleted)
  const hasPrescribed = sets.some((s) => s.prescribedWeight != null || s.prescribedReps != null)
  const noSetsConfirmed = !firstWorkoutCompleted && sets.every((s) => !s.confirmed)
  const confirmedCount = sets.filter((s) => s.confirmed).length

  const setActivityNote = useActiveWorkoutStore((s) => s.setActivityNote)
  const storedActivity = useActiveWorkoutStore((s) => {
    for (const g of s.loggedGroups) {
      const match = g.activities.find((a) => a.id === loggedActivityId)
      if (match) return match
    }
    return undefined
  })
  const activityNote = useMemo<NoteContent>(
    () => ({ text: storedActivity?.notes ?? '', tags: storedActivity?.noteTags ?? [] }),
    [storedActivity?.notes, storedActivity?.noteTags],
  )

  if (isDone) {
    return (
      <section aria-label={`${exerciseName} exercise`} className="bg-surface-pit/40">
        <div className="flex items-center gap-3 px-4 py-3">
          <h3 className="min-w-0 flex-1 truncate font-display text-xs font-medium text-warm-ash/60">
            {exerciseName}
          </h3>
          <span className="shrink-0 bg-surface-gunmetal px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-warm-ash/60">
            {confirmedCount} {confirmedCount === 1 ? 'SET' : 'SETS'}
          </span>
          <button
            type="button"
            onClick={onExpandToggle}
            aria-label={`Expand ${exerciseName}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center text-warm-ash/60 transition-colors hover:text-warm-ash active:text-ember"
          >
            <Icon name="chevron_right" size={20} />
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={`${exerciseName} exercise`}
      data-active={isActive ? 'true' : 'false'}
      className={cn(
        'transition-colors duration-300 ease-out',
        isActive ? 'bg-surface-iron' : 'bg-surface-pit',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3
          className={cn(
            'font-display text-xs font-medium transition-colors duration-300 ease-out',
            isActive ? 'text-ember' : 'text-ember/40',
          )}
        >
          {exerciseName}
        </h3>
        <div className="flex items-center gap-3">
          <NoteAffordance
            value={activityNote}
            onChange={(next) => setActivityNote(loggedActivityId, next)}
            level="exercise"
            variant="inline"
          />
          {onRemoveExercise && (
            <button
              type="button"
              onClick={onRemoveExercise}
              className="flex h-12 w-12 items-center justify-center text-warm-ash/40 transition-colors hover:text-red-500 active:text-red-600"
              aria-label={`Remove ${exerciseName}`}
            >
              <Icon name="delete" size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      {hasPrescribed ? (
        <div className="flex items-center gap-2 px-4 py-1">
          <span className="w-12 shrink-0 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            SET
          </span>
          <span className="flex-1 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            PRESCRIBED
          </span>
          <span className="flex-1 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            ACTUAL
          </span>
          <span className="w-14 shrink-0 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            STATUS
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-1">
          <span className="w-12 shrink-0 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            SET
          </span>
          <span className="flex-1 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            {isBodyweight ? 'BW' : 'WEIGHT'}
          </span>
          <span className="flex-1 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            REPS
          </span>
          <span className="w-14 shrink-0 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
            STATUS
          </span>
        </div>
      )}

      {/* First-set onboarding hint */}
      {noSetsConfirmed && (
        <OnboardingHint hintKey="workout-first-set" position="above" className="mx-4">
          Enter weight and reps, then confirm your set.
        </OnboardingHint>
      )}

      <div className="flex flex-col gap-[0.4rem]">
        {sets.map((set) => {
          const isThisPending = !set.confirmed && set.id.startsWith('pending-')
          return (
            <SetRow
              key={set.id}
              setNumber={set.setNumber}
              initialWeight={set.weight}
              initialReps={set.reps}
              confirmed={set.confirmed}
              isConfirming={isConfirming}
              prescribedWeight={set.prescribedWeight}
              prescribedReps={set.prescribedReps}
              isBodyweight={isBodyweight}
              isPending={isThisPending}
              onPendingDirty={isThisPending ? onPendingDirty : undefined}
              onConfirm={(weight, reps, setType) =>
                onConfirmSet(loggedActivityId, set.setNumber, weight, reps, setType)
              }
              onDelete={onDeleteSet ? () => onDeleteSet(set.id) : undefined}
              onUnconfirm={
                set.confirmed && onUnconfirmSet
                  ? () => onUnconfirmSet(loggedActivityId, set.id)
                  : undefined
              }
            />
          )
        })}
      </div>
      {(onAddSet || onSkipExercise) && (
        <div className="flex px-4 pb-3 pt-1">
          {onAddSet && (
            <button
              type="button"
              onClick={onAddSet}
              className="min-h-12 flex-1 py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60 transition-colors hover:text-warm-ash active:text-ember"
            >
              Add set
            </button>
          )}
          {onSkipExercise && (
            <button
              type="button"
              onClick={onSkipExercise}
              className="min-h-12 flex-1 py-2 text-xs font-bold uppercase tracking-widest text-warm-ash/60 transition-colors hover:text-warm-ash active:text-ember"
            >
              Done
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export type { SetRowData }
