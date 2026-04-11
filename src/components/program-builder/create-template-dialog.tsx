import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SessionTemplateForm } from '@/components/session-builder/session-template-form'
import type { SessionTemplate } from '@/domain/types'

interface CreateTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (template: SessionTemplate) => void
}

export function CreateTemplateDialog({ open, onOpenChange, onCreated }: CreateTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto bg-surface-anvil p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="font-display text-sm text-ember">
            Create Session Template
          </DialogTitle>
          <DialogDescription className="sr-only">
            Create a new session template to assign to your program
          </DialogDescription>
        </DialogHeader>
        <SessionTemplateForm onSave={onCreated} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
