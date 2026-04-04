import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'
import {
  initDisplayPublisher,
  configureDisplayPublisher,
  publishDisplaySnapshot,
  publishSessionEnded,
  publishFocusEvent,
  publishUnfocusEvent,
  destroyDisplayPublisher,
} from '@/lib/display-publisher'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockClient() {
  const mockSend = vi.fn().mockResolvedValue('ok')
  const mockSubscribe = vi.fn().mockImplementation((cb) => {
    cb?.('SUBSCRIBED')
    return mockChannel
  })
  const mockChannel = {
    send: mockSend,
    subscribe: mockSubscribe,
    unsubscribe: vi.fn(),
  }
  const mockClient = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient
  return { mockClient, mockChannel, mockSend }
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  destroyDisplayPublisher()
})

// ===========================================================================
// publishDisplaySnapshot
// ===========================================================================

describe('publishDisplaySnapshot', () => {
  it('is a no-op when publisher is not initialized', () => {
    const { mockSend } = createMockClient()
    // Do NOT call initDisplayPublisher
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('is a no-op when displayVisible is false', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: false })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends workout_snapshot when initialized and displayVisible is true', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'workout_snapshot',
      payload: SNAPSHOT_FIXTURE,
    })
  })
})

// ===========================================================================
// publishSessionEnded
// ===========================================================================

describe('publishSessionEnded', () => {
  it('sends session_ended event with user_id', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    publishSessionEnded('user-abc')
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'session_ended',
      payload: { user_id: 'user-abc' },
    })
  })
})

// ===========================================================================
// publishFocusEvent
// ===========================================================================

describe('publishFocusEvent', () => {
  it('sends focus event with user_id', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    publishFocusEvent('user-xyz')
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'focus',
      payload: { user_id: 'user-xyz' },
    })
  })
})

// ===========================================================================
// publishUnfocusEvent
// ===========================================================================

describe('publishUnfocusEvent', () => {
  it('sends unfocus event with empty payload', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    publishUnfocusEvent()
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'unfocus',
      payload: {},
    })
  })
})

// ===========================================================================
// destroyDisplayPublisher
// ===========================================================================

describe('destroyDisplayPublisher', () => {
  it('calls removeChannel and resets state so subsequent publish is a no-op', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    // First publish to create the channel
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).toHaveBeenCalledTimes(1)

    // Destroy
    destroyDisplayPublisher()
    expect(mockClient.removeChannel).toHaveBeenCalled()

    // Subsequent publish should be a no-op
    mockSend.mockClear()
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Fire-and-forget error handling
// ===========================================================================

describe('fire-and-forget error handling', () => {
  it('does not propagate when send rejects', async () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    mockSend.mockRejectedValueOnce(new Error('network failure'))

    // Should not throw
    expect(() => publishDisplaySnapshot(SNAPSHOT_FIXTURE)).not.toThrow()

    // Let the microtask queue flush so the .catch handler runs
    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Lazy channel creation
// ===========================================================================

describe('lazy channel creation', () => {
  it('creates channel on first publish and reuses it on second', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ displayVisible: true })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    // client.channel should only be called once (lazy init, then reuse)
    expect(mockClient.channel).toHaveBeenCalledTimes(1)
    // But send should be called twice
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})
