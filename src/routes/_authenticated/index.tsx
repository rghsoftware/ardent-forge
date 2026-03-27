import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogs } from '@/hooks/use-workout-logs'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { CrashRecoveryDialog } from '@/components/workout/crash-recovery-dialog'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import type { WorkoutLog } from '@/domain/types'

export const Route = createFileRoute('/_authenticated/')({
  component: TodayPage,
})

function TodayPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { startWorkout, isStarting } = useActiveWorkout()
  const userId = user?.id ?? ''
  const { data: recentWorkouts = [] } = useWorkoutLogs(userId, 5)
  const [startError, setStartError] = useState<string | null>(null)

  // Filter to only completed workouts for the recent list
  const completedWorkouts = recentWorkouts.filter((w) => !!w.completedAt)

  const handleStartWorkout = async () => {
    if (!userId) return
    setStartError(null)
    try {
      const workoutLog = await startWorkout(userId)
      navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
    } catch {
      setStartError('Failed to start workout. Check your connection and try again.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-anvil p-4 gap-6">
      {/* Crash recovery check */}
      <CrashRecoveryDialog userId={userId} />

      {/* Hero CTA */}
      <div className="mt-8 flex flex-col gap-2">
        <Button
          variant="molten"
          className="w-full h-16 text-base uppercase tracking-widest font-medium"
          onClick={handleStartWorkout}
          disabled={isStarting || !userId}
        >
          {isStarting ? 'STARTING...' : 'EXECUTE WORKOUT'}
        </Button>
        {startError && (
          <p className="text-xs text-warning-flare text-center uppercase tracking-wider">
            {startError}
          </p>
        )}
      </div>

      {/* Recent workouts */}
      {completedWorkouts.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-warm-ash/60 mb-3 font-heading">
            RECENT SESSIONS
          </h2>
          <div className="flex flex-col gap-2">
            {completedWorkouts.map((workout) => (
              <RecentWorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {completedWorkouts.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-warm-ash/40">
          <span
            className="material-symbols-outlined text-5xl"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
          >
            fitness_center
          </span>
          <p className="text-sm uppercase tracking-widest font-heading">NO SESSIONS YET</p>
          <p className="text-xs uppercase tracking-wider">TAP EXECUTE WORKOUT TO BEGIN</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecentWorkoutCard
// ---------------------------------------------------------------------------

function RecentWorkoutCard({ workout }: { workout: WorkoutLog }) {
  const startedAt = new Date(workout.startedAt)
  const completedAt = workout.completedAt ? new Date(workout.completedAt) : null

  const dateLabel = startedAt
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()

  const duration = completedAt
    ? formatDuration(Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
    : null

  return (
    <div className="flex items-center justify-between bg-surface-iron px-4 py-3 milled-edge">
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-sm text-bone-white uppercase tracking-wider">
          {workout.title ?? dateLabel}
        </span>
        <span className="text-xs text-warm-ash/60 uppercase tracking-wider">{dateLabel}</span>
      </div>

      {duration && (
        <span className="font-display text-sm text-warm-ash tabular-nums">{duration}</span>
      )}
    </div>
  )
}
