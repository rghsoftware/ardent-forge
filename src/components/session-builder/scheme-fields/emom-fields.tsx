import { UnderlineNumberInput, LoadSpecEditor } from '../inputs'
import type { SetScheme } from '@/domain/types'

interface EmomFieldsProps {
  value: SetScheme & { type: 'emom' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}

export function EmomFields({ value, onChange, exerciseSupports1RM }: EmomFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <UnderlineNumberInput
          value={value.repsPerMinute}
          onChange={(v) => onChange({ ...value, repsPerMinute: v })}
          label="REPS / MIN"
          min={1}
          className="flex-1"
        />
        <UnderlineNumberInput
          value={value.totalMinutes}
          onChange={(v) => onChange({ ...value, totalMinutes: v })}
          label="TOTAL MIN"
          min={1}
          className="flex-1"
        />
      </div>
      <LoadSpecEditor
        value={value.load ?? { type: 'unspecified' }}
        onChange={(load) => onChange({ ...value, load })}
        schemeType={value.type}
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

export type { EmomFieldsProps }
