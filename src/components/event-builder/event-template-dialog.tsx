import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import { useSessionTemplateFull } from '@/hooks/use-session-templates'
import type { SessionTemplate } from '@/domain/types'
import type { SessionTemplateFull } from '@/lib/data-adapter'

interface EventTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (template: SessionTemplate) => void
  editingId?: string | null
}

export function EventTemplateDialog({
  open,
  onOpenChange,
  onSaved,
  editingId,
}: EventTemplateDialogProps) {
  const isEditing = Boolean(editingId)
  const handleCancel = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-surface-anvil p-0 sm:max-w-5xl">
        <div className="px-4 lg:px-12">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="font-display text-sm text-ember">
              {isEditing ? 'Edit Event' : 'Create Event'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing
                ? 'Edit an existing event template'
                : 'Create a new event template to assign to your program'}
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            {editingId ? (
              <EditLoader templateId={editingId} onSave={onSaved} onCancel={handleCancel} />
            ) : (
              <EventTemplateForm onSave={onSaved} onCancel={handleCancel} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EditLoader({
  templateId,
  onSave,
  onCancel,
}: {
  templateId: string
  onSave: (template: SessionTemplate) => void
  onCancel: () => void
}) {
  const { data, isLoading, error } = useSessionTemplateFull(templateId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-10 w-full bg-surface-iron" />
        <Skeleton className="h-8 w-48 bg-surface-iron" />
        <Skeleton className="h-32 w-full bg-surface-iron" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-4">
        <p className="text-center text-xs text-destructive">Failed to load event</p>
        <p className="text-center text-xs text-warm-ash/40">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
    )
  }

  if (!data) {
    return <div className="p-4 text-center text-xs text-warm-ash/60">Event not found</div>
  }

  return (
    <EventTemplateForm
      initial={data as SessionTemplateFull}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}
