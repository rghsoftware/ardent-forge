import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLeaveConversation } from '@/hooks/use-chat'

interface LeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  onLeft: () => void
}

export function LeaveDialog({ open, onOpenChange, conversationId, onLeft }: LeaveDialogProps) {
  const leaveConversation = useLeaveConversation()
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState(false)

  const handleLeave = async () => {
    setLeaving(true)
    setError(false)
    try {
      await leaveConversation.mutateAsync(conversationId)
      onOpenChange(false)
      onLeft()
    } catch (err) {
      console.error('[chat] Failed to leave conversation:', err)
      setError(true)
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Leave this conversation?</DialogTitle>
          <DialogDescription>You won't receive new messages.</DialogDescription>
        </DialogHeader>
        {error && <p className="px-6 text-xs text-red-400">Failed to leave. Please try again.</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={leaving}>
            CANCEL
          </Button>
          <Button variant="destructive" onClick={handleLeave} disabled={leaving}>
            {leaving ? 'LEAVING...' : 'LEAVE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
