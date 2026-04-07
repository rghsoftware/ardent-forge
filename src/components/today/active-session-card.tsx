import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'

/**
 * ActiveSessionCard -- shown on the Forge page when the user has navigated
 * away from an in-progress (non-paused) workout via browser back, link
 * click, etc. The active workout store still holds the session, so this
 * card surfaces a "Resume" CTA that returns the user to /log/$workoutId.
 *
 * Mutually exclusive with PausedSessionCard:
 *   - If the in-store workoutLog has pausedAt, PausedSessionCard handles it.
 *   - Otherwise this card renders.
 *
 * Returns null when there is no active session in the store.
 */
export function ActiveSessionCard() {
  const navigate = useNavigate()
  const workoutLog = useActiveWorkoutStore((s) => s.workoutLog)

  if (!workoutLog || workoutLog.pausedAt) return null

  const handleResume = () => {
    navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
  }

  return (
    <div className="milled-edge flex flex-col gap-4 border-l-2 border-ember bg-surface-iron p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center bg-ember px-2 py-0.5 font-heading text-[11px] uppercase tracking-widest text-surface-pit">
          IN PROGRESS
        </span>
        <span className="font-heading text-[11px] uppercase tracking-widest text-warm-ash/60">
          Started
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-heading text-base text-bone-white">
          {workoutLog.title || 'Active session'}
        </span>
      </div>

      <Button
        variant="molten"
        className="min-h-12 w-full text-xs font-medium"
        onClick={handleResume}
      >
        Continue session
      </Button>
    </div>
  )
}
