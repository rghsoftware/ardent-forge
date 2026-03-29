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
    <div className="flex min-h-screen flex-col bg-surface-anvil px-4 pb-6">
      {/* Crash recovery check */}
      <CrashRecoveryDialog userId={userId} />

      {/* Data mismatch error banner */}
      {todayContext?.error && (
        <div
          role="alert"
          className="mt-6 bg-amber-900/30 border border-amber-600/40 px-4 py-3 text-xs text-amber-300 text-center"
        >
          Your program data may be out of sync. Try reactivating your program.
        </div>
      )}

      {/* Active program context card */}
      {(isProgramLoading || hasActiveProgram) && !todayContext?.error && (
        <div className="pt-6">
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
        <div className="flex flex-1 flex-col gap-8 pt-6">
          {/* Ghost preview: shows what recent sessions look like when filled */}
          <div className="flex flex-col opacity-25 pointer-events-none select-none">
            {(
              [
                {
                  title: 'Upper Push A',
                  exercises: 'Bench Press, OHP, Lateral Raises',
                  duration: '48:22',
                  sets: 18,
                  even: true,
                },
                {
                  title: 'Lower B — Squat',
                  exercises: 'Back Squat, Romanian Deadlift, Leg Press',
                  duration: '55:10',
                  sets: 15,
                  even: false,
                },
                {
                  title: 'Pull — Back & Biceps',
                  exercises: 'Deadlift, Barbell Row, Pull-up',
                  duration: '42:00',
                  sets: 14,
                  even: true,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.title}
                className={`flex min-h-[60px] items-center justify-between px-4 py-3 ${row.even ? 'bg-surface-iron' : 'bg-surface-charcoal'}`}
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
                  <span className="font-heading text-sm text-bone-white uppercase tracking-wider">
                    {row.title}
                  </span>
                  <span className="text-xs text-warm-ash/60 truncate">{row.exercises}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-display text-sm text-warm-ash tabular-nums">
                    {row.duration}
                  </span>
                  <span className="inline-flex items-center bg-surface-gunmetal text-bone-white text-[11px] px-2 py-0.5 uppercase tracking-widest">
                    {row.sets} SETS
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Value description */}
          <div className="flex flex-col gap-2 text-center px-6">
            <p className="text-sm font-heading text-warm-ash">Your sessions will appear here.</p>
            <p className="text-xs text-warm-ash/50 leading-relaxed">
              Track every set, weight, and rep. Watch your progress across workouts -- or follow a
              structured program session by session.
            </p>
          </div>
        </div>
      )}

      {/* Recent workouts */}
      {completedWorkouts.length > 0 && (
        <section className="pt-6">
          <div className="border-t border-surface-steel pt-4 pb-2">
            <h2 className="text-xs font-heading uppercase tracking-widest text-warm-ash/60">
              RECENT SESSIONS
            </h2>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {completedWorkouts.map((workout) => (
              <RecentWorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </section>
      )}

      {/* Ad-hoc workout CTA */}
      <div className="pt-6">
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
                ? 'w-full h-12 text-xs font-medium'
                : 'w-full h-16 text-base font-medium'
            }
            onClick={handleStartWorkout}
            disabled={isStarting || !userId}
          >
            {isStarting ? 'Starting...' : hasActiveProgram ? 'Ad-hoc Workout' : 'Execute Workout'}
          </Button>
          {startError && <p className="text-xs text-warning-flare text-center">{startError}</p>}
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
        <span className="font-heading text-sm text-bone-white">{workout.title ?? dateLabel}</span>
        <span className="text-xs text-warm-ash/60 uppercase tracking-wider">{dateLabel}</span>
      </div>

      {duration && (
        <span className="font-display text-sm text-warm-ash tabular-nums">{duration}</span>
      )}
    </div>
  )
}
