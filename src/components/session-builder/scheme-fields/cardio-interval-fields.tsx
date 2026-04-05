import { DurationInput, DistanceInput, UnderlineNumberInput, CardioModalitySelect } from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface CardioIntervalFieldsProps {
  value: SetScheme & { type: 'cardioInterval' }
  onChange: (s: SetScheme) => void
}

export function CardioIntervalFields({ value, onChange }: CardioIntervalFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <DurationInput
        value={value.workDuration}
        onChange={(d: Duration) => onChange({ ...value, workDuration: d })}
        label="WORK DURATION"
      />
      <DistanceInput
        value={value.workDistance}
        onChange={(d) => onChange({ ...value, workDistance: d })}
        label="WORK DISTANCE (OPTIONAL)"
      />
      <DurationInput
        value={value.rest}
        onChange={(d: Duration) => onChange({ ...value, rest: d })}
        label="REST"
      />
      <UnderlineNumberInput
        value={value.rounds}
        onChange={(v) => onChange({ ...value, rounds: v })}
        label="ROUNDS"
        min={1}
      />
      <CardioModalitySelect
        value={value.modality}
        onChange={(m) => onChange({ ...value, modality: m })}
      />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          INTENSITY NOTES
        </span>
        <input
          type="text"
          value={value.intensityNotes ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              intensityNotes: e.target.value || undefined,
            })
          }
          placeholder="e.g. 90% effort"
          className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Intensity notes"
        />
      </div>
    </div>
  )
}

export type { CardioIntervalFieldsProps }
