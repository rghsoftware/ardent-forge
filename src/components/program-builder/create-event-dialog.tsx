import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EventTemplateForm } from '@/components/event-builder/event-template-form'
import type { SessionTemplate } from '@/domain/types'

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (template: SessionTemplate) => void
}

export function CreateEventDialog({ open, onOpenChange, onCreated }: CreateEventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto bg-surface-anvil p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="font-display text-sm text-ember">Create Event</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new event template to assign to your program
          </DialogDescription>
        </DialogHeader>
        <EventTemplateForm onSave={onCreated} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
