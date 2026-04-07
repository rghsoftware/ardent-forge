import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { ManualWorkoutForm } from '@/components/workout/manual-workout-form'
import { Icon } from '@/components/icon'

export const Route = createFileRoute('/_authenticated/log/new')({
  component: ManualLogNewPage,
})

function ManualLogNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  if (!userId) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10">
          <p className="font-display text-sm text-warning-flare">
            You must be signed in to log a workout.
          </p>
          <Link to="/" className="mt-4 inline-block text-xs text-ember">
            Back to Forge
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/"
            aria-label="Back"
            className="h-12 w-12 flex items-center justify-center text-warm-ash hover:text-bone-white"
          >
            <Icon name="arrow_back" size={24} />
          </Link>
          <h1 className="font-display text-2xl font-medium text-bone-white">Log past workout</h1>
        </div>
        <ManualWorkoutForm
          mode="create"
          userId={userId}
          onSaved={(id) => navigate({ to: '/history/$workoutId', params: { workoutId: id } })}
        />
      </div>
    </div>
  )
}
