import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  initDisplayPublisher,
  configureDisplayPublisher,
  setHelloResponder,
  destroyDisplayPublisher,
  publishDisplaySnapshot,
} from '@/lib/display-publisher'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockChannel() {
  let helloListener: (() => void) | null = null

  const channel = {
    send: vi.fn().mockResolvedValue('ok'),
    subscribe: vi.fn().mockImplementation((cb) => {
      cb?.('SUBSCRIBED')
      return channel
    }),
    on: vi.fn((_type: string, opts: { event: string }, handler: () => void) => {
      if (opts.event === 'display_hello') {
        helloListener = handler
      }
      return channel
    }),
    unsubscribe: vi.fn(),
  }

  return {
    channel,
    fireHello: () => helloListener?.(),
  }
}

function createMockClient(channel: ReturnType<typeof createMockChannel>['channel']) {
  return {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient
}

// Test gym ID (F018 -- publisher is now gym-scoped)
const GYM_A = 'gym-a-0000-0000-000000000000'

// Minimal valid snapshot to trigger channel creation
const SNAPSHOT: DisplaySnapshot = {
  user_id: 'user-1',
  display_name: 'Test',
  session_name: 'Session',
  workout_started_at: '2026-04-03T10:00:00Z',
  current_exercise: 'Bench Press',
  exercise_index: 0,
  total_exercises: 1,
  sets: [],
  rest_timer: { state: 'idle' },
  session_type: 'STRENGTH',
  is_visible: true,
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  destroyDisplayPublisher()
})

// ===========================================================================
// setHelloResponder
// ===========================================================================

describe('setHelloResponder', () => {
  it('stores the callback', () => {
    const responder = vi.fn()
    setHelloResponder(responder)

    // Verify it was stored by triggering it through the channel
    const { channel, fireHello } = createMockChannel()
    const client = createMockClient(channel)
    initDisplayPublisher(client)
    configureDisplayPublisher({ gymId: GYM_A })

    // Force channel creation by publishing
    publishDisplaySnapshot(SNAPSHOT)

    // Simulate the display_hello broadcast event
    fireHello()

    expect(responder).toHaveBeenCalledOnce()
  })
})

// ===========================================================================
// display_hello event
// ===========================================================================

describe('display_hello event on channel', () => {
  it('triggers the stored callback', () => {
    const { channel, fireHello } = createMockChannel()
    const client = createMockClient(channel)
    initDisplayPublisher(client)
    configureDisplayPublisher({ gymId: GYM_A })

    const responder = vi.fn()
    setHelloResponder(responder)

    // Force channel creation
    publishDisplaySnapshot(SNAPSHOT)

    fireHello()

    expect(responder).toHaveBeenCalledOnce()
  })

  it('null responder does not crash when hello event fires', () => {
    const { channel, fireHello } = createMockChannel()
    const client = createMockClient(channel)
    initDisplayPublisher(client)
    configureDisplayPublisher({ gymId: GYM_A })

    setHelloResponder(null)

    // Force channel creation
    publishDisplaySnapshot(SNAPSHOT)

    // Should not throw
    expect(() => fireHello()).not.toThrow()
  })
})

// ===========================================================================
// destroyDisplayPublisher clears responder
// ===========================================================================

describe('destroyDisplayPublisher', () => {
  it('clears the responder', () => {
    const responder = vi.fn()
    setHelloResponder(responder)

    destroyDisplayPublisher()

    // After destroy, set up a fresh publisher and trigger hello
    const { channel, fireHello } = createMockChannel()
    const client = createMockClient(channel)
    initDisplayPublisher(client)
    configureDisplayPublisher({ gymId: GYM_A })

    publishDisplaySnapshot(SNAPSHOT)
    fireHello()

    // The old responder should not have been called since it was cleared
    expect(responder).not.toHaveBeenCalled()
  })
})
