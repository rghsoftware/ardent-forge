import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogFull } from '@/hooks/use-workout-logs'
import { ManualWorkoutForm } from '@/components/workout/manual-workout-form'
import { DeleteWorkoutDialog } from '@/components/history/delete-workout-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'

export const Route = createFileRoute('/_authenticated/log/$workoutId/edit')({
  component: ManualLogEditPage,
})

function ManualLogEditPage() {
  const { workoutId } = Route.useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const { data, isLoading, isError } = useWorkoutLogFull(workoutId)
  const [showDelete, setShowDelete] = useState(false)

  if (!userId) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10">
          <p className="font-display text-sm text-warning-flare">You must be signed in to edit a workout.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 pt-6 flex flex-col gap-3">
          <Skeleton className="h-8 w-48 rounded-none bg-surface-steel" />
          <Skeleton className="h-12 w-full rounded-none bg-surface-steel" />
          <Skeleton className="h-12 w-full rounded-none bg-surface-steel" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10 flex flex-col items-center">
          <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">cloud_off</span>
          <p className="font-display text-sm text-warning-flare">Failed to load workout</p>
          <Link to="/history" className="mt-4 text-xs text-ember">
            Back to history
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10 flex flex-col items-center">
          <Icon name="error_outline" size={48} className="mb-3 text-warm-ash/40" />
          <p className="font-display text-sm text-warm-ash">Workout not found</p>
          <Link to="/history" className="mt-4 text-xs text-ember">
            Back to history
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 pt-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/history/$workoutId"
              params={{ workoutId }}
              aria-label="Back"
              className="h-12 w-12 flex items-center justify-center text-warm-ash hover:text-bone-white"
            >
              <Icon name="arrow_back" size={24} />
            </Link>
            <h1 className="font-display text-2xl font-medium text-bone-white">Edit workout</h1>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
            className="min-h-[48px]"
          >
            Delete
          </Button>
        </div>
        <ManualWorkoutForm
          mode="edit"
          initialValue={data}
          userId={userId}
          onSaved={(id) => navigate({ to: '/history/$workoutId', params: { workoutId: id } })}
        />
      </div>
      <DeleteWorkoutDialog
        workoutId={workoutId}
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onSuccess={() => {
          setShowDelete(false)
          navigate({ to: '/history' })
        }}
      />
    </div>
  )
}
