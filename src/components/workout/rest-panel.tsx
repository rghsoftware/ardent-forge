import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatCountdown } from '@/lib/format-duration'

export interface RestPanelProps {
  /** Seconds remaining on the rest countdown. */
  remaining: number
  /** Total rest seconds (used to compute cooling progress). */
  total: number
  /** Skip rest immediately. */
  onSkip: () => void
  /**
   * Adjust rest by ±delta seconds. When omitted the ±30 controls are
   * hidden -- circuits currently don't support manual adjustment.
   */
  onAdjust?: (delta: number) => void
  /** Optional badge above the timer (e.g. "ROUND 2/4 COMPLETE"). */
  topBadge?: ReactNode
  /** Small uppercase label above the next block (e.g. "NEXT" or "NEXT UP"). */
  nextLabel?: string
  /** Primary "what's next" line. */
  nextPrimary?: ReactNode
  /** Secondary "what's next" line, typically a prescription. */
  nextSecondary?: ReactNode
}

/**
 * Shared cooling-rest primitive used by RestView (strength rest, full
 * page) and CircuitPanel (inter-exercise / inter-round rest, embedded).
 *
 * Visual metaphor: hot ember pulse at start, fading and slowing as the
 * metal cools and the lifter becomes ready for the next set.
 */
export function RestPanel({
  remaining,
  total,
  onSkip,
  onAdjust,
  topBadge,
  nextLabel,
  nextPrimary,
  nextSecondary,
}: RestPanelProps) {
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0

  // Pulse slows as the metal cools: 1s when hot -> 2.4s when cool
  const pulseDuration = `${(1 + (1 - progress) * 1.4).toFixed(2)}s`
  // Glow fades from 35% opacity down to invisible
  const glowOpacity = progress * 0.35
  // Text cools from ember-warm to bone-white
  const textColor = `color-mix(in oklch, var(--color-ember) ${Math.round(progress * 75)}%, var(--color-bone-white))`

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Ember glow -- brightness-pulses while fading with heat */}
      <div
        className="pointer-events-none absolute inset-0 bg-forge"
        style={{
          opacity: glowOpacity,
          animation: `ember-pulse ${pulseDuration} ease-in-out infinite`,
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        {topBadge}
        <span className="text-sm font-bold uppercase tracking-widest text-warm-ash/70">Rest</span>
        <span
          className="font-display text-[7rem] leading-none tabular-nums tracking-tight"
          style={{ color: textColor }}
        >
          {formatCountdown(remaining)}
        </span>

        <div className="flex items-center gap-3">
          {onAdjust && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onAdjust(-30)}
              className="min-h-14 min-w-20 text-sm font-bold uppercase tracking-widest"
            >
              -30s
            </Button>
          )}
          <Button
            variant="molten"
            size="lg"
            onClick={onSkip}
            className="min-h-16 min-w-32 px-8 text-lg font-bold uppercase tracking-widest"
          >
            Skip
          </Button>
          {onAdjust && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onAdjust(30)}
              className="min-h-14 min-w-20 text-sm font-bold uppercase tracking-widest"
            >
              +30s
            </Button>
          )}
        </div>

        {nextPrimary && (
          <div className="mt-2 flex flex-col items-center gap-2">
            {nextLabel && (
              <span className="text-xs font-bold uppercase tracking-widest text-warm-ash/70">
                {nextLabel}
              </span>
            )}
            <div className="font-display text-3xl tracking-tight text-bone-white">
              {nextPrimary}
            </div>
            {nextSecondary && (
              <div className="text-xl tabular-nums text-ember">{nextSecondary}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
