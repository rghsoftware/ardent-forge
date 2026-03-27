import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import type { Weight, WorkoutLog } from '@/domain/types'
import type {
  LoggedActivityGroupWithActivities,
  LoggedActivityWithSets,
} from '@/stores/active-workout-store'

interface WorkoutSummaryProps {
  workoutLog: WorkoutLog
  loggedGroups: LoggedActivityGroupWithActivities[]
  exerciseNames: Record<string, string>
  onDone: () => void
}

interface ExerciseSummary {
  exerciseId: string
  name: string
  setCount: number
  topWeight: Weight | null
  topReps: number | null
}

export function WorkoutSummary({
  workoutLog,
  loggedGroups,
  exerciseNames,
  onDone,
}: WorkoutSummaryProps) {
  const stats = useMemo(() => {
    const allActivities: LoggedActivityWithSets[] = loggedGroups.flatMap((g) => g.activities)
    const allSets = allActivities.flatMap((a) => a.sets)
    const confirmedSets = allSets.filter((s) => s.completed)

    // Duration
    let durationSeconds = 0
    if (workoutLog.completedAt) {
      const start = new Date(workoutLog.startedAt).getTime()
      const end = new Date(workoutLog.completedAt).getTime()
      durationSeconds = Math.floor((end - start) / 1000)
    }

    // Exercise count
    const exerciseCount = allActivities.length

    // Total sets
    const totalSets = confirmedSets.length

    // Total volume (weight * reps for all confirmed sets)
    let totalVolume = 0
    for (const set of confirmedSets) {
      const weight = set.actualWeight?.value ?? 0
      const reps = set.actualReps ?? 0
      totalVolume += weight * reps
    }

    // Per-exercise breakdown
    const exerciseSummaries: ExerciseSummary[] = allActivities.map((activity) => {
      const sets = activity.sets.filter((s) => s.completed)
      let topWeight: Weight | null = null
      let topReps: number | null = null

      for (const set of sets) {
        const w = set.actualWeight?.value ?? 0
        if (w > (topWeight?.value ?? 0)) {
          topWeight = set.actualWeight ?? null
          topReps = set.actualReps ?? null
        }
      }

      return {
        exerciseId: activity.exerciseId,
        name: exerciseNames[activity.exerciseId] ?? 'Unknown Exercise',
        setCount: sets.length,
        topWeight,
        topReps,
      }
    })

    return { durationSeconds, exerciseCount, totalSets, totalVolume, exerciseSummaries }
  }, [workoutLog, loggedGroups, exerciseNames])

  return (
    <div className="flex min-h-screen flex-col bg-surface-anvil">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <span className="block text-[10px] uppercase tracking-widest text-warm-ash/60">
          WORKOUT COMPLETE
        </span>
      </div>

      {/* Duration readout */}
      <div className="flex flex-col items-center py-6">
        <span className="text-readout text-bone-white">
          {formatDuration(stats.durationSeconds)}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-widest text-warm-ash/60">
          DURATION
        </span>
      </div>

      {/* Stats grid */}
      <div className="flex gap-0 px-4 pb-6">
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-4">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {stats.exerciseCount}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">EXERCISES</span>
        </div>
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-4">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {stats.totalSets}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">SETS</span>
        </div>
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-4">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {stats.totalVolume > 0 ? `${Math.round(stats.totalVolume).toLocaleString()}` : '--'}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">VOLUME</span>
        </div>
      </div>

      {/* Per-exercise breakdown */}
      {stats.exerciseSummaries.length > 0 && (
        <div className="px-4 pb-6">
          <span className="mb-2 block text-[10px] uppercase tracking-widest text-warm-ash/60">
            EXERCISE BREAKDOWN
          </span>

          {/* Column headers */}
          <div className="flex items-center gap-2 py-1">
            <span className="flex-1 text-[10px] uppercase tracking-widest text-warm-ash/60">
              EXERCISE
            </span>
            <span className="w-12 text-center text-[10px] uppercase tracking-widest text-warm-ash/60">
              SETS
            </span>
            <span className="w-24 text-center text-[10px] uppercase tracking-widest text-warm-ash/60">
              TOP SET
            </span>
          </div>

          {stats.exerciseSummaries.map((ex) => (
            <div
              key={ex.exerciseId}
              className="flex items-center gap-2 bg-surface-iron py-2.5 px-2"
            >
              <span className="flex-1 text-sm text-bone-white">{ex.name}</span>
              <span className="w-12 text-center font-display text-sm tabular-nums text-bone-white">
                {ex.setCount}
              </span>
              <span className="w-24 text-center font-display text-sm tabular-nums text-bone-white">
                {ex.topWeight != null
                  ? `${ex.topWeight.value} ${ex.topWeight.unit} x ${ex.topReps ?? '--'}`
                  : '--'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Done button */}
      <div className="mt-auto px-4 pb-8">
        <Button variant="default" size="lg" onClick={onDone} className="min-h-12 w-full">
          DONE
        </Button>
      </div>
    </div>
  )
}
