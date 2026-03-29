import { useState, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { defaultScheme } from './set-scheme-defaults'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  SetScheme,
  LoadSpec,
  Duration,
  Weight,
  Distance,
  Pace,
  CardioModality,
  NumberRange,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetSchemeEditorProps {
  value: SetScheme
  onChange: (scheme: SetScheme) => void
  exerciseSupports1RM?: boolean
  errors?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEME_GROUPS = [
  {
    label: 'STRENGTH',
    types: [
      { value: 'fixedSets', label: 'Fixed' },
      { value: 'percentageSets', label: '% 1RM' },
      { value: 'workToMax', label: 'Max' },
    ],
  },
  {
    label: 'ENDURANCE',
    types: [
      { value: 'forReps', label: 'Reps' },
      { value: 'timedHold', label: 'Hold' },
      { value: 'percentageOfMaxReps', label: '% Reps' },
    ],
  },
  {
    label: 'CARDIO',
    types: [
      { value: 'cardioSteadyState', label: 'Steady' },
      { value: 'cardioInterval', label: 'Interval' },
      { value: 'ruckMarch', label: 'Ruck' },
    ],
  },
  {
    label: 'METCON',
    types: [
      { value: 'emom', label: 'EMOM' },
      { value: 'amrapTimed', label: 'AMRAP' },
      { value: 'descendingReps', label: 'Descend' },
    ],
  },
] as const

type SetSchemeType = SetScheme['type']

const CARDIO_MODALITIES: CardioModality[] = [
  'RUNNING',
  'CYCLING',
  'SWIMMING',
  'ROWING',
  'RUCKING',
  'JUMP_ROPE',
  'STAIR_CLIMBER',
  'ELLIPTICAL',
]

const LOAD_TYPES = [
  { value: 'absolute', label: 'WEIGHT' },
  { value: 'percentageOf1RM', label: '% 1RM' },
  { value: 'rpe', label: 'RPE' },
  { value: 'percentMaxReps', label: '% MAX REPS' },
  { value: 'bodyweight', label: 'BW' },
  { value: 'bodyweightPlus', label: 'BW+' },
  { value: 'unspecified', label: 'NONE' },
] as const

const WEIGHT_UNITS: Array<'lb' | 'kg'> = ['lb', 'kg']
const DISTANCE_UNITS: Array<'mi' | 'km' | 'm' | 'yd'> = ['mi', 'km', 'm', 'yd']
const PACE_UNITS: Array<'mi' | 'km'> = ['mi', 'km']

// ---------------------------------------------------------------------------
// Defaults are in set-scheme-defaults.ts (separate file for fast-refresh)

// ---------------------------------------------------------------------------
// Sub-editors
// ---------------------------------------------------------------------------

function UnderlineNumberInput({
  value,
  onChange,
  placeholder,
  label,
  min,
  max,
  step,
  className = '',
}: {
  value: number | undefined
  onChange: (v: number) => void
  placeholder?: string
  label: string
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          if (!isNaN(n)) onChange(n)
        }}
        placeholder={placeholder ?? '--'}
        min={min}
        max={max}
        step={step}
        className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
        aria-label={label}
      />
    </div>
  )
}

function DurationInput({
  value,
  onChange,
  label,
}: {
  value: Duration | undefined
  onChange: (d: Duration) => void
  label: string
}) {
  const totalSeconds = value?.seconds ?? 0
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={minutes || ''}
          onChange={(e) => {
            const m = parseInt(e.target.value) || 0
            onChange({ seconds: m * 60 + seconds })
          }}
          placeholder="0"
          min={0}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minutes`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">MIN</span>
        <input
          type="number"
          inputMode="numeric"
          value={seconds || ''}
          onChange={(e) => {
            const s = parseInt(e.target.value) || 0
            onChange({ seconds: minutes * 60 + s })
          }}
          placeholder="0"
          min={0}
          max={59}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} seconds`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">SEC</span>
      </div>
    </div>
  )
}

function WeightInput({
  value,
  onChange,
  label,
}: {
  value: Weight
  onChange: (w: Weight) => void
  label: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value.value || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ ...value, value: v })
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} value`}
        />
        <Select
          value={value.unit}
          onValueChange={(u) => onChange({ ...value, unit: u as 'lb' | 'kg' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u} className="text-xs uppercase">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function DistanceInput({
  value,
  onChange,
  label,
}: {
  value: Distance | undefined
  onChange: (d: Distance) => void
  label: string
}) {
  const current = value ?? { value: 0, unit: 'mi' as const }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={current.value || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ ...current, value: v })
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} value`}
        />
        <Select
          value={current.unit}
          onValueChange={(u) => onChange({ ...current, unit: u as 'mi' | 'km' | 'm' | 'yd' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {DISTANCE_UNITS.map((u) => (
              <SelectItem key={u} value={u} className="text-xs uppercase">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function PaceInput({
  value,
  onChange,
  label,
}: {
  value: Pace | undefined
  onChange: (p: Pace | undefined) => void
  label: string
}) {
  const current = value ?? { minutesPerUnit: 0, unit: 'mi' as const }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={current.minutesPerUnit || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ ...current, minutesPerUnit: v })
            else onChange(undefined)
          }}
          placeholder="--"
          min={0}
          className="min-h-12 w-20 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minutes per unit`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">MIN /</span>
        <Select
          value={current.unit}
          onValueChange={(u) => onChange({ ...current, unit: u as 'mi' | 'km' })}
        >
          <SelectTrigger className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-surface-gunmetal">
            {PACE_UNITS.map((u) => (
              <SelectItem key={u} value={u} className="text-xs uppercase">
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function NumberRangeInput({
  value,
  onChange,
  label,
}: {
  value: NumberRange
  onChange: (r: NumberRange) => void
  label: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={value.min || ''}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0
            onChange({ ...value, min: v })
          }}
          placeholder="MIN"
          min={0}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} minimum`}
        />
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">TO</span>
        <input
          type="number"
          inputMode="numeric"
          value={value.max || ''}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0
            onChange({ ...value, max: v })
          }}
          placeholder="MAX"
          min={0}
          className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label={`${label} maximum`}
        />
      </div>
    </div>
  )
}

function CardioModalitySelect({
  value,
  onChange,
}: {
  value: CardioModality
  onChange: (m: CardioModality) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        MODALITY
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as CardioModality)}>
        <SelectTrigger className="min-h-12 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-surface-gunmetal">
          {CARDIO_MODALITIES.map((m) => (
            <SelectItem key={m} value={m} className="text-xs uppercase">
              {m.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LoadSpec editor
// ---------------------------------------------------------------------------

function LoadSpecEditor({
  value,
  onChange,
  exerciseSupports1RM = false,
}: {
  value: LoadSpec
  onChange: (spec: LoadSpec) => void
  exerciseSupports1RM?: boolean
}) {
  const availableTypes = LOAD_TYPES.filter(
    (t) => t.value !== 'percentageOf1RM' || exerciseSupports1RM,
  )

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

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        LOAD
      </span>

      {/* Load type badges */}
      <div className="flex flex-wrap gap-1">
        {availableTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleTypeChange(t.value)}
            className={`min-h-8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
              value.type === t.value
                ? 'bg-forge text-on-forge'
                : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

// ---------------------------------------------------------------------------
// Per-type field editors
// ---------------------------------------------------------------------------

function FixedSetsFields({
  value,
  onChange,
  exerciseSupports1RM,
}: {
  value: SetScheme & { type: 'fixedSets' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}) {
  const setsIsRange = typeof value.sets === 'object'
  const repsIsRange = typeof value.reps === 'object'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {setsIsRange ? (
          <NumberRangeInput
            value={value.sets as NumberRange}
            onChange={(r) => onChange({ ...value, sets: r })}
            label="SETS"
          />
        ) : (
          <UnderlineNumberInput
            value={value.sets as number}
            onChange={(v) => onChange({ ...value, sets: v })}
            label="SETS"
            min={1}
            className="flex-1"
          />
        )}
        {repsIsRange ? (
          <NumberRangeInput
            value={value.reps as NumberRange}
            onChange={(r) => onChange({ ...value, reps: r })}
            label="REPS"
          />
        ) : (
          <UnderlineNumberInput
            value={value.reps as number}
            onChange={(v) => onChange({ ...value, reps: v })}
            label="REPS"
            min={1}
            className="flex-1"
          />
        )}
      </div>

      <LoadSpecEditor
        value={value.load}
        onChange={(load) => onChange({ ...value, load })}
        exerciseSupports1RM={exerciseSupports1RM}
      />

      <DurationInput
        value={value.restBetweenSets}
        onChange={(d) => onChange({ ...value, restBetweenSets: d })}
        label="REST BETWEEN SETS"
      />

      <div className="flex items-center gap-3">
        <Checkbox
          checked={value.lastSetAMRAP ?? false}
          onCheckedChange={(c) => onChange({ ...value, lastSetAMRAP: c === true })}
        />
        <span className="text-xs uppercase tracking-wider text-bone-white">LAST SET AMRAP</span>
      </div>
    </div>
  )
}

function PercentageSetsFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'percentageSets' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <UnderlineNumberInput
          value={value.sets}
          onChange={(v) => onChange({ ...value, sets: v })}
          label="SETS"
          min={1}
          className="flex-1"
        />
        <UnderlineNumberInput
          value={value.reps}
          onChange={(v) => onChange({ ...value, reps: v })}
          label="REPS"
          min={1}
          className="flex-1"
        />
      </div>

      <UnderlineNumberInput
        value={Math.round(value.percentageOf1RM * 100)}
        onChange={(v) => onChange({ ...value, percentageOf1RM: v / 100 })}
        label="% OF 1RM"
        min={1}
        max={100}
        step={1}
      />

      <DurationInput
        value={value.restBetweenSets}
        onChange={(d) => onChange({ ...value, restBetweenSets: d })}
        label="REST BETWEEN SETS"
      />

      <div className="flex items-center gap-3">
        <Checkbox
          checked={value.lastSetAMRAP ?? false}
          onCheckedChange={(c) => onChange({ ...value, lastSetAMRAP: c === true })}
        />
        <span className="text-xs uppercase tracking-wider text-bone-white">LAST SET AMRAP</span>
      </div>
    </div>
  )
}

function WorkToMaxFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'workToMax' }
  onChange: (s: SetScheme) => void
}) {
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

function TimedHoldFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'timedHold' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <DurationInput
        value={value.duration}
        onChange={(d) => onChange({ ...value, duration: d })}
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
        onChange={(d) => onChange({ ...value, restBetweenSets: d })}
        label="REST BETWEEN SETS"
      />
    </div>
  )
}

function ForRepsFields({
  value,
  onChange,
  exerciseSupports1RM,
}: {
  value: SetScheme & { type: 'forReps' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}) {
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
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

function CardioSteadyStateFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'cardioSteadyState' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <DurationInput
        value={value.duration}
        onChange={(d) => onChange({ ...value, duration: d })}
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

function CardioIntervalFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'cardioInterval' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <DurationInput
        value={value.workDuration}
        onChange={(d) => onChange({ ...value, workDuration: d })}
        label="WORK DURATION"
      />
      <DistanceInput
        value={value.workDistance}
        onChange={(d) => onChange({ ...value, workDistance: d })}
        label="WORK DISTANCE (OPTIONAL)"
      />
      <DurationInput
        value={value.rest}
        onChange={(d) => onChange({ ...value, rest: d })}
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

function RuckMarchFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'ruckMarch' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <WeightInput
        value={value.loadWeight}
        onChange={(w) => onChange({ ...value, loadWeight: w })}
        label="RUCK WEIGHT"
      />
      <DurationInput
        value={value.duration}
        onChange={(d) => onChange({ ...value, duration: d })}
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

function EmomFields({
  value,
  onChange,
  exerciseSupports1RM,
}: {
  value: SetScheme & { type: 'emom' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}) {
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
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

function AmrapTimedFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'amrapTimed' }
  onChange: (s: SetScheme) => void
}) {
  return (
    <DurationInput
      value={value.timeCap}
      onChange={(d) => onChange({ ...value, timeCap: d })}
      label="TIME CAP"
    />
  )
}

function DescendingRepsFields({
  value,
  onChange,
  exerciseSupports1RM,
}: {
  value: SetScheme & { type: 'descendingReps' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}) {
  const [ladderText, setLadderText] = useState(value.repLadder.join(', '))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          REP LADDER (DESCENDING)
        </span>
        <input
          type="text"
          value={ladderText}
          onChange={(e) => {
            setLadderText(e.target.value)
            const nums = e.target.value
              .split(/[,\s]+/)
              .map(Number)
              .filter((n) => !isNaN(n) && n > 0)
            if (nums.length >= 2) {
              onChange({ ...value, repLadder: nums })
            }
          }}
          placeholder="10, 8, 6, 4, 2"
          className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Rep ladder"
        />
      </div>
      <LoadSpecEditor
        value={value.load ?? { type: 'unspecified' }}
        onChange={(load) => onChange({ ...value, load })}
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

function PercentageOfMaxRepsFields({
  value,
  onChange,
}: {
  value: SetScheme & { type: 'percentageOfMaxReps' }
  onChange: (s: SetScheme) => void
}) {
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SetSchemeEditor({
  value,
  onChange,
  exerciseSupports1RM = false,
  errors = {},
}: SetSchemeEditorProps) {
  const handleTypeChange = useCallback(
    (newType: SetSchemeType) => {
      if (newType === value.type) return
      const next = defaultScheme(newType)
      // Preserve rest if available on both old and new
      if ('restBetweenSets' in value && 'restBetweenSets' in next && value.restBetweenSets) {
        ;(next as Record<string, unknown>).restBetweenSets = value.restBetweenSets
      }
      onChange(next)
    },
    [value, onChange],
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Type selector grid */}
      <div className="flex flex-col gap-2">
        {SCHEME_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {group.types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTypeChange(t.value as SetSchemeType)}
                  className={`min-h-8 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    value.type === t.value
                      ? 'bg-forge text-on-forge'
                      : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic fields */}
      <div className="border-t border-warm-ash/10 pt-4">
        {value.type === 'fixedSets' && (
          <FixedSetsFields
            value={value}
            onChange={onChange}
            exerciseSupports1RM={exerciseSupports1RM}
          />
        )}
        {value.type === 'percentageSets' && (
          <PercentageSetsFields value={value} onChange={onChange} />
        )}
        {value.type === 'workToMax' && <WorkToMaxFields value={value} onChange={onChange} />}
        {value.type === 'timedHold' && <TimedHoldFields value={value} onChange={onChange} />}
        {value.type === 'forReps' && (
          <ForRepsFields
            value={value}
            onChange={onChange}
            exerciseSupports1RM={exerciseSupports1RM}
          />
        )}
        {value.type === 'cardioSteadyState' && (
          <CardioSteadyStateFields value={value} onChange={onChange} />
        )}
        {value.type === 'cardioInterval' && (
          <CardioIntervalFields value={value} onChange={onChange} />
        )}
        {value.type === 'ruckMarch' && <RuckMarchFields value={value} onChange={onChange} />}
        {value.type === 'emom' && (
          <EmomFields value={value} onChange={onChange} exerciseSupports1RM={exerciseSupports1RM} />
        )}
        {value.type === 'amrapTimed' && <AmrapTimedFields value={value} onChange={onChange} />}
        {value.type === 'descendingReps' && (
          <DescendingRepsFields
            value={value}
            onChange={onChange}
            exerciseSupports1RM={exerciseSupports1RM}
          />
        )}
        {value.type === 'percentageOfMaxReps' && (
          <PercentageOfMaxRepsFields value={value} onChange={onChange} />
        )}
      </div>

      {/* Validation errors */}
      {Object.entries(errors).map(([key, msg]) => (
        <p key={key} className="text-xs text-destructive">
          {msg}
        </p>
      ))}
    </div>
  )
}

export type { SetSchemeEditorProps }
