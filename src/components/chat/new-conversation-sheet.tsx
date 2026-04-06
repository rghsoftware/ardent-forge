import { useCallback, useMemo, useState } from 'react'
import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useConnections } from '@/hooks/use-connections'
import { useCreateConversation, useFindDirectConversation } from '@/hooks/use-chat'
import { useUserProfile } from '@/hooks/use-user-profile'

interface NewConversationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}

// ---------------------------------------------------------------------------
// Contact row -- resolves display name for a single connection peer
// ---------------------------------------------------------------------------

function ContactRow({
  userId,
  selected,
  onToggle,
  search,
}: {
  userId: string
  selected: boolean
  onToggle: (userId: string) => void
  search: string
}) {
  const { data: profile } = useUserProfile(userId)
  const displayName = profile?.displayName ?? 'Unknown'

  // Filter by search term -- render nothing when no match
  if (search.trim() && !displayName.toLowerCase().includes(search.trim().toLowerCase())) {
    return null
  }
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onToggle(userId)}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        selected ? 'bg-surface-steel/50' : 'hover:bg-surface-steel/20',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center text-xs font-medium',
          selected ? 'bg-ember text-surface-pit' : 'bg-surface-steel text-warm-ash',
        )}
      >
        {initials}
      </div>
      <span className="flex-1 truncate font-body text-sm text-bone-white">{displayName}</span>
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center border',
          selected
            ? 'border-ember bg-ember text-surface-pit'
            : 'border-surface-steel bg-transparent',
        )}
      >
        {selected && <Icon name="check" size={14} />}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Selected chip
// ---------------------------------------------------------------------------

function SelectedChip({
  userId,
  onRemove,
}: {
  userId: string
  onRemove: (userId: string) => void
}) {
  const { data: profile } = useUserProfile(userId)
  const displayName = profile?.displayName ?? 'Unknown'

  return (
    <span className="inline-flex items-center gap-1 bg-surface-steel px-2 py-1 text-xs text-bone-white">
      {displayName}
      <button
        type="button"
        onClick={() => onRemove(userId)}
        className="text-warm-ash/60 hover:text-warm-ash"
        aria-label={`Remove ${displayName}`}
      >
        <Icon name="close" size={14} />
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main sheet
// ---------------------------------------------------------------------------

export function NewConversationSheet({ open, onOpenChange, onCreated }: NewConversationSheetProps) {
  const { user } = useAuth()
  const { data: connections, isLoading: connectionsLoading } = useConnections()
  const createConversation = useCreateConversation()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [groupTitle, setGroupTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Derive the "other user" id from each active connection
  const activeContacts = useMemo(() => {
    if (!connections || !user) return []
    return connections
      .filter((c) => c.status === 'ACTIVE')
      .map((c) => (c.requesterId === user.id ? c.recipientId : c.requesterId))
  }, [connections, user])

  // For single-selection direct conversation lookup
  const singleSelectedId = selectedIds.length === 1 ? selectedIds[0] : ''
  const { data: existingDirect } = useFindDirectConversation(singleSelectedId)

  // 2+ selected = group mode (current user added server-side, so 2 selected = 3 total participants)
  const isGroupMode = selectedIds.length >= 2

  const toggleContact = useCallback((userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }, [])

  const removeSelected = useCallback((userId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== userId))
  }, [])

  const handleStart = useCallback(async () => {
    if (selectedIds.length === 0) return
    setIsCreating(true)
    setError(null)

    try {
      if (selectedIds.length === 1) {
        // Direct message
        if (existingDirect) {
          onCreated(existingDirect.id)
        } else {
          const conversation = await createConversation.mutateAsync({
            type: 'direct',
            participantIds: [selectedIds[0]],
          })
          onCreated(conversation.id)
        }
      } else {
        // Group conversation
        const conversation = await createConversation.mutateAsync({
          type: 'group',
          participantIds: selectedIds,
          title: groupTitle.trim() || undefined,
        })
        onCreated(conversation.id)
      }

      // Reset state
      setSelectedIds([])
      setSearch('')
      setGroupTitle('')
      onOpenChange(false)
    } catch {
      setError('Failed to create conversation. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }, [selectedIds, existingDirect, createConversation, groupTitle, onCreated, onOpenChange])

  // Reset state when sheet closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setSelectedIds([])
        setSearch('')
        setGroupTitle('')
        setError(null)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[80vh] flex-col bg-surface-charcoal">
        <SheetHeader>
          <SheetTitle className="text-bone-white">New Conversation</SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 border-b border-surface-steel bg-transparent px-1 py-2">
            <Icon name="search" size={18} className="text-warm-ash/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 bg-transparent font-body text-sm text-bone-white placeholder:text-warm-ash/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {selectedIds.map((id) => (
              <SelectedChip key={id} userId={id} onRemove={removeSelected} />
            ))}
          </div>
        )}

        {/* Group title input (when 2+ selected) */}
        {isGroupMode && (
          <div className="px-4 pb-2">
            <input
              type="text"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder="Group name (optional)"
              className="w-full border-b border-surface-steel bg-transparent py-1 font-body text-sm text-bone-white placeholder:text-warm-ash/50 focus:border-ember focus:outline-none"
            />
          </div>
        )}

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {connectionsLoading && (
            <div className="flex items-center justify-center py-12 text-sm text-warm-ash/50">
              Loading contacts...
            </div>
          )}

          {!connectionsLoading && activeContacts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Icon name="person_off" size={48} className="text-warm-ash/30" />
              <p className="text-sm font-heading text-warm-ash">No connections yet</p>
              <p className="text-xs text-warm-ash/50">
                Add connections from the Connections page to start a conversation.
              </p>
            </div>
          )}

          {!connectionsLoading &&
            activeContacts.length > 0 &&
            activeContacts.map((userId) => (
              <ContactRow
                key={userId}
                userId={userId}
                selected={selectedIds.includes(userId)}
                onToggle={toggleContact}
                search={search}
              />
            ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-ghost-line/15 p-4">
          <Button
            className="w-full"
            disabled={selectedIds.length === 0 || isCreating}
            onClick={() => void handleStart()}
          >
            {isCreating ? 'Starting...' : 'START'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
