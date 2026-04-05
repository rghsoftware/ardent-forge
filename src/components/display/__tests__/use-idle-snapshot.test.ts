// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleSnapshot } from '../use-idle-snapshot'
import { getSupabaseClient } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validIdleSnapshot = {
  server_time: '2026-04-04T10:00:00Z',
  scheduled_sessions: [
    {
      display_name: 'Robert',
      session_name: 'Push Day',
      session_type: 'STRENGTH' as const,
      day_label: 'Day 1',
    },
  ],
  next_session: {
    display_name: 'Robert',
    session_name: 'Push Day',
  },
}

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type BroadcastHandler = (payload: { payload: unknown }) => void
type SubscribeCallback = (status: string) => void

function createMockChannel() {
  let broadcastHandler: BroadcastHandler = () => {}
  let subscribeCallback: SubscribeCallback = () => {}

  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: BroadcastHandler) => {
      broadcastHandler = handler
      return channel
    }),
    subscribe: vi.fn((cb: SubscribeCallback) => {
      subscribeCallback = cb
      return channel
    }),
  }

  return {
    channel,
    fireBroadcast(payload: unknown) {
      broadcastHandler({ payload })
    },
    fireStatus(status: string) {
      subscribeCallback(status)
    },
  }
}

function createMockClient(channelMock: ReturnType<typeof createMockChannel>['channel']) {
  return {
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useIdleSnapshot', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null initially when no broadcast received', () => {
    const mock = createMockChannel()
    const client = createMockClient(mock.channel)
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)

    const { result } = renderHook(() => useIdleSnapshot())

    expect(result.current).toBeNull()
  })

  it('updates snapshot state when a valid payload is broadcast', () => {
    const mock = createMockChannel()
    const client = createMockClient(mock.channel)
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)

    const { result } = renderHook(() => useIdleSnapshot())

    act(() => {
      mock.fireBroadcast(validIdleSnapshot)
    })

    expect(result.current).toEqual(validIdleSnapshot)
  })

  it('discards invalid payload and logs console.error', () => {
    const mock = createMockChannel()
    const client = createMockClient(mock.channel)
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useIdleSnapshot())

    act(() => {
      mock.fireBroadcast({ bad: 'data' })
    })

    expect(result.current).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      '[useIdleSnapshot] Invalid payload:',
      expect.any(Array),
    )
  })

  it('returns null without throwing when client is null, logs console.error', () => {
    vi.mocked(getSupabaseClient).mockReturnValue(null as unknown as ReturnType<typeof getSupabaseClient>)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useIdleSnapshot())

    expect(result.current).toBeNull()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Supabase client not initialized'),
    )
  })

  it('calls removeChannel on unmount', () => {
    const mock = createMockChannel()
    const client = createMockClient(mock.channel)
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)

    const { unmount } = renderHook(() => useIdleSnapshot())

    unmount()

    expect(client.removeChannel).toHaveBeenCalledWith(mock.channel)
  })

  it('fires connected callback on SUBSCRIBED status', () => {
    const mock = createMockChannel()
    const client = createMockClient(mock.channel)
    vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)
    const onStatus = vi.fn()

    renderHook(() => useIdleSnapshot(onStatus))

    act(() => {
      mock.fireStatus('SUBSCRIBED')
    })

    expect(onStatus).toHaveBeenCalledWith('connected')
  })

  it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])(
    'fires reconnecting callback on %s status',
    (status) => {
      const mock = createMockChannel()
      const client = createMockClient(mock.channel)
      vi.mocked(getSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>)
      const onStatus = vi.fn()

      renderHook(() => useIdleSnapshot(onStatus))

      act(() => {
        mock.fireStatus(status)
      })

      expect(onStatus).toHaveBeenCalledWith('reconnecting')
    },
  )
})
