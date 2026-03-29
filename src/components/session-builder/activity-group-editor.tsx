import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { ActivityEditor, type ActivityData } from './activity-editor'
import { DurationInputCompact } from './duration-input-compact'
import { defaultScheme } from './set-scheme-defaults'
import type { GroupType, Duration, Exercise } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityGroupData {
  groupType: GroupType
  ordinal: number
  rounds?: number
  restBetweenRounds?: Duration
  restBetweenActivities?: Duration
  activities: ActivityData[]
}

interface ActivityGroupEditorProps {
  group: ActivityGroupData
  exercises: Exercise[]
  onChange: (updated: ActivityGroupData) => void
  onDelete: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUP_TYPES: Array<{ value: GroupType; label: string }> = [
  { value: 'STRAIGHT_SETS', label: 'STRAIGHT' },
  { value: 'SUPERSET', label: 'SUPERSET' },
  { value: 'CIRCUIT', label: 'CIRCUIT' },
  { value: 'COMPLEX', label: 'COMPLEX' },
  { value: 'EMOM', label: 'EMOM' },
  { value: 'AMRAP', label: 'AMRAP' },
  { value: 'COUPLET', label: 'COUPLET' },
]

const GROUP_TYPES_WITH_ROUNDS: GroupType[] = ['CIRCUIT', 'AMRAP', 'COUPLET']

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ActivityGroupEditor({
  group,
  exercises,
  onChange,
  onDelete,
}: ActivityGroupEditorProps) {
  const showRounds = GROUP_TYPES_WITH_ROUNDS.includes(group.groupType)

  const handleAddActivity = () => {
    const newActivity: ActivityData = {
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
    const activities = group.activities
      .filter((_, i) => i !== index)
      .map((a, i) => ({ ...a, ordinal: i + 1 }))
    onChange({ ...group, activities })
  }

  return (
    <section className="bg-surface-charcoal" aria-label={`Activity group ${group.ordinal}`}>
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-forge font-display text-xs font-medium tabular-nums text-on-forge">
          {group.ordinal}
        </span>

        {/* Group type selector */}
        <div className="flex flex-1 flex-wrap gap-1">
          {GROUP_TYPES.map((gt) => (
            <button
              key={gt.value}
              type="button"
              onClick={() => onChange({ ...group, groupType: gt.value })}
              className={`min-h-8 px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                group.groupType === gt.value
                  ? 'bg-forge text-on-forge'
                  : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
              }`}
            >
              {gt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
          aria-label="Delete group"
        >
          <Icon name="delete" size={20} />
        </button>
      </div>

      {/* Group settings row */}
      <div className="flex flex-wrap gap-4 px-4 pb-3">
        {showRounds && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              ROUNDS
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
              className="min-h-10 w-16 border-0 border-b border-warm-ash/30 bg-transparent py-1 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
              aria-label="Rounds"
            />
          </div>
        )}

        <DurationInputCompact
          value={group.restBetweenRounds}
          onChange={(d) => onChange({ ...group, restBetweenRounds: d })}
          label="REST / ROUNDS"
        />

        <DurationInputCompact
          value={group.restBetweenActivities}
          onChange={(d) => onChange({ ...group, restBetweenActivities: d })}
          label="REST / EXERCISES"
        />
      </div>

      {/* Activities */}
      <div className="flex flex-col gap-2 px-2 pb-2">
        {group.activities.map((activity, index) => (
          <ActivityEditor
            key={index}
            activity={activity}
            exercises={exercises}
            onChange={(updated) => handleUpdateActivity(index, updated)}
            onDelete={() => handleDeleteActivity(index)}
          />
        ))}
      </div>

      {/* Add exercise button */}
      <div className="px-4 pb-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAddActivity}
          className="w-full text-xs"
        >
          <Icon name="add" size={16} />
          Add exercise
        </Button>
      </div>
    </section>
  )
}
