import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import type { Gym, GymMember } from '@/domain/types'

interface GymOwnerActionsProps {
  gym: Gym
  members: (GymMember & { displayName: string | null })[]
  onRename: (name: string) => void
  onDelete: () => void
  onProposeTransfer: (targetUserId: string) => void
  onGenerateInvite: () => void
  renamePending?: boolean
  deletePending?: boolean
}

export function GymOwnerActions({
  gym,
  members,
  onRename,
  onDelete,
  onProposeTransfer,
  onGenerateInvite,
  renamePending,
  deletePending,
}: GymOwnerActionsProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(gym.name)
  const [transferTarget, setTransferTarget] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const eligibleTransferTargets = members.filter((m) => m.userId !== gym.ownerUserId)

  return (
    <section className="bg-surface-pit/40 px-4 py-4">
      <button
        type="button"
        data-testid="gym-owner-actions-toggle"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-12 w-full items-center justify-between font-sans text-[11px] font-medium uppercase tracking-widest text-warm-ash hover:text-bone-white"
        aria-expanded={open}
      >
        <span>OWNER ACTIONS</span>
        <span>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-6">
          {/* Rename */}
          <div className="space-y-2">
            <label htmlFor="rename-gym-input" className={FORGE_LABEL_CLASS}>
              Rename gym
            </label>
            <div className="flex gap-2">
              <ForgeInput
                id="rename-gym-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                data-testid="rename-gym-input"
              />
              <Button
                data-testid="rename-gym-submit"
                className="min-h-[48px] bg-forge text-on-forge hover:bg-forge/80"
                disabled={!name.trim() || name === gym.name || renamePending}
                onClick={() => onRename(name.trim())}
              >
                {renamePending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Generate invite */}
          <div className="space-y-2">
            <h3 className={FORGE_LABEL_CLASS}>Invite members</h3>
            <Button
              data-testid="generate-invite-button"
              className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
              onClick={onGenerateInvite}
            >
              Generate invite link
            </Button>
          </div>

          {/* Propose transfer */}
          {eligibleTransferTargets.length > 0 && (
            <div className="space-y-2">
              <label className={FORGE_LABEL_CLASS}>Transfer ownership</label>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger
                  data-testid="propose-transfer-select"
                  className="min-h-[48px] rounded-none border-surface-steel bg-surface-iron"
                >
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleTransferTargets.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.displayName ?? m.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                data-testid="propose-transfer-submit"
                className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
                disabled={!transferTarget}
                onClick={() => onProposeTransfer(transferTarget)}
              >
                Propose transfer
              </Button>
            </div>
          )}

          {/* Delete */}
          <div className="space-y-2">
            <h3 className={FORGE_LABEL_CLASS}>Danger zone</h3>
            <Button
              variant="outline"
              data-testid="delete-gym-button"
              className="min-h-[48px] w-full rounded-none border-warning-flare text-warning-flare hover:bg-warning-flare/10"
              onClick={() => setConfirmDelete(true)}
            >
              Delete gym
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-none bg-surface-iron">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-sans text-sm font-medium uppercase tracking-widest text-bone-white">
              DELETE {gym.name.toUpperCase()}?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-warm-ash">
              This removes all members and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePending}
              className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-gym-confirm"
              onClick={() => {
                onDelete()
                setConfirmDelete(false)
              }}
              disabled={deletePending}
              className="min-h-[48px] rounded-none bg-warning-flare text-on-forge hover:bg-warning-flare/80"
            >
              {deletePending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
