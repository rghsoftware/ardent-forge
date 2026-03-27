import { Button } from '@/components/ui/button'
import { formatCountdown } from '@/lib/format-duration'

interface RestTimerOverlayProps {
  restTimer: { remaining: number; total: number } | null
  onSkip: () => void
  onAdjust: (delta: number) => void
}

export function RestTimerOverlay({ restTimer, onSkip, onAdjust }: RestTimerOverlayProps) {
  if (!restTimer) return null

  const { remaining } = restTimer

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 mx-4 mb-2 bg-surface-steel p-4">
      <div className="flex flex-col items-center gap-3">
        {/* Label */}
        <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">REST</span>

        {/* Countdown */}
        <span className="font-display text-5xl tabular-nums tracking-tight text-bone-white">
          {formatCountdown(remaining)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => onAdjust(-30)} className="text-xs">
            -30S
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-ember">
            SKIP
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAdjust(30)} className="text-xs">
            +30S
          </Button>
        </div>
      </div>
    </div>
  )
}
