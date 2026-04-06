import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogs } from '@/hooks/use-workout-logs'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { useActiveProgram, useProgramFull } from '@/hooks/use-programs'
import { CrashRecoveryDialog } from '@/components/workout/crash-recovery-dialog'
import { ProgramSessionCard } from '@/components/today/program-session-card'
import { EventCountdownBadge } from '@/components/event-builder/event-countdown-badge'
import { GhostSessionPreview } from '@/components/shared/ghost-session-preview'
import { WelcomeCard } from '@/components/onboarding/welcome-card'
import { OnboardingHint } from '@/components/onboarding/onboarding-hint'
import { useOnboarding } from '@/hooks/use-onboarding'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNextUpcomingEvent } from '@/hooks/use-event-items'
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
  // dayOfWeek uses JS Date.getDay() convention: 0=Sun..6=Sat (matches scheduledSessions schema)
  const todayDow = new Date().getDay()

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
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const { startWorkout, startProgrammedWorkout, isStarting } = useActiveWorkout()
  const userId = user?.id ?? ''

  const { markRouteVisited } = useOnboarding()
  const firstWorkoutCompleted = useOnboardingStore((s) => s.firstWorkoutCompleted)

  const { data: recentWorkouts = [], isError: isWorkoutsError } = useWorkoutLogs(userId, 5)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    markRouteVisited('/')
  }, [markRouteVisited])

  // Active program context
  const {
    data: activation,
    isLoading: isLoadingActivation,
    isError: isActivationError,
  } = useActiveProgram(userId || undefined)
  const {
    data: programFull,
    isLoading: isLoadingProgram,
    isError: isProgramError,
  } = useProgramFull(activation?.programId)

  const { data: nextEvent, isError: isEventError } = useNextUpcomingEvent(userId || undefined)

  const hasDataError = isWorkoutsError || isActivationError || isProgramError || isEventError

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

  // Compute total weeks for current block
  const totalWeeksInBlock = useMemo(() => {
    if (!todayContext?.block?.id || !programFull) return 0
    return programFull.blockWeeks.filter((bw) => bw.blockId === todayContext.block!.id).length
  }, [todayContext, programFull])

  // If no userId and not guest, show loading -- avoids silent empty-data state
  if (!userId && !isGuest) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  const handleStartWorkout = async () => {
    if (!userId) {
      console.error('[today-page] Cannot start workout: no authenticated user')
      setStartError('You must be signed in to start a workout.')
      return
    }
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
        todayContext.session.overrides,
      )
      navigate({ to: '/log/$workoutId', params: { workoutId: workoutLog.id } })
    } catch (err) {
      console.error('[today-page] handleStartProgrammedSession:', err)
      setStartError('Failed to start session. Check your connection and try again.')
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil px-4 pb-6 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Crash recovery check */}
        <CrashRecoveryDialog userId={userId} />

        {/* Data fetch error banner */}
        {hasDataError && (
          <div
            role="alert"
            className="mt-6 bg-warning-flare/10 border border-warning-flare/30 px-4 py-3 text-xs text-warning-flare text-center"
          >
            Some data failed to load. Check your connection and try again.
          </div>
        )}

        {/* Data mismatch error banner */}
        {todayContext?.error && (
          <div
            role="alert"
            className="mt-6 bg-amber-900/30 border border-amber-600/40 px-4 py-3 text-xs text-amber-300 text-center"
          >
            Your program data may be out of sync. Try reactivating your program.
          </div>
        )}

        {/* First workout celebration hint */}
        {firstWorkoutCompleted && (
          <div className="pt-6">
            <OnboardingHint hintKey="workout-complete-celebration">
              First session logged. Your history and analytics are now building.
            </OnboardingHint>
          </div>
        )}

        {/* Two-column grid at md+ when there are recent sessions to show in the right column.
           When no recent sessions exist, no grid wrapper is needed -- the left column
           fills the single-column layout naturally. */}
        <div
          className={
            completedWorkouts.length > 0 ? 'md:grid md:grid-cols-2 md:gap-8 lg:gap-10' : undefined
          }
        >
          {/* Left: program card + CTA */}
          <div>
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

            {/* Upcoming event countdown badge */}
            {nextEvent && (
              <div className="pt-4">
                <EventCountdownBadge
                  eventName={nextEvent.template.name}
                  daysUntil={nextEvent.daysUntil}
                  templateId={nextEvent.template.id}
                />
              </div>
            )}

            {/* Empty state -- only show when no program and no history */}
            {completedWorkouts.length === 0 && !hasActiveProgram && !isProgramLoading && (
              <div className="flex flex-1 flex-col gap-8 pt-6">
                <WelcomeCard />
                <GhostSessionPreview />

                <div className="flex flex-col gap-2 text-center px-6">
                  <p className="text-sm font-heading text-warm-ash">
                    Your sessions will appear here.
                  </p>
                  <p className="text-xs text-warm-ash/50 leading-relaxed">
                    Track every set, weight, and rep. Watch your progress across workouts -- or
                    follow a structured program session by session.
                  </p>
                </div>
              </div>
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
                  {isStarting
                    ? 'Starting...'
                    : hasActiveProgram
                      ? 'Ad-hoc Workout'
                      : 'Execute Workout'}
                </Button>
                {startError && (
                  <p className="text-xs text-warning-flare text-center">{startError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: recent sessions */}
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
