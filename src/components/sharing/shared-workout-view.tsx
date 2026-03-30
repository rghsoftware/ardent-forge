import { Icon } from '@/components/icon'
import { formatDuration, formatDateLabel } from '@/lib/format-duration'

// ---------------------------------------------------------------------------
// Types matching the JSONB shape from get_shared_workout RPC
// The RPC returns snake_case keys via row_to_json(). The workoutLog object
// uses camelCase keys because it is built with jsonb_build_object() using
// explicit key names in the migration SQL.
// ---------------------------------------------------------------------------

interface RpcWorkoutLog {
  id: string
  userId: string
  title?: string | null
  startedAt: string
  completedAt?: string | null
  sessionTemplateId?: string | null
  programContext?: { dayLabel?: string } | null
  status: string
  durationSeconds?: number | null
  createdAt?: string
  updatedAt?: string
}

interface RpcLoggedSet {
  id: string
  logged_activity_id: string
  set_number: number
  set_type: string
  prescribed?: Record<string, unknown> | null
  actual_reps?: number | null
  actual_weight?: { value: number; unit: string } | null
  actual_duration?: { seconds: number } | null
  actual_distance?: { value: number; unit: string } | null
  actual_pace?: { value: number; unit: string } | null
  actual_heart_rate?: number | null
  rpe?: number | null
  completed: boolean
  notes?: string | null
  ruck_load?: { value: number; unit: string } | null
  elevation_gain?: { value: number; unit: string } | null
}

interface RpcLoggedActivity {
  id: string
  logged_group_id: string
  exercise_id: string
  ordinal: number
  notes?: string | null
}

interface RpcLoggedActivityGroup {
  id: string
  workout_log_id: string
  group_type: string
  ordinal: number
  actual_rounds_completed?: number | null
  completion_time?: { seconds: number } | null
}

interface SharedWorkoutData {
  workoutLog: RpcWorkoutLog
  activityGroups: Array<{
    group: RpcLoggedActivityGroup
    activities: Array<{
      activity: RpcLoggedActivity
      sets: RpcLoggedSet[]
    }>
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActualValue(set: RpcLoggedSet): string {
  // Weight + reps
  if (set.actual_weight != null && set.actual_reps != null) {
    return `${set.actual_weight.value}${set.actual_weight.unit} x ${set.actual_reps}`
  }

  // Weight only
  if (set.actual_weight != null) {
    return `${set.actual_weight.value}${set.actual_weight.unit}`
  }

  // Duration-based
  if (set.actual_duration != null) {
    return formatDuration(set.actual_duration.seconds)
  }

  // Distance-based
  if (set.actual_distance != null) {
    return `${set.actual_distance.value} ${set.actual_distance.unit}`
  }

  // Reps only
  if (set.actual_reps != null) {
    return `${set.actual_reps} reps`
  }

  return '--'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SharedWorkoutViewProps {
  data: SharedWorkoutData
}

export function SharedWorkoutView({ data }: SharedWorkoutViewProps) {
  const { workoutLog, activityGroups } = data

  const startedAt = new Date(workoutLog.startedAt)
  const dateLabel = formatDateLabel(startedAt)
  const durationSeconds = workoutLog.durationSeconds

  // Count completed sets across all activities
  const allSets = activityGroups.flatMap((g) => g.activities.flatMap((a) => a.sets))
  const completedSets = allSets.filter((s) => s.completed)

  // Total volume
  const totalVolume = completedSets.reduce((acc, set) => {
    const weight = set.actual_weight?.value ?? 0
    const reps = set.actual_reps ?? 0
    return acc + weight * reps
  }, 0)

  // Sort groups by ordinal
  const sortedGroups = [...activityGroups].sort((a, b) => a.group.ordinal - b.group.ordinal)

  return (
    <div className="flex flex-col gap-0">
      {/* Workout header */}
      <div className="flex flex-col items-center gap-1 py-4">
        <h2 className="font-display text-xl font-medium text-bone-white">
          {workoutLog.title ?? dateLabel}
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">{dateLabel}</span>
      </div>

      {/* Duration readout */}
      {durationSeconds != null && durationSeconds > 0 && (
        <div className="flex flex-col items-center py-4">
          <span className="text-readout text-bone-white">{formatDuration(durationSeconds)}</span>
          <span className="mt-1 text-[11px] uppercase tracking-widest text-warm-ash/60">
            DURATION
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-0 px-4 pb-4">
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {completedSets.length}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">SETS</span>
        </div>
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {totalVolume > 0 ? Math.round(totalVolume).toLocaleString() : '--'}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">VOLUME</span>
        </div>
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {sortedGroups.reduce((acc, g) => acc + g.activities.length, 0)}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">EXERCISES</span>
        </div>
      </div>

      {/* Program context */}
      {workoutLog.programContext?.dayLabel && (
        <div className="px-4 pb-4">
          <span className="inline-flex items-center bg-surface-gunmetal text-bone-white text-[11px] px-2 py-0.5 uppercase tracking-widest">
            PROGRAM: {workoutLog.programContext.dayLabel}
          </span>
        </div>
      )}

      {/* Exercise breakdown */}
      <div className="flex flex-col gap-6 px-4 pb-8">
        {sortedGroups.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="font-display text-sm text-warm-ash">No exercises logged</p>
          </div>
        ) : (
          sortedGroups.map((groupEntry) => {
            const sortedActivities = [...groupEntry.activities].sort(
              (a, b) => a.activity.ordinal - b.activity.ordinal,
            )

            return sortedActivities.map(({ activity, sets }) => {
              const sortedSets = [...sets].sort((a, b) => a.set_number - b.set_number)

              return (
                <div key={activity.id}>
                  {/* Exercise name -- using exercise_id since we don't have exercise names */}
                  <h3 className="text-xs font-medium text-warm-ash mb-2">
                    Exercise {activity.ordinal}
                  </h3>

                  {/* Data table */}
                  <div className="w-full">
                    {/* Column headers */}
                    <div className="flex items-center py-1.5">
                      <span className="w-12 text-center text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                        SET
                      </span>
                      <span className="flex-1 text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                        ACTUAL
                      </span>
                      <span className="w-24 text-center text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                        STATUS
                      </span>
                    </div>

                    {/* Set rows */}
                    {sortedSets.map((set, setIdx) => (
                      <div
                        key={set.id}
                        className={`flex items-center py-2 ${
                          setIdx % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
                        }`}
                      >
                        {/* Set number */}
                        <span className="w-12 text-center font-display text-sm tabular-nums text-bone-white">
                          {set.set_number}
                        </span>

                        {/* Actual values */}
                        <span className="flex-1 font-display text-sm tabular-nums text-bone-white">
                          {formatActualValue(set)}
                        </span>

                        {/* Status badge */}
                        <div className="w-24 flex justify-center">
                          {set.completed ? (
                            <span className="inline-flex items-center gap-1 bg-forge text-on-forge text-[11px] px-2 py-0.5 uppercase tracking-widest">
                              <Icon name="check" size={12} />
                              DONE
                            </span>
                          ) : (
                            <span className="inline-flex items-center bg-surface-gunmetal text-warm-ash text-[11px] px-2 py-0.5 uppercase tracking-widest">
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
          })
        )}
      </div>
    </div>
  )
}
