import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdapter } from '@/lib/adapter'
import {
  initRealtimeManager,
  getRealtimeManager,
  resetRealtimeManager,
} from '@/lib/realtime-manager'
import type { Message } from '@/domain/types/message'

/**
 * Invisible component that initializes the RealtimeManager singleton and
 * wires incoming message broadcasts into TanStack Query caches.
 *
 * Follows the same pattern as SyncListener: renders nothing, must be
 * mounted inside QueryClientProvider.
 */
export function ChatRealtimeListener() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    const adapter = getAdapter()
    initRealtimeManager(client, adapter)

    const manager = getRealtimeManager()
    if (!manager) return

    // Resolve the current user ID from the cached session so the onMessage
    // callback can skip unread-count increments for the user's own messages.
    // getSession() reads from the in-memory auth store (no network call).
    let currentUserId: string | undefined

    client.auth
      .getSession()
      .then(({ data }) => {
        currentUserId = data?.session?.user?.id
      })
      .catch(() => {
        // Non-critical -- worst case we increment unread for own messages
      })

    // Keep the user ID in sync when auth state changes (sign-in, token refresh).
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id
    })

    // Wire the global onMessage callback to update query caches.
    manager.onMessage = (conversationId, payload) => {
      // Append the broadcast message to the infinite messages cache.
      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old

          // Deduplicate across all pages
          if (old.pages.some((page) => page.some((m) => m.id === payload.message_id))) {
            return old
          }

          const newMessage: Message = {
            id: payload.message_id,
            conversationId: payload.conversation_id,
            senderId: payload.sender_id,
            messageType: payload.message_type,
            content: payload.preview,
            createdAt: payload.created_at,
          }

          const lastPage = old.pages[old.pages.length - 1]
          return {
            ...old,
            pages: [...old.pages.slice(0, -1), [...(lastPage ?? []), newMessage]],
          }
        },
      )

      // Increment unread count unless the sender is the current user.
      if (currentUserId && payload.sender_id === currentUserId) return

      queryClient.setQueryData<Map<string, number>>(['unread-counts'], (old) => {
        if (!old) return old
        const updated = new Map(old)
        updated.set(conversationId, (updated.get(conversationId) ?? 0) + 1)
        return updated
      })
    }

    return () => {
      subscription.unsubscribe()
      resetRealtimeManager()
    }
  }, [queryClient])

  return null
}
