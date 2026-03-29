import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogs } from '@/hooks/use-workout-logs'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useActiveProgram, useProgramFull } from '@/hooks/use-programs'
import { CrashRecoveryDialog } from '@/components/workout/crash-recovery-dialog'
import { ProgramSessionCard } from '@/components/today/program-session-card'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format-duration'
import type { WorkoutLog } from '@/domain/types'
import type { ProgramFull } from '@/lib/data-adapter'

export const Route = createFileRoute('/_authenticated/')({
  component: TodayPage,
})

// ---------------------------------------------------------------------------
// Helpers -- resolve today's session from the program structure
// ---------------------------------------------------------------------------

type TodaySessionResult = {
  block: ProgramFull['blocks'][number] | null
  week: ProgramFull['blockWeeks'][number] | null
  session: ProgramFull['scheduledSessions'][number] | null
  error?: 'block-not-found' | 'week-not-found'
}

function resolveTodaySession(
  programFull: ProgramFull,
  blockOrdinal: number,
  weekNumber: number,
): TodaySessionResult {
  const todayDow = new Date().getDay() // 0=Sun .. 6=Sat

  // Find the current block by ordinal
  const currentBlock = programFull.blocks.find((b) => b.ordinal === blockOrdinal)
  if (!currentBlock) {
    return { block: null, week: null, session: null, error: 'block-not-found' }
  }

  // Find the current week within that block
  const currentWeek = programFull.blockWeeks.find(
    (bw) => bw.blockId === currentBlock.id && bw.weekNumber === weekNumber,
  )
  if (!currentWeek) {
    return { block: currentBlock, week: null, session: null, error: 'week-not-found' }
  }

  // Find a scheduled session for today's day of week
  const todaySession = programFull.scheduledSessions.find(
    (ss) => ss.blockWeekId === currentWeek.id && ss.dayOfWeek === todayDow,
  )

  // No error -- if no session, it is a genuine rest day
  return {
    block: currentBlock,
    week: currentWeek,
    session: todaySession ?? null,
  }
}

// ---------------------------------------------------------------------------
// TodayPage
// ---------------------------------------------------------------------------

function TodayPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { startWorkout, startProgrammedWorkout, isStarting } = useActiveWorkout()
  const userId = user?.id ?? ''
  const { data: recentWorkouts = [] } = useWorkoutLogs(userId, 5)
  const [startError, setStartError] = useState<string | null>(null)

  // Active program context
  const { data: activation, isLoading: isLoadingActivation } = useActiveProgram(userId || undefined)
  const { data: programFull, isLoading: isLoadingProgram } = useProgramFull(activation?.programId)

  const isProgramLoading = isLoadingActivation || (!!activation && isLoadingProgram)
  const hasActiveProgram = !!activation && !!programFull

  // Resolve today's session from the program structure
  const todayContext = useMemo(() => {
    if (!programFull || !activation) return null
    return resolveTodaySession(
      programFull,
      activation.currentBlockOrdinal,
      activation.currentWeekNumber,
    )
  }, [programFull, activation])

  // Filter to only completed workouts for the recent list
  const completedWorkouts = recentWorkouts.filter((w) => !!w.completedAt)

  const handleStartWorkout = async () => {
    if (!userId) return
    setStartError(null)
    try {
      const workoutLog = await startWorkout(userId)
      navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
    } catch (err) {
      console.error('[today-page] handleStartWorkout:', err)
      setStartError('Failed to start workout. Check your connection and try again.')
    }
  }

  const handleStartProgrammedSession = async () => {
    if (
      !userId ||
      !todayContext?.session?.sessionTemplateId ||
      !activation ||
      !todayContext.block
    ) {
      setStartError('Unable to start session. Program data may be incomplete.')
      return
    }
    setStartError(null)
    try {
      const workoutLog = await startProgrammedWorkout(
        userId,
        todayContext.session.sessionTemplateId,
        {
          programId: activation.programId,
          blockId: todayContext.block.id,
          weekNumber: activation.currentWeekNumber,
          dayLabel: todayContext.session.dayLabel,
        },
      )
      navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
    } catch (err) {
      console.error('[today-page] handleStartProgrammedSession:', err)
      setStartError('Failed to start session. Check your connection and try again.')
    }
  }

  // Compute total weeks for current block
  const totalWeeksInBlock = useMemo(() => {
    if (!todayContext?.block?.id || !programFull) return 0
    return programFull.blockWeeks.filter((bw) => bw.blockId === todayContext.block!.id).length
  }, [todayContext, programFull])

  return (
    <div className="flex min-h-screen flex-col bg-surface-anvil p-4 gap-6">
      {/* Crash recovery check */}
      <CrashRecoveryDialog userId={userId} />

      {/* Data mismatch error banner */}
      {todayContext?.error && (
        <div
          role="alert"
          className="mt-8 bg-amber-900/30 border border-amber-600/40 px-4 py-3 text-xs text-amber-300 uppercase tracking-wider text-center"
        >
          Your program data may be out of sync. Try reactivating your program.
        </div>
      )}

      {/* Active program context card */}
      {(isProgramLoading || hasActiveProgram) && !todayContext?.error && (
        <div className="mt-8">
          <ProgramSessionCard
            programName={programFull?.program.name ?? ''}
            blockName={todayContext?.block?.name ?? ''}
            weekNumber={activation?.currentWeekNumber ?? 0}
            totalWeeks={totalWeeksInBlock}
            sessionName={todayContext?.session?.dayLabel}
            sessionType={todayContext?.session?.sessionType}
            onStartSession={handleStartProgrammedSession}
            isLoading={isProgramLoading}
            isRestDay={hasActiveProgram && !todayContext?.session && !todayContext?.error}
          />
        </div>
      )}

      {/* Empty state -- only show when no program and no history */}
      {completedWorkouts.length === 0 && !hasActiveProgram && !isProgramLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-warm-ash/40">
          <span
            className="material-symbols-outlined text-5xl"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
          >
            fitness_center
          </span>
          <p className="text-sm uppercase tracking-widest font-heading">NO SESSIONS YET</p>
          <p className="text-xs uppercase tracking-wider">TAP EXECUTE WORKOUT TO BEGIN</p>
        </div>
      )}

      {/* Recent workouts */}
      {completedWorkouts.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-warm-ash/60 mb-3 font-heading">
            RECENT SESSIONS
          </h2>
          <div className="flex flex-col gap-2">
            {completedWorkouts.map((workout) => (
              <RecentWorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </section>
      )}

      {/* Ad-hoc workout CTA */}
      <div className={hasActiveProgram ? '' : 'mt-8'}>
        <div className="flex flex-col gap-2">
          {hasActiveProgram && (
            <span className="text-xs text-warm-ash/40 uppercase tracking-wider text-center">
              OR
            </span>
          )}
          <Button
            variant={hasActiveProgram ? 'outline' : 'molten'}
            className={
              hasActiveProgram
                ? 'w-full h-12 text-xs uppercase tracking-widest font-medium'
                : 'w-full h-16 text-base uppercase tracking-widest font-medium'
            }
            onClick={handleStartWorkout}
            disabled={isStarting || !userId}
          >
            {isStarting ? 'STARTING...' : hasActiveProgram ? 'AD-HOC WORKOUT' : 'EXECUTE WORKOUT'}
          </Button>
          {startError && (
            <p className="text-xs text-warning-flare text-center uppercase tracking-wider">
              {startError}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecentWorkoutCard
// ---------------------------------------------------------------------------

function RecentWorkoutCard({ workout }: { workout: WorkoutLog }) {
  const startedAt = new Date(workout.startedAt)
  const completedAt = workout.completedAt ? new Date(workout.completedAt) : null

  const dateLabel = startedAt
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()

  const duration = completedAt
    ? formatDuration(Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
    : null

  return (
    <div className="flex items-center justify-between bg-surface-iron px-4 py-3 milled-edge">
      <div className="flex flex-col gap-0.5">
        <span className="font-heading text-sm text-bone-white uppercase tracking-wider">
          {workout.title ?? dateLabel}
        </span>
        <span className="text-xs text-warm-ash/60 uppercase tracking-wider">{dateLabel}</span>
      </div>

      {duration && (
        <span className="font-display text-sm text-warm-ash tabular-nums">{duration}</span>
      )}
    </div>
  )
}
