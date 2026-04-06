import { useState, useCallback } from 'react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Icon } from '@/components/icon'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { defaultScheme } from './set-scheme-defaults'
import { CATEGORY_SCHEME_TYPES } from '@/components/builders/visibility-maps'
import {
  FixedSetsFields,
  PercentageSetsFields,
  WorkToMaxFields,
  TimedHoldFields,
  ForRepsFields,
  CardioSteadyStateFields,
  CardioIntervalFields,
  RuckMarchFields,
  EmomFields,
  AmrapTimedFields,
  DescendingRepsFields,
  PercentageOfMaxRepsFields,
} from './scheme-fields'
import type { SetScheme, SessionType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SetSchemeEditorProps {
  value: SetScheme
  onChange: (scheme: SetScheme) => void
  exerciseSupports1RM?: boolean
  sessionCategory?: SessionType
  showAllTypes?: boolean
  onShowAllTypesChange?: (v: boolean) => void
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

const SCHEME_GROUP_FOR_TYPE = {
  fixedSets: 'STRENGTH',
  percentageSets: 'STRENGTH',
  workToMax: 'STRENGTH',
  forReps: 'ENDURANCE',
  timedHold: 'ENDURANCE',
  percentageOfMaxReps: 'ENDURANCE',
  cardioSteadyState: 'CARDIO',
  cardioInterval: 'CARDIO',
  ruckMarch: 'CARDIO',
  emom: 'METCON',
  amrapTimed: 'METCON',
  descendingReps: 'METCON',
} satisfies Record<SetSchemeType, (typeof SCHEME_GROUPS)[number]['label']>

const SCHEME_TYPE_LABELS = {
  fixedSets: 'Fixed',
  percentageSets: '% 1RM',
  workToMax: 'Max',
  forReps: 'Reps',
  timedHold: 'Hold',
  percentageOfMaxReps: '% Reps',
  cardioSteadyState: 'Steady',
  cardioInterval: 'Interval',
  ruckMarch: 'Ruck',
  emom: 'EMOM',
  amrapTimed: 'AMRAP',
  descendingReps: 'Descend',
} satisfies Record<SetSchemeType, string>

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SetSchemeEditor({
  value,
  onChange,
  exerciseSupports1RM = false,
  sessionCategory,
  showAllTypes = false,
  onShowAllTypesChange,
  errors = {},
}: SetSchemeEditorProps) {
  const activeGroup =
    SCHEME_GROUPS.find((g) => g.types.some((t) => t.value === value.type))?.label ?? 'STRENGTH'
  const [selectedGroup, setSelectedGroup] = useState(activeGroup)
  const [typeSelectorOpen, setTypeSelectorOpen] = useState(
    !value.type || value.type === 'fixedSets',
  )

  // Category-based filtering: derive which types to show.
  // Empty array means "all scheme types allowed" -- Mixed and Event return []
  // to show the full list rather than filtering.
  const defaultTypes = sessionCategory ? CATEGORY_SCHEME_TYPES[sessionCategory] : []
  const categoryShowsAll = defaultTypes.length === 0
  const isFiltered = !categoryShowsAll && !showAllTypes

  // Filter SCHEME_GROUPS to only include visible types, omitting empty groups
  const visibleGroups = isFiltered
    ? SCHEME_GROUPS.map((group) => ({
        ...group,
        types: group.types.filter((t) => (defaultTypes as SetSchemeType[]).includes(t.value)),
      })).filter((group) => group.types.length > 0)
    : SCHEME_GROUPS

  const handleTypeChange = useCallback(
    (newType: SetSchemeType) => {
      if (newType === value.type) return
      let next = defaultScheme(newType)
      // Preserve rest between sets when switching scheme types: rest is high-friction
      // to re-enter (minutes + seconds), so keeping it avoids punishing users who
      // experiment with different schemes. Load is reset because each scheme type
      // has different default load semantics.
      if ('restBetweenSets' in value && 'restBetweenSets' in next && value.restBetweenSets) {
        next = { ...next, restBetweenSets: value.restBetweenSets }
      }
      // Update selected group to match the new type's group
      const newGroup = SCHEME_GROUPS.find((g) => g.types.some((t) => t.value === newType))?.label
      if (newGroup) setSelectedGroup(newGroup)
      onChange(next)
      setTypeSelectorOpen(false)
    },
    [value, onChange],
  )

  // When filtering is active, ensure selectedGroup is valid for visible groups
  const effectiveSelectedGroup =
    isFiltered && !visibleGroups.some((g) => g.label === selectedGroup)
      ? (visibleGroups[0]?.label ?? selectedGroup)
      : selectedGroup

  return (
    <div className="flex flex-col gap-4">
      {/* Two-level type selector */}
      <Collapsible open={typeSelectorOpen} onOpenChange={setTypeSelectorOpen}>
        {/* Compact summary when collapsed */}
        <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-left">
          <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
            {SCHEME_GROUP_FOR_TYPE[value.type]}
          </span>
          <span className="text-[11px] font-medium text-bone-white">
            {SCHEME_TYPE_LABELS[value.type]}
          </span>
          <Icon
            name={typeSelectorOpen ? 'expand_less' : 'expand_more'}
            size={14}
            className="ml-auto text-warm-ash/40"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-150">
          <div className="flex flex-col gap-2">
            {/* Level 1: Group selector */}
            <ToggleGroup
              type="single"
              value={effectiveSelectedGroup}
              onValueChange={(v) => {
                if (v) setSelectedGroup(v as typeof selectedGroup)
              }}
              className="flex gap-1"
            >
              {visibleGroups.map((group) => (
                <ToggleGroupItem
                  key={group.label}
                  value={group.label}
                  className="min-h-8 flex-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wider"
                >
                  {group.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Level 2: Type selector within group */}
            {visibleGroups
              .filter((g) => g.label === effectiveSelectedGroup)
              .map((group) => (
                <ToggleGroup
                  key={group.label}
                  type="single"
                  value={value.type}
                  onValueChange={(v) => {
                    if (v) handleTypeChange(v as SetSchemeType)
                  }}
                  className="flex gap-1"
                >
                  {group.types.map((t) => (
                    <ToggleGroupItem
                      key={t.value}
                      value={t.value}
                      className="min-h-8 flex-1 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider"
                    >
                      {t.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ))}

            {/* "Show all types" toggle -- only when filtered */}
            {isFiltered && onShowAllTypesChange && (
              <button
                type="button"
                onClick={() => onShowAllTypesChange(true)}
                className="mt-1 text-warm-ash font-body text-xs uppercase tracking-wider hover:text-bone-white"
              >
                Show all types
              </button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

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

      {Object.entries(errors).map(([key, msg]) => (
        <p key={key} className="text-xs text-destructive">
          {msg}
        </p>
      ))}
    </div>
  )
}

export type { SetSchemeEditorProps }
