import { NumberRangeInput } from '../inputs'
import type { SetScheme } from '@/domain/types'

interface WorkToMaxFieldsProps {
  value: SetScheme & { type: 'workToMax' }
  onChange: (s: SetScheme) => void
}

export function WorkToMaxFields({ value, onChange }: WorkToMaxFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <NumberRangeInput
        value={value.targetRepRange}
        onChange={(r) => onChange({ ...value, targetRepRange: r })}
        label="TARGET REP RANGE"
      />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          WARMUP SCHEME (OPTIONAL)
        </span>
        <input
          type="text"
          value={value.warmupScheme ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              warmupScheme: e.target.value || undefined,
            })
          }
          placeholder="e.g. 5x135, 3x185, 1x225"
          className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Warmup scheme"
        />
      </div>
    </div>
  )
}

export type { WorkToMaxFieldsProps }
