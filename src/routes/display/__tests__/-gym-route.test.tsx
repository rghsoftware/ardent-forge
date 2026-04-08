// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSubscribeToDisplay,
  mockInitDisplaySubscriber,
  mockDestroyDisplaySubscriber,
  mockCreateClient,
  mockResolveConfig,
  mockSupabaseFrom,
  capturedGymComponent,
  capturedIndexComponent,
  mockParams,
  mockSearch,
} = vi.hoisted(() => {
  const mockSubscribeToDisplay = vi.fn()
  const mockInitDisplaySubscriber = vi.fn()
  const mockDestroyDisplaySubscriber = vi.fn()
  const mockCreateClient = vi.fn()
  const mockResolveConfig = vi.fn()
  const mockSupabaseFrom = vi.fn()
  const capturedGymComponent: { current: React.ComponentType | undefined } = {
    current: undefined,
  }
  const capturedIndexComponent: { current: React.ComponentType | undefined } = {
    current: undefined,
  }
  const mockParams: { current: Record<string, string> } = { current: {} }
  const mockSearch: { current: Record<string, unknown> } = { current: { clock: '24h' } }
  return {
    mockSubscribeToDisplay,
    mockInitDisplaySubscriber,
    mockDestroyDisplaySubscriber,
    mockCreateClient,
    mockResolveConfig,
    mockSupabaseFrom,
    capturedGymComponent,
    capturedIndexComponent,
    mockParams,
    mockSearch,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => {
  interface RouteConfig {
    component?: React.ComponentType
  }
  let lastRoute: {
    useParams: () => Record<string, string>
    useSearch: () => Record<string, unknown>
  } | null = null

  return {
    createFileRoute: (path: string) => (config: RouteConfig) => {
      // Capture the component under the right key based on route path
      if (path === '/display/gym/$gymId') {
        capturedGymComponent.current = config.component
      } else if (path === '/display/') {
        capturedIndexComponent.current = config.component
      }
      lastRoute = {
        useParams: () => mockParams.current,
        useSearch: () => mockSearch.current,
      }
      return {
        ...config,
        useParams: () => mockParams.current,
        useSearch: () => mockSearch.current,
      }
    },
    get Route() {
      return lastRoute
    },
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mockCreateClient(...args)
    return {
      from: mockSupabaseFrom,
      channel: vi.fn(),
      removeChannel: vi.fn(),
    }
  },
}))

vi.mock('@/lib/config-store', () => ({
  resolveConfig: mockResolveConfig,
}))

vi.mock('@/lib/display-subscriber', () => ({
  initDisplaySubscriber: mockInitDisplaySubscriber,
  subscribeToDisplay: mockSubscribeToDisplay,
  destroyDisplaySubscriber: mockDestroyDisplaySubscriber,
}))

vi.mock('@/stores/display-store', () => ({
  useDisplayStore: Object.assign(() => null, {
    getState: () => ({
      upsertSession: vi.fn(),
      removeSession: vi.fn(),
      setFocusedUser: vi.fn(),
      setIdleSnapshot: vi.fn(),
      setConnectionStatus: vi.fn(),
      pruneStale: vi.fn(),
      clearAllSessions: vi.fn(),
    }),
  }),
  getDisplayMode: () => 'idle',
}))

vi.mock('@/components/display/idle-view', () => ({
  IdleView: () => <div data-testid="idle-view" />,
}))
vi.mock('@/components/display/board-view', () => ({
  BoardView: () => <div data-testid="board-view" />,
}))
vi.mock('@/components/display/focused-view', () => ({
  FocusedView: () => <div data-testid="focused-view" />,
}))
vi.mock('@/components/display/connection-footer', () => ({
  ConnectionFooter: () => <div data-testid="connection-footer" />,
}))

// F019: the /display index route now renders <DisplayDispatcher />, which
// reads useAuth() and useGyms(). Mock both so the legacy-page tests below
// can simulate the unauthenticated branch (which preserves the F018 copy).
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isGuest: false }),
}))

vi.mock('@/hooks/use-gyms', () => ({
  useGyms: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

// Import after mocks are registered -- this triggers createFileRoute
import '../gym/$gymId'
import '../index'

import { getGymChannelName } from '@/lib/gym-channel'

// ===========================================================================
// Tests -- /display/gym/$gymId
// ===========================================================================

const VALID_GYM_ID = '12345678-1234-4abc-8def-1234567890ab'

describe('DisplayGymPage (/display/gym/$gymId)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParams.current = { gymId: VALID_GYM_ID }
    mockSearch.current = { clock: '24h' }
    mockResolveConfig.mockResolvedValue({
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'pk-test',
    })
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { id: VALID_GYM_ID, name: 'Garage' }, error: null }),
        }),
      }),
    })
  })

  it('calls subscribeToDisplay with the gymId from the route param', async () => {
    const Component = capturedGymComponent.current
    if (!Component) throw new Error('DisplayGymPage component was not captured')

    render(<Component />)

    await waitFor(() => {
      expect(mockSubscribeToDisplay).toHaveBeenCalledTimes(1)
    })

    const callArg = mockSubscribeToDisplay.mock.calls[0][0] as {
      gymId: string
      handlers: unknown
    }
    expect(callArg.gymId).toBe(VALID_GYM_ID)
    expect(callArg.handlers).toBeDefined()

    // Guard: the subscriber was called with a gymId that round-trips through
    // the channel-name helper.
    const expectedChannelName = getGymChannelName(VALID_GYM_ID)
    expect(expectedChannelName).toBe(`display:gym:${VALID_GYM_ID}`)
  })

  it('creates the Supabase client for the display route', async () => {
    const Component = capturedGymComponent.current
    if (!Component) throw new Error('DisplayGymPage component was not captured')

    render(<Component />)

    await waitFor(() => {
      expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'pk-test')
    })
  })

  it('renders an invalid-gym error message when the param is not a UUID', () => {
    mockParams.current = { gymId: 'not-a-uuid' }

    const Component = capturedGymComponent.current
    if (!Component) throw new Error('DisplayGymPage component was not captured')

    const { getByText } = render(<Component />)

    expect(getByText(/INVALID GYM ID/i)).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockSubscribeToDisplay).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Tests -- /display/ (legacy, not-configured page)
// ===========================================================================

describe('DisplayNotConfiguredPage (/display/)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not create a Supabase client', () => {
    const Component = capturedIndexComponent.current
    if (!Component) throw new Error('DisplayNotConfiguredPage component was not captured')

    render(<Component />)

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockResolveConfig).not.toHaveBeenCalled()
  })

  it('does not open a subscriber channel', () => {
    const Component = capturedIndexComponent.current
    if (!Component) throw new Error('DisplayNotConfiguredPage component was not captured')

    render(<Component />)

    expect(mockInitDisplaySubscriber).not.toHaveBeenCalled()
    expect(mockSubscribeToDisplay).not.toHaveBeenCalled()
  })

  it('renders the not-configured message', () => {
    const Component = capturedIndexComponent.current
    if (!Component) throw new Error('DisplayNotConfiguredPage component was not captured')

    const { getByText } = render(<Component />)

    expect(getByText(/DISPLAY NOT CONFIGURED/i)).toBeTruthy()
  })
})
