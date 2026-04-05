import { cn } from '@/lib/utils'
import { formatCountdown } from '@/lib/format-duration'
import { useTimerInterpolation } from '@/hooks/use-timer-interpolation'
import type { RestTimerState } from '@/domain/types/display-snapshot'

interface RestTimerDisplayProps {
  restTimer: RestTimerState
  variant: 'compact' | 'large'
}

function RestTimerDisplay({ restTimer, variant }: RestTimerDisplayProps) {
  const remaining = useTimerInterpolation(restTimer)

  if (remaining === 0) return null

  const formatted = formatCountdown(remaining)

  if (variant === 'compact') {
    return (
      <span className="inline-block bg-surface-steel px-3 py-1 font-display text-[1.75rem] text-ember">
        {formatted}
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-surface-steel px-6 py-4',
        remaining < 10 && 'animate-[ember-pulse_1s_ease-in-out_infinite]',
      )}
    >
      <span className="text-readout text-ember">{formatted}</span>
    </div>
  )
}

export { RestTimerDisplay }
