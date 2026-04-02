// ---------------------------------------------------------------------------
// EventProgressBar -- horizontal progress indicator for packing list
// ---------------------------------------------------------------------------

interface EventProgressBarProps {
  packed: number
  total: number
  label?: string
}

export function EventProgressBar({ packed, total, label }: EventProgressBarProps) {
  const pct = total > 0 ? (packed / total) * 100 : 0

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs tracking-widest">
        <span className="text-warm-ash">{label || `PACKED: ${packed} / ${total}`}</span>
        {packed === total && total > 0 && (
          <span className="font-medium text-ember">ALL PACKED</span>
        )}
      </div>
      <div
        className="h-2 w-full bg-surface-steel"
        role="progressbar"
        aria-valuenow={packed}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full bg-ember transition-all duration-150" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
