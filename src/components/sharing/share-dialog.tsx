import { useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import {
  useShareLinksForEntity,
  useCreateShareLink,
  useRevokeShareLink,
} from '@/hooks/use-share-links'
import { generateShareToken } from '@/lib/share-utils'
import type { ShareableEntityType } from '@/domain/types'

interface ShareDialogProps {
  entityType: ShareableEntityType
  entityId: string
  trigger: ReactNode
}

const ENTITY_LABELS: Record<ShareableEntityType, string> = {
  PROGRAM: 'PROGRAM',
  WORKOUT_LOG: 'WORKOUT',
}

export function ShareDialog({ entityType, entityId, trigger }: ShareDialogProps) {
  const { user, isGuest } = useAuth()
  const userId = user?.id

  const { data: links = [], isLoading } = useShareLinksForEntity(entityType, entityId)
  const createMutation = useCreateShareLink()
  const revokeMutation = useRevokeShareLink()

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const activeLinks = links.filter((link) => link.isActive)

  const handleGenerate = async () => {
    if (!userId) return
    await createMutation.mutateAsync({
      token: generateShareToken(),
      entityType,
      entityId,
      createdBy: userId,
      isActive: true,
    })
  }

  const handleRevoke = async (id: string) => {
    await revokeMutation.mutateAsync(id)
  }

  const handleCopy = async (token: string, linkId: string) => {
    const url = `https://ardentforge.app/s/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(linkId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Fallback: select the input so the user can Ctrl+C
      const input = document.querySelector<HTMLInputElement>(`[data-link-id="${linkId}"]`)
      input?.select()
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent
        className="bg-surface-iron rounded-none p-0 gap-0 max-w-md border-0 ring-0"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <Icon name="link" size={16} className="text-ember" />
            <DialogTitle className="text-xs uppercase tracking-wider text-ember font-heading">
              Share access
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-warm-ash/60 mt-1">
            Generate read-only links to share this {ENTITY_LABELS[entityType].toLowerCase()} with
            anyone.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Guest mode: cannot share */}
          {isGuest ? (
            <div className="flex flex-col items-center gap-3 py-4 bg-surface-charcoal px-4">
              <Icon name="cloud_off" size={24} className="text-warm-ash/40" />
              <p className="text-xs uppercase tracking-wider text-warm-ash/60 text-center">
                Sign in to share
              </p>
              <p className="text-xs text-warm-ash/40 text-center">
                Sharing requires an account to generate secure links.
              </p>
            </div>
          ) : (
            <>
              {/* Generate button */}
              <Button
                variant="default"
                onClick={handleGenerate}
                disabled={createMutation.isPending}
                className="min-h-12 w-full bg-forge text-on-forge text-xs uppercase tracking-wider hover:brightness-110"
              >
                {createMutation.isPending ? (
                  <>
                    <Icon name="progress_activity" size={16} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Icon name="add_link" size={16} />
                    Generate access link
                  </>
                )}
              </Button>

              {/* Error state */}
              {createMutation.isError && (
                <p className="text-xs text-warning-flare text-center">
                  Failed to generate link. Try again.
                </p>
              )}

              {/* Active links */}
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-surface-charcoal animate-pulse" />
                  ))}
                </div>
              ) : activeLinks.length > 0 ? (
                <div className="flex flex-col gap-0">
                  <span className="text-[11px] uppercase tracking-widest text-warm-ash/60 mb-2">
                    Active links
                  </span>
                  {activeLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex flex-col gap-2 bg-surface-charcoal px-3 py-3 mb-1"
                    >
                      {/* Status badge */}
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-ember">
                          <Icon name="check_circle" size={12} fill className="text-ember" />
                          Link active
                        </span>
                        <span className="text-[11px] text-warm-ash/40">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* URL + copy */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`https://ardentforge.app/s/${link.token}`}
                          data-link-id={link.id}
                          className="flex-1 bg-surface-gunmetal text-bone-white text-xs px-3 py-2 rounded-none border-0 outline-none select-all truncate"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy(link.token, link.id)}
                          className="shrink-0 text-ember"
                          aria-label="Copy link"
                        >
                          <Icon name={copiedId === link.id ? 'check' : 'content_copy'} size={16} />
                        </Button>
                      </div>

                      {/* Revoke */}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevoke(link.id)}
                        disabled={revokeMutation.isPending}
                        className="min-h-10 w-full text-xs uppercase tracking-wider"
                      >
                        {revokeMutation.isPending ? (
                          <>
                            <Icon name="progress_activity" size={14} className="animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          <>
                            <Icon name="link_off" size={14} />
                            Revoke access
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3">
                  <p className="text-xs text-warm-ash/40 text-center">
                    No active links. Generate one to share this{' '}
                    {ENTITY_LABELS[entityType].toLowerCase()}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer close */}
        <div className="px-5 pb-5">
          <DialogTrigger asChild>
            <Button variant="ghost" className="min-h-10 w-full text-xs text-warm-ash/60">
              Close
            </Button>
          </DialogTrigger>
        </div>
      </DialogContent>
    </Dialog>
  )
}
