import { useMemo } from 'react'
import { RestPanel } from '@/components/workout/rest-panel'
import type { LoggedActivityGroupWithActivities } from '@/stores/active-workout-store'

interface RestViewProps {
  restTimer: { remaining: number; total: number }
  loggedGroups: LoggedActivityGroupWithActivities[]
  exerciseNames: Record<string, string>
  onSkip: () => void
  onAdjust: (delta: number) => void
}

interface NextUpInfo {
  exerciseName: string
  setNumber: number
  totalSets: number
  prescribedWeight?: { value: number; unit: string }
  prescribedReps?: number
}

interface LastSetInfo {
  exerciseName: string
  setNumber: number
  weight?: { value: number; unit: string }
  reps?: number
}

/**
 * Full-page rest view -- owns the screen between sets in SET-mode
 * strength workouts. Composes RestPanel (the shared cooling-timer
 * primitive) with workout-level chrome: "last set" chip and session
 * progress counter.
 */
export function RestView({
  restTimer,
  loggedGroups,
  exerciseNames,
  onSkip,
  onAdjust,
}: RestViewProps) {
  // Compute next-up (first activity with any incomplete set) and last-set
  // (most recently confirmed set, by iteration order).
  const { nextUp, lastSet, confirmedCount, plannedCount } = useMemo(() => {
    let nextUp: NextUpInfo | null = null
    let lastSet: LastSetInfo | null = null
    let confirmedCount = 0
    let plannedCount = 0

    for (const group of loggedGroups) {
      if (group.groupType === 'CIRCUIT') continue // circuits manage their own rest
      for (const activity of group.activities) {
        plannedCount += activity.sets.length
        const exerciseName = exerciseNames[activity.exerciseId] ?? 'Unknown'

        for (const set of activity.sets) {
          if (set.completed) {
            confirmedCount++
            lastSet = {
              exerciseName,
              setNumber: set.setNumber,
              weight: set.actualWeight ?? undefined,
              reps: set.actualReps ?? undefined,
            }
          } else if (!nextUp) {
            nextUp = {
              exerciseName,
              setNumber: set.setNumber,
              totalSets: activity.sets.length,
              prescribedWeight: set.prescribed?.weight ?? undefined,
              prescribedReps: set.prescribed?.reps ?? undefined,
            }
          }
        }
      }
    }

    return { nextUp, lastSet, confirmedCount, plannedCount }
  }, [loggedGroups, exerciseNames])

  return (
    <div className="flex flex-1 flex-col">
      <RestPanel
        remaining={restTimer.remaining}
        total={restTimer.total}
        onSkip={onSkip}
        onAdjust={onAdjust}
        nextLabel={nextUp ? 'Next up' : undefined}
        nextPrimary={
          nextUp ? (
            <div className="flex flex-col items-center gap-1">
              <span>{nextUp.exerciseName}</span>
              <span className="text-xs uppercase tracking-widest text-warm-ash/60">
                Set {nextUp.setNumber} of {nextUp.totalSets}
              </span>
            </div>
          ) : undefined
        }
        nextSecondary={
          nextUp && (nextUp.prescribedWeight || nextUp.prescribedReps != null) ? (
            <>
              {nextUp.prescribedWeight
                ? `${nextUp.prescribedWeight.value} ${nextUp.prescribedWeight.unit}`
                : 'Bodyweight'}
              {nextUp.prescribedReps != null && (
                <>
                  <span className="mx-2 text-warm-ash/40">×</span>
                  {nextUp.prescribedReps}
                </>
              )}
            </>
          ) : undefined
        }
      />

      {/* Last set + session progress */}
      <div className="mt-auto flex flex-col gap-2 px-4 pt-6 pb-6">
        {lastSet && (
          <p className="text-xs text-warm-ash/60">
            Last:{' '}
            <span className="text-bone-white">
              {lastSet.exerciseName} · Set {lastSet.setNumber}
            </span>{' '}
            {lastSet.weight && (
              <span className="tabular-nums text-bone-white">
                {lastSet.weight.value} {lastSet.weight.unit}
              </span>
            )}
            {lastSet.reps != null && (
              <>
                <span className="text-warm-ash/40"> × </span>
                <span className="tabular-nums text-bone-white">{lastSet.reps}</span>
              </>
            )}
          </p>
        )}
        <p className="text-[10px] uppercase tracking-widest text-warm-ash/40">
          {confirmedCount} of {plannedCount} sets logged
        </p>
      </div>
    </div>
  )
}
