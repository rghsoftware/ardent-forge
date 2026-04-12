import { useState, useCallback } from 'react'
import { Icon } from '@/components/icon'
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { useExercises, useRecentlyUsedExercises } from '@/hooks/use-exercises'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { Exercise } from '@/domain/types'

export interface ExercisePickerPanelProps {
  userId?: string
  onExerciseSelected: (exercise: Exercise) => void
  autoFocus?: boolean
}

/**
 * Headless exercise picker panel. No Sheet/Dialog/portal — pure UI.
 * Consumed by AddExerciseSheet (legacy sheet wrapper) and
 * ExercisePickerDrawer (new template-route drawer).
 */
export function ExercisePickerPanel({
  userId,
  onExerciseSelected,
  autoFocus = true,
}: ExercisePickerPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const { data: allExercises = [], isError: exercisesFailed } = useExercises()
  const { data: recentExercises = [] } = useRecentlyUsedExercises(userId)

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
      onExerciseSelected(exercise)
      setSearchQuery('')
    },
    [onExerciseSelected],
  )

  const showRecent = debouncedQuery.length === 0 && recentExercises.length > 0

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ExerciseSearchInput value={searchQuery} onChange={setSearchQuery} autoFocus={autoFocus} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {exercisesFailed && (
          <p className="py-8 text-center text-xs text-destructive">
            Could not load exercises. Check your connection and try again.
          </p>
        )}

        {!exercisesFailed && showRecent && (
          <div className="mb-4">
            <span className="mb-2 block text-[11px] uppercase tracking-widest text-warm-ash/60">
              RECENTLY USED
            </span>
            <div className="flex flex-col">
              {recentExercises.map((ex) => (
                <ExerciseRow key={ex.id} exercise={ex} onSelect={handleSelect} />
              ))}
            </div>
          </div>
        )}

        {!exercisesFailed && debouncedQuery.length > 0 && (
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

        {!exercisesFailed && debouncedQuery.length === 0 && recentExercises.length === 0 && (
          <p className="py-8 text-center text-xs text-warm-ash/60">Type to search exercises</p>
        )}
      </div>
    </div>
  )
}

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
      <Icon name="fitness_center" size={20} className="shrink-0 text-warm-ash/60" />
      <div className="flex flex-col">
        <span className="text-sm text-bone-white">{exercise.name}</span>
        <span className="text-[11px] uppercase tracking-wider text-warm-ash/60">
          {exercise.category}
        </span>
      </div>
    </button>
  )
}
