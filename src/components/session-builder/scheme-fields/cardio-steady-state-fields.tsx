import { DurationInput, DistanceInput, CardioModalitySelect } from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface CardioSteadyStateFieldsProps {
  value: SetScheme & { type: 'cardioSteadyState' }
  onChange: (s: SetScheme) => void
}

export function CardioSteadyStateFields({ value, onChange }: CardioSteadyStateFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
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
          placeholder="e.g. Zone 2, conversational pace"
          className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Intensity notes"
        />
      </div>
    </div>
  )
}

export type { CardioSteadyStateFieldsProps }
