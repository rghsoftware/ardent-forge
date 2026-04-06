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

type PublishDialogMode = 'program' | 'template' | 'exercise'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: PublishDialogMode
  entityName: string
  onConfirm: () => void
  isPublishing?: boolean
}

const TITLES = {
  program: 'Publish Program',
  template: 'Publish Template',
  exercise: 'Publish Exercise',
} satisfies Record<PublishDialogMode, string>

function getDescription(mode: PublishDialogMode, entityName: string): string {
  switch (mode) {
    case 'program':
      return `Publishing '${entityName}' will also make all its templates and referenced exercises publicly visible. Any authenticated user will be able to discover and clone this program.`
    case 'template':
      return `Publishing '${entityName}' will also make any referenced custom exercises publicly visible. Any authenticated user will be able to discover and clone this template.`
    case 'exercise':
      return `Publishing '${entityName}' will make this exercise visible to all authenticated users.`
  }
}

export function PublishDialog({
  open,
  onOpenChange,
  mode,
  entityName,
  onConfirm,
  isPublishing = false,
}: PublishDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLES[mode]}</AlertDialogTitle>
          <AlertDialogDescription>{getDescription(mode, entityName)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPublishing}
            className="bg-ember text-on-primary hover:brightness-110"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
