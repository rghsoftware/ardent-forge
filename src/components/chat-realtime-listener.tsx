import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdapter } from '@/lib/adapter'
import { useAuth } from '@/lib/auth'
import {
  initRealtimeManager,
  resetRealtimeManager,
} from '@/lib/realtime-manager'
import { toMessageFromBroadcast } from '@/lib/realtime-schemas'
import type { Message } from '@/domain/types/message'

/**
 * Invisible component that initializes the RealtimeManager singleton and
 * wires incoming message broadcasts into TanStack Query caches.
 *
 * Follows the same pattern as SyncListener: renders nothing, must be
 * mounted inside QueryClientProvider and AuthProvider.
 */
export function ChatRealtimeListener() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const currentUserId = user?.id

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    const adapter = getAdapter()
    const manager = initRealtimeManager(client, adapter)

    // Wire a message listener to update query caches.
    const removeMessageListener = manager.addMessageListener((conversationId, payload) => {
      // Append the broadcast message to the infinite messages cache.
      queryClient.setQueryData<InfiniteData<Message[], string | undefined>>(
        ['messages', conversationId],
        (old) => {
          if (!old) return old

          // Deduplicate across all pages
          if (old.pages.some((page) => page.some((m) => m.id === payload.message_id))) {
            return old
          }

          const newMessage: Message = toMessageFromBroadcast(payload)

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
    })

    return () => {
      removeMessageListener()
      resetRealtimeManager()
    }
  }, [queryClient, currentUserId])

  return null
}
