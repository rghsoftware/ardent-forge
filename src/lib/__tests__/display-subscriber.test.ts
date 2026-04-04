import { vi, describe, it, expect, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
import {
  initDisplaySubscriber,
  subscribeToDisplay,
  publishHello,
  destroyDisplaySubscriber,
  type DisplayEventHandlers,
} from '@/lib/display-subscriber'

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
    onStatusChange: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Reset module state between tests
// ---------------------------------------------------------------------------

afterEach(() => {
  destroyDisplaySubscriber()
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
    subscribeToDisplay(handlers)

    // The client.channel method should have been called
    expect(client.channel).toHaveBeenCalledWith('display', {
      config: { broadcast: { ack: false, self: false } },
    })
  })
})

// ===========================================================================
// subscribeToDisplay
// ===========================================================================

describe('subscribeToDisplay', () => {
  it('creates channel with correct config', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    subscribeToDisplay(createMockHandlers())

    expect(client.channel).toHaveBeenCalledWith('display', {
      config: { broadcast: { ack: false, self: false } },
    })
  })

  it('is a no-op if client is not initialized', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    subscribeToDisplay(createMockHandlers())

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot subscribe'))
    warnSpy.mockRestore()
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
    subscribeToDisplay(handlers)

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
    subscribeToDisplay(handlers)

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
    subscribeToDisplay(handlers)

    const listener = listeners.get('session_ended')!
    listener({ payload: { user_id: 'u1' } })

    expect(handlers.onSessionEnded).toHaveBeenCalledWith({ user_id: 'u1' })
  })

  it('valid focus calls onFocus', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay(handlers)

    const listener = listeners.get('focus')!
    listener({ payload: { user_id: 'u2' } })

    expect(handlers.onFocus).toHaveBeenCalledWith({ user_id: 'u2' })
  })

  it('unfocus calls onUnfocus', () => {
    const { channel, listeners } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)

    const handlers = createMockHandlers()
    subscribeToDisplay(handlers)

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
    subscribeToDisplay(handlers)

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
      subscribeToDisplay(handlers)

      const cb = getSubscribeCallback()!
      cb(status)

      expect(handlers.onStatusChange).toHaveBeenCalledWith('reconnecting')
      warnSpy.mockRestore()
    },
  )
})

// ===========================================================================
// publishHello
// ===========================================================================

describe('publishHello', () => {
  it('sends correct event through the channel', () => {
    const { channel } = createMockChannel()
    const client = createMockClient(channel)
    initDisplaySubscriber(client)
    subscribeToDisplay(createMockHandlers())

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
    subscribeToDisplay(createMockHandlers())

    destroyDisplaySubscriber()

    expect(client.removeChannel).toHaveBeenCalled()

    // Subsequent subscribe should warn (no client)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    subscribeToDisplay(createMockHandlers())
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot subscribe'))
    warnSpy.mockRestore()
  })
})
