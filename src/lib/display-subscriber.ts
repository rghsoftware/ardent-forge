import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import {
  displaySnapshotSchema,
  type DisplaySnapshot,
  type DisplayConnectionStatus,
} from '@/domain/types/display-snapshot'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisplayEventHandlers {
  onSnapshot: (snapshot: DisplaySnapshot) => void
  onSessionEnded: (payload: { user_id: string }) => void
  onFocus: (payload: { user_id: string }) => void
  onUnfocus: () => void
  onStatusChange: (status: DisplayConnectionStatus) => void
}

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null
let _status: DisplayConnectionStatus = 'disconnected'
let _retryTimer: ReturnType<typeof setTimeout> | null = null
let _retryAttempt = 0
let _hasConnectedBefore = false

const RETRY_BASE_MS = 2_000
const RETRY_MAX_MS = 30_000

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
    handlers.onStatusChange('disconnected')
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
        _retryAttempt = 0
        if (_hasConnectedBefore) {
          publishHello()
        }
        _hasConnectedBefore = true
        handlers.onStatusChange('connected')
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.warn(`[display-subscriber] Channel terminal status: ${status}`, err)
        _status = 'reconnecting'
        handlers.onStatusChange('reconnecting')

        // Remove the dead channel before clearing the reference (P6-002)
        if (_channel && _client) {
          _client.removeChannel(_channel)
        }
        _channel = null

        const delay = Math.min(RETRY_BASE_MS * 2 ** _retryAttempt, RETRY_MAX_MS)
        _retryAttempt++
        console.info(`[display-subscriber] Reconnecting in ${delay}ms (attempt ${_retryAttempt})`)
        _retryTimer = setTimeout(() => {
          _retryTimer = null
          if (_client) subscribeToDisplay(handlers)
        }, delay)
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
export function getSubscriberStatus(): DisplayConnectionStatus {
  return _status
}

/**
 * Tear down the broadcast channel, cancel any pending reconnect, and reset
 * all module-scope state.
 */
export function destroyDisplaySubscriber(): void {
  if (_retryTimer !== null) {
    clearTimeout(_retryTimer)
    _retryTimer = null
  }

  if (_channel && _client) {
    _client.removeChannel(_channel)
  }

  _channel = null
  _client = null
  _status = 'disconnected'
  _retryAttempt = 0
  _hasConnectedBefore = false
}
