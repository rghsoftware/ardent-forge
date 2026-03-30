import { useState } from 'react'
import { useJoinGroup } from '@/hooks/use-groups'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface JoinGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JoinGroupDialog({ open, onOpenChange }: JoinGroupDialogProps) {
  const [code, setCode] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const joinGroup = useJoinGroup()

  const resetForm = () => {
    setCode('')
    setFormError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) {
      setFormError('Invite code is required.')
      return
    }

    // Validate AF-XXXXXXXX pattern
    if (!/^AF-[A-Z0-9]{8}$/.test(trimmedCode)) {
      setFormError('Invalid code format. Expected: AF-XXXXXXXX')
      return
    }

    try {
      await joinGroup.mutateAsync(trimmedCode)
      handleOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid or expired invite code.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-iron border-ghost-line/15">
        <DialogHeader>
          <DialogTitle className="font-heading text-bone-white">Join group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-code" className="text-xs text-warm-ash">
              Invite code
            </Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AF-ABCD1234"
              maxLength={11}
              autoFocus
              className="font-mono tracking-wider"
              error={!!formError}
            />
            <p className="text-xs text-warm-ash/50">Ask a group member for their invite code.</p>
          </div>

          {formError && <p className="text-xs text-warning-flare">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={joinGroup.isPending}>
              {joinGroup.isPending ? 'Joining...' : 'Join group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
