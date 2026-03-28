import { formatDuration } from '@/lib/format-duration'
import { Icon } from '@/components/icon'
import type { Exercise, LoggedActivityGroup, LoggedActivity, LoggedSet } from '@/domain/types'

interface WorkoutDetailExercisesProps {
  groups: LoggedActivityGroup[]
  activities: LoggedActivity[]
  sets: LoggedSet[]
  exercises: Exercise[]
}

function formatActualValue(set: LoggedSet): string {
  // Weight-based sets
  if (set.actualWeight != null && set.actualReps != null) {
    return `${set.actualWeight.value}${set.actualWeight.unit} x ${set.actualReps}`
  }

  // Weight only
  if (set.actualWeight != null) {
    return `${set.actualWeight.value}${set.actualWeight.unit}`
  }

  // Duration-based sets
  if (set.actualDuration != null) {
    return formatDuration(set.actualDuration.seconds)
  }

  // Distance-based sets
  if (set.actualDistance != null) {
    return `${set.actualDistance.value} ${set.actualDistance.unit}`
  }

  // Reps only
  if (set.actualReps != null) {
    return `${set.actualReps} reps`
  }

  return '--'
}

export function WorkoutDetailExercises({
  groups,
  activities,
  sets,
  exercises,
}: WorkoutDetailExercisesProps) {
  // Build lookup maps
  const exerciseMap = new Map<string, Exercise>()
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex)
  }

  const activitiesByGroup = new Map<string, LoggedActivity[]>()
  for (const activity of activities) {
    const list = activitiesByGroup.get(activity.loggedGroupId) ?? []
    list.push(activity)
    activitiesByGroup.set(activity.loggedGroupId, list)
  }

  const setsByActivity = new Map<string, LoggedSet[]>()
  for (const set of sets) {
    const list = setsByActivity.get(set.loggedActivityId) ?? []
    list.push(set)
    setsByActivity.set(set.loggedActivityId, list)
  }

  // Sort groups by ordinal
  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)

  if (sortedGroups.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p className="font-display text-sm uppercase tracking-widest text-warm-ash">
          NO EXERCISES LOGGED
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {sortedGroups.map((group) => {
        const groupActivities = (activitiesByGroup.get(group.id) ?? []).sort(
          (a, b) => a.ordinal - b.ordinal,
        )

        return groupActivities.map((activity) => {
          const exercise = exerciseMap.get(activity.exerciseId)
          const activitySets = (setsByActivity.get(activity.id) ?? []).sort(
            (a, b) => a.setNumber - b.setNumber,
          )

          return (
            <div key={activity.id}>
              {/* Exercise name header */}
              <h3 className="text-xs font-medium uppercase tracking-widest text-warm-ash mb-2">
                {exercise?.name ?? 'Unknown Exercise'}
              </h3>

              {/* Data table */}
              <div className="w-full">
                {/* Column headers */}
                <div className="flex items-center py-1.5">
                  <span className="w-12 text-center text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                    SET
                  </span>
                  <span className="flex-1 text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                    ACTUAL
                  </span>
                  <span className="w-24 text-center text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
                    STATUS
                  </span>
                </div>

                {/* Set rows */}
                {activitySets.map((set, setIdx) => (
                  <div
                    key={set.id}
                    className={`flex items-center py-2 ${
                      setIdx % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
                    }`}
                  >
                    {/* Set number */}
                    <span className="w-12 text-center font-display text-sm tabular-nums text-bone-white">
                      {set.setNumber}
                    </span>

                    {/* Actual values */}
                    <span className="flex-1 font-display text-sm tabular-nums text-bone-white">
                      {formatActualValue(set)}
                    </span>

                    {/* Status badge */}
                    <div className="w-24 flex justify-center">
                      {set.completed ? (
                        <span className="inline-flex items-center gap-1 bg-forge text-on-forge text-[10px] px-2 py-0.5 uppercase tracking-widest">
                          <Icon name="check" size={12} />
                          DONE
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-surface-gunmetal text-warm-ash text-[10px] px-2 py-0.5 uppercase tracking-widest">
                          SKIP
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Activity notes */}
                {activity.notes && (
                  <div className="mt-1 px-3 py-1.5">
                    <span className="text-xs text-warm-ash/60 italic">{activity.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })
      })}
    </div>
  )
}
