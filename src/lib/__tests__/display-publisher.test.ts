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
  isPublisherReady,
  getActiveGymId,
} from '@/lib/display-publisher'
import { getGymChannelName } from '@/lib/gym-channel'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockClient() {
  const mockSend = vi.fn().mockResolvedValue('ok')
  const mockSubscribe = vi.fn().mockImplementation((cb) => {
    cb?.('SUBSCRIBED')
    return mockChannel
  })
  const mockChannel: Record<string, unknown> = {
    send: mockSend,
    subscribe: mockSubscribe,
    unsubscribe: vi.fn(),
    on: vi.fn().mockReturnThis(),
  }
  const mockClient = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient
  return { mockClient, mockChannel, mockSend }
}

// Test gym IDs (not required to be UUIDs; the publisher is agnostic)
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

  it('is a no-op when gymId is null (Private workout)', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: null })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).not.toHaveBeenCalled()
    expect(mockClient.channel).not.toHaveBeenCalled()
  })

  it('sends workout_snapshot to the per-gym channel when configured', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), {
      config: { broadcast: { ack: false, self: false } },
    })
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
  it('is a no-op when gymId is null', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: null })

    publishSessionEnded('user-abc')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends session_ended event with user_id to the per-gym channel', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    publishSessionEnded('user-abc')
    expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), expect.any(Object))
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
  it('is a no-op when gymId is null', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: null })

    publishFocusEvent('user-xyz')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends focus event with user_id to the per-gym channel', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    publishFocusEvent('user-xyz')
    expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), expect.any(Object))
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
  it('is a no-op when gymId is null', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: null })

    publishUnfocusEvent()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends unfocus event with empty payload to the per-gym channel', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    publishUnfocusEvent()
    expect(mockClient.channel).toHaveBeenCalledWith(getGymChannelName(GYM_A), expect.any(Object))
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'unfocus',
      payload: {},
    })
  })
})

// ===========================================================================
// Switching gyms between publishes
// ===========================================================================

describe('switching gyms between publishes', () => {
  it('recreates the channel when gymId changes and sends to the new channel', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)

    // First publish to gym A
    configureDisplayPublisher({ gymId: GYM_A })
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    expect(mockClient.channel).toHaveBeenCalledTimes(1)
    expect(mockClient.channel).toHaveBeenLastCalledWith(
      getGymChannelName(GYM_A),
      expect.any(Object),
    )

    // Switch to gym B -- the stale channel should be torn down on reconfigure
    configureDisplayPublisher({ gymId: GYM_B })

    expect(mockClient.removeChannel).toHaveBeenCalledTimes(1)

    // Publish again; a new channel for gym B should be created
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    expect(mockClient.channel).toHaveBeenCalledTimes(2)
    expect(mockClient.channel).toHaveBeenLastCalledWith(
      getGymChannelName(GYM_B),
      expect.any(Object),
    )

    // Both sends happened
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})

// ===========================================================================
// isPublisherReady / getActiveGymId
// ===========================================================================

describe('isPublisherReady', () => {
  it('returns false when client is not initialized', () => {
    expect(isPublisherReady()).toBe(false)
  })

  it('returns false when client is initialized but gymId is null', () => {
    const { mockClient } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: null })
    expect(isPublisherReady()).toBe(false)
  })

  it('returns true when client is initialized and gymId is set', () => {
    const { mockClient } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })
    expect(isPublisherReady()).toBe(true)
  })
})

describe('getActiveGymId', () => {
  it('returns null when not configured', () => {
    expect(getActiveGymId()).toBeNull()
  })

  it('returns the configured gym ID', () => {
    const { mockClient } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })
    expect(getActiveGymId()).toBe(GYM_A)
  })

  it('returns null after configuring with null', () => {
    const { mockClient } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })
    configureDisplayPublisher({ gymId: null })
    expect(getActiveGymId()).toBeNull()
  })
})

// ===========================================================================
// destroyDisplayPublisher
// ===========================================================================

describe('destroyDisplayPublisher', () => {
  it('calls removeChannel and resets state so subsequent publish is a no-op', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    // First publish to create the channel
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    expect(mockSend).toHaveBeenCalledTimes(1)

    // Destroy
    destroyDisplayPublisher()
    expect(mockClient.removeChannel).toHaveBeenCalled()

    // getActiveGymId should reset
    expect(getActiveGymId()).toBeNull()

    // Subsequent publish should be a no-op (no client, no gymId)
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
    configureDisplayPublisher({ gymId: GYM_A })

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
  it('creates channel on first publish and reuses it on second within the same gym', () => {
    const { mockClient, mockSend } = createMockClient()
    initDisplayPublisher(mockClient)
    configureDisplayPublisher({ gymId: GYM_A })

    publishDisplaySnapshot(SNAPSHOT_FIXTURE)
    publishDisplaySnapshot(SNAPSHOT_FIXTURE)

    // client.channel should only be called once (lazy init, then reuse)
    expect(mockClient.channel).toHaveBeenCalledTimes(1)
    // But send should be called twice
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})
