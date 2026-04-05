import { DurationInput } from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface AmrapTimedFieldsProps {
  value: SetScheme & { type: 'amrapTimed' }
  onChange: (s: SetScheme) => void
}

export function AmrapTimedFields({ value, onChange }: AmrapTimedFieldsProps) {
  return (
    <DurationInput
      value={value.timeCap}
      onChange={(d: Duration) => onChange({ ...value, timeCap: d })}
      label="TIME CAP"
    />
  )
}

export type { AmrapTimedFieldsProps }
