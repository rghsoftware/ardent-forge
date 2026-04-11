import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Icon } from '@/components/icon'
import { HelpTrigger } from '@/components/ui/help-trigger'
import { GROUP_TYPE_HELP } from '@/components/builders/help-content'
import { GROUP_FIELD_VISIBILITY } from '@/components/builders/visibility-maps'
import { ActivityEditor, type ActivityData, type PickerComponentProps } from './activity-editor'
import type { ComponentType } from 'react'
import { DurationInput } from './inputs/duration-input'
import { defaultScheme } from './set-scheme-defaults'
import type { GroupType, Duration, Exercise, SessionType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityGroupData {
  clientId: string
  groupType: GroupType | null
  ordinal: number
  rounds?: number
  restBetweenRounds?: Duration
  restBetweenActivities?: Duration
  activities: ActivityData[]
}

interface ActivityGroupEditorProps {
  group: ActivityGroupData
  exercises: Exercise[]
  sessionCategory: SessionType
  showAllSchemeTypes: boolean
  onShowAllSchemeTypesChange: (v: boolean) => void
  onChange: (updated: ActivityGroupData) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
  PickerComponent?: ComponentType<PickerComponentProps>
  groupErrors?: { noType?: string; noActivities?: string }
  activityErrors?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRENGTH_TYPES: Array<{ value: GroupType; label: string }> = [
  { value: 'STRAIGHT_SETS', label: 'STRAIGHT' },
  { value: 'SUPERSET', label: 'SUPERSET' },
  { value: 'CIRCUIT', label: 'CIRCUIT' },
  { value: 'COMPLEX', label: 'COMPLEX' },
]

const CONDITIONING_TYPES: Array<{ value: GroupType; label: string }> = [
  { value: 'EMOM', label: 'EMOM' },
  { value: 'AMRAP', label: 'AMRAP' },
  { value: 'COUPLET', label: 'COUPLET' },
]

// ---------------------------------------------------------------------------
// Help content for group types
// ---------------------------------------------------------------------------

const groupTypeHelpContent = (
  <div className="flex flex-col gap-2">
    {Object.values(GROUP_TYPE_HELP).map((item) => (
      <div key={item.label}>
        <span className="font-medium text-bone-white">{item.label}</span>
        <p className="mt-0.5">{item.description}</p>
      </div>
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityGroupEditor({
  group,
  exercises,
  sessionCategory,
  showAllSchemeTypes,
  onShowAllSchemeTypesChange,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  PickerComponent,
  groupErrors,
  activityErrors,
}: ActivityGroupEditorProps) {
  const isStage1 = group.groupType === null
  const visibility = group.groupType ? GROUP_FIELD_VISIBILITY[group.groupType] : null

  const handleTypeChange = (value: string) => {
    // ToggleGroup fires empty string on deselect -- ignore to keep current selection
    if (!value) return
    const newType = value as GroupType

    // Changing type in Stage 2: reset rest/rounds fields, preserve exercises
    if (group.groupType !== null) {
      onChange({
        ...group,
        groupType: newType,
        rounds: undefined,
        restBetweenRounds: undefined,
        restBetweenActivities: undefined,
      })
    } else {
      onChange({ ...group, groupType: newType })
    }
  }

  const handleAddActivity = () => {
    const newActivity: ActivityData = {
      clientId: crypto.randomUUID(),
      exerciseId: null,
      setScheme: defaultScheme('fixedSets'),
      ordinal: group.activities.length + 1,
    }
    onChange({ ...group, activities: [...group.activities, newActivity] })
  }

  const handleUpdateActivity = (index: number, updated: ActivityData) => {
    const activities = [...group.activities]
    activities[index] = updated
    onChange({ ...group, activities })
  }

  const handleDeleteActivity = (index: number) => {
    const updated = group.activities
      .filter((_, i) => i !== index)
      .map((a, i) => ({ ...a, ordinal: i + 1 }))
    onChange({ ...group, activities: updated })
  }

  const handleMoveActivity = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= group.activities.length) {
      console.warn('[activity-group-editor] handleMoveActivity: target index out of bounds')
      return
    }
    const reordered = [...group.activities]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    onChange({ ...group, activities: reordered.map((a, i) => ({ ...a, ordinal: i + 1 })) })
  }

  return (
    <section className="bg-surface-charcoal" aria-label={`Activity group ${group.ordinal}`}>
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* Reorder + ordinal */}
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-bone-white disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Move group up"
            >
              <Icon name="keyboard_arrow_up" size={16} />
            </button>
          )}
          {/* surface-steel intentional: ordinal is a positional index, not a primary action.
              Position already communicates order; ember here would dilute the accent. */}
          <span className="flex h-8 w-8 items-center justify-center bg-surface-steel font-display text-xs font-medium tabular-nums text-bone-white">
            {group.ordinal}
          </span>
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-bone-white disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Move group down"
            >
              <Icon name="keyboard_arrow_down" size={16} />
            </button>
          )}
        </div>

        {/* Group type selector */}
        <div className="flex flex-1 flex-col gap-1">
          <ToggleGroup
            id={`field-group-${group.clientId}-type`}
            type="single"
            value={group.groupType ?? ''}
            onValueChange={handleTypeChange}
            className="flex flex-col items-start gap-2"
            aria-invalid={groupErrors?.noType ? true : undefined}
          >
            <div className="flex flex-col gap-0.5">
              <p className="font-display text-[10px] uppercase tracking-widest text-warm-ash/40">
                Strength
              </p>
              <div className="flex gap-1">
                {STRENGTH_TYPES.map((gt) => (
                  <ToggleGroupItem
                    key={gt.value}
                    value={gt.value}
                    className="min-h-12 w-24 shrink-0 px-2 text-xs font-medium uppercase tracking-wider"
                  >
                    {gt.label}
                  </ToggleGroupItem>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-display text-[10px] uppercase tracking-widest text-warm-ash/40">
                Conditioning
              </p>
              <div className="flex gap-1">
                {CONDITIONING_TYPES.map((gt) => (
                  <ToggleGroupItem
                    key={gt.value}
                    value={gt.value}
                    className="min-h-12 w-24 shrink-0 px-2 text-xs font-medium uppercase tracking-wider"
                  >
                    {gt.label}
                  </ToggleGroupItem>
                ))}
              </div>
            </div>
          </ToggleGroup>
          {groupErrors?.noType && (
            <p role="alert" className="text-xs text-destructive">
              {groupErrors.noType}
            </p>
          )}
          {group.groupType && (
            <p className="font-body text-xs text-warm-ash">
              {GROUP_TYPE_HELP[group.groupType].oneLiner}
            </p>
          )}
        </div>

        <HelpTrigger title="Group types" content={groupTypeHelpContent} />

        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
          aria-label="Delete group"
        >
          <Icon name="delete" size={20} />
        </button>
      </div>

      {/* Stage 2: group settings and exercises (only after type is selected) */}
      {!isStage1 && visibility && (
        <>
          {/* Group settings row */}
          {(visibility.rounds ||
            visibility.restBetweenRounds ||
            visibility.restBetweenActivities) && (
            <div className="flex flex-wrap gap-4 px-4 pb-3">
              {visibility.rounds && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-warm-ash/60">
                    Rounds
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={group.rounds ?? ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      onChange({ ...group, rounds: isNaN(v) ? undefined : v })
                    }}
                    placeholder="--"
                    min={1}
                    className="min-h-12 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-1 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
                    aria-label="Rounds"
                  />
                </div>
              )}

              {visibility.restBetweenRounds && (
                <DurationInput
                  size="compact"
                  clearable
                  value={group.restBetweenRounds}
                  onChange={(d) => onChange({ ...group, restBetweenRounds: d })}
                  label="Rest / Rounds"
                />
              )}

              {visibility.restBetweenActivities && (
                <DurationInput
                  size="compact"
                  clearable
                  value={group.restBetweenActivities}
                  onChange={(d) => onChange({ ...group, restBetweenActivities: d })}
                  label="Rest / Exercises"
                />
              )}
            </div>
          )}

          {/* Activities */}
          <div className="flex flex-col gap-2 px-2 pb-2">
            {group.activities.map((activity, index) => (
              <ActivityEditor
                key={activity.clientId}
                activity={activity}
                exercises={exercises}
                sessionCategory={sessionCategory}
                showAllSchemeTypes={showAllSchemeTypes}
                onShowAllSchemeTypesChange={onShowAllSchemeTypesChange}
                onChange={(updated) => handleUpdateActivity(index, updated)}
                onDelete={() => handleDeleteActivity(index)}
                onMoveUp={() => handleMoveActivity(index, index - 1)}
                onMoveDown={() => handleMoveActivity(index, index + 1)}
                isFirst={index === 0}
                isLast={index === group.activities.length - 1}
                PickerComponent={PickerComponent}
                exerciseError={activityErrors?.[activity.clientId]}
              />
            ))}
          </div>

          {/* Add exercise button */}
          <div className="px-4 pb-4">
            <Button
              id={`field-group-${group.clientId}-add-activity`}
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddActivity}
              className="w-full text-xs"
            >
              <Icon name="add" size={16} />
              Select exercise
            </Button>
            {groupErrors?.noActivities && (
              <p role="alert" className="mt-1 text-center text-xs text-destructive">
                {groupErrors.noActivities}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
