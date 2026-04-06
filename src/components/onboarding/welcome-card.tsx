import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useOnboarding } from '@/hooks/use-onboarding'
import { useWorkoutLogs } from '@/hooks/use-workout-logs'
import { Icon } from '@/components/icon'

const PATHS = [
  {
    label: 'Log a workout',
    icon: 'fitness_center',
    to: '/' as const,
  },
  {
    label: 'Browse exercises',
    icon: 'exercise',
    to: '/exercises' as const,
  },
  {
    label: 'Build a program',
    icon: 'construction',
    to: '/builder' as const,
  },
] as const

export function WelcomeCard() {
  const { isFirstRun, dismissWelcome } = useOnboarding()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: workoutLogs, isError } = useWorkoutLogs(userId, 1)

  const hasExistingWorkouts = (workoutLogs?.length ?? 0) > 0

  // Silently dismiss for existing users who already have workout history
  useEffect(() => {
    if (isFirstRun && hasExistingWorkouts) {
      dismissWelcome()
    }
  }, [isFirstRun, hasExistingWorkouts, dismissWelcome])

  if (!isFirstRun || hasExistingWorkouts || isError) return null

  const handlePathClick = (to: string) => {
    dismissWelcome()
    navigate({ to })
  }

  return (
    <div
      className="relative border-l-2 border-ember bg-surface-iron px-4 py-5 motion-safe:animate-[hint-fade-in_300ms_ease-out]"
      data-testid="welcome-card"
    >
      <button
        type="button"
        onClick={() => dismissWelcome()}
        className="absolute top-2 right-2 flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-bone-white"
        aria-label="Dismiss welcome"
      >
        <Icon name="close" size={18} />
      </button>

      <div className="flex flex-col gap-4 pr-10">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm text-bone-white">Welcome to Ardent Forge</h2>
          <p className="text-xs text-warm-ash/60">Choose where to start.</p>
        </div>

        <div className="flex flex-col gap-2">
          {PATHS.map((path) => (
            <button
              key={path.to}
              type="button"
              onClick={() => handlePathClick(path.to)}
              className="flex min-h-12 items-center gap-3 bg-surface-charcoal px-4 py-3 text-left text-xs text-bone-white hover:bg-surface-gunmetal"
              data-testid={`welcome-path-${path.to}`}
            >
              <Icon name={path.icon} size={20} className="text-ember" />
              <span className="font-medium">{path.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
