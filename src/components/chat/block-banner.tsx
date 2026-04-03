import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// BlockBanner -- replaces compose bar when the other user is blocked
// ---------------------------------------------------------------------------

interface BlockBannerProps {
  onUnblock: () => void
}

export function BlockBanner({ onUnblock }: BlockBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ghost-line bg-surface-charcoal px-4 py-3">
      <span className="text-sm text-bone-white">
        This conversation is blocked. Unblock to resume.
      </span>
      <Button variant="ghost" className="text-ember" onClick={onUnblock}>
        UNBLOCK
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BlockConfirmDialog -- confirmation before blocking a user
// ---------------------------------------------------------------------------

interface BlockConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  onConfirm: () => void
}

export function BlockConfirmDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
}: BlockConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Block {userName}?</DialogTitle>
          <DialogDescription>Their messages will be hidden in all conversations.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            CANCEL
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            BLOCK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
