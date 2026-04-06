import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useWorkoutLogs, useWorkoutLogFull, useDeleteWorkoutLog } from '@/hooks/use-workout-logs'
import { useActiveWorkout } from '@/hooks/use-active-workout'
import { formatTimeAgo, formatDateLabel } from '@/lib/format-duration'
import type { WorkoutLog } from '@/domain/types'

interface CrashRecoveryDialogProps {
  userId: string
}

/**
 * CrashRecoveryDialog -- detects an incomplete workout on mount and prompts
 * the user to resume or discard it. Industrial language: RESUME / DISCARD.
 */
export function CrashRecoveryDialog({ userId }: CrashRecoveryDialogProps) {
  const navigate = useNavigate()
  const { resumeWorkout, isActive } = useActiveWorkout()
  const { data: recentLogs = [] } = useWorkoutLogs(userId, 10)
  const deleteWorkoutLogMutation = useDeleteWorkoutLog()

  // Find the most recent incomplete workout that is not intentionally paused.
  // Paused sessions (pausedAt != null) are handled by PausedSessionCard, not crash recovery.
  const incompleteWorkout: WorkoutLog | undefined = recentLogs.find(
    (log) => !log.completedAt && !log.pausedAt,
  )

  // Fetch full workout data for the incomplete workout (groups, activities, sets)
  const { data: fullWorkout, isPending: isLoadingFullWorkout } = useWorkoutLogFull(
    incompleteWorkout?.id ?? '',
  )

  // Qualify the candidate: a session is only "crash-orphaned" if it has at least
  // one confirmed set OR was started more than 60s ago. Otherwise treat as a
  // transient navigation race (fresh session that was never really used).
  const hasConfirmedSet = fullWorkout ? fullWorkout.sets.some((s) => s.completed) : false
  const ageMs = incompleteWorkout ? Date.now() - new Date(incompleteWorkout.startedAt).getTime() : 0
  const qualifiesAsCrash = hasConfirmedSet || ageMs > 60_000

  if (incompleteWorkout && fullWorkout && !qualifiesAsCrash) {
    console.info('[crash-recovery] Skipping transient session (no confirmed sets, <60s old):', {
      workoutId: incompleteWorkout.id,
      ageMs,
    })
  }

  const [dismissed, setDismissed] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [discardError, setDiscardError] = useState<string | null>(null)

  // Derive open state -- no effect needed
  const open = Boolean(
    incompleteWorkout && fullWorkout && qualifiesAsCrash && !isActive && !dismissed,
  )

  const handleResume = () => {
    if (!fullWorkout || !incompleteWorkout) return
    setIsResuming(true)
    setDismissed(true)
    resumeWorkout(fullWorkout)
    navigate({ to: '/log/$workoutId', params: { workoutId: incompleteWorkout.id } })
  }

  const handleDiscard = async () => {
    if (!incompleteWorkout) return
    setIsDiscarding(true)
    setDiscardError(null)

    try {
      await deleteWorkoutLogMutation.mutateAsync(incompleteWorkout.id)
      setDismissed(true)
    } catch (err) {
      console.error('[workout] Failed to discard incomplete workout:', {
        workoutId: incompleteWorkout.id,
        err,
      })
      setIsDiscarding(false)
      setDiscardError('Failed to discard. Try again.')
    }
  }

  if (!incompleteWorkout) return null
  if (fullWorkout && !qualifiesAsCrash) return null

  const startedDate = new Date(incompleteWorkout.startedAt)
  const timeAgo = formatTimeAgo(startedDate)
  const dateLabel = formatDateLabel(startedDate)

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setDismissed(true)
      }}
    >
      <DialogContent
        className="bg-surface-iron rounded-none ring-0 ring-transparent"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-lg text-bone-white">
            Resume Session?
          </DialogTitle>
          <DialogDescription className="text-warm-ash text-sm">
            {isLoadingFullWorkout
              ? 'Loading session data...'
              : `You have an unfinished workout from ${dateLabel} (${timeAgo}).`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1">
            <Button
              variant="ghost"
              className="w-full text-warm-ash hover:text-warning-flare"
              onClick={handleDiscard}
              disabled={isDiscarding || isResuming}
            >
              {isDiscarding ? 'Discarding...' : 'Discard'}
            </Button>
            {discardError && (
              <span className="text-center text-xs text-warning-flare">{discardError}</span>
            )}
          </div>
          <Button
            variant="molten"
            className="flex-1 h-12"
            onClick={handleResume}
            disabled={isResuming || isDiscarding || !fullWorkout}
          >
            {isResuming ? 'Resuming...' : 'Resume'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
