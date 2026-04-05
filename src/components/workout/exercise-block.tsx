import { SetRow } from '@/components/workout/set-row'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useOnboardingStore } from '@/stores/onboarding-store'
import type { SetType } from '@/domain/types'

interface SetRowData {
  id: string
  setNumber: number
  weight?: string
  reps?: string
  confirmed: boolean
  prescribedWeight?: { value: number; unit: string }
  prescribedReps?: number
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
}

export function ExerciseBlock({
  exerciseName,
  sets,
  loggedActivityId,
  onConfirmSet,
  isConfirming = false,
}: ExerciseBlockProps) {
  const firstWorkoutCompleted = useOnboardingStore((s) => s.firstWorkoutCompleted)
  const hasPrescribed = sets.some((s) => s.prescribedWeight != null || s.prescribedReps != null)
  const noSetsConfirmed = !firstWorkoutCompleted && sets.every((s) => !s.confirmed)

  return (
    <section className="bg-surface-iron" aria-label={`${exerciseName} exercise`}>
      {/* Exercise name header */}
      <div className="px-4 pt-4 pb-2">
        <h3 className="font-display text-xs font-medium text-ember">{exerciseName}</h3>
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
            WEIGHT
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

      {/* Set rows */}
      <div className="flex flex-col gap-[0.4rem]">
        {sets.map((set) => (
          <SetRow
            key={set.id}
            setNumber={set.setNumber}
            initialWeight={set.weight}
            initialReps={set.reps}
            confirmed={set.confirmed}
            isConfirming={isConfirming}
            prescribedWeight={set.prescribedWeight}
            prescribedReps={set.prescribedReps}
            onConfirm={(weight, reps, setType) =>
              onConfirmSet(loggedActivityId, set.setNumber, weight, reps, setType)
            }
          />
        ))}
      </div>
    </section>
  )
}

export type { SetRowData }
