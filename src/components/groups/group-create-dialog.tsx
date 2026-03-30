import { useState } from 'react'
import { useCreateGroup } from '@/hooks/use-groups'
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

interface GroupCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GroupCreateDialog({ open, onOpenChange }: GroupCreateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [retentionDays, setRetentionDays] = useState('30')
  const [formError, setFormError] = useState<string | null>(null)

  const createGroup = useCreateGroup()

  const resetForm = () => {
    setName('')
    setDescription('')
    setRetentionDays('30')
    setFormError(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Group name is required.')
      return
    }
    if (trimmedName.length > 200) {
      setFormError('Group name must be 200 characters or fewer.')
      return
    }

    const days = parseInt(retentionDays, 10)
    if (isNaN(days) || days < 1 || days > 90) {
      setFormError('Data retention must be between 1 and 90 days.')
      return
    }

    try {
      await createGroup.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        dataRetentionDays: days,
      })
      handleOpenChange(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create group.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-surface-iron border-ghost-line/15">
        <DialogHeader>
          <DialogTitle className="font-heading text-bone-white">Create group</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name" className="text-xs text-warm-ash">
              Name
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning Crew"
              maxLength={200}
              autoFocus
              error={!!formError && !name.trim()}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-desc" className="text-xs text-warm-ash">
              Description (optional)
            </Label>
            <textarea
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              rows={2}
              className="w-full bg-surface-gunmetal text-bone-white px-3 py-2 rounded-none border-0 border-b-2 border-transparent outline-none placeholder:text-warm-ash/50 focus:border-b-ember resize-none text-sm"
            />
          </div>

          {/* Data retention */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-retention" className="text-xs text-warm-ash">
              Data retention (days)
            </Label>
            <Input
              id="group-retention"
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              min={1}
              max={90}
              error={
                !!formError &&
                (isNaN(parseInt(retentionDays, 10)) ||
                  parseInt(retentionDays, 10) < 1 ||
                  parseInt(retentionDays, 10) > 90)
              }
            />
            <p className="text-xs text-warm-ash/50">
              How long group activity data is visible (1-90 days).
            </p>
          </div>

          {/* Error */}
          {formError && <p className="text-xs text-warning-flare">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createGroup.isPending}>
              {createGroup.isPending ? 'Creating...' : 'Create group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
