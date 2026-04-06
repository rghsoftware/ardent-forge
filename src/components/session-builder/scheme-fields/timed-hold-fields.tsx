import { DurationInput, UnderlineNumberInput } from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface TimedHoldFieldsProps {
  value: SetScheme & { type: 'timedHold' }
  onChange: (s: SetScheme & { type: 'timedHold' }) => void
}

export function TimedHoldFields({ value, onChange }: TimedHoldFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <DurationInput
        value={value.duration}
        onChange={(d: Duration) => onChange({ ...value, duration: d })}
        label="HOLD DURATION"
      />
      <UnderlineNumberInput
        value={value.sets}
        onChange={(v) => onChange({ ...value, sets: v })}
        label="SETS"
        min={1}
      />
      <DurationInput
        value={value.restBetweenSets}
        onChange={(d: Duration) => onChange({ ...value, restBetweenSets: d })}
        label="REST BETWEEN SETS"
      />
    </div>
  )
}

export type { TimedHoldFieldsProps }
