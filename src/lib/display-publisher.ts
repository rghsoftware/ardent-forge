import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Module-scope state
// ---------------------------------------------------------------------------

/**
 * Publisher mode -- distinguishes the three operationally distinct states
 * the broadcast pipeline can be in. Without this distinction, callers cannot
 * tell apart "user explicitly chose Private" (silent drops are correct) from
 * "publisher state was lost on tab refresh" (silent drops are a bug, P14-001)
 * from "publisher initialized but caller has not configured intent yet."
 *
 * - 'unconfigured': initial state after init OR after a tab refresh wiped
 *   module memory. Drops in this mode trigger a one-shot warning so operators
 *   notice broadcasts vanishing silently.
 * - 'private': user explicitly picked "Private (don't publish)" at workout
 *   start. Drops in this mode are expected and silent.
 * - 'broadcasting': user picked a gym at workout start. Drops in this mode
 *   indicate something is wrong (channel died, client disappeared) and
 *   trigger a one-shot warning.
 *
 * This will be subsumed by the discriminated `PublisherState` ADR-013, but
 * the distinction is needed today to fix the silent-downgrade bug class.
 */
export type PublisherMode = 'unconfigured' | 'private' | 'broadcasting'

let _client: SupabaseClient | null = null
let _channel: RealtimeChannel | null = null
let _activeGymId: string | null = null
let _channelGymId: string | null = null
let _helloResponder: (() => void) | null = null
let _publisherMode: PublisherMode = 'unconfigured'
let _silentDropWarned = false
// P14-015: track consecutive terminal-status events on the same channel.
// After three failures on the same gym, escalate the log level so a
// flapping channel is loud in production logs.
let _terminalFailureCount = 0
const TERMINAL_FAILURE_ESCALATE_AFTER = 3
// P14-013: track consecutive removeChannel failures across all teardown
// paths. After 5 in a row, escalate from warn to error so a broken
// supabase client surface area is loud in production logs.
let _removeChannelFailureCount = 0
const REMOVE_CHANNEL_ESCALATE_AFTER = 5

/**
 * Wrap `_client.removeChannel(channel)` with a counted failure log so we
 * have one place to track removeChannel failures across the three teardown
 * paths (gym switch in ensureChannel, gym switch in configureDisplayPublisher,
 * channel terminal status, destroy). P14-013 escalation lives here.
 */
function removeChannelSafe(channel: RealtimeChannel, context: string): void {
  if (!_client) return
  try {
    _client.removeChannel(channel)
    _removeChannelFailureCount = 0
  } catch (err) {
    _removeChannelFailureCount++
    const escalate = _removeChannelFailureCount >= REMOVE_CHANNEL_ESCALATE_AFTER
    const logFn = escalate ? console.error : console.warn
    logFn(
      `[display-publisher] removeChannel failed in ${context} ` +
        `(consecutive=${_removeChannelFailureCount}${escalate ? ', escalated' : ''}):`,
      err,
    )
  }
}

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
    removeChannelSafe(_channel, 'ensureChannel/gym-switch')
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
    if (!_helloResponder) {
      // P14-042: hello arrived during teardown (responder was cleared but
      // the channel hasn't been removed yet). Log at info so test logs and
      // prod traces are honest about the race.
      console.info(
        '[display-publisher] Hello received with no responder; ignored (likely teardown race)',
      )
      return
    }
    try {
      _helloResponder()
    } catch (err) {
      console.error('[display-publisher] Hello responder threw:', err)
    }
  })

  _channel.subscribe((status, err) => {
    if (status === 'CLOSED') {
      // CLOSED is a normal teardown path -- log at info level so we have a
      // breadcrumb but do not paint it as an error. Still call removeChannel
      // so the supabase client releases its reference (P14-008).
      console.info('[display-publisher] Channel closed (normal teardown)')
      if (_channel) removeChannelSafe(_channel, 'subscribe/CLOSED')
      _channel = null
      _channelGymId = null
    } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      // TIMED_OUT and CHANNEL_ERROR are unexpected terminal states. Log at
      // warn for the first few failures, then escalate to error so a
      // flapping channel is loud in production logs (P14-015).
      // P14-008: explicitly call removeChannel so the supabase client does
      // not retain a reference to the dead channel. Without this, a workout
      // that bounces network connectivity a few times leaks several dead
      // channels for the lifetime of the active workout.
      _terminalFailureCount++
      const escalate = _terminalFailureCount >= TERMINAL_FAILURE_ESCALATE_AFTER
      const logFn = escalate ? console.error : console.warn
      logFn(
        `[display-publisher] Channel terminal status: ${status} ` +
          `(consecutive=${_terminalFailureCount}${escalate ? ', escalated' : ''})`,
        err,
      )
      if (_channel) removeChannelSafe(_channel, `subscribe/${status}`)
      _channel = null
      _channelGymId = null
    } else if (status === 'SUBSCRIBED') {
      // Reset the terminal-failure counter on a successful subscribe so a
      // recovered channel does not carry stale escalation state.
      _terminalFailureCount = 0
    }
  })

  return _channel
}

// ---------------------------------------------------------------------------
// Silent-drop logging (P14-001 / P14-002)
// ---------------------------------------------------------------------------

/**
 * Logs the first silent drop per session whenever broadcast was expected
 * (publisher mode is 'unconfigured' or 'broadcasting' but the gym/client
 * check still failed). Stays silent in 'private' mode where drops are
 * intentional. Logs once per session to avoid spamming the console with one
 * warning per published set.
 *
 * Reset by `configureDisplayPublisher` and `destroyDisplayPublisher` so a
 * fresh workout gets a fresh warning budget.
 */
function maybeLogSilentDrop(eventName: string): void {
  if (_silentDropWarned) return
  if (_publisherMode === 'private') return
  _silentDropWarned = true
  if (_publisherMode === 'unconfigured') {
    console.warn(
      `[display-publisher] Dropped ${eventName}: publisher unconfigured. ` +
        'This commonly indicates the page was refreshed mid-workout, which wipes the in-memory ' +
        'gym selection. Subsequent broadcasts will also be dropped silently. ' +
        'Restart the workout to re-establish broadcasting. Known v1 limitation; ' +
        'see ADR-013 for the type-safe fix.',
    )
  } else {
    console.warn(
      `[display-publisher] Dropped ${eventName}: client missing or no active gym ` +
        `while in mode=${_publisherMode}. This is unexpected; further drops will be silent.`,
    )
  }
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
 * broadcast to and the explicit caller intent.
 *
 * `intent` is required so the publisher can distinguish "explicit Private"
 * (silent drops are correct) from "publisher unconfigured / refresh case"
 * (silent drops are a bug worth warning about). See `PublisherMode` docs.
 *
 * - `intent: 'broadcasting'` requires a non-null `gymId`. Sets the active gym
 *   and switches the publisher into broadcasting mode.
 * - `intent: 'private'` requires `gymId === null`. Switches the publisher
 *   into private mode -- subsequent publish calls drop silently.
 *
 * If the gym ID changes between calls and a channel already exists, the
 * stale channel is torn down so the next publish creates a fresh channel
 * bound to the new gym.
 */
export function configureDisplayPublisher({
  gymId,
  intent,
}: {
  gymId: string | null
  intent: 'broadcasting' | 'private'
}): void {
  // Validate the gymId/intent combination at the boundary so future callers
  // cannot bypass the state machine. Per .claude/rules/state-management.md,
  // module-state setters should validate at their own boundary.
  if (intent === 'broadcasting' && gymId === null) {
    console.error(
      '[display-publisher] configureDisplayPublisher called with intent=broadcasting but gymId=null; ignoring',
    )
    return
  }
  if (intent === 'private' && gymId !== null) {
    console.error(
      `[display-publisher] configureDisplayPublisher called with intent=private but gymId=${gymId}; ignoring`,
    )
    return
  }

  // No-op when nothing actually changes (avoids redundant log spam and
  // unnecessary channel teardowns when an effect re-runs with stable values).
  if (_publisherMode === intent && _activeGymId === gymId) return

  // Breadcrumb so production debugging "why did this workout publish to the
  // wrong gym?" has a traceable entry point. The actual broadcast path is
  // fire-and-forget so this is the best place to record intent.
  console.info(
    `[display-publisher] Mode change: ${_publisherMode} -> ${intent} ` +
      `(gym ${_activeGymId ?? 'none'} -> ${gymId ?? 'none'})`,
  )

  _activeGymId = gymId
  _publisherMode = intent
  // Reset the silent-drop warning budget so the next workout can warn fresh
  // if drops happen.
  _silentDropWarned = false

  // If the cached channel belongs to the old gym, tear it down eagerly so the
  // next publish creates a fresh channel for the new gym. We also handle this
  // defensively in ensureChannel, but eager teardown here avoids a lingering
  // subscription in the rare W5 path.
  if (_channel && _channelGymId !== _activeGymId) {
    removeChannelSafe(_channel, 'configureDisplayPublisher/gym-switch')
    _channel = null
    _channelGymId = null
  }
}

/**
 * Broadcast a full workout snapshot to the active gym's display channel.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishDisplaySnapshot(snapshot: DisplaySnapshot): void {
  if (!_client || _activeGymId === null) {
    maybeLogSilentDrop('workout_snapshot')
    return
  }

  const channel = ensureChannel()
  if (!channel) {
    maybeLogSilentDrop('workout_snapshot')
    return
  }

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
  if (!_client || _activeGymId === null) {
    maybeLogSilentDrop('session_ended')
    return
  }

  const channel = ensureChannel()
  if (!channel) {
    maybeLogSilentDrop('session_ended')
    return
  }

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
  if (!_client || _activeGymId === null) {
    maybeLogSilentDrop('focus')
    return
  }

  const channel = ensureChannel()
  if (!channel) {
    maybeLogSilentDrop('focus')
    return
  }

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
  if (!_client || _activeGymId === null) {
    maybeLogSilentDrop('unfocus')
    return
  }

  const channel = ensureChannel()
  if (!channel) {
    maybeLogSilentDrop('unfocus')
    return
  }

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
 * Return the publisher's current operational mode. Useful for callers that
 * need to distinguish "explicit Private" from "publisher unconfigured /
 * refresh case" without inspecting `_activeGymId` directly.
 */
export function getPublisherMode(): PublisherMode {
  return _publisherMode
}

/**
 * Tear down the broadcast channel and reset all module-scope state.
 */
export function destroyDisplayPublisher(): void {
  if (_channel) removeChannelSafe(_channel, 'destroyDisplayPublisher')

  _channel = null
  _channelGymId = null
  _client = null
  _activeGymId = null
  _helloResponder = null
  _publisherMode = 'unconfigured'
  _silentDropWarned = false
  _terminalFailureCount = 0
  _removeChannelFailureCount = 0
}
