import { UnderlineNumberInput, LoadSpecEditor } from '../inputs'
import type { SetScheme } from '@/domain/types'

interface ForRepsFieldsProps {
  value: SetScheme & { type: 'forReps' }
  onChange: (s: SetScheme & { type: 'forReps' }) => void
  exerciseSupports1RM: boolean
}

export function ForRepsFields({ value, onChange, exerciseSupports1RM }: ForRepsFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <UnderlineNumberInput
        value={value.targetReps}
        onChange={(v) => onChange({ ...value, targetReps: v })}
        label="TARGET REPS"
        min={1}
      />
      <LoadSpecEditor
        value={value.load ?? { type: 'unspecified' }}
        onChange={(load) => onChange({ ...value, load })}
        schemeType={value.type}
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

export type { ForRepsFieldsProps }
