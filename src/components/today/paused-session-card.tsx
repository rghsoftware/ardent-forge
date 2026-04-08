import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useWorkoutLogs, useDeleteWorkoutLog } from '@/hooks/use-workout-logs'
import { formatDuration, formatTimeAgo } from '@/lib/format-duration'
import type { WorkoutLog } from '@/domain/types'

interface PausedSessionCardProps {
  userId: string
}

/**
 * PausedSessionCard -- shown on the Forge page when the user has a workout
 * that was intentionally paused (pausedAt set, not yet completed).
 *
 * Resume behavior: navigates to `/log/$workoutId`. The log page header
 * already exposes a resume control (S022) that unpauses the session, so we
 * defer the unpause action there. This avoids having to hydrate the active
 * workout store from this card and keeps the flow identical to the in-log
 * resume UX.
 *
 * Discard uses a two-step confirm-in-place pattern (no modal) -- tap once
 * to arm, tap again to confirm deletion.
 */
export function PausedSessionCard({ userId }: PausedSessionCardProps) {
  const navigate = useNavigate()
  const { data: recentLogs = [], isError } = useWorkoutLogs(userId, 5)
  const deleteWorkoutLogMutation = useDeleteWorkoutLog()

  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)
  const [discardError, setDiscardError] = useState<string | null>(null)

  const pausedLog: WorkoutLog | undefined = recentLogs.find(
    (log) => log.pausedAt && !log.completedAt,
  )

  if (isError || !pausedLog) return null

  // Elapsed time is frozen at the moment of pause:
  // (pausedAt - startedAt) - totalPausedMs
  const startedMs = new Date(pausedLog.startedAt).getTime()
  const pausedAtMs = new Date(pausedLog.pausedAt as string).getTime()
  const frozenElapsedMs = pausedAtMs - startedMs - pausedLog.totalPausedMs
  const elapsedSeconds = Math.max(0, Math.floor(frozenElapsedMs / 1000))
  const elapsedLabel = formatDuration(elapsedSeconds)
  const pausedAgoLabel = formatTimeAgo(new Date(pausedAtMs))

  const handleResume = () => {
    navigate({ to: '/log/$workoutId', params: { workoutId: pausedLog.id } })
  }

  const handleDiscard = async () => {
    if (!confirmingDiscard) {
      setConfirmingDiscard(true)
      return
    }
    setIsDiscarding(true)
    setDiscardError(null)
    try {
      await deleteWorkoutLogMutation.mutateAsync(pausedLog.id)
      // Card unmounts on next query refresh
    } catch (err) {
      console.error('[paused-session-card] Failed to discard paused workout:', {
        workoutId: pausedLog.id,
        err,
      })
      setIsDiscarding(false)
      setConfirmingDiscard(false)
      setDiscardError('Failed to discard. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-surface-iron p-5 milled-edge border-l-2 border-ember">
      {/* Header: PAUSED badge + paused-since subtitle */}
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center bg-ember px-2 py-0.5 text-[11px] font-heading uppercase tracking-widest text-surface-pit">
          PAUSED
        </span>
        <span className="font-heading text-[11px] uppercase tracking-widest text-warm-ash/60">
          Paused {pausedAgoLabel}
        </span>
      </div>

      {/* Session title + frozen elapsed time */}
      <div className="flex flex-col gap-1">
        <span className="font-heading text-base text-bone-white">{pausedLog.title}</span>
        <span className="font-display text-2xl tabular-nums text-ember">{elapsedLabel}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button
          variant="molten"
          className="w-full min-h-12 text-xs font-medium"
          onClick={handleResume}
          disabled={isDiscarding}
        >
          Resume session
        </Button>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="w-full min-h-12 text-warm-ash hover:text-warning-flare"
            onClick={handleDiscard}
            disabled={isDiscarding}
          >
            {isDiscarding
              ? 'Discarding...'
              : confirmingDiscard
                ? 'Tap again to confirm discard'
                : 'Discard'}
          </Button>
          {discardError && (
            <span className="text-center text-xs text-warning-flare">{discardError}</span>
          )}
        </div>
      </div>
    </div>
  )
}
