import { useMemo, useEffect, useState } from 'react'
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

// Animates a number from 0 to target using ease-out-cubic.
function useCountUp(target: number, duration = 900, delay = 500) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const timer = setTimeout(() => {
      const start = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(timer)
  }, [target, duration, delay])
  return value
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

    let durationSeconds = 0
    if (workoutLog.completedAt) {
      const start = new Date(workoutLog.startedAt).getTime()
      const end = new Date(workoutLog.completedAt).getTime()
      durationSeconds = Math.floor((end - start) / 1000)
    }

    const exerciseCount = allActivities.length
    const totalSets = confirmedSets.length

    let totalVolume = 0
    for (const set of confirmedSets) {
      totalVolume += (set.actualWeight?.value ?? 0) * (set.actualReps ?? 0)
    }

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

    let prescribedSetCount = 0
    let completedPrescribedCount = 0
    if (programContext) {
      for (const set of allSets) {
        if (set.prescribed) {
          prescribedSetCount++
          if (set.completed) completedPrescribedCount++
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

  // Global top set — heaviest confirmed set across all exercises
  const topSetInfo = useMemo(() => {
    let best: { name: string; weight: Weight; reps: number } | null = null
    for (const ex of stats.exerciseSummaries) {
      if (ex.topWeight != null && ex.topReps != null) {
        if (best === null || ex.topWeight.value > best.weight.value) {
          best = { name: ex.name, weight: ex.topWeight, reps: ex.topReps }
        }
      }
    }
    return best
  }, [stats.exerciseSummaries])

  const animatedWeight = useCountUp(topSetInfo?.weight.value ?? 0)

  const sessionDate = new Date(workoutLog.startedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const adherenceColor =
    stats.adherencePercent == null
      ? ''
      : stats.adherencePercent >= 90
        ? 'text-ember'
        : stats.adherencePercent >= 70
          ? 'text-warm-ash'
          : 'text-warning-flare'

  return (
    <div className="flex min-h-screen flex-col bg-surface-pit">
      {/* Forge accent line — draws left to right on mount */}
      <div
        className="h-0.5 bg-forge"
        style={{
          animation: 'forge-draw 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
          transformOrigin: 'left',
        }}
      />

      <div className="flex flex-1 flex-col px-4 pt-6 pb-8">
        {/* Program context — only for programmed sessions */}
        {programContext && (
          <p
            className="mb-4 text-[11px] text-warm-ash/50 uppercase tracking-widest"
            style={{ animation: 'rise 0.4s ease-out 0.2s both' }}
          >
            {programName ?? 'Program'} · {blockName ?? 'Block'} · Week {programContext.weekNumber}
            {programContext.dayLabel ? ` · ${programContext.dayLabel}` : ''}
          </p>
        )}

        {/* Heading */}
        <div className="mb-8" style={{ animation: 'rise 0.4s ease-out 0.35s both' }}>
          <h1 className="font-display text-2xl font-bold text-bone-white leading-tight">
            Session complete.
          </h1>
          <p className="mt-0.5 text-sm text-warm-ash/50">{sessionDate}</p>
        </div>

        {/* Hero — top set if strength work exists, otherwise duration */}
        <div
          className="mb-8 border-t border-surface-steel pt-5"
          style={{ animation: 'rise 0.4s ease-out 0.5s both' }}
        >
          {topSetInfo ? (
            <>
              <span className="text-[11px] text-warm-ash/50 uppercase tracking-widest">
                Top set
              </span>
              <p className="mt-0.5 mb-2 text-xs text-ember">{topSetInfo.name}</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-6xl font-bold tabular-nums text-bone-white leading-none">
                  {animatedWeight}
                </span>
                <div className="flex flex-col gap-0.5 pb-1">
                  <span className="text-sm text-warm-ash/60 leading-none">
                    {topSetInfo.weight.unit}
                  </span>
                  <span className="text-lg text-warm-ash/40 leading-none">× {topSetInfo.reps}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] text-warm-ash/50 uppercase tracking-widest">
                Duration
              </span>
              <p className="mt-1 font-display text-6xl font-bold tabular-nums text-bone-white leading-none">
                {formatDuration(stats.durationSeconds)}
              </p>
            </>
          )}
        </div>

        {/* Secondary stats — asymmetric sizes, left-aligned */}
        <div
          className="mb-8 flex items-end gap-6"
          style={{ animation: 'rise 0.4s ease-out 0.62s both' }}
        >
          {/* Duration — only shown as secondary when top set took the hero spot */}
          {topSetInfo && (
            <div>
              <p className="font-display text-xl tabular-nums text-bone-white leading-none">
                {formatDuration(stats.durationSeconds)}
              </p>
              <span className="mt-0.5 block text-[11px] text-warm-ash/50 uppercase tracking-widest">
                Duration
              </span>
            </div>
          )}

          <div>
            <p className="font-display text-lg tabular-nums text-bone-white/70 leading-none">
              {stats.totalSets}
            </p>
            <span className="mt-0.5 block text-[11px] text-warm-ash/50 uppercase tracking-widest">
              Sets
            </span>
          </div>

          {stats.totalVolume > 0 && (
            <div>
              <p className="font-display text-base tabular-nums text-bone-white/50 leading-none">
                {Math.round(stats.totalVolume).toLocaleString()}
              </p>
              <span className="mt-0.5 block text-[11px] text-warm-ash/50 uppercase tracking-widest">
                Volume
              </span>
            </div>
          )}

          {/* Adherence — right-aligned, colored by result */}
          {stats.adherencePercent != null && (
            <div className="ml-auto">
              <p className={`font-display text-xl tabular-nums leading-none ${adherenceColor}`}>
                {stats.adherencePercent}%
              </p>
              <span className="mt-0.5 block text-[11px] text-warm-ash/50 uppercase tracking-widest text-right">
                Adherence
              </span>
            </div>
          )}
        </div>

        {/* Exercise breakdown — rows, no table chrome */}
        {stats.exerciseSummaries.length > 0 && (
          <div className="flex-1">
            <div className="border-t border-surface-steel pt-4 mb-1">
              <span className="text-[11px] text-warm-ash/50 uppercase tracking-widest">
                Exercises
              </span>
            </div>
            {stats.exerciseSummaries.map((ex, i) => (
              <div
                key={ex.exerciseId}
                className="flex items-center justify-between border-b border-surface-steel/30 py-3"
                style={{ animation: `rise 0.3s ease-out ${0.72 + i * 0.06}s both` }}
              >
                <span className="flex-1 text-sm text-bone-white">{ex.name}</span>
                <span className="mr-4 text-[11px] tabular-nums text-warm-ash/40">
                  {ex.setCount}×
                </span>
                <span className="w-28 text-right font-display text-sm tabular-nums text-warm-ash">
                  {ex.topWeight != null ? `${ex.topWeight.value} × ${ex.topReps ?? '--'}` : '--'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Done */}
        <div className="mt-8" style={{ animation: 'rise 0.4s ease-out 0.85s both' }}>
          <Button variant="default" size="lg" onClick={onDone} className="min-h-12 w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
