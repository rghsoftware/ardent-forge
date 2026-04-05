import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useExercises, useRecentlyUsedExercises } from '@/hooks/use-exercises'
import type { ExerciseCategory, MuscleGroup, MovementPattern } from '@/domain/types'
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { ExerciseFilterBar } from '@/components/exercises/exercise-filter-bar'
import { ExerciseListItem } from '@/components/exercises/exercise-list-item'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'
import { Icon } from '@/components/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_authenticated/exercises/')({
  component: ExercisesPage,
})

function ExerciseListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-b-[rgba(91,64,57,0.15)] bg-surface-iron px-4 py-3"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded-none bg-surface-steel" />
            <Skeleton className="h-3 w-24 rounded-none bg-surface-steel" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ExercisesPage() {
  const { user } = useAuth()
  const userId = user?.id

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | undefined>()
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<MuscleGroup | undefined>()
  const [activeMovementPattern, setActiveMovementPattern] = useState<MovementPattern | undefined>()
  const [showCreateSheet, setShowCreateSheet] = useState(false)

  const debouncedQuery = useDebouncedValue(searchQuery, 200)

  const hasActiveFilters =
    !!debouncedQuery || !!activeCategory || !!activeMuscleGroup || !!activeMovementPattern

  const {
    data: exercises,
    isLoading: isLoadingExercises,
    isError,
  } = useExercises({
    searchQuery: debouncedQuery || undefined,
    category: activeCategory,
    muscleGroup: activeMuscleGroup,
    movementPattern: activeMovementPattern,
  })

  const { data: recentlyUsed, isLoading: isLoadingRecent } = useRecentlyUsedExercises(userId)

  const isLoading = isLoadingExercises || (!hasActiveFilters && isLoadingRecent)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Icon name="fitness_center" size={24} className="text-warm-ash" />
        <h1 className="font-display text-2xl font-medium text-bone-white">Exercise Library</h1>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <ExerciseSearchInput value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Filters */}
      <div className="px-4 pb-4">
        <ExerciseFilterBar
          activeCategory={activeCategory}
          activeMuscleGroup={activeMuscleGroup}
          activeMovementPattern={activeMovementPattern}
          onCategoryChange={setActiveCategory}
          onMuscleGroupChange={setActiveMuscleGroup}
          onMovementPatternChange={setActiveMovementPattern}
        />
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ExerciseListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
              cloud_off
            </span>
            <p className="font-display text-sm text-warning-flare">Failed to load exercises</p>
            <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
          </div>
        ) : hasActiveFilters ? (
          /* Filtered/search results -- no section headers */
          <>
            {exercises && exercises.length > 0 ? (
              exercises.map((exercise) => (
                <ExerciseListItem key={exercise.id} exercise={exercise} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-16">
                <span className="material-symbols-outlined mb-3 text-4xl text-warm-ash/40">
                  search_off
                </span>
                <p className="font-display text-sm text-warm-ash">No exercises found</p>
              </div>
            )}
          </>
        ) : (
          /* Default view -- recently used + all exercises */
          <>
            {recentlyUsed && recentlyUsed.length > 0 && (
              <>
                <div className="px-4 py-2">
                  <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                    RECENTLY USED
                  </h2>
                </div>
                {recentlyUsed.map((exercise) => (
                  <ExerciseListItem key={exercise.id} exercise={exercise} />
                ))}
                <div className="h-4" />
              </>
            )}

            <div className="px-4 py-2">
              <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                ALL EXERCISES
              </h2>
            </div>
            {exercises && exercises.length > 0 ? (
              exercises.map((exercise) => (
                <ExerciseListItem key={exercise.id} exercise={exercise} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-16">
                <p className="font-display text-sm text-warm-ash">No exercises found</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create custom exercise button */}
      <div className="px-4 py-4">
        <Button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          className="min-h-12 w-full bg-forge text-on-forge text-xs font-medium"
        >
          Create custom exercise
        </Button>
      </div>

      <CreateExerciseSheet open={showCreateSheet} onOpenChange={setShowCreateSheet} />
    </div>
  )
}
