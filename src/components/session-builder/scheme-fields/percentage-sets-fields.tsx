import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Icon } from '@/components/icon'
import { UnderlineNumberInput, DurationInput } from '../inputs'
import type { Duration, SetScheme } from '@/domain/types'

interface PercentageSetsFieldsProps {
  value: SetScheme & { type: 'percentageSets' }
  onChange: (s: SetScheme & { type: 'percentageSets' }) => void
}

export function PercentageSetsFields({ value, onChange }: PercentageSetsFieldsProps) {
  const hasOptions = !!(value.restBetweenSets?.seconds || value.lastSetAMRAP)

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

export type { PercentageSetsFieldsProps }
