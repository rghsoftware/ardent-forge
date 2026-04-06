import type { NumberRange } from '@/domain/types'

interface NumberRangeInputProps {
  value: NumberRange
  onChange: (r: NumberRange) => void
  label: string
}

export function NumberRangeInput({ value, onChange, label }: NumberRangeInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value.min || ''}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0
            onChange({ ...value, min: v })
          }}
          placeholder="MIN"
          min={0}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minimum`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">TO</span>
        <input
          type="number"
          inputMode="numeric"
          value={value.max || ''}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0
            onChange({ ...value, max: v })
          }}
          placeholder="MAX"
          min={0}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  )
}

export type { NumberRangeInputProps }
