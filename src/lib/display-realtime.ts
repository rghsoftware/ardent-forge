import type { SupabaseClient } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/realtime-js'
import {
  displaySnapshotSchema,
  idleSnapshotSchema,
  type DisplaySnapshot,
  type DisplayConnectionStatus,
  type IdleSnapshot,
} from '@/domain/types/display-snapshot'
import { z } from 'zod'
import { getGymChannelName } from '@/lib/gym-channel'

export interface DisplayEventHandlers {
  onSnapshot: (snapshot: DisplaySnapshot) => void
  onSessionEnded: (payload: { user_id: string }) => void
  onFocus: (payload: { user_id: string }) => void
  onUnfocus: () => void
  onIdleSnapshot: (snapshot: IdleSnapshot) => void
  onStatusChange: (status: DisplayConnectionStatus) => void
}
export interface SubscribeToDisplayArgs {
  gymId: string
  handlers: DisplayEventHandlers
}

const L = '[display-realtime]'
const userIdPayload = z.object({ user_id: z.string() })
const BC = { config: { broadcast: { ack: false, self: false } } } as const

function removeSafe(client: SupabaseClient | null, ch: RealtimeChannel, ctx: string): void {
  if (!client) {
    console.warn(`${L} removeSafe(${ctx}): client is null, channel may be leaked`)
    return
  }
  try {
    client.removeChannel(ch)
  } catch (err) {
    console.error(`${L} removeChannel failed in ${ctx}:`, err)
  }
}

function validated<T>(schema: z.ZodType<T>, p: unknown, ev: string, cb: (d: T) => void) {
  const r = schema.safeParse(p)
  if (r.success) cb(r.data)
  else console.warn(`${L} Invalid ${ev} payload (dropping):`, r.error.toString(), p)
}

let _client: SupabaseClient | null = null
let _pubChannel: RealtimeChannel | null = null
let _pubGymId: string | null = null
let _pubHelloResponder: (() => void) | null = null
let _pubConfigured = false

function teardownPubChannel(): void {
  if (_pubChannel) {
    removeSafe(_client, _pubChannel, 'pubTeardown')
    _pubChannel = null
  }
}

function ensurePubChannel(): RealtimeChannel | null {
  if (!_client || _pubGymId === null) return null
  if (_pubChannel) return _pubChannel
  _pubChannel = _client.channel(getGymChannelName(_pubGymId), BC)
  _pubChannel.on('broadcast', { event: 'display_hello' }, () => {
    if (!_pubHelloResponder) return
    try {
      _pubHelloResponder()
    } catch (err) {
      console.error(`${L} responder threw:`, err)
    }
  })
  _pubChannel.subscribe((status, err) => {
    if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
      ;(status === 'CLOSED' ? console.info : console.error)(`${L} Pub channel ${status}`, err ?? '')
      teardownPubChannel()
    }
  })
  return _pubChannel
}

function pubSend(event: string, payload: unknown): void {
  const ch = ensurePubChannel()
  if (!ch) {
    if (_pubConfigured && _pubGymId !== null)
      console.warn(`${L} Dropped ${event}: channel unavailable while broadcasting`)
    return
  }
  ch.send({ type: 'broadcast', event, payload: payload as Record<string, unknown> }).catch(
    (err: unknown) => {
      console.error(`${L} Failed to send ${event}:`, err)
    },
  )
}

export function initDisplayPublisher(client: SupabaseClient): void {
  _client = client
}

type PubConfig = { gymId: string | null; intent: 'broadcasting' | 'private' }

export function configureDisplayPublisher({ gymId, intent }: PubConfig): void {
  if (intent === 'broadcasting' && gymId === null) {
    console.error(`${L} configure: broadcasting requires gymId`)
    return
  }
  if (intent === 'private' && gymId !== null) {
    console.error(`${L} configure: private requires gymId=null, got ${gymId}`)
    return
  }
  if (gymId !== null && gymId.trim() === '') {
    console.error(`${L} configure: gymId must not be empty`)
    return
  }
  const next = intent === 'broadcasting'
  if (_pubConfigured === next && _pubGymId === gymId) return
  console.info(`${L} ${_pubConfigured ? 'broadcasting' : 'off'} -> ${intent}`)
  if (gymId !== _pubGymId) teardownPubChannel()
  _pubGymId = gymId
  _pubConfigured = next
}

export function publishDisplaySnapshot(snapshot: DisplaySnapshot): void {
  pubSend('workout_snapshot', snapshot)
}
export function publishSessionEnded(userId: string): void {
  pubSend('session_ended', { user_id: userId })
}
export function publishFocusEvent(userId: string): void {
  pubSend('focus', { user_id: userId })
}
export function publishUnfocusEvent(): void {
  pubSend('unfocus', {})
}
export function setHelloResponder(fn: (() => void) | null): void {
  _pubHelloResponder = fn
}
export function isPublisherReady(): boolean {
  return _client !== null && _pubGymId !== null
}
export function getActiveGymId(): string | null {
  return _pubGymId
}

export function destroyDisplayPublisher(): void {
  teardownPubChannel()
  _pubGymId = null
  _pubHelloResponder = null
  _pubConfigured = false
  if (!_subChannel) _client = null
}

let _subChannel: RealtimeChannel | null = null
let _subStatus: DisplayConnectionStatus = 'disconnected'
let _subRetryTimer: ReturnType<typeof setTimeout> | null = null
let _subRetryAttempt = 0
let _subConnectedBefore = false

function scheduleRetry(gymId: string, handlers: DisplayEventHandlers): void {
  const delay = Math.min(2_000 * 2 ** _subRetryAttempt, 30_000)
  _subRetryAttempt++
  console.info(`${L} Reconnecting in ${delay}ms (attempt ${_subRetryAttempt})`)
  _subRetryTimer = setTimeout(() => {
    _subRetryTimer = null
    if (_client) {
      subscribeToDisplay({ gymId, handlers })
    } else {
      console.error(`${L} Retry fired but client is null — stopping reconnect loop`)
      _subStatus = 'disconnected'
      handlers.onStatusChange('disconnected')
    }
  }, delay)
}

export function initDisplaySubscriber(client: SupabaseClient): void {
  _client = client
}

export function subscribeToDisplay({ gymId, handlers }: SubscribeToDisplayArgs): void {
  if (!_client)
    throw new Error(`${L} Cannot subscribe: no client. Call initDisplaySubscriber first.`)
  if (!gymId || gymId.trim() === '')
    throw new Error(`${L} Cannot subscribe: gymId must be a non-empty string`)
  if (_subRetryTimer !== null) {
    clearTimeout(_subRetryTimer)
    _subRetryTimer = null
  }
  if (_subChannel) {
    removeSafe(_client, _subChannel, 'sub/existing')
    _subChannel = null
  }
  _subChannel = _client.channel(getGymChannelName(gymId), BC)
  _subChannel
    .on('broadcast', { event: 'workout_snapshot' }, ({ payload }) =>
      validated(displaySnapshotSchema, payload, 'workout_snapshot', handlers.onSnapshot),
    )
    .on('broadcast', { event: 'session_ended' }, ({ payload }) =>
      validated(userIdPayload, payload, 'session_ended', handlers.onSessionEnded),
    )
    .on('broadcast', { event: 'focus' }, ({ payload }) =>
      validated(userIdPayload, payload, 'focus', handlers.onFocus),
    )
    .on('broadcast', { event: 'idle_snapshot' }, ({ payload }) =>
      validated(idleSnapshotSchema, payload, 'idle_snapshot', handlers.onIdleSnapshot),
    )
    .on('broadcast', { event: 'unfocus' }, () => {
      try {
        handlers.onUnfocus()
      } catch (err) {
        console.error(`${L} unfocus handler threw:`, err)
      }
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        _subStatus = 'connected'
        _subRetryAttempt = 0
        if (_subConnectedBefore) publishHello()
        _subConnectedBefore = true
        handlers.onStatusChange('connected')
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        ;(status === 'CLOSED' ? console.info : console.error)(
          `${L} Subscriber channel ${status}`,
          err ?? '',
        )
        _subStatus = 'reconnecting'
        handlers.onStatusChange('reconnecting')
        if (_subChannel) removeSafe(_client, _subChannel, `subSub/${status}`)
        _subChannel = null
        scheduleRetry(gymId, handlers)
      }
    })
}

export function publishHello(): void {
  if (!_subChannel) {
    console.warn(`${L} publishHello: no subscriber channel`)
    return
  }
  _subChannel
    .send({ type: 'broadcast', event: 'display_hello', payload: {} })
    .catch((err: unknown) => {
      console.error(`${L} Failed to send display_hello:`, err)
    })
}

export function getSubscriberStatus(): DisplayConnectionStatus {
  return _subStatus
}

export function destroyDisplaySubscriber(): void {
  if (_subRetryTimer !== null) {
    clearTimeout(_subRetryTimer)
    _subRetryTimer = null
  }
  if (_subChannel) removeSafe(_client, _subChannel, 'destroySub')
  _subChannel = null
  _subStatus = 'disconnected'
  _subRetryAttempt = 0
  _subConnectedBefore = false
  if (!_pubChannel && _pubGymId === null) _client = null
}
