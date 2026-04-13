import { formatCountdown } from '@/lib/format-duration'

interface RestTimerBannerProps {
  /** Seconds remaining on the rest countdown. */
  remaining: number
  /** Total rest duration in seconds (used to compute progress bar width). */
  total: number
  /** Expand back to the full-page rest view. */
  onExpand: () => void
  /** Skip rest immediately. */
  onSkip: () => void
}

/**
 * Compact sticky strip shown when the rest timer is minimized.
 * Renders below the exercise view so the user can keep logging notes
 * or reviewing sets while the countdown runs in the background.
 */
export function RestTimerBanner({ remaining, total, onExpand, onSkip }: RestTimerBannerProps) {
  const progressPct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0

  return (
    <div className="sticky bottom-0 z-40 bg-surface-iron">
      {/* Ember progress bar -- full width, thin, shows time remaining */}
      <div className="h-0.5 w-full bg-surface-charcoal">
        <div
          className="h-full bg-ember transition-[width] duration-1000 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex min-h-12 items-center gap-3 px-4">
        {/* REST label + countdown */}
        <span className="text-xs font-bold uppercase tracking-widest text-warm-ash/60">Rest</span>
        <span className="font-display tabular-nums text-ember">{formatCountdown(remaining)}</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Expand button */}
        <button
          type="button"
          onClick={onExpand}
          className="flex min-h-12 items-center px-3 text-xs font-bold uppercase tracking-widest text-warm-ash/70 hover:text-bone-white"
        >
          Expand
        </button>

        {/* Skip button */}
        <button
          type="button"
          onClick={onSkip}
          className="flex min-h-12 items-center px-3 text-xs font-bold uppercase tracking-widest text-ember hover:text-forge"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
