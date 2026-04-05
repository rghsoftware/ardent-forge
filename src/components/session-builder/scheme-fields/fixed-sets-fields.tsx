import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Icon } from '@/components/icon'
import { UnderlineNumberInput, NumberRangeInput, DurationInput, LoadSpecEditor } from '../inputs'
import type { Duration, SetScheme, NumberRange } from '@/domain/types'

interface FixedSetsFieldsProps {
  value: SetScheme & { type: 'fixedSets' }
  onChange: (s: SetScheme) => void
  exerciseSupports1RM: boolean
}

export function FixedSetsFields({ value, onChange, exerciseSupports1RM }: FixedSetsFieldsProps) {
  const setsIsRange = typeof value.sets === 'object'
  const repsIsRange = typeof value.reps === 'object'
  const hasOptions = !!(value.restBetweenSets?.seconds || value.lastSetAMRAP)

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
        schemeType={value.type}
        exerciseSupports1RM={exerciseSupports1RM}
      />

      <Collapsible defaultOpen={hasOptions}>
        <CollapsibleTrigger className="flex items-center gap-1 py-1 text-[11px] font-medium text-warm-ash/60 hover:text-warm-ash">
          <Icon name="tune" size={14} />
          More options
          <Icon name="expand_more" size={14} />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150">
          <div className="flex flex-col gap-4 pt-2">
            <DurationInput
              value={value.restBetweenSets}
              onChange={(d: Duration) => onChange({ ...value, restBetweenSets: d })}
              label="REST BETWEEN SETS"
            />

            <div className="flex items-center gap-3">
              <Checkbox
                checked={value.lastSetAMRAP ?? false}
                onCheckedChange={(c) => onChange({ ...value, lastSetAMRAP: c === true })}
              />
              <span className="text-xs uppercase tracking-wider text-bone-white">
                LAST SET AMRAP
              </span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export type { FixedSetsFieldsProps }
