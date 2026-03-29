import { useDeleteWorkoutLog } from '@/hooks/use-workout-logs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteWorkoutDialogProps {
  workoutId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeleteWorkoutDialog({
  workoutId,
  open,
  onClose,
  onSuccess,
}: DeleteWorkoutDialogProps) {
  const deleteWorkoutLog = useDeleteWorkoutLog()

  const handleDelete = async () => {
    try {
      await deleteWorkoutLog.mutateAsync(workoutId)
      onSuccess()
    } catch {
      // Error state available via deleteWorkoutLog.isError
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-xs text-warning-flare">Delete Workout</DialogTitle>
          <DialogDescription>
            This workout and all its logged sets will be permanently deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={deleteWorkoutLog.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteWorkoutLog.isPending}
          >
            {deleteWorkoutLog.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
        {deleteWorkoutLog.isError && (
          <p className="text-xs text-warning-flare px-4 pb-2">
            Failed to delete workout. Please try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
