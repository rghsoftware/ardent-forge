import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import type { DataAdapter } from './data-adapter'
import type { MessageBroadcastPayload } from './realtime-schemas'
import { messageBroadcastPayloadSchema } from './realtime-schemas'
import { createForegroundDetector, type ForegroundDetector } from './foreground-detector'

// ---------------------------------------------------------------------------
// RealtimeManager -- core interface for Supabase Realtime Broadcast channels
// ---------------------------------------------------------------------------

export interface RealtimeManager {
  /** Subscribe to broadcast events on a conversation channel. No-op if already subscribed. */
  subscribe(conversationId: string): void
  /** Unsubscribe from a single conversation channel and clean up typing state. */
  unsubscribe(conversationId: string): void
  /** Tear down all active channel subscriptions. */
  unsubscribeAll(): void

  /** Send a message broadcast on the conversation channel. */
  broadcastMessage(conversationId: string, payload: MessageBroadcastPayload): Promise<void>
  /** Send a typing indicator (debounced to max 1 per 2 seconds per conversation). */
  broadcastTyping(conversationId: string, userId: string, userName: string): void

  /** Callback fired when a validated message broadcast arrives. */
  onMessage: ((conversationId: string, payload: MessageBroadcastPayload) => void) | null
  /** Callback fired when a typing indicator arrives. */
  onTyping: ((conversationId: string, userId: string, userName: string) => void) | null

  /** Returns the list of users currently typing in a conversation. */
  getTypingUsers(conversationId: string): Array<{ userId: string; userName: string }>

  /** Re-fetch missed messages and re-subscribe after returning to foreground. */
  handleForeground(): Promise<void>
  /** Snapshot timestamps and tear down channels when backgrounded. */
  handleBackground(): void

  /** Stop the foreground detector and remove all channels. */
  destroy(): void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRealtimeManager(
  client: SupabaseClient,
  adapter: DataAdapter,
): RealtimeManager {
  // -- Internal state (closure-scoped) -------------------------------------

  /** Active channel subscriptions keyed by conversationId. */
  const channels = new Map<string, RealtimeChannel>()

  /** Typing indicators: conversationId -> userId -> { userName, timeout }. */
  const typingState = new Map<
    string,
    Map<string, { userName: string; timeout: ReturnType<typeof setTimeout> }>
  >()

  /** Debounce tracking: conversationId -> last timestamp we sent a typing event. */
  const lastTypingSent = new Map<string, number>()

  /** Most recent `created_at` per conversation, used for catch-up on foreground. */
  const lastKnownTimestamps = new Map<string, string>()

  // -- Helpers --------------------------------------------------------------

  function clearTypingForConversation(conversationId: string): void {
    const users = typingState.get(conversationId)
    if (users) {
      for (const entry of users.values()) {
        clearTimeout(entry.timeout)
      }
      typingState.delete(conversationId)
    }
  }

  function clearAllTyping(): void {
    for (const conversationId of typingState.keys()) {
      clearTypingForConversation(conversationId)
    }
  }

  // -- The manager object ---------------------------------------------------

  const manager: RealtimeManager = {
    onMessage: null,
    onTyping: null,

    // -- Channel lifecycle --------------------------------------------------

    subscribe(conversationId: string): void {
      if (channels.has(conversationId)) return

      const channel = client.channel(`chat:${conversationId}`, {
        config: { broadcast: { ack: false, self: false } },
      })

      // Listen for message broadcasts
      channel.on('broadcast', { event: 'message' }, (incoming) => {
        const result = messageBroadcastPayloadSchema.safeParse(incoming.payload)
        if (!result.success) {
          console.warn(
            `[realtime-manager] Invalid message broadcast on chat:${conversationId}`,
            result.error.issues,
          )
          return
        }

        const payload = result.data

        // Track the most recent timestamp for catch-up on foreground
        const existing = lastKnownTimestamps.get(conversationId)
        if (!existing || payload.created_at > existing) {
          lastKnownTimestamps.set(conversationId, payload.created_at)
        }

        manager.onMessage?.(conversationId, payload)
      })

      // Listen for typing broadcasts
      channel.on('broadcast', { event: 'typing' }, (incoming) => {
        const userId = incoming.payload?.user_id as string | undefined
        const userName = incoming.payload?.user_name as string | undefined

        if (!userId || !userName) return

        // Update typing state with a 3-second expiry
        let users = typingState.get(conversationId)
        if (!users) {
          users = new Map()
          typingState.set(conversationId, users)
        }

        // Clear any existing timeout for this user
        const existing = users.get(userId)
        if (existing) {
          clearTimeout(existing.timeout)
        }

        const timeout = setTimeout(() => {
          const current = typingState.get(conversationId)
          current?.delete(userId)
          if (current?.size === 0) {
            typingState.delete(conversationId)
          }
        }, 3_000)

        users.set(userId, { userName, timeout })

        manager.onTyping?.(conversationId, userId, userName)
      })

      // Subscribe to the channel
      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Subscription successful -- nothing else to do
        } else if (err) {
          console.warn(
            `[realtime-manager] Channel chat:${conversationId} status: ${status}`,
            err,
          )
        }
      })

      channels.set(conversationId, channel)
    },

    unsubscribe(conversationId: string): void {
      const channel = channels.get(conversationId)
      if (!channel) return

      client.removeChannel(channel)
      channels.delete(conversationId)
      clearTypingForConversation(conversationId)
    },

    unsubscribeAll(): void {
      client.removeAllChannels()
      channels.clear()
      clearAllTyping()
      lastTypingSent.clear()
    },

    // -- Broadcasting -------------------------------------------------------

    async broadcastMessage(
      conversationId: string,
      payload: MessageBroadcastPayload,
    ): Promise<void> {
      const channel = channels.get(conversationId)
      if (!channel) {
        console.warn(
          `[realtime-manager] Cannot broadcast message: not subscribed to chat:${conversationId}`,
        )
        return
      }

      await channel.send({ type: 'broadcast', event: 'message', payload })
    },

    broadcastTyping(conversationId: string, userId: string, userName: string): void {
      const now = Date.now()
      const last = lastTypingSent.get(conversationId) ?? 0
      if (now - last < 2_000) return

      const channel = channels.get(conversationId)
      if (!channel) return

      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: userId, user_name: userName },
      })

      lastTypingSent.set(conversationId, now)
    },

    // -- Typing state -------------------------------------------------------

    getTypingUsers(conversationId: string): Array<{ userId: string; userName: string }> {
      const users = typingState.get(conversationId)
      if (!users) return []

      return Array.from(users.entries()).map(([userId, { userName }]) => ({
        userId,
        userName,
      }))
    },

    // -- Foreground / Background lifecycle ----------------------------------

    async handleForeground(): Promise<void> {
      // Collect conversation IDs before re-subscribing (they may have been
      // cleared during background teardown, so we snapshot the keys first).
      const conversationIds = [...lastKnownTimestamps.keys()]

      // Catch up on missed messages for each tracked conversation
      for (const conversationId of conversationIds) {
        const since = lastKnownTimestamps.get(conversationId)
        if (!since) continue

        try {
          const messages = await adapter.getMessagesSince(conversationId, since)
          for (const msg of messages) {
            const payload: MessageBroadcastPayload = {
              message_id: msg.id,
              conversation_id: msg.conversationId,
              sender_id: msg.senderId ?? '',
              message_type: msg.messageType,
              preview: (msg.content ?? '').slice(0, 100),
              created_at: msg.createdAt,
            }

            // Update last-known timestamp
            const existing = lastKnownTimestamps.get(conversationId)
            if (!existing || payload.created_at > existing) {
              lastKnownTimestamps.set(conversationId, payload.created_at)
            }

            manager.onMessage?.(conversationId, payload)
          }
        } catch (err) {
          console.warn(
            `[realtime-manager] Failed to fetch catch-up messages for ${conversationId}`,
            err,
          )
        }
      }

      // Re-subscribe to all channels (they were torn down on background)
      for (const conversationId of conversationIds) {
        manager.subscribe(conversationId)
      }
    },

    handleBackground(): void {
      // Ensure every subscribed conversation has an entry in
      // lastKnownTimestamps so handleForeground re-subscribes to it.
      // Conversations that already have a timestamp are left as-is;
      // those without one get an empty string marker so they are
      // re-subscribed without a catch-up query.
      for (const conversationId of channels.keys()) {
        if (!lastKnownTimestamps.has(conversationId)) {
          lastKnownTimestamps.set(conversationId, '')
        }
      }

      manager.unsubscribeAll()
    },

    // -- Cleanup ------------------------------------------------------------

    destroy(): void {
      foregroundDetector.stop()
      manager.unsubscribeAll()
      lastKnownTimestamps.clear()
    },
  }

  // -- Foreground detector wiring -------------------------------------------

  const foregroundDetector: ForegroundDetector = createForegroundDetector(
    () => {
      manager.handleForeground()
    },
    () => {
      manager.handleBackground()
    },
  )

  foregroundDetector.start()

  return manager
}

// ---------------------------------------------------------------------------
// Singleton access pattern (matches adapter.ts style)
// ---------------------------------------------------------------------------

let _manager: RealtimeManager | null = null

/** Returns the current RealtimeManager instance, or null if not initialized. */
export function getRealtimeManager(): RealtimeManager | null {
  return _manager
}

/** Creates (or replaces) the singleton RealtimeManager. */
export function initRealtimeManager(
  client: SupabaseClient,
  adapter: DataAdapter,
): RealtimeManager {
  if (_manager) _manager.destroy()
  _manager = createRealtimeManager(client, adapter)
  return _manager
}

/** Destroys and clears the singleton RealtimeManager. */
export function resetRealtimeManager(): void {
  _manager?.destroy()
  _manager = null
}
