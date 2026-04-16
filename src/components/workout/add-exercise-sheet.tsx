import { useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ExercisePickerPanel } from './exercise-picker-panel'
import { useFrequentExercises } from '@/hooks/use-frequent-exercises'
import type { Exercise } from '@/domain/types'

interface AddExerciseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExerciseSelected: (exercise: Exercise) => void
  userId?: string
}

/**
 * Thin sheet wrapper around ExercisePickerPanel. Retained for legacy
 * consumers (log.$workoutId, manual-workout-form, session-edit-sheet).
 * New template routes should use ExercisePickerDrawer instead to avoid
 * the sheet-inside-sheet anti-pattern.
 */
export function AddExerciseSheet({
  open,
  onOpenChange,
  onExerciseSelected,
  userId,
}: AddExerciseSheetProps) {
  const { data: frequentExercises = [], isError: frequentFailed } = useFrequentExercises(userId)
  if (frequentFailed) {
    console.warn('[add-exercise-sheet] Frequent exercises query failed; showing empty state')
  }

  const handleSelected = useCallback(
    (exercise: Exercise) => {
      onExerciseSelected(exercise)
      onOpenChange(false)
    },
    [onExerciseSelected, onOpenChange],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[80vh] flex-col bg-surface-anvil p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-xs text-ember">Add Exercise</SheetTitle>
          <SheetDescription className="sr-only">
            Search and select an exercise to add to your workout
          </SheetDescription>
        </SheetHeader>

        <ExercisePickerPanel
          userId={userId}
          onExerciseSelected={handleSelected}
          autoFocus={open}
          frequentExercises={frequentExercises}
        />
      </SheetContent>
    </Sheet>
  )
}
