import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  useExercises,
  useRecentlyUsedExercises,
  usePublishExercise,
  useUnpublishExercise,
} from '@/hooks/use-exercises'
import type { ExerciseCategory, MuscleGroup, MovementPattern, Exercise } from '@/domain/types'
import { ExerciseSearchInput } from '@/components/exercises/exercise-search-input'
import { ExerciseFilterBar } from '@/components/exercises/exercise-filter-bar'
import { ExerciseListItem } from '@/components/exercises/exercise-list-item'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'
import { ScopeToggle } from '@/components/shared/scope-toggle'
import { PublishDialog } from '@/components/library/publish-dialog'
import { Icon } from '@/components/icon'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useOnboarding } from '@/hooks/use-onboarding'
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
  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/exercises')
  }, [markRouteVisited])

  const [scope, setScope] = useState<'mine' | 'public'>('mine')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ExerciseCategory | undefined>()
  const [activeMuscleGroup, setActiveMuscleGroup] = useState<MuscleGroup | undefined>()
  const [activeMovementPattern, setActiveMovementPattern] = useState<MovementPattern | undefined>()
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [publishTarget, setPublishTarget] = useState<Exercise | null>(null)

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
    scope,
  })

  const { data: recentlyUsed, isLoading: isLoadingRecent } = useRecentlyUsedExercises(userId)

  const publishExercise = usePublishExercise()
  const unpublishExercise = useUnpublishExercise()

  const isLoading = isLoadingExercises || (scope === 'mine' && !hasActiveFilters && isLoadingRecent)

  const handlePublishConfirm = () => {
    if (!publishTarget) {
      console.error('[exercises] Cannot publish: no target exercise selected')
      return
    }
    publishExercise.mutate(publishTarget.id, {
      onSuccess: () => setPublishTarget(null),
    })
  }

  const handleUnpublish = (exercise: Exercise) => {
    unpublishExercise.mutate(exercise.id)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Icon name="fitness_center" size={24} className="text-warm-ash" />
        <h1 className="font-display text-2xl font-medium text-bone-white">Exercise Library</h1>
      </div>

      {/* Scope toggle */}
      <div className="px-4 pt-2 pb-1">
        <ScopeToggle value={scope} onChange={setScope} />
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
                <ExerciseListItemWithActions
                  key={exercise.id}
                  exercise={exercise}
                  scope={scope}
                  onPublish={setPublishTarget}
                  onUnpublish={handleUnpublish}
                />
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
          /* Default view */
          <>
            {/* Recently used -- only shown in "mine" scope */}
            {scope === 'mine' && recentlyUsed && recentlyUsed.length > 0 && (
              <>
                <div className="px-4 py-2">
                  <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                    RECENTLY USED
                  </h2>
                </div>
                {recentlyUsed.map((exercise) => (
                  <ExerciseListItemWithActions
                    key={exercise.id}
                    exercise={exercise}
                    scope={scope}
                    onPublish={setPublishTarget}
                    onUnpublish={handleUnpublish}
                  />
                ))}
                <div className="h-4" />
              </>
            )}

            <div className="px-4 py-2">
              <h2 className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                {scope === 'mine' ? 'ALL EXERCISES' : 'PUBLIC EXERCISES'}
              </h2>
            </div>
            {exercises && exercises.length > 0 ? (
              exercises.map((exercise) => (
                <ExerciseListItemWithActions
                  key={exercise.id}
                  exercise={exercise}
                  scope={scope}
                  onPublish={setPublishTarget}
                  onUnpublish={handleUnpublish}
                />
              ))
            ) : (
              <EmptyState
                icon="fitness_center"
                heading={scope === 'mine' ? 'No exercises found' : 'No public exercises yet'}
                subtext={
                  scope === 'mine'
                    ? 'Exercises will appear here after your first workout, or create a custom exercise below.'
                    : 'Public exercises shared by the community will appear here.'
                }
              />
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

      {/* Publish confirmation dialog */}
      <PublishDialog
        open={!!publishTarget}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null)
        }}
        mode="exercise"
        entityName={publishTarget?.name ?? ''}
        onConfirm={handlePublishConfirm}
        isPublishing={publishExercise.isPending}
      />
    </div>
  )
}

/** Wraps ExerciseListItem with optional publish/unpublish actions for custom exercises */
function ExerciseListItemWithActions({
  exercise,
  scope,
  onPublish,
  onUnpublish,
}: {
  exercise: Exercise
  scope: 'mine' | 'public'
  onPublish: (exercise: Exercise) => void
  onUnpublish: (exercise: Exercise) => void
}) {
  // For custom exercises in "mine" scope, show publish/unpublish action
  const showPublishAction = exercise.isCustom && scope === 'mine'

  if (!showPublishAction) {
    return <ExerciseListItem exercise={exercise} />
  }

  return (
    <div className="flex items-center bg-surface-iron">
      <div className="min-w-0 flex-1">
        <ExerciseListItem exercise={exercise} />
      </div>
      <div className="shrink-0 pr-4">
        {exercise.isPublic ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onUnpublish(exercise)
            }}
            className="flex min-h-[36px] items-center gap-1 px-2 text-xs text-warm-ash hover:text-bone-white"
            aria-label={`Unpublish ${exercise.name}`}
          >
            <span className="material-symbols-outlined text-base">visibility_off</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onPublish(exercise)
            }}
            className="flex min-h-[36px] items-center gap-1 px-2 text-xs text-ember hover:brightness-110"
            aria-label={`Publish ${exercise.name}`}
          >
            <span className="material-symbols-outlined text-base">publish</span>
          </button>
        )}
      </div>
    </div>
  )
}
