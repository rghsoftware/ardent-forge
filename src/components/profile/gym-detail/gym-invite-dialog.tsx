import { useState, type ReactElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import { useCreateGymInvite } from '@/hooks/use-gym-invites'
import type { GymInvitation } from '@/domain/types'

interface GymInviteDialogProps {
  gymId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/gyms/join?token=${encodeURIComponent(token)}`
  return `${window.location.origin}/gyms/join?token=${encodeURIComponent(token)}`
}

export function GymInviteDialog({ gymId, open, onOpenChange }: GymInviteDialogProps): ReactElement {
  const createInvite = useCreateGymInvite()
  const [maxUses, setMaxUses] = useState('10')
  const [expiresDays, setExpiresDays] = useState('7')
  const [generated, setGenerated] = useState<GymInvitation | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = () => {
    const uses = Math.max(1, Math.min(1000, parseInt(maxUses, 10) || 10))
    const days = Math.max(1, Math.min(365, parseInt(expiresDays, 10) || 7))
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    createInvite.mutate(
      { gymId, expiresAt, maxUses: uses },
      {
        onSuccess: (invite) => setGenerated(invite as GymInvitation),
      },
    )
  }

  const handleCopy = async () => {
    if (!generated) return
    try {
      await navigator.clipboard.writeText(buildInviteUrl(generated.token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[gym-invite-dialog] clipboard write failed:', err)
    }
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      setGenerated(null)
      setCopied(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-none bg-surface-iron">
        <DialogHeader>
          <DialogTitle className="font-sans text-sm font-medium uppercase tracking-widest text-bone-white">
            GENERATE INVITE
          </DialogTitle>
          <DialogDescription className="font-sans text-sm text-warm-ash">
            Create a shareable link anyone can use to join this gym.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="invite-expires-days" className={FORGE_LABEL_CLASS}>
                Expires in (days)
              </label>
              <ForgeInput
                id="invite-expires-days"
                type="number"
                min="1"
                max="365"
                value={expiresDays}
                onChange={(e) => setExpiresDays(e.target.value)}
                data-testid="invite-expires-days"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-max-uses" className={FORGE_LABEL_CLASS}>
                Max uses
              </label>
              <ForgeInput
                id="invite-max-uses"
                type="number"
                min="1"
                max="1000"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                data-testid="invite-max-uses"
              />
            </div>
            {createInvite.isError && (
              <p className="text-xs text-warning-flare" role="alert">
                Failed to generate invite. Try again.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center bg-bone-white p-4">
              <QRCodeSVG value={buildInviteUrl(generated.token)} size={192} level="M" />
            </div>
            <p
              data-testid="invite-url"
              className="break-all bg-surface-pit/40 p-2 font-mono text-xs text-bone-white"
            >
              {buildInviteUrl(generated.token)}
            </p>
            <p className="font-sans text-[11px] text-warm-ash">
              Expires {new Date(generated.expiresAt).toLocaleString()} · {generated.maxUses} uses
            </p>
          </div>
        )}

        <DialogFooter>
          {!generated ? (
            <Button
              data-testid="generate-invite-submit"
              className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
              disabled={createInvite.isPending}
              onClick={handleGenerate}
            >
              {createInvite.isPending ? 'Generating...' : 'Generate'}
            </Button>
          ) : (
            <Button
              data-testid="copy-invite-link"
              className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
