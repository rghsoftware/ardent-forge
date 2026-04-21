import { WorkoutHeader } from '@/components/workout/workout-header'
import { WorkoutPausedBar } from '@/components/workout/workout-paused-bar'
import { ErrorBanner } from '@/components/workout/error-banner'
import { WorkoutHeaderMenu } from '@/components/workout/workout-header-menu'
import { EventDetail } from '@/components/event-builder/event-detail'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { EventMetadata } from '@/domain/types'

export type EventWorkoutLog = { id: string; eventMetadata: EventMetadata }

interface EventWorkoutViewProps {
  workoutLog: EventWorkoutLog
  elapsedSeconds: number
  isPauseSupported: boolean
  isPaused: boolean
  handlePause: () => void
  handleResume: () => void
  handleFinish: () => Promise<void>
  handleDiscard: () => Promise<void>
  isBroadcasting: boolean
  publishFocus: () => void
  publishUnfocus: () => void
  isFinishing: boolean
  isDiscarding: boolean
  pageError: string | null
  setPageError: (error: string | null) => void
  showDiscardDialog: boolean
  setShowDiscardDialog: (open: boolean) => void
}

export function EventWorkoutView({
  workoutLog,
  elapsedSeconds,
  isPauseSupported,
  isPaused,
  handlePause,
  handleResume,
  handleFinish,
  handleDiscard,
  isBroadcasting,
  publishFocus,
  publishUnfocus,
  isFinishing,
  isDiscarding,
  pageError,
  setPageError,
  showDiscardDialog,
  setShowDiscardDialog,
}: EventWorkoutViewProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {pageError && <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />}

      {/* Sticky header with timer + paused-state action bar */}
      <div className="sticky top-0 z-50">
        <WorkoutHeader
          elapsedSeconds={elapsedSeconds}
          isPaused={isPauseSupported && isPaused}
          onPause={isPauseSupported ? handlePause : undefined}
          onResume={isPauseSupported ? handleResume : undefined}
          actions={
            <WorkoutHeaderMenu
              isBroadcasting={isBroadcasting}
              publishFocus={publishFocus}
              publishUnfocus={publishUnfocus}
            />
          }
        />
        <WorkoutPausedBar
          isPaused={isPauseSupported && isPaused}
          onResume={handleResume}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          canFinish={true}
          onDiscard={() => setShowDiscardDialog(true)}
          showFinishHelper={false}
        />
      </div>

      <EventDetail
        workoutLogId={workoutLog.id}
        eventMetadata={workoutLog.eventMetadata}
        interactive={true}
      />

      {/* Discard confirmation dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Discard workout</DialogTitle>
            <DialogDescription>
              All logged sets will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDiscardDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? 'Discarding...' : 'Discard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
