import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConversations, useUnreadCounts } from '@/hooks/use-chat'
import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NewConversationSheet } from '@/components/chat/new-conversation-sheet'
import type { Conversation } from '@/domain/types'
import { getInitials, relativeTime } from './chat-utils'

// ---------------------------------------------------------------------------
// ConversationListSkeleton
// ---------------------------------------------------------------------------

export function ConversationListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-3 px-4 min-h-[60px] py-3',
            i % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal',
          )}
        >
          {/* Avatar skeleton */}
          <Skeleton className="h-10 w-10 shrink-0 bg-surface-steel" />
          {/* Text skeleton */}
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-4 w-32 rounded-none bg-surface-steel" />
            <Skeleton className="h-3 w-48 rounded-none bg-surface-steel" />
          </div>
          {/* Timestamp skeleton */}
          <Skeleton className="h-3 w-8 rounded-none bg-surface-steel shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationEmptyState
// ---------------------------------------------------------------------------

interface ConversationEmptyStateProps {
  onStartConversation: () => void
}

export function ConversationEmptyState({ onStartConversation }: ConversationEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <Icon name="chat" size={48} className="text-warm-ash/30" />
      <p className="font-heading text-sm text-warm-ash uppercase tracking-wider">
        No active channels
      </p>
      <p className="text-xs text-warm-ash/50 leading-relaxed">
        Start a conversation with a connection or group member.
      </p>
      <Button variant="default" size="sm" onClick={onStartConversation} className="mt-2">
        Start conversation
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationRow
// ---------------------------------------------------------------------------

interface ConversationRowProps {
  conversation: Conversation
  index: number
  unreadCount: number
  onClick: () => void
}

function ConversationRow({ conversation, index, unreadCount, onClick }: ConversationRowProps) {
  const hasUnread = unreadCount > 0

  // Resolve display name: group convos use title, direct convos use title or fallback
  const displayName =
    conversation.type === 'group'
      ? (conversation.title ?? 'Group')
      : (conversation.title ?? 'Direct Message')

  const initials = getInitials(displayName)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 min-h-[60px] py-3 text-left transition-colors hover:bg-surface-gunmetal',
        index % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal',
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-surface-steel">
        <span className="font-heading text-sm text-ember">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className={cn('font-heading text-sm text-bone-white truncate', hasUnread && 'font-bold')}
        >
          {displayName}
        </span>
        <span className="text-xs text-warm-ash/60 truncate">
          {conversation.type === 'group' ? 'Group conversation' : 'Tap to open'}
        </span>
      </div>

      {/* Right side: timestamp + unread dot */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-xs text-warm-ash/60">{relativeTime(conversation.updatedAt)}</span>
        {hasUnread && <span className="block h-2 w-2 bg-ember" />}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// ConversationList
// ---------------------------------------------------------------------------

export function ConversationList() {
  const navigate = useNavigate()
  const { data: conversations, isLoading, isError } = useConversations()
  const { data: unreadCounts } = useUnreadCounts()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleNewConversation = () => setSheetOpen(true)

  const handleCreated = (conversationId: string) => {
    setSheetOpen(false)
    navigate({ to: '/comms/$conversationId', params: { conversationId } })
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-6 pb-4 md:px-6 lg:px-8">
          <h1 className="font-heading text-sm uppercase tracking-wider text-bone-white">Comms</h1>
          <Button variant="default" size="sm" onClick={handleNewConversation}>
            New
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <ConversationListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <Icon name="cloud_off" size={36} className="mb-3 text-warm-ash/60" />
            <p className="font-heading text-sm text-bone-white">Failed to load conversations</p>
            <p className="mt-2 text-xs text-warm-ash/50">Check your connection and try again.</p>
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <ConversationEmptyState onStartConversation={handleNewConversation} />
        ) : (
          <div className="flex-1">
            {conversations.map((conversation, i) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                index={i}
                unreadCount={unreadCounts?.get(conversation.id) ?? 0}
                onClick={() =>
                  navigate({
                    to: '/comms/$conversationId',
                    params: { conversationId: conversation.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* NewConversationSheet */}
      <NewConversationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}
