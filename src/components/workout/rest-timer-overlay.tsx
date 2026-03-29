import { Button } from '@/components/ui/button'
import { formatCountdown } from '@/lib/format-duration'

interface RestTimerOverlayProps {
  restTimer: { remaining: number; total: number } | null
  onSkip: () => void
  onAdjust: (delta: number) => void
}

export function RestTimerOverlay({ restTimer, onSkip, onAdjust }: RestTimerOverlayProps) {
  if (!restTimer) return null

  const { remaining, total } = restTimer
  const progress = Math.max(0, Math.min(1, remaining / total))

  // Pulse slows as the metal cools: 1s when hot → 2.4s when cool
  const pulseDuration = `${(1 + (1 - progress) * 1.4).toFixed(2)}s`

  // Glow fades from 35% opacity down to invisible
  const glowOpacity = progress * 0.35

  // Text cools from ember-warm to bone-white
  const textColor = `color-mix(in oklch, var(--color-ember) ${Math.round(progress * 75)}%, var(--color-bone-white))`

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-4 mb-2 bg-surface-steel p-4 relative overflow-hidden">
      {/* Ember glow — brightness-pulses while fading with heat */}
      <div
        className="absolute inset-0 pointer-events-none bg-forge"
        style={{
          opacity: glowOpacity,
          animation: `ember-pulse ${pulseDuration} ease-in-out infinite`,
        }}
      />

      <div className="flex flex-col items-center gap-3 relative z-10">
        {/* Label */}
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">REST</span>

        {/* Countdown — cools from ember to bone-white */}
        <span
          className="font-display text-5xl tabular-nums tracking-tight"
          style={{ color: textColor }}
        >
          {formatCountdown(remaining)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onAdjust(-30)} className="text-xs">
            -30s
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-ember">
            Skip
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAdjust(30)} className="text-xs">
            +30s
          </Button>
        </div>
      </div>
    </div>
  )
}
