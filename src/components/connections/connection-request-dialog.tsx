import { useState } from 'react'
import { useRequestConnection } from '@/hooks/use-connections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Icon } from '@/components/icon'

export function ConnectionRequestDialog() {
  const [open, setOpen] = useState(false)
  const [recipientId, setRecipientId] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const requestConnection = useRequestConnection()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = recipientId.trim()
    if (!trimmed) return

    requestConnection.mutate(trimmed, {
      onSuccess: () => {
        setSuccessMsg('Request sent!')
        setRecipientId('')
        setTimeout(() => {
          setOpen(false)
          setSuccessMsg('')
        }, 1200)
      },
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setRecipientId('')
      setSuccessMsg('')
      requestConnection.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          Connect
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-none border-warm-ash/10 bg-surface-charcoal">
        <DialogHeader>
          <DialogTitle className="font-display text-bone-white">
            Send connection request
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="recipient-id" className="text-warm-ash text-xs">
              User email or ID
            </Label>
            <Input
              id="recipient-id"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="athlete@example.com"
              className="rounded-none bg-surface-iron border-warm-ash/10 text-bone-white placeholder:text-warm-ash/40 min-h-12"
              disabled={requestConnection.isPending}
            />
          </div>

          {requestConnection.isError && (
            <p className="flex items-center gap-1.5 text-xs text-warning-flare">
              <Icon name="error" size={14} />
              {requestConnection.error?.message || 'Failed to send request'}
            </p>
          )}

          {successMsg && (
            <p className="flex items-center gap-1.5 text-xs text-forge-ember">
              <Icon name="check_circle" size={14} />
              {successMsg}
            </p>
          )}

          <Button
            type="submit"
            className="w-full min-h-12 rounded-none"
            disabled={!recipientId.trim() || requestConnection.isPending}
          >
            {requestConnection.isPending ? 'Sending...' : 'Send request'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
