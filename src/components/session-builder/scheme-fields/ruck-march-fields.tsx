import {
  WeightInput,
  DurationInput,
  DistanceInput,
  PaceInput,
  CardioModalitySelect,
} from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface RuckMarchFieldsProps {
  value: SetScheme & { type: 'ruckMarch' }
  onChange: (s: SetScheme) => void
}

export function RuckMarchFields({ value, onChange }: RuckMarchFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <WeightInput
        value={value.loadWeight}
        onChange={(w) => onChange({ ...value, loadWeight: w })}
        label="RUCK WEIGHT"
      />
      <DurationInput
        value={value.duration}
        onChange={(d: Duration) => onChange({ ...value, duration: d })}
        label="DURATION (OPTIONAL)"
      />
      <DistanceInput
        value={value.distance}
        onChange={(d) => onChange({ ...value, distance: d })}
        label="DISTANCE (OPTIONAL)"
      />
      <PaceInput
        value={value.paceTarget}
        onChange={(p) => onChange({ ...value, paceTarget: p })}
        label="PACE TARGET (OPTIONAL)"
      />
      <CardioModalitySelect
        value={value.modality}
        onChange={(m) => onChange({ ...value, modality: m })}
      />
    </div>
  )
}

export type { RuckMarchFieldsProps }
