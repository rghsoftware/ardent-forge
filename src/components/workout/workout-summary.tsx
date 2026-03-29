import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import type { Weight, WorkoutLog, ProgramContext } from '@/domain/types'
import type {
  LoggedActivityGroupWithActivities,
  LoggedActivityWithSets,
} from '@/stores/active-workout-store'

interface WorkoutSummaryProps {
  workoutLog: WorkoutLog
  loggedGroups: LoggedActivityGroupWithActivities[]
  exerciseNames: Record<string, string>
  onDone: () => void
  /** Program name to display in progress section (when programContext exists) */
  programName?: string
  /** Block name to display in progress section */
  blockName?: string
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
  programName,
  blockName,
}: WorkoutSummaryProps) {
  const programContext: ProgramContext | undefined = workoutLog.programContext ?? undefined

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

    // Prescription adherence (only for programmed workouts)
    let prescribedSetCount = 0
    let completedPrescribedCount = 0
    if (programContext) {
      for (const set of allSets) {
        if (set.prescribed) {
          prescribedSetCount++
          if (set.completed) {
            completedPrescribedCount++
          }
        }
      }
    }
    const adherencePercent =
      prescribedSetCount > 0
        ? Math.round((completedPrescribedCount / prescribedSetCount) * 100)
        : null

    return {
      durationSeconds,
      exerciseCount,
      totalSets,
      totalVolume,
      exerciseSummaries,
      prescribedSetCount,
      completedPrescribedCount,
      adherencePercent,
    }
  }, [workoutLog, loggedGroups, exerciseNames, programContext])

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

      {/* Program progress (programmed workouts only) */}
      {programContext && (
        <div className="px-4 pb-6">
          <span className="mb-2 block text-[10px] uppercase tracking-widest text-warm-ash/60">
            PROGRAM PROGRESS
          </span>
          <div className="space-y-2 bg-surface-iron p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-warm-ash/80">Program</span>
              <span className="text-sm font-medium text-bone-white">
                {programName ?? 'Active Program'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-warm-ash/80">Block</span>
              <span className="text-sm font-medium text-bone-white">{blockName ?? `Block`}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-warm-ash/80">Session</span>
              <span className="text-sm font-medium text-bone-white">
                Week {programContext.weekNumber} / {programContext.dayLabel}
              </span>
            </div>
            {stats.adherencePercent != null && (
              <>
                <div className="my-1 border-t border-warm-ash/10" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-warm-ash/80">Prescribed sets</span>
                  <span className="text-sm tabular-nums text-bone-white">
                    {stats.completedPrescribedCount} / {stats.prescribedSetCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-warm-ash/80">Adherence</span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      stats.adherencePercent >= 90
                        ? 'text-green-400'
                        : stats.adherencePercent >= 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {stats.adherencePercent}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
          Done
        </Button>
      </div>
    </div>
  )
}
