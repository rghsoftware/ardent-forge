import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Pace } from '@/domain/types'

const PACE_UNITS = ['mi', 'km'] as const satisfies readonly Pace['unit'][]

interface PaceInputProps {
  value: Pace | undefined
  onChange: (p: Pace | undefined) => void
  label: string
}

export function PaceInput({ value, onChange, label }: PaceInputProps) {
  const current = value ?? { minutesPerUnit: 0, unit: 'mi' as const }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={current.minutesPerUnit || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ ...current, minutesPerUnit: v })
            else onChange(undefined)
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minutes per unit`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">MIN /</span>
        <Select
          value={current.unit}
          onValueChange={(u) => onChange({ ...current, unit: u as 'mi' | 'km' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {PACE_UNITS.map((u) => (
              <SelectItem key={u} value={u} className="text-xs uppercase">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export type { PaceInputProps }
