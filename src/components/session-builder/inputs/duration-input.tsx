import type { Duration } from '@/domain/types'

// ---------------------------------------------------------------------------
// Size variants
// ---------------------------------------------------------------------------

const SIZE_STYLES = {
  default: {
    input: 'min-h-12 w-16 py-2',
    minuteLabel: 'MIN',
    secondLabel: 'SEC',
  },
  compact: {
    input: 'min-h-10 w-14 py-1',
    minuteLabel: 'M',
    secondLabel: 'S',
  },
} as const

type DurationInputSize = keyof typeof SIZE_STYLES

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DurationInputProps {
  value: Duration | undefined
  onChange: (d: Duration) => void
  label: string
  /** Visual size variant. Defaults to `"default"`. */
  size?: DurationInputSize
}

interface DurationInputUndefinableProps {
  value: Duration | undefined
  onChange: (d: Duration | undefined) => void
  label: string
  /** Visual size variant. Defaults to `"default"`. */
  size?: DurationInputSize
}

export function DurationInput({
  value,
  onChange,
  label,
  size = 'default',
}: DurationInputProps | DurationInputUndefinableProps) {
  const totalSeconds = value?.seconds ?? 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const styles = SIZE_STYLES[size]

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = parseInt(e.target.value) || 0
    if (size === 'compact' && m === 0 && seconds === 0) {
      ;(onChange as (d: Duration | undefined) => void)(undefined)
    } else {
      onChange({ seconds: m * 60 + seconds })
    }
  }

  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value) || 0
    if (size === 'compact' && minutes === 0 && s === 0) {
      ;(onChange as (d: Duration | undefined) => void)(undefined)
    } else {
      onChange({ seconds: minutes * 60 + s })
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={minutes || ''}
          onChange={handleMinutesChange}
          placeholder="0"
          min={0}
          className={`${styles.input} border-0 border-b border-warm-ash/30 bg-transparent text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none`}
          aria-label={`${label} minutes`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
          {styles.minuteLabel}
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={seconds || ''}
          onChange={handleSecondsChange}
          placeholder="0"
          min={0}
          max={59}
          className={`${styles.input} border-0 border-b border-warm-ash/30 bg-transparent text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none`}
          aria-label={`${label} seconds`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
          {styles.secondLabel}
        </span>
      </div>
    </div>
  )
}

export type { DurationInputProps, DurationInputUndefinableProps, DurationInputSize }
