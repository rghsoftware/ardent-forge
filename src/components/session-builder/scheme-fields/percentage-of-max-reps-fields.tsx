import { UnderlineNumberInput } from '../inputs'
import type { SetScheme } from '@/domain/types'

interface PercentageOfMaxRepsFieldsProps {
  value: SetScheme & { type: 'percentageOfMaxReps' }
  onChange: (s: SetScheme) => void
}

export function PercentageOfMaxRepsFields({ value, onChange }: PercentageOfMaxRepsFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <UnderlineNumberInput
        value={Math.round(value.percentage * 100)}
        onChange={(v) => onChange({ ...value, percentage: v / 100 })}
        label="% OF MAX REPS"
        min={1}
        max={100}
        step={1}
      />
      <UnderlineNumberInput
        value={value.sets}
        onChange={(v) => onChange({ ...value, sets: v })}
        label="SETS (OPTIONAL)"
        min={1}
      />
    </div>
  )
}

export type { PercentageOfMaxRepsFieldsProps }
