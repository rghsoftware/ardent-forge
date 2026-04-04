import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import { displaySnapshotSchema, type DisplaySnapshot } from '@/domain/types/display-snapshot'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisplayEventHandlers {
  onSnapshot: (snapshot: DisplaySnapshot) => void
  onSessionEnded: (payload: { user_id: string }) => void
  onFocus: (payload: { user_id: string }) => void
  onUnfocus: () => void
  onStatusChange: (status: 'connected' | 'reconnecting' | 'disconnected') => void
}

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null
let _status: 'connected' | 'reconnecting' | 'disconnected' = 'disconnected'

// ---------------------------------------------------------------------------
// Inline schemas for lightweight payload validation
// ---------------------------------------------------------------------------

const userIdPayloadSchema = z.object({ user_id: z.string() })

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store the Supabase client reference for later channel creation.
 * Does NOT create the channel yet -- that happens in subscribeToDisplay.
 */
export function initDisplaySubscriber(client: SupabaseClient): void {
  _client = client
}

/**
 * Create the broadcast channel, register listeners for each event type,
 * and subscribe. Validates all incoming payloads with Zod before dispatching.
 */
export function subscribeToDisplay(handlers: DisplayEventHandlers): void {
  if (!_client) {
    console.warn('[display-subscriber] Cannot subscribe: client not initialized')
    return
  }

  // Tear down any existing channel before creating a new one
  if (_channel) {
    _client.removeChannel(_channel)
    _channel = null
  }

  _channel = _client.channel('display', {
    config: { broadcast: { ack: false, self: false } },
  })

  _channel
    .on('broadcast', { event: 'workout_snapshot' }, ({ payload }) => {
      const result = displaySnapshotSchema.safeParse(payload)
      if (result.success) {
        handlers.onSnapshot(result.data)
      } else {
        console.warn(
          '[display-subscriber] Invalid workout_snapshot payload, dropping',
          result.error,
        )
      }
    })
    .on('broadcast', { event: 'session_ended' }, ({ payload }) => {
      const result = userIdPayloadSchema.safeParse(payload)
      if (result.success) {
        handlers.onSessionEnded(result.data)
      } else {
        console.warn('[display-subscriber] Invalid session_ended payload, dropping', result.error)
      }
    })
    .on('broadcast', { event: 'focus' }, ({ payload }) => {
      const result = userIdPayloadSchema.safeParse(payload)
      if (result.success) {
        handlers.onFocus(result.data)
      } else {
        console.warn('[display-subscriber] Invalid focus payload, dropping', result.error)
      }
    })
    .on('broadcast', { event: 'unfocus' }, () => {
      handlers.onUnfocus()
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        _status = 'connected'
        handlers.onStatusChange('connected')
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.warn(`[display-subscriber] Channel terminal status: ${status}`, err)
        _status = 'reconnecting'
        handlers.onStatusChange('reconnecting')
        // Clear the dead channel so a future subscribeToDisplay call recreates it
        _channel = null
      }
    })
}

/**
 * Send a display_hello broadcast to signal presence on the channel.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishHello(): void {
  if (!_channel) return

  _channel
    .send({ type: 'broadcast', event: 'display_hello', payload: {} })
    .catch((err: unknown) => {
      console.error('[display-subscriber] Failed to send display_hello', err)
    })
}

/**
 * Return the current subscriber connection status.
 */
export function getSubscriberStatus(): 'connected' | 'reconnecting' | 'disconnected' {
  return _status
}

/**
 * Tear down the broadcast channel and reset all module-scope state.
 */
export function destroyDisplaySubscriber(): void {
  if (_channel && _client) {
    _client.removeChannel(_channel)
  }

  _channel = null
  _client = null
  _status = 'disconnected'
}
