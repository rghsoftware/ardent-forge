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

  // Find the most recent incomplete workout (no completedAt)
  const incompleteWorkout: WorkoutLog | undefined = recentLogs.find((log) => !log.completedAt)

  // Fetch full workout data for the incomplete workout (groups, activities, sets)
  const { data: fullWorkout } = useWorkoutLogFull(incompleteWorkout?.id ?? '')

  const [dismissed, setDismissed] = useState(false)
  const [isResuming, setIsResuming] = useState(false)
  const [isDiscarding, setIsDiscarding] = useState(false)

  // Derive open state -- no effect needed
  const open = Boolean(incompleteWorkout && !isActive && !dismissed)

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

    try {
      await deleteWorkoutLogMutation.mutateAsync(incompleteWorkout.id)
      setDismissed(true)
    } catch {
      // Allow retry on failure
      setIsDiscarding(false)
    }
  }

  if (!incompleteWorkout) return null

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
          <DialogTitle className="font-heading text-lg uppercase tracking-widest text-bone-white">
            RESUME SESSION?
          </DialogTitle>
          <DialogDescription className="text-warm-ash text-sm">
            You have an unfinished workout from {dateLabel} ({timeAgo}).
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row gap-3 sm:flex-row">
          <Button
            variant="ghost"
            className="flex-1 uppercase tracking-widest text-warm-ash hover:text-warning-flare"
            onClick={handleDiscard}
            disabled={isDiscarding || isResuming}
          >
            {isDiscarding ? 'DISCARDING...' : 'DISCARD'}
          </Button>
          <Button
            variant="molten"
            className="flex-1 h-12 uppercase tracking-widest"
            onClick={handleResume}
            disabled={isResuming || isDiscarding || !fullWorkout}
          >
            {isResuming ? 'RESUMING...' : 'RESUME'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

function formatDateLabel(date: Date): string {
  return date
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
}
