import { useState, useEffect, useCallback } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { getRealtimeManager } from '@/lib/realtime-manager'
import type { Message, MessageType, ConversationType } from '@/domain/types'

const MESSAGE_PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => getAdapter().getConversations(),
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: () => getAdapter().getConversation(id),
    enabled: !!id,
  })
}

export function useFindDirectConversation(otherUserId: string) {
  return useQuery({
    queryKey: ['conversations', 'direct', otherUserId],
    queryFn: () => getAdapter().findDirectConversation(otherUserId),
    enabled: !!otherUserId,
  })
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      getAdapter().getMessages(conversationId, {
        before: pageParam,
        limit: MESSAGE_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getPreviousPageParam: (firstPage) => {
      if (firstPage.length < MESSAGE_PAGE_SIZE) return undefined
      return firstPage[0]?.createdAt
    },
    getNextPageParam: () => undefined,
    enabled: !!conversationId,
    select: (data) => ({ ...data, allMessages: data.pages.flat() }),
  })
}

export function useUnreadCounts() {
  return useQuery({
    queryKey: ['unread-counts'],
    queryFn: () => getAdapter().getUnreadCounts(),
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vars: {
      conversationId: string
      messageType: MessageType
      content?: string
    }) => {
      const message = await getAdapter().sendMessage(
        vars.conversationId,
        vars.messageType,
        vars.content,
      )

      const manager = getRealtimeManager()
      if (manager) {
        await manager.broadcastMessage(vars.conversationId, {
          message_id: message.id,
          conversation_id: vars.conversationId,
          sender_id: message.senderId ?? '',
          message_type: message.messageType,
          preview: (vars.content ?? '').slice(0, 100),
          created_at: message.createdAt,
        })
      }

      return message
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['messages', vars.conversationId] })

      const previous = queryClient.getQueryData<InfiniteData<Message[], string | undefined>>([
        'messages',
        vars.conversationId,
      ])

      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', vars.conversationId],
        (old) => {
          if (!old) return old

          const optimisticMessage: Message = {
            id: 'optimistic-' + crypto.randomUUID(),
            conversationId: vars.conversationId,
            senderId: undefined,
            messageType: vars.messageType,
            content: vars.content,
            syncStatus: 'pending',
            createdAt: new Date().toISOString(),
          }

          const pages = [...old.pages]
          const lastPageIndex = pages.length - 1
          pages[lastPageIndex] = [...(pages[lastPageIndex] ?? []), optimisticMessage]

          return { ...old, pages }
        },
      )

      return { previous }
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages', vars.conversationId], context.previous)
      }
      console.error('[chat] Failed to send message, rolling back:', _err)
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['messages', vars.conversationId] })
    },
  })
}

export function useUpdateLastRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => getAdapter().updateLastRead(conversationId),
    onError: (err) => {
      console.error('[chat] Failed to update last read:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] })
    },
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (vars: {
      type: ConversationType
      participantIds: string[]
      title?: string
      groupId?: string
    }) => getAdapter().createConversation(vars.type, vars.participantIds, vars.title, vars.groupId),
    onSuccess: (newConversation) => {
      getRealtimeManager()?.subscribe(newConversation.id)
    },
    onError: (err) => {
      console.error('[chat] Failed to create conversation:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useLeaveConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => getAdapter().leaveConversation(conversationId),
    onMutate: (conversationId) => {
      getRealtimeManager()?.unsubscribe(conversationId)
    },
    onError: (err) => {
      console.error('[chat] Failed to leave conversation:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] })
    },
  })
}

export function useToggleArchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conversationId: string) => getAdapter().toggleArchive(conversationId),
    onError: (err) => {
      console.error('[chat] Failed to toggle archive:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Realtime integration hook
// ---------------------------------------------------------------------------

export function useRealtimeMessages(conversationId: string) {
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([])

  const refreshTyping = useCallback(() => {
    const manager = getRealtimeManager()
    if (!manager) return
    setTypingUsers(manager.getTypingUsers(conversationId))
  }, [conversationId])

  useEffect(() => {
    const manager = getRealtimeManager()
    if (!manager || !conversationId) return

    manager.subscribe(conversationId)

    // Capture the previous onTyping callback so we can restore it on cleanup
    const previousOnTyping = manager.onTyping

    manager.onTyping = (typingConversationId, _userId, _userName) => {
      if (typingConversationId === conversationId) {
        refreshTyping()
      }
      // Forward to previous handler if present
      previousOnTyping?.(typingConversationId, _userId, _userName)
    }

    return () => {
      manager.unsubscribe(conversationId)
      // Restore previous handler
      manager.onTyping = previousOnTyping
    }
  }, [conversationId, refreshTyping])

  return { typingUsers }
}
