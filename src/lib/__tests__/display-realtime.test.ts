import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
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
  initDisplaySubscriber,
  subscribeToDisplay,
  publishHello,
  destroyDisplaySubscriber,
  type DisplayEventHandlers,
} from '@/lib/display-realtime'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type BroadcastCallback = (msg: { payload: unknown }) => void
type SubscribeCallback = (status: string, err?: unknown) => void

function createMockClient() {
  const mockSend = vi.fn().mockResolvedValue('ok')
  const broadcastHandlers = new Map<string, BroadcastCallback>()
  let subscribeCallback: SubscribeCallback | null = null

  const mockChannel: Record<string, unknown> = {
    send: mockSend,
    subscribe: vi.fn().mockImplementation((cb: SubscribeCallback) => {
      subscribeCallback = cb
      cb('SUBSCRIBED')
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
