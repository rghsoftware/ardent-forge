import type { Duration } from '@/domain/types'

export function DurationInputCompact({
  value,
  onChange,
  label,
}: {
  value: Duration | undefined
  onChange: (d: Duration | undefined) => void
  label: string
}) {
  const totalSeconds = value?.seconds ?? 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={minutes || ''}
          onChange={(e) => {
            const m = parseInt(e.target.value) || 0
            if (m === 0 && seconds === 0) {
              onChange(undefined)
            } else {
              onChange({ seconds: m * 60 + seconds })
            }
          }}
          placeholder="0"
          min={0}
          className="min-h-10 w-14 border-0 border-b border-warm-ash/30 bg-transparent py-1 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minutes`}
        />
        <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">M</span>
        <input
          type="number"
          inputMode="numeric"
          value={seconds || ''}
          onChange={(e) => {
            const s = parseInt(e.target.value) || 0
            if (minutes === 0 && s === 0) {
              onChange(undefined)
            } else {
              onChange({ seconds: minutes * 60 + s })
            }
          }}
          placeholder="0"
          min={0}
          max={59}
          className="min-h-10 w-14 border-0 border-b border-warm-ash/30 bg-transparent py-1 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} seconds`}
        />
        <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">S</span>
      </div>
    </div>
  )
}
