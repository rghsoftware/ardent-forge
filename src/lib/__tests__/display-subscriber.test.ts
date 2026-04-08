import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
import {
  initDisplaySubscriber,
  subscribeToDisplay,
  publishHello,
  destroyDisplaySubscriber,
  type DisplayEventHandlers,
} from '@/lib/display-subscriber'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockChannel() {
  const listeners = new Map<string, (incoming: { payload: unknown }) => void>()
  let subscribeCallback: ((status: string, err?: Error) => void) | null = null

  const channel = {
    on: vi.fn(
      (
        _type: string,
        opts: { event: string },
        handler: (incoming: { payload: unknown }) => void,
      ) => {
        listeners.set(opts.event, handler)
        return channel // chainable
      },
    ),
    subscribe: vi.fn((cb: (status: string, err?: Error) => void) => {
      subscribeCallback = cb
      return channel
    }),
    send: vi.fn(() => Promise.resolve()),
  }

  return { channel, listeners, getSubscribeCallback: () => subscribeCallback }
}

function createMockClient(channel: ReturnType<typeof createMockChannel>['channel']) {
  return {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient
}

// Test gym IDs
const GYM_A = 'gym-a-0000-0000-000000000000'
const GYM_B = 'gym-b-0000-0000-000000000000'

// Minimal valid snapshot
const SNAPSHOT_FIXTURE: DisplaySnapshot = {
  user_id: 'user-123',
  display_name: 'Test User',
  session_name: 'Morning Workout',
  workout_started_at: '2026-04-03T10:00:00Z',
  current_exercise: 'Bench Press',
  exercise_index: 0,
  total_exercises: 3,
  sets: [],
  rest_timer: { state: 'idle' },
  session_type: 'STRENGTH',
  is_visible: true,
}

function createMockHandlers(): DisplayEventHandlers {
  return {
    onSnapshot: vi.fn(),
    onSessionEnded: vi.fn(),
    onFocus: vi.fn(),
    onUnfocus: vi.fn(),
    onIdleSnapshot: vi.fn(),
    onStatusChange: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Reset module state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  destroyDisplaySubscriber()
  vi.useRealTimers()
})

// ===========================================================================
// initDisplaySubscriber
// ===========================================================================

describe('initDisplaySubscriber', () => {
  it('stores client so subscribeToDisplay can create a channel', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)

    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    // The client.channel method should have been called with the per-gym name
    expect(client.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), {
      config: { broadcast: { ack: false, self: false } },
    })
  })
})

// ===========================================================================
// subscribeToDisplay
// ===========================================================================

describe('subscribeToDisplay', () => {
  it('creates channel named display:gym:<gymId> with correct config', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    expect(client.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), {
      config: { broadcast: { ack: false, self: false } },
    })
  })

  it('opens a different channel name for a different gym', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    subscribeToDisplay({ gymId: GYM_B, handlers: createMockHandlers() })

    expect(client.channel).toHaveBeenCalledWith(getGymChannelName(GYM_B), {
      config: { broadcast: { ack: false, self: false } },
    })
  })

  it('throws if client is not initialized (P14-004)', () => {
    // Per F018 P14-004: subscribeToDisplay must throw rather than warn-and-
    // return when the client is not initialized, so the route's outer
    // try/catch can map this into a `subscribe-failed` BootError with a
    // visible Retry button.
    expect(() => subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })).toThrow(
      /client not initialized/i,
    )
  })
})

// ===========================================================================
// Event dispatching
// ===========================================================================

describe('event dispatching', () => {
  it('valid workout_snapshot calls onSnapshot with parsed data', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    // Simulate a valid snapshot broadcast
    const listener = listeners.get('workout_snapshot')!
    listener({ payload: SNAPSHOT_FIXTURE })

    expect(handlers.onSnapshot).toHaveBeenCalledWith(SNAPSHOT_FIXTURE)
  })

  it('invalid workout_snapshot is dropped with console.warn', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    subscribeToDisplay({ gymId: GYM_A, handlers })

    const listener = listeners.get('workout_snapshot')!
    listener({ payload: { bad: 'data' } })

    expect(handlers.onSnapshot).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid workout_snapshot'),
      expect.anything(),
    )
    warnSpy.mockRestore()
  })

  it('valid session_ended calls onSessionEnded', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    const listener = listeners.get('session_ended')!
    listener({ payload: { user_id: 'u1' } })

    expect(handlers.onSessionEnded).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('valid focus calls onFocus', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    const listener = listeners.get('focus')!
    listener({ payload: { user_id: 'u2' } })

    expect(handlers.onFocus).toHaveBeenCalledWith({ user_id: 'u2' })
  })

  it('unfocus calls onUnfocus', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    // unfocus handler has a different signature -- no payload arg
    const listener = listeners.get('unfocus')!
    listener({ payload: {} })

    expect(handlers.onUnfocus).toHaveBeenCalled()
  })
})

// ===========================================================================
// Status changes
// ===========================================================================

describe('status changes', () => {
  it('SUBSCRIBED calls onStatusChange("connected")', () => {
    const { channel, getSubscribeCallback } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    const cb = getSubscribeCallback()!
    cb('SUBSCRIBED')

    expect(handlers.onStatusChange).toHaveBeenCalledWith('connected')
  })

  it.each(['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'])(
    '%s calls onStatusChange("reconnecting")',
    (status) => {
      const { channel, getSubscribeCallback } = createMockChannel()
      const client = createMockClient(channel)
      initDisplaySubscriber(client)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const handlers = createMockHandlers()
      subscribeToDisplay({ gymId: GYM_A, handlers })

      const cb = getSubscribeCallback()!
      cb(status)

      expect(handlers.onStatusChange).toHaveBeenCalledWith('reconnecting')
      warnSpy.mockRestore()
    },
  )
})

// ===========================================================================
// Reconnect retains the original gymId
// ===========================================================================

describe('reconnect retains gym ID', () => {
  it('reuses the original gymId on retry after a CHANNEL_ERROR', () => {
    const { channel, getSubscribeCallback } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    const handlers = createMockHandlers()
    subscribeToDisplay({ gymId: GYM_A, handlers })

    expect(client.channel).toHaveBeenCalledTimes(1)
    expect(client.channel).toHaveBeenLastCalledWith(getGymChannelName(GYM_A), expect.any(Object))

    // Trigger a terminal status to force a retry
    const cb = getSubscribeCallback()!
    cb('CHANNEL_ERROR')

    // Fast-forward through the retry delay using an explicit time budget
    // (P14-046). `vi.runOnlyPendingTimers` was sensitive to timer-ordering
    // changes (e.g., a defensive setTimeout(0) added in the subscribe
    // path). Using a generous budget keeps the test deterministic against
    // future production-code timer additions.
    vi.advanceTimersByTime(5_000)

    // The reconnect must have opened a channel for the same gym, not a
    // different one.
    expect(client.channel).toHaveBeenCalledTimes(2)
    expect(client.channel).toHaveBeenNthCalledWith(2, getGymChannelName(GYM_A), expect.any(Object))

    // Guard: the other gym's channel name was never used
    const channelNames = (client.channel as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0] as string,
    )
    expect(channelNames.every((name) => name === getGymChannelName(GYM_A))).toBe(true)
    expect(channelNames.includes(getGymChannelName(GYM_B))).toBe(false)

    warnSpy.mockRestore()
    infoSpy.mockRestore()
  })
})

// ===========================================================================
// publishHello
// ===========================================================================

describe('publishHello', () => {
  it('sends correct event through the channel', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)
    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    publishHello()

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'display_hello',
      payload: {},
    })
  })

  it('is a no-op when no channel exists', () => {
    // No init, no subscribe -- publishHello should not throw
    expect(() => publishHello()).not.toThrow()
  })
})

// ===========================================================================
// destroyDisplaySubscriber
// ===========================================================================

describe('destroyDisplaySubscriber', () => {
  it('removes channel and resets state', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)
    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    destroyDisplaySubscriber()

    expect(client.removeChannel).toHaveBeenCalled()

    // Subsequent subscribe should throw (no client). Per F018 P14-004,
    // subscribeToDisplay throws on uninit so the route's outer try/catch
    // can map this into a `subscribe-failed` BootError.
    expect(() => subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })).toThrow(
      /client not initialized/i,
    )
  })
})
