import { useState } from 'react'
import { useRevokeInvite } from '@/hooks/use-groups'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import type { GroupInvite } from '@/domain/types'

interface InviteCodeDisplayProps {
  invite: GroupInvite
  groupId: string
}

function getExpiryText(expiresAt: string): string {
  const now = Date.now()
  const expiry = new Date(expiresAt).getTime()
  const diffMs = expiry - now

  if (diffMs <= 0) return 'Expired'

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return 'Expires in 1 day'
  return `Expires in ${diffDays} days`
}

export function InviteCodeDisplay({ invite, groupId }: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false)
  const revokeInvite = useRevokeInvite()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may not be available in all contexts
    }
  }

  const handleRevoke = () => {
    revokeInvite.mutate({ inviteId: invite.id, groupId })
  }

  if (!invite.isActive) return null

  return (
    <div className="flex items-center justify-between gap-3 bg-surface-charcoal px-4 py-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-mono text-lg tracking-wider text-ember">{invite.code}</span>
        <span className="text-xs text-warm-ash/50">{getExpiryText(invite.expiresAt)}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy invite code'}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleRevoke}
          disabled={revokeInvite.isPending}
          aria-label="Revoke invite"
        >
          <Icon name="close" size={16} className="text-warning-flare" />
        </Button>
      </div>
    </div>
  )
}
