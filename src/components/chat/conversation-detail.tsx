import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConversation, useRealtimeMessages, useToggleArchive, useUpdateLastRead } from '@/hooks/use-chat'
import { useAuth } from '@/lib/auth'
import { useBlockedUsers } from '@/hooks/use-blocked-users'
import { useUserProfile } from '@/hooks/use-user-profile'
import { ConversationHeader } from './conversation-header'
import { MessageList } from './message-list'
import { TypingIndicator } from './typing-indicator'
import { ComposeBar } from './compose-bar'
import { BlockBanner, BlockConfirmDialog } from './block-banner'
import { LeaveDialog } from './leave-dialog'
import { ParticipantSheet } from './participant-sheet'
import { Icon } from '@/components/icon'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConversationDetailProps {
  conversationId: string
}

// ---------------------------------------------------------------------------
// ConversationDetail
// ---------------------------------------------------------------------------

export function ConversationDetail({ conversationId }: ConversationDetailProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''

  // Data hooks
  const { data: conversation, isLoading, isError } = useConversation(conversationId)
  const { typingUsers } = useRealtimeMessages(conversationId)
  const updateLastRead = useUpdateLastRead()
  const toggleArchive = useToggleArchive()
  const { blockedIds, blockUser, unblockUser, isBlocked } = useBlockedUsers()

  // Dialog/sheet state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [participantSheetOpen, setParticipantSheetOpen] = useState(false)

  // For direct conversations, resolve the other user's profile
  const otherUserId = useMemo(() => {
    if (!conversation || conversation.type !== 'direct') return ''
    return conversation.participantUserIds.find((id) => id !== currentUserId) ?? ''
  }, [conversation, currentUserId])
  const { data: otherProfile } = useUserProfile(otherUserId)

  const displayName = useMemo(() => {
    if (conversation?.type === 'group') return conversation.title ?? 'Group'
    if (otherProfile?.displayName) return otherProfile.displayName
    return conversation?.title ?? 'Direct Message'
  }, [conversation, otherProfile])

  const isOtherBlocked = otherUserId ? isBlocked(otherUserId) : false
  const blockedUserIds = useMemo(() => new Set(blockedIds), [blockedIds])

  // Mark as read on mount and when new messages arrive while focused
  useEffect(() => {
    if (conversationId) {
      updateLastRead.mutate(conversationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const handleNewMessageAtBottom = useCallback(() => {
    if (document.hasFocus()) {
      updateLastRead.mutate(conversationId)
    }
  }, [conversationId, updateLastRead])

  // Navigation callbacks
  const handleBack = useCallback(() => {
    navigate({ to: '/comms' })
  }, [navigate])

  const handleBlock = useCallback(() => {
    setBlockDialogOpen(true)
  }, [])

  const handleConfirmBlock = useCallback(() => {
    if (otherUserId) {
      blockUser(otherUserId)
    }
    setBlockDialogOpen(false)
  }, [otherUserId, blockUser])

  const handleUnblock = useCallback(() => {
    if (otherUserId) {
      unblockUser(otherUserId)
    }
  }, [otherUserId, unblockUser])

  const handleArchive = useCallback(() => {
    toggleArchive.mutateAsync(conversationId).then(() => {
      navigate({ to: '/comms' })
    }).catch((err) => {
      console.error('[chat] Archive failed:', err)
    })
  }, [conversationId, navigate, toggleArchive])

  const handleLeave = useCallback(() => {
    setLeaveDialogOpen(true)
  }, [])

  const handleLeft = useCallback(() => {
    navigate({ to: '/comms' })
  }, [navigate])

  const handleViewParticipants = useCallback(() => {
    setParticipantSheetOpen(true)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
        <div className="flex items-center gap-3 border-b border-ghost-line/15 bg-surface-anvil px-4 py-3">
          <Skeleton className="h-6 w-6 bg-surface-steel" />
          <Skeleton className="h-4 w-32 bg-surface-steel" />
        </div>
        <div className="flex-1" />
      </div>
    )
  }

  // Not found / error state
  if (isError || !conversation) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil">
        <Icon name="forum" size={36} className="mb-3 text-warm-ash/30" />
        <p className="font-heading text-sm text-bone-white">Conversation not found</p>
        <button
          type="button"
          onClick={handleBack}
          className="mt-4 text-sm text-ember hover:underline"
        >
          Back to Comms
        </button>
      </div>
    )
  }

  const isGroup = conversation.type === 'group'

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {/* Header */}
      <ConversationHeader
        conversation={conversation}
        displayName={displayName}
        participantCount={isGroup ? conversation.participantUserIds.length : undefined}
        onBack={handleBack}
        onArchive={handleArchive}
        onBlock={handleBlock}
        onLeave={handleLeave}
        onViewParticipants={handleViewParticipants}
      />

      {/* Message list */}
      <MessageList
        conversationId={conversationId}
        conversationType={conversation.type}
        blockedUserIds={blockedUserIds}
        currentUserId={currentUserId}
        onNewMessageAtBottom={handleNewMessageAtBottom}
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} />}

      {/* Compose bar or block banner */}
      {conversation.type === 'direct' && isOtherBlocked ? (
        <BlockBanner onUnblock={handleUnblock} />
      ) : (
        <ComposeBar conversationId={conversationId} onSend={handleNewMessageAtBottom} />
      )}

      {/* Dialogs and sheets */}
      <BlockConfirmDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        userName={displayName}
        onConfirm={handleConfirmBlock}
      />

      <LeaveDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        conversationId={conversationId}
        onLeft={handleLeft}
      />

      {isGroup && (
        <ParticipantSheet
          open={participantSheetOpen}
          onOpenChange={setParticipantSheetOpen}
          conversationId={conversationId}
          participantUserIds={conversation.participantUserIds}
        />
      )}
    </div>
  )
}
