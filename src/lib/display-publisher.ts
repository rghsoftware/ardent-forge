import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null
let _activeGymId: string | null = null
let _channelGymId: string | null = null
let _helloResponder: (() => void) | null = null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lazily creates and subscribes the broadcast channel on first use for the
 * currently-active gym ID. Returns the channel, or null if the client is not
 * initialized or there is no active gym (Private workout).
 *
 * If the active gym ID has changed since the last call (i.e., the cached
 * channel was bound to a different gym), this helper tears down the stale
 * channel and creates a fresh one for the new gym.
 */
function ensureChannel(): RealtimeChannel | null {
  if (!_client) return null
  if (_activeGymId === null) return null

  // If the cached channel is bound to a different gym, tear it down so we can
  // create a new channel for the new gym on this call.
  if (_channel && _channelGymId !== _activeGymId) {
    try {
      _client.removeChannel(_channel)
    } catch (err) {
      console.warn('[display-publisher] Failed to remove stale channel on gym switch:', err)
    }
    _channel = null
    _channelGymId = null
  }

  if (_channel) return _channel

  const channelName = getGymChannelName(_activeGymId)
  _channel = _client.channel(channelName, {
    config: { broadcast: { ack: false, self: false } },
  })
  _channelGymId = _activeGymId

  _channel.on('broadcast', { event: 'display_hello' }, () => {
    // Wrap responder invocation in try/catch -- the responder may call
    // republishCurrentState() which can throw, and Supabase Realtime swallows
    // exceptions inside `on` callbacks in some versions. Logging here ensures
    // the failure is traceable instead of silently lost.
    try {
      _helloResponder?.()
    } catch (err) {
      console.error('[display-publisher] Hello responder threw:', err)
    }
  })

  _channel.subscribe((status, err) => {
    if (status === 'CLOSED') {
      // CLOSED is a normal teardown path -- log at info level so we have a
      // breadcrumb but do not paint it as an error.
      console.info('[display-publisher] Channel closed (normal teardown)')
      _channel = null
      _channelGymId = null
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      // TIMED_OUT and CHANNEL_ERROR are unexpected terminal states; log them
      // at warn level with the err payload so retries surface in the console.
      console.warn(`[display-publisher] Channel terminal status: ${status}`, err)
      _channel = null
      _channelGymId = null
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
 * Configure the publisher with the gym ID the current workout is being
 * broadcast to. Pass `null` for a Private workout (publisher no-ops on every
 * send). If the gym ID changes between calls and a channel already exists,
 * the stale channel is torn down so the next publish creates a fresh channel
 * bound to the new gym.
 */
export function configureDisplayPublisher({ gymId }: { gymId: string | null }): void {
  if (_activeGymId === gymId) return

  // Breadcrumb so production debugging "why did this workout publish to the
  // wrong gym?" has a traceable entry point. The actual broadcast path is
  // fire-and-forget so this is the best place to record intent.
  console.info(
    `[display-publisher] Active gym change: ${_activeGymId ?? 'none'} -> ${gymId ?? 'none (private)'}`,
  )

  _activeGymId = gymId

  // If the cached channel belongs to the old gym, tear it down eagerly so the
  // next publish creates a fresh channel for the new gym. We also handle this
  // defensively in ensureChannel, but eager teardown here avoids a lingering
  // subscription in the rare W5 path.
  if (_channel && _client && _channelGymId !== _activeGymId) {
    try {
      _client.removeChannel(_channel)
    } catch (err) {
      console.warn('[display-publisher] Failed to remove channel on gym switch:', err)
    }
    _channel = null
    _channelGymId = null
  }
}

/**
 * Broadcast a full workout snapshot to the active gym's display channel.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishDisplaySnapshot(snapshot: DisplaySnapshot): void {
  if (!_client || _activeGymId === null) return

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
  if (!_client || _activeGymId === null) return

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
  if (!_client || _activeGymId === null) return

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
  if (!_client || _activeGymId === null) return

  const channel = ensureChannel()
  if (!channel) return

  channel.send({ type: 'broadcast', event: 'unfocus', payload: {} }).catch((err: unknown) => {
    console.error('[display-publisher] Failed to send unfocus', err)
  })
}

/**
 * Register a callback to invoke when a display_hello event is received.
 * Pass null to deregister the current responder.
 */
export function setHelloResponder(fn: (() => void) | null): void {
  _helloResponder = fn
}

/**
 * Check whether the publisher has a working client and an active gym.
 * Used by the hook to reflect true broadcast readiness in the UI.
 */
export function isPublisherReady(): boolean {
  return _client !== null && _activeGymId !== null
}

/**
 * Return the gym ID the publisher is currently configured to broadcast to, or
 * null when the publisher is in Private mode (or has not been configured yet).
 * Consumed by the active-workout header label component (F018 D12).
 */
export function getActiveGymId(): string | null {
  return _activeGymId
}

/**
 * Tear down the broadcast channel and reset all module-scope state.
 */
export function destroyDisplayPublisher(): void {
  if (_channel && _client) {
    try {
      _client.removeChannel(_channel)
    } catch (err) {
      console.warn('[display-publisher] Failed to remove channel on destroy:', err)
    }
  }

  _channel = null
  _channelGymId = null
  _client = null
  _activeGymId = null
  _helloResponder = null
}
