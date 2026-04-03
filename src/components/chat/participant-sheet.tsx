import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Icon } from '@/components/icon'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useConnections } from '@/hooks/use-connections'
import { useAuth } from '@/lib/auth'
import { getAdapter } from '@/lib/adapter'

// ---------------------------------------------------------------------------
// ParticipantAvatar -- 40px circle with initials
// ---------------------------------------------------------------------------

function getInitials(name: string | undefined): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function ParticipantRow({ userId }: { userId: string }) {
  const { data: profile } = useUserProfile(userId)
  const displayName = profile?.displayName ?? 'Unknown'

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-surface-steel">
        <span className="text-sm font-medium text-ember">{getInitials(displayName)}</span>
      </div>
      <span className="text-sm text-bone-white">{displayName}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ContactPicker -- inline picker for adding a new participant
// ---------------------------------------------------------------------------

function ContactPicker({
  conversationId,
  participantUserIds,
  onAdded,
}: {
  conversationId: string
  participantUserIds: string[]
  onAdded: () => void
}) {
  const { user } = useAuth()
  const { data: connections } = useConnections()
  const [adding, setAdding] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const participantSet = new Set(participantUserIds)

  // Filter to ACTIVE connections whose "other" user is not already a participant
  const available = (connections ?? []).filter((c) => {
    if (c.status !== 'ACTIVE') return false
    const otherId = c.requesterId === user?.id ? c.recipientId : c.requesterId
    return !participantSet.has(otherId)
  })

  const handleAdd = async (userId: string) => {
    setAdding(userId)
    setAddError(null)
    try {
      await getAdapter().addParticipant(conversationId, userId)
      onAdded()
    } catch (err) {
      console.error('[chat] Failed to add participant:', err)
      const message = err instanceof Error ? err.message : 'Failed to add participant'
      setAddError(message)
    } finally {
      setAdding(null)
    }
  }

  if (available.length === 0) {
    return <div className="px-4 py-3 text-sm text-warm-ash">No available connections to add.</div>
  }

  return (
    <div className="flex flex-col">
      {addError && (
        <div className="px-4 py-2">
          <p className="text-xs text-red-400">{addError}</p>
        </div>
      )}
      {available.map((conn) => {
        const otherId = conn.requesterId === user?.id ? conn.recipientId : conn.requesterId
        return (
          <ContactPickerRow
            key={conn.id}
            userId={otherId}
            disabled={adding !== null}
            loading={adding === otherId}
            onSelect={() => handleAdd(otherId)}
          />
        )
      })}
    </div>
  )
}

function ContactPickerRow({
  userId,
  disabled,
  loading,
  onSelect,
}: {
  userId: string
  disabled: boolean
  loading: boolean
  onSelect: () => void
}) {
  const { data: profile } = useUserProfile(userId)
  const displayName = profile?.displayName ?? 'Unknown'

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-steel/20 disabled:opacity-50"
      disabled={disabled}
      onClick={onSelect}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-surface-steel">
        <span className="text-sm font-medium text-ember">{getInitials(displayName)}</span>
      </div>
      <span className="text-sm text-bone-white">{loading ? 'Adding...' : displayName}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ParticipantSheet -- bottom sheet listing participants + add member
// ---------------------------------------------------------------------------

interface ParticipantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  participantUserIds: string[]
}

export function ParticipantSheet({
  open,
  onOpenChange,
  conversationId,
  participantUserIds,
}: ParticipantSheetProps) {
  const queryClient = useQueryClient()
  const [showPicker, setShowPicker] = useState(false)

  const handleAdded = () => {
    setShowPicker(false)
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  // Reset picker state when sheet closes
  const handleOpenChange = (next: boolean) => {
    if (!next) setShowPicker(false)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="bg-surface-charcoal">
        <SheetHeader>
          <SheetTitle className="text-bone-white">Participants</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col">
          {participantUserIds.map((uid) => (
            <ParticipantRow key={uid} userId={uid} />
          ))}
        </div>

        {showPicker ? (
          <div className="border-t border-ghost-line pt-2">
            <p className="px-4 pb-2 text-xs font-medium uppercase tracking-wider text-warm-ash">
              Select a connection
            </p>
            <ContactPicker
              conversationId={conversationId}
              participantUserIds={participantUserIds}
              onAdded={handleAdded}
            />
          </div>
        ) : (
          <div className="px-4 pb-2 pt-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-ember"
              onClick={() => setShowPicker(true)}
            >
              <Icon name="person_add" size={20} />
              ADD MEMBER
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
