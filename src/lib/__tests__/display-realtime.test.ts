import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisplaySnapshot, IdleSnapshot } from '@/domain/types/display-snapshot'
import {
  initDisplayPublisher,
  configureDisplayPublisher,
  publishDisplaySnapshot,
  publishSessionEnded,
  publishFocusEvent,
  publishUnfocusEvent,
  setHelloResponder,
  destroyDisplayPublisher,
  isPublisherReady,
  getActiveGymId,
  initDisplaySubscriber,
  subscribeToDisplay,
  publishHello,
  destroyDisplaySubscriber,
  getSubscriberStatus,
  type DisplayEventHandlers,
} from '@/lib/display-realtime'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type BroadcastCallback = (msg: { payload: unknown }) => void
type SubscribeCallback = (status: string, err?: unknown) => void

function createMockClient({ autoSubscribe = true }: { autoSubscribe?: boolean } = {}) {
  const mockSend = vi.fn().mockResolvedValue('ok')
  const broadcastHandlers = new Map<string, BroadcastCallback>()
  let subscribeCallback: SubscribeCallback | null = null

  const mockChannel: Record<string, unknown> = {
    send: mockSend,
    subscribe: vi.fn().mockImplementation((cb: SubscribeCallback) => {
      subscribeCallback = cb
      if (autoSubscribe) cb('SUBSCRIBED')
      return mockChannel
    }),
    unsubscribe: vi.fn(),
    on: vi
      .fn()
      .mockImplementation((_type: string, opts: { event: string }, cb: BroadcastCallback) => {
        broadcastHandlers.set(opts.event, cb)
        return mockChannel
      }),
  }

  const mockClient = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient

  return {
    mockClient,
    mockChannel,
    mockSend,
    broadcastHandlers,
    getSubscribeCallback: () => subscribeCallback,
    fireSubscribeCallback: (status: string, err?: unknown) => subscribeCallback?.(status, err),
  }
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

// Test gym IDs
const GYM_A = 'gym-a-0000-0000-000000000000'
const GYM_B = 'gym-b-0000-0000-000000000000'

// Minimal valid DisplaySnapshot fixture
const SNAPSHOT_FIXTURE: DisplaySnapshot = {
  user_id: 'user-123',
  display_name: 'Test User',
  session_name: 'Morning Workout',
  workout_started_at: '2026-04-03T10:00:00Z',
  current_exercise: 'Bench Press',
  exercise_index: 0,
  total_exercises: 3,
  sets: [
    {
      set_number: 1,
      prescribed: { reps: 5, weight: { value: 135, unit: 'lb' } },
      completed: false,
    },
  ],
  rest_timer: { state: 'idle' },
  session_type: 'STRENGTH',
  is_visible: true,
}

// Minimal valid IdleSnapshot fixture
const IDLE_SNAPSHOT_FIXTURE: IdleSnapshot = {
  server_time: '2026-04-12T10:00:00Z',
  scheduled_sessions: [
    {
      display_name: 'Test User',
      session_name: 'Morning Strength',
      session_type: 'STRENGTH',
      day_label: 'Sunday',
    },
  ],
  next_session: {
    display_name: 'Test User',
    session_name: 'Morning Strength',
  },
}

const BC_OPTS = { config: { broadcast: { ack: false, self: false } } }

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  destroyDisplayPublisher()
  destroyDisplaySubscriber()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ===========================================================================
// Publisher
// ===========================================================================

describe('Publisher', () => {
  describe('initDisplayPublisher + configureDisplayPublisher', () => {
    it('sets up state so subsequent publishes reach the channel', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      publishDisplaySnapshot(SNAPSHOT_FIXTURE)

      expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), BC_OPTS)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('publishDisplaySnapshot', () => {
    it('calls channel.send with workout_snapshot event and the snapshot as payload', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      publishDisplaySnapshot(SNAPSHOT_FIXTURE)

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'workout_snapshot',
        payload: SNAPSHOT_FIXTURE,
      })
    })
  })

  describe('publishSessionEnded', () => {
    it('sends session_ended event with user_id payload', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      publishSessionEnded('user-abc')

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'session_ended',
        payload: { user_id: 'user-abc' },
      })
    })
  })

  describe('publishFocusEvent', () => {
    it('sends focus event with user_id payload', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      publishFocusEvent('user-xyz')

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'focus',
        payload: { user_id: 'user-xyz' },
      })
    })
  })

  describe('publishUnfocusEvent', () => {
    it('sends unfocus event with empty payload', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      publishUnfocusEvent()

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'unfocus',
        payload: {},
      })
    })
  })

  describe('configureDisplayPublisher boundary validation', () => {
    it('logs error and returns when intent=broadcasting but gymId=null', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)

      configureDisplayPublisher({ gymId: null, intent: 'broadcasting' })

      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('broadcasting requires gymId'))
      // State should not have been mutated
      expect(isPublisherReady()).toBe(false)
    })

    it('logs error and returns when intent=private but gymId is non-null', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)

      configureDisplayPublisher({ gymId: GYM_A, intent: 'private' })

      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('private requires gymId=null'))
    })
  })

  describe('destroyDisplayPublisher', () => {
    it('calls removeChannel and resets state so subsequent publish is a no-op', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      // Create the channel via a publish
      publishDisplaySnapshot(SNAPSHOT_FIXTURE)
      expect(mockSend).toHaveBeenCalledTimes(1)

      destroyDisplayPublisher()

      expect(mockClient.removeChannel).toHaveBeenCalled()

      // Subsequent publish should be a no-op
      mockSend.mockClear()
      publishDisplaySnapshot(SNAPSHOT_FIXTURE)
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('isPublisherReady', () => {
    it('returns false when no client is initialized', () => {
      expect(isPublisherReady()).toBe(false)
    })

    it('returns false when client is set but gymId is null', () => {
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: null, intent: 'private' })

      expect(isPublisherReady()).toBe(false)
    })

    it('returns true when client and gymId are both set', () => {
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      expect(isPublisherReady()).toBe(true)
    })
  })
})

// ===========================================================================
// Subscriber
// ===========================================================================

describe('Subscriber', () => {
  describe('subscribeToDisplay', () => {
    it('subscribes to the correct gym channel name', () => {
      const { mockClient } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), BC_OPTS)
    })
  })

  describe('workout_snapshot broadcast', () => {
    it('fires onSnapshot handler with parsed data when subscriber receives a workout_snapshot', () => {
      const { mockClient, broadcastHandlers } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      // Simulate a broadcast arriving on the channel
      const snapshotCb = broadcastHandlers.get('workout_snapshot')
      expect(snapshotCb).toBeDefined()
      snapshotCb!({ payload: SNAPSHOT_FIXTURE })

      expect(handlers.onSnapshot).toHaveBeenCalledWith(SNAPSHOT_FIXTURE)
    })
  })

  describe('session_ended broadcast', () => {
    it('fires onSessionEnded handler when subscriber receives a session_ended event', () => {
      const { mockClient, broadcastHandlers } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      const sessionEndedCb = broadcastHandlers.get('session_ended')
      expect(sessionEndedCb).toBeDefined()
      sessionEndedCb!({ payload: { user_id: 'user-abc' } })

      expect(handlers.onSessionEnded).toHaveBeenCalledWith({ user_id: 'user-abc' })
    })
  })

  describe('publishHello', () => {
    it('sends display_hello event on the subscriber channel', () => {
      const { mockClient, mockSend } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })
      publishHello()

      expect(mockSend).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'display_hello',
        payload: {},
      })
    })
  })

  describe('destroyDisplaySubscriber', () => {
    it('calls removeChannel and clears retry timers', () => {
      const { mockClient, getSubscribeCallback } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      // Initial subscribe fires 'connected' -- clear that so we can assert
      // no NEW connected call arrives after destroy.
      ;(handlers.onStatusChange as ReturnType<typeof vi.fn>).mockClear()
      const channelCallsBefore = (mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length

      // Simulate a channel error to trigger a retry timer
      const subCb = getSubscribeCallback()
      subCb?.('CHANNEL_ERROR', new Error('test'))

      // Now destroy -- should clear the pending retry timer and remove channel
      destroyDisplaySubscriber()

      expect(mockClient.removeChannel).toHaveBeenCalled()

      // Advance timers past the retry delay -- no new subscription should occur
      vi.advanceTimersByTime(60_000)

      // No new channel was created (the retry timer was cleared)
      const channelCallsAfter = (mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length
      expect(channelCallsAfter).toBe(channelCallsBefore)

      // onStatusChange should NOT have been called with 'connected' again
      expect(handlers.onStatusChange).not.toHaveBeenCalledWith('connected')
    })
  })
})

// ===========================================================================
// Hello handshake
// ===========================================================================

describe('Hello handshake', () => {
  it('publisher fires the registered helloResponder when it receives a display_hello event', () => {
    const { mockClient, broadcastHandlers } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

    const responder = vi.fn()
    setHelloResponder(responder)

    // Force channel creation by publishing something
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    // Simulate the display_hello broadcast arriving on the publisher channel
    const helloCb = broadcastHandlers.get('display_hello')
    expect(helloCb).toBeDefined()
    helloCb!({ payload: {} })

    expect(responder).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// S015-T: subscribeToDisplay throws when uninitialized
// ===========================================================================

describe('Subscriber (uninitialized guards)', () => {
  it('throws when called before initDisplaySubscriber', () => {
    // No initDisplaySubscriber — _client is null from afterEach cleanup
    expect(() => subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })).toThrow(
      /Cannot subscribe: no client/,
    )
  })

  it('throws when gymId is an empty string', () => {
    const { mockClient } = createMockClient()
    initDisplaySubscriber(mockClient)

    expect(() => subscribeToDisplay({ gymId: '', handlers: createMockHandlers() })).toThrow(
      /gymId must be a non-empty string/,
    )
  })
})

// ===========================================================================
// S016-T: auto-publishHello on reconnect
// ===========================================================================

describe('Reconnect', () => {
  it('does not fire publishHello on the first connection', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplaySubscriber(mockClient)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    expect(mockSend).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'display_hello' }))
  })

  it('auto-fires publishHello on reconnect when previously connected', () => {
    const { mockClient, mockSend, getSubscribeCallback } = createMockClient()
    initDisplaySubscriber(mockClient)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    // Clear sends from the initial connect
    mockSend.mockClear()

    // Trigger channel error — schedules retry
    getSubscribeCallback()?.('CHANNEL_ERROR', new Error('network'))

    // Advance past the first retry delay (2000ms for attempt 1)
    vi.advanceTimersByTime(2_000)

    // Retry fires subscribeToDisplay, mock auto-fires SUBSCRIBED,
    // _subConnectedBefore=true → publishHello is called
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'display_hello',
      payload: {},
    })
  })
})

// ===========================================================================
// S017-T: onStatusChange assertions
// ===========================================================================

describe('Subscriber (onStatusChange)', () => {
  it('calls onStatusChange("connected") on SUBSCRIBED', () => {
    const { mockClient } = createMockClient()
    initDisplaySubscriber(mockClient)
    const handlers = createMockHandlers()

    subscribeToDisplay({ gymId: GYM_A, handlers })

    expect(handlers.onStatusChange).toHaveBeenCalledWith('connected')
  })

  it.each(['TIMED_OUT', 'CHANNEL_ERROR', 'CLOSED'])(
    'calls onStatusChange("reconnecting") for %s',
    (status) => {
      const { mockClient, getSubscribeCallback } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })
      ;(handlers.onStatusChange as ReturnType<typeof vi.fn>).mockClear()

      getSubscribeCallback()?.(status, new Error('test'))

      expect(handlers.onStatusChange).toHaveBeenCalledWith('reconnecting')
    },
  )
})

// ===========================================================================
// S018-T: focus, unfocus, idle_snapshot broadcast handlers
// ===========================================================================

describe('Subscriber (extended event handlers)', () => {
  describe('focus broadcast', () => {
    it('fires onFocus when subscriber receives a focus broadcast', () => {
      const { mockClient, broadcastHandlers } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      const focusCb = broadcastHandlers.get('focus')
      expect(focusCb).toBeDefined()
      focusCb!({ payload: { user_id: 'user-123' } })

      expect(handlers.onFocus).toHaveBeenCalledWith({ user_id: 'user-123' })
    })
  })

  describe('unfocus broadcast', () => {
    it('fires onUnfocus when subscriber receives an unfocus broadcast', () => {
      const { mockClient, broadcastHandlers } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      const unfocusCb = broadcastHandlers.get('unfocus')
      expect(unfocusCb).toBeDefined()
      unfocusCb!({ payload: {} })

      expect(handlers.onUnfocus).toHaveBeenCalledTimes(1)
    })
  })

  describe('idle_snapshot broadcast', () => {
    it('fires onIdleSnapshot when subscriber receives a valid idle_snapshot broadcast', () => {
      const { mockClient, broadcastHandlers } = createMockClient()
      initDisplaySubscriber(mockClient)
      const handlers = createMockHandlers()

      subscribeToDisplay({ gymId: GYM_A, handlers })

      const idleCb = broadcastHandlers.get('idle_snapshot')
      expect(idleCb).toBeDefined()
      idleCb!({ payload: IDLE_SNAPSHOT_FIXTURE })

      expect(handlers.onIdleSnapshot).toHaveBeenCalledWith(IDLE_SNAPSHOT_FIXTURE)
    })
  })
})

// ===========================================================================
// S019-T: gym-switch channel teardown
// ===========================================================================

describe('Publisher (gym switch)', () => {
  it('tears down the old channel and creates a new one when gymId changes', () => {
    const { mockClient } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

    // Force GYM_A channel creation
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), BC_OPTS)

    const removeChannelSpy = mockClient.removeChannel as ReturnType<typeof vi.fn>
    const removeCallsBefore = removeChannelSpy.mock.calls.length

    // Switch to GYM_B — should tear down GYM_A channel
    configureDisplayPublisher({ gymId: GYM_B, intent: 'broadcasting' })

    expect(mockClient.removeChannel).toHaveBeenCalledTimes(removeCallsBefore + 1)

    // Next publish should create a GYM_B channel
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockClient.channel).toHaveBeenLastCalledWith(getGymChannelName(GYM_B), BC_OPTS)
  })
})

// ===========================================================================
// S020-T: exponential backoff sequencing
// ===========================================================================

describe('Backoff', () => {
  it('schedules first retry after 2000ms on CHANNEL_ERROR', () => {
    const { mockClient, getSubscribeCallback } = createMockClient()
    initDisplaySubscriber(mockClient)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })
    const channelCallsBefore = (mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length

    getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))

    vi.advanceTimersByTime(1_999)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore,
    )

    vi.advanceTimersByTime(1)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore + 1,
    )
  })

  it('resets retry attempt counter after successful reconnect', () => {
    const { mockClient, getSubscribeCallback } = createMockClient()
    initDisplaySubscriber(mockClient)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    // First error: attempt 1, delay=2000ms; retry fires SUBSCRIBED → counter resets to 0
    getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))
    vi.advanceTimersByTime(2_000)

    // Second error after reset should also use 2000ms, not 4000ms
    const channelCallsBefore = (mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length
    getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))

    vi.advanceTimersByTime(1_999)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore,
    )

    vi.advanceTimersByTime(1)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore + 1,
    )
  })

  it('caps retry delay at 30 seconds', () => {
    // autoSubscribe=false prevents SUBSCRIBED from resetting _subRetryAttempt,
    // allowing the counter to accumulate across consecutive errors.
    const { mockClient, getSubscribeCallback } = createMockClient({ autoSubscribe: false })
    initDisplaySubscriber(mockClient)

    subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

    // Drive 4 errors + advance their delays so _subRetryAttempt reaches 4
    // without a successful SUBSCRIBED resetting it.
    const delays = [2_000, 4_000, 8_000, 16_000]
    for (const delay of delays) {
      getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))
      vi.advanceTimersByTime(delay)
    }

    // 5th error: attempt=4 → delay = min(2000 * 2^4, 30000) = min(32000, 30000) = 30000ms
    const channelCallsBefore = (mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length
    getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))

    vi.advanceTimersByTime(29_999)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore,
    )

    vi.advanceTimersByTime(1)
    expect((mockClient.channel as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      channelCallsBefore + 1,
    )
  })
})

// ===========================================================================
// S021-T: getActiveGymId and getSubscriberStatus state transitions
// ===========================================================================

describe('Getter state transitions', () => {
  describe('getActiveGymId', () => {
    it('returns null when publisher is not configured', () => {
      expect(getActiveGymId()).toBeNull()
    })

    it('returns the configured gymId while broadcasting', () => {
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      expect(getActiveGymId()).toBe(GYM_A)
    })

    it('returns null after destroyDisplayPublisher', () => {
      const { mockClient } = createMockClient()
      initDisplayPublisher(mockClient)
      configureDisplayPublisher({ gymId: GYM_A, intent: 'broadcasting' })

      destroyDisplayPublisher()

      expect(getActiveGymId()).toBeNull()
    })
  })

  describe('getSubscriberStatus', () => {
    it('returns "disconnected" before subscribing', () => {
      expect(getSubscriberStatus()).toBe('disconnected')
    })

    it('returns "connected" after SUBSCRIBED', () => {
      const { mockClient } = createMockClient()
      initDisplaySubscriber(mockClient)

      subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })

      expect(getSubscriberStatus()).toBe('connected')
    })

    it('returns "reconnecting" after CHANNEL_ERROR', () => {
      const { mockClient, getSubscribeCallback } = createMockClient()
      initDisplaySubscriber(mockClient)

      subscribeToDisplay({ gymId: GYM_A, handlers: createMockHandlers() })
      getSubscribeCallback()?.('CHANNEL_ERROR', new Error('test'))

      expect(getSubscriberStatus()).toBe('reconnecting')
    })
  })
})
