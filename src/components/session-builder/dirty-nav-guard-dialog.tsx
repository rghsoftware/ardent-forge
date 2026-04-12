import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DirtyNavGuardDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Confirmation dialog shown when a user attempts to navigate away from the
// template editor with unsaved changes. Copy uses mixed-case per ADR-021-05
// to match the broader UX guidance on dialog tone.
export function DirtyNavGuardDialog({ open, onConfirm, onCancel }: DirtyNavGuardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes to this template. Leaving this page will discard them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
