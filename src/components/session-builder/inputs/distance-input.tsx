import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Distance } from '@/domain/types'

const DISTANCE_UNITS: Array<'mi' | 'km' | 'm' | 'yd'> = ['mi', 'km', 'm', 'yd']

interface DistanceInputProps {
  value: Distance | undefined
  onChange: (d: Distance) => void
  label: string
}

export function DistanceInput({ value, onChange, label }: DistanceInputProps) {
  const current = value ?? { value: 0, unit: 'mi' as const }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={current.value || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ ...current, value: v })
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} value`}
        />
        <Select
          value={current.unit}
          onValueChange={(u) => onChange({ ...current, unit: u as 'mi' | 'km' | 'm' | 'yd' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {DISTANCE_UNITS.map((u) => (
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

export type { DistanceInputProps }
