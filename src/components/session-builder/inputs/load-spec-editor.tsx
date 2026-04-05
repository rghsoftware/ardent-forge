import { useCallback, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SCHEME_LOAD_VISIBILITY } from '@/components/builders/visibility-maps'
import { UnderlineNumberInput } from './underline-number-input'
import { WeightInput } from './weight-input'
import type { SetScheme, LoadSpec } from '@/domain/types'

const LOAD_TYPES = [
  { value: 'absolute', label: 'WEIGHT' },
  { value: 'percentageOf1RM', label: '% 1RM' },
  { value: 'rpe', label: 'RPE' },
  { value: 'percentMaxReps', label: '% MAX REPS' },
  { value: 'bodyweight', label: 'BW' },
  { value: 'bodyweightPlus', label: 'BW+' },
  { value: 'unspecified', label: 'NONE' },
] as const

interface LoadSpecEditorProps {
  value: LoadSpec
  onChange: (spec: LoadSpec) => void
  schemeType: SetScheme['type']
  exerciseSupports1RM?: boolean
}

export function LoadSpecEditor({
  value,
  onChange,
  schemeType,
  exerciseSupports1RM = false,
}: LoadSpecEditorProps) {
  const allowedLoads = SCHEME_LOAD_VISIBILITY[schemeType]

  // Filter by scheme-level visibility, then by 1RM support
  const availableTypes = allowedLoads
    ? LOAD_TYPES.filter(
        (t) =>
          (allowedLoads as LoadSpec['type'][]).includes(t.value) &&
          (t.value !== 'percentageOf1RM' || exerciseSupports1RM),
      )
    : LOAD_TYPES.filter((t) => t.value !== 'percentageOf1RM' || exerciseSupports1RM)

  const handleTypeChange = useCallback(
    (newType: string) => {
      switch (newType) {
        case 'absolute':
          onChange({ type: 'absolute', weight: { value: 135, unit: 'lb' } })
          break
        case 'percentageOf1RM':
          onChange({ type: 'percentageOf1RM', percentage: 0.75 })
          break
        case 'rpe':
          onChange({ type: 'rpe', target: 7 })
          break
        case 'bodyweight':
          onChange({ type: 'bodyweight' })
          break
        case 'bodyweightPlus':
          onChange({
            type: 'bodyweightPlus',
            additionalWeight: { value: 25, unit: 'lb' },
          })
          break
        case 'percentMaxReps':
          onChange({ type: 'percentMaxReps', percentage: 0.5 })
          break
        default:
          onChange({ type: 'unspecified' })
      }
    },
    [onChange],
  )

  // Reset to 'unspecified' when the current load type is no longer in the filtered list
  useEffect(() => {
    if (allowedLoads === null) return
    const isCurrentAllowed = (allowedLoads as string[]).includes(value.type)
    if (!isCurrentAllowed) {
      onChange({ type: 'unspecified' })
    }
  }, [allowedLoads, value.type, onChange])

  // Scheme manages its own load internally -- hide the load picker entirely
  if (allowedLoads === null) return null

  return (
    <div className="flex flex-col gap-3">
      {/* Load type dropdown */}
      <Select value={value.type} onValueChange={handleTypeChange}>
        <SelectTrigger className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-surface-gunmetal">
          {availableTypes.map((t) => (
            <SelectItem key={t.value} value={t.value} className="text-xs uppercase">
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Load value fields */}
      {value.type === 'absolute' && (
        <WeightInput
          value={value.weight}
          onChange={(w) => onChange({ type: 'absolute', weight: w })}
          label="WEIGHT"
        />
      )}
      {value.type === 'percentageOf1RM' && (
        <UnderlineNumberInput
          value={Math.round(value.percentage * 100)}
          onChange={(v) => onChange({ type: 'percentageOf1RM', percentage: v / 100 })}
          label="% OF 1RM"
          min={1}
          max={100}
          step={1}
        />
      )}
      {value.type === 'rpe' && (
        <UnderlineNumberInput
          value={value.target}
          onChange={(v) => onChange({ type: 'rpe', target: Math.round(v * 2) / 2 })}
          label="RPE TARGET"
          min={1}
          max={10}
          step={0.5}
        />
      )}
      {value.type === 'bodyweightPlus' && (
        <WeightInput
          value={value.additionalWeight}
          onChange={(w) => onChange({ type: 'bodyweightPlus', additionalWeight: w })}
          label="ADDITIONAL WEIGHT"
        />
      )}
      {value.type === 'percentMaxReps' && (
        <UnderlineNumberInput
          value={Math.round(value.percentage * 100)}
          onChange={(v) => onChange({ type: 'percentMaxReps', percentage: v / 100 })}
          label="% OF MAX REPS"
          min={1}
          max={100}
          step={1}
        />
      )}
    </div>
  )
}

export type { LoadSpecEditorProps }
