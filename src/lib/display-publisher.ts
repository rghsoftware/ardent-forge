import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null
let _displayVisible: boolean = true
let _helloResponder: (() => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lazily creates and subscribes the broadcast channel on first use.
 * Returns the channel, or null if the client is not initialized.
 */
function ensureChannel(): RealtimeChannel | null {
  if (!_client) return null
  if (_channel) return _channel

  _channel = _client.channel('display', {
    config: { broadcast: { ack: false, self: false } },
  })

  _channel.on('broadcast', { event: 'display_hello' }, () => {
    _helloResponder?.()
  })

  _channel.subscribe((status, err) => {
    if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
      console.warn(`[display-publisher] Channel terminal status: ${status}`, err)
      // Clear the dead channel so the next publish attempt recreates it
      _channel = null
    }
  })

  return _channel
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Store the Supabase client reference for later channel creation.
 * Does NOT create the channel yet -- that happens lazily on first publish.
 */
export function initDisplayPublisher(client: SupabaseClient): void {
  _client = client
}

/**
 * Configure the publisher with the current user's display visibility preference.
 */
export function configureDisplayPublisher({ displayVisible }: { displayVisible: boolean }): void {
  _displayVisible = displayVisible
}

/**
 * Broadcast a full workout snapshot to the display channel.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishDisplaySnapshot(snapshot: DisplaySnapshot): void {
  if (!_client || !_displayVisible) return

  const channel = ensureChannel()
  if (!channel) return

  channel
    .send({ type: 'broadcast', event: 'workout_snapshot', payload: snapshot })
    .catch((err: unknown) => {
      console.error('[display-publisher] Failed to send workout_snapshot', err)
    })
}

/**
 * Broadcast that the user's workout session has ended.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishSessionEnded(userId: string): void {
  if (!_client || !_displayVisible) return

  const channel = ensureChannel()
  if (!channel) return

  channel
    .send({ type: 'broadcast', event: 'session_ended', payload: { user_id: userId } })
    .catch((err: unknown) => {
      console.error('[display-publisher] Failed to send session_ended', err)
    })
}

/**
 * Broadcast a focus event -- tells remote displays to highlight this user.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishFocusEvent(userId: string): void {
  if (!_client || !_displayVisible) return

  const channel = ensureChannel()
  if (!channel) return

  channel
    .send({ type: 'broadcast', event: 'focus', payload: { user_id: userId } })
    .catch((err: unknown) => {
      console.error('[display-publisher] Failed to send focus', err)
    })
}

/**
 * Broadcast an unfocus event -- tells remote displays to clear the highlight.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishUnfocusEvent(): void {
  if (!_client || !_displayVisible) return

  const channel = ensureChannel()
  if (!channel) return

  channel.send({ type: 'broadcast', event: 'unfocus', payload: {} }).catch((err: unknown) => {
    console.error('[display-publisher] Failed to send unfocus', err)
  })
}

/**
 * Check whether the publisher has a working client and display is visible.
 * Used by the hook to reflect true broadcast readiness in the UI.
 */
export function setHelloResponder(fn: (() => void) | null): void {
  _helloResponder = fn
}

/**
 * Check whether the publisher has a working client and display is visible.
 * Used by the hook to reflect true broadcast readiness in the UI.
 */
export function isPublisherReady(): boolean {
  return _client !== null && _displayVisible
}

/**
 * Tear down the broadcast channel and reset all module-scope state.
 */
export function destroyDisplayPublisher(): void {
  if (_channel && _client) {
    _client.removeChannel(_channel)
  }

  _channel = null
  _client = null
  _displayVisible = true
  _helloResponder = null
}
