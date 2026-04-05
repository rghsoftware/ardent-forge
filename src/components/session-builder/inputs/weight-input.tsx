import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Weight } from '@/domain/types'

const WEIGHT_UNITS = ['lb', 'kg'] as const satisfies readonly Weight['unit'][]

interface WeightInputProps {
  value: Weight
  onChange: (w: Weight) => void
  label: string
}

export function WeightInput({ value, onChange, label }: WeightInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value.value || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange({ ...value, value: isNaN(v) ? 0 : v })
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} value`}
        />
        <Select
          value={value.unit}
          onValueChange={(u) => onChange({ ...value, unit: u as 'lb' | 'kg' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {WEIGHT_UNITS.map((u) => (
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

export type { WeightInputProps }
