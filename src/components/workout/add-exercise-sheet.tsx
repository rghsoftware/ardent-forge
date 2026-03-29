import { useState, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { useExercises, useRecentlyUsedExercises } from '@/hooks/use-exercises'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { Exercise, GroupType } from '@/domain/types'

interface AddExerciseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExerciseSelected: (exercise: Exercise, groupType: GroupType) => void
  userId?: string
}

export function AddExerciseSheet({
  open,
  onOpenChange,
  onExerciseSelected,
  userId,
}: AddExerciseSheetProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const { data: allExercises = [] } = useExercises()
  const { data: recentExercises = [] } = useRecentlyUsedExercises(userId)

  // Filter exercises by search query
  const filteredExercises =
    debouncedQuery.length > 0
      ? allExercises.filter(
          (ex) =>
            ex.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            ex.aliases.some((a) => a.toLowerCase().includes(debouncedQuery.toLowerCase())),
        )
      : []

  const handleSelect = useCallback(
    (exercise: Exercise) => {
      onExerciseSelected(exercise, 'STRAIGHT_SETS')
      onOpenChange(false)
      setSearchQuery('')
    },
    [onExerciseSelected, onOpenChange],
  )

  const showRecent = debouncedQuery.length === 0 && recentExercises.length > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] bg-surface-anvil p-0">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle className="text-xs text-ember">Add Exercise</SheetTitle>
          <SheetDescription className="sr-only">
            Search and select an exercise to add to your workout
          </SheetDescription>
        </SheetHeader>

        {/* Search input */}
        <div className="px-4 pt-2">
          <ExerciseSearchInput value={searchQuery} onChange={setSearchQuery} autoFocus={open} />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Recently used */}
          {showRecent && (
            <div className="mb-4">
              <span className="mb-2 block text-[10px] uppercase tracking-widest text-warm-ash/60">
                RECENTLY USED
              </span>
              <div className="flex flex-col">
                {recentExercises.map((ex) => (
                  <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {debouncedQuery.length > 0 && (
            <div>
              {filteredExercises.length === 0 ? (
                <p className="py-8 text-center text-xs text-warm-ash/60">No matches</p>
              ) : (
                <div className="flex flex-col">
                  {filteredExercises.map((ex) => (
                    <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state when no search and no recent */}
          {debouncedQuery.length === 0 && recentExercises.length === 0 && (
            <p className="py-8 text-center text-xs text-warm-ash/60">Type to search exercises</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// ExerciseRow -- single exercise in the search results
// ---------------------------------------------------------------------------

function ExerciseRow({
  exercise,
  onSelect,
}: {
  exercise: Exercise
  onSelect: (exercise: Exercise) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(exercise)}
      className="flex min-h-12 w-full items-center gap-3 bg-transparent px-1 py-2 text-left transition-colors hover:bg-surface-charcoal"
    >
      <span className="material-symbols-outlined text-warm-ash/60 text-xl">fitness_center</span>
      <div className="flex flex-col">
        <span className="text-sm text-bone-white">{exercise.name}</span>
        <span className="text-[10px] uppercase tracking-wider text-warm-ash/60">
          {exercise.category}
        </span>
      </div>
    </button>
  )
}
