import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useWorkoutLogFull } from '@/hooks/use-workout-logs'
import { useExercises } from '@/hooks/use-exercises'
import { WorkoutDetailHeader } from '@/components/history/workout-detail-header'
import { WorkoutDetailExercises } from '@/components/history/workout-detail-exercises'
import { DeleteWorkoutDialog } from '@/components/history/delete-workout-dialog'
import { EventDetail } from '@/components/event-builder/event-detail'
import { ShareDialog } from '@/components/sharing/share-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@tanstack/react-router'
import { Icon } from '@/components/icon'

export const Route = createFileRoute('/_authenticated/history/$workoutId')({
  component: WorkoutDetailPage,
})

function WorkoutDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      {/* Back button skeleton */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Skeleton className="h-12 w-12 rounded-none bg-surface-steel" />
        <Skeleton className="h-6 w-48 rounded-none bg-surface-steel" />
      </div>

      {/* Duration skeleton */}
      <div className="flex flex-col items-center py-4">
        <Skeleton className="h-14 w-32 rounded-none bg-surface-steel" />
        <Skeleton className="mt-2 h-3 w-16 rounded-none bg-surface-steel" />
      </div>

      {/* Stats row skeleton */}
      <div className="flex gap-0 px-4 pb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center bg-surface-iron py-3">
            <Skeleton className="h-8 w-12 rounded-none bg-surface-steel" />
            <Skeleton className="mt-1 h-3 w-10 rounded-none bg-surface-steel" />
          </div>
        ))}
      </div>

      {/* Exercise blocks skeleton */}
      <div className="flex flex-col gap-6 px-4 pb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-4 w-40 rounded-none bg-surface-steel" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className={`flex items-center py-2 ${j % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'}`}
              >
                <Skeleton className="ml-3 h-4 w-8 rounded-none bg-surface-steel" />
                <Skeleton className="ml-4 h-4 w-24 rounded-none bg-surface-steel" />
                <Skeleton className="ml-auto mr-3 h-5 w-14 rounded-none bg-surface-steel" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkoutDetailPage() {
  const { workoutId } = Route.useParams()
  const navigate = useNavigate()

  const { data: workoutData, isLoading, isError } = useWorkoutLogFull(workoutId)
  const { data: exercises = [] } = useExercises()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDeleteSuccess = () => {
    setShowDeleteDialog(false)
    navigate({ to: '/history' })
  }

  if (isLoading) {
    return <WorkoutDetailSkeleton />
  }

  if (isError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil px-4">
        <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
          cloud_off
        </span>
        <p className="font-display text-sm text-warning-flare">
          Failed to load workout
        </p>
        <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
        <Link to="/history" className="mt-4 text-xs text-ember">
          Back to history
        </Link>
      </div>
    )
  }

  if (!workoutData) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil px-4">
        <Icon name="error_outline" size={48} className="mb-3 text-warm-ash/40" />
        <p className="font-display text-sm text-warm-ash">
          Workout not found
        </p>
        <Link to="/history" className="mt-4 text-xs text-ember">
          Back to history
        </Link>
      </div>
    )
  }

  const { log, groups, activities, sets } = workoutData

  // -------------------------------------------------------------------------
  // Event log: render EventDetail instead of exercise breakdown
  // -------------------------------------------------------------------------

  if (log.eventMetadata) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl md:px-6 lg:px-8">
          <WorkoutDetailHeader
            log={log}
            allSets={sets}
            onDelete={() => setShowDeleteDialog(true)}
            shareAction={
              <ShareDialog
                entityType="WORKOUT_LOG"
                entityId={workoutId}
                trigger={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 min-h-10 text-xs uppercase tracking-wider"
                  >
                    <Icon name="share" size={16} />
                    Share
                  </Button>
                }
              />
            }
          />

          <EventDetail
            workoutLogId={workoutId}
            eventMetadata={log.eventMetadata}
            interactive={false}
          />
        </div>

        {/* Delete dialog */}
        <DeleteWorkoutDialog
          workoutId={workoutId}
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl md:px-6 lg:px-8">
        <WorkoutDetailHeader
          log={log}
          allSets={sets}
          onDelete={() => setShowDeleteDialog(true)}
          shareAction={
            <ShareDialog
              entityType="WORKOUT_LOG"
              entityId={workoutId}
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 min-h-10 text-xs uppercase tracking-wider"
                >
                  <Icon name="share" size={16} />
                  Share
                </Button>
              }
            />
          }
        />

        {/* Exercise breakdown */}
        <WorkoutDetailExercises
          groups={groups}
          activities={activities}
          sets={sets}
          exercises={exercises}
        />
      </div>

      {/* Delete dialog */}
      <DeleteWorkoutDialog
        workoutId={workoutId}
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  )
}
