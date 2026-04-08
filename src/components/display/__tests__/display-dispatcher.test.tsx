// @vitest-environment happy-dom
//
// P15-040: This file tests the wiring of `useAuth` / `useGyms` →
// `computeDispatcherState` → render. The PURE state-machine logic (all
// precedence rules between loading / unauthenticated / error / zero /
// single / many) lives in `dispatcher-state.test.ts` and MUST NOT be
// duplicated here. Add render-wiring cases only:
//   - "this input shape produces THIS rendered testId"
//   - "clicking retry invokes the refetch function"
// If the assertion is about which `kind` the state machine returns, it
// belongs in `dispatcher-state.test.ts`.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Hoisted test doubles
// ---------------------------------------------------------------------------

const { mockUseAuth, mockUseGyms, navigateProps } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseGyms: vi.fn(),
  navigateProps: { current: undefined as Record<string, unknown> | undefined },
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  Navigate: (props: Record<string, unknown>) => {
    navigateProps.current = props
    return <div data-testid="navigate-spy" data-to={String(props.to)} />
  },
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/hooks/use-gyms', () => ({
  useGyms: (...args: unknown[]) => mockUseGyms(...args),
}))

// Avoid mounting the heavy sub-views — replace them with lightweight stubs.
vi.mock('../display-setup-panel', () => ({
  DisplaySetupPanel: ({ userId }: { userId: string }) => (
    <div data-testid="display-setup-panel-stub" data-user-id={userId} />
  ),
}))

vi.mock('../display-chooser', () => ({
  DisplayChooser: ({ gyms, userId }: { gyms: Gym[]; userId: string }) => (
    <div data-testid="display-chooser-stub" data-gym-count={gyms.length} data-user-id={userId} />
  ),
}))

import { DisplayDispatcher } from '../display-dispatcher'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-default',
    name: 'Gym',
    ownerUserId: 'user-1',
    isDefault: false,
    createdAt: '2026-04-07T00:00:00Z',
    updatedAt: '2026-04-07T00:00:00Z',
    ...overrides,
  }
}

function authState(overrides: { loading?: boolean; user?: { id: string } | null } = {}) {
  return {
    loading: false,
    user: { id: 'user-1' },
    session: null,
    isGuest: false,
    ...overrides,
  }
}

function gymsState(
  overrides: {
    isLoading?: boolean
    isError?: boolean
    data?: Gym[] | undefined
    refetch?: () => void
  } = {},
) {
  return {
    isLoading: false,
    isError: false,
    data: [] as Gym[],
    refetch: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  navigateProps.current = undefined
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DisplayDispatcher', () => {
  it('renders LegacyNotConfiguredPage when unauthenticated', () => {
    mockUseAuth.mockReturnValue(authState({ user: null }))
    mockUseGyms.mockReturnValue(gymsState({ data: undefined }))

    render(<DisplayDispatcher />)

    expect(screen.getByText('DISPLAY NOT CONFIGURED')).toBeInTheDocument()
    expect(screen.getByText(/Ask the gym owner for the display URL/)).toBeInTheDocument()
    expect(screen.getByText(/Expected format: \/display\/gym\/<gym-id>/)).toBeInTheDocument()
  })

  it('renders loading state while auth is resolving', () => {
    mockUseAuth.mockReturnValue(authState({ loading: true, user: null }))
    mockUseGyms.mockReturnValue(gymsState({ data: undefined }))

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('display-dispatcher-loading')).toBeInTheDocument()
    // Setup UI must not leak through during loading
    expect(screen.queryByTestId('display-setup-panel-stub')).not.toBeInTheDocument()
    expect(screen.queryByTestId('display-chooser-stub')).not.toBeInTheDocument()
  })

  it('renders loading state while gyms are loading', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ isLoading: true, data: undefined }))

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('display-dispatcher-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('display-setup-panel-stub')).not.toBeInTheDocument()
  })

  it('renders error state with Retry that calls refetch', async () => {
    const refetch = vi.fn()
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ isError: true, data: undefined, refetch }))

    const user = userEvent.setup()
    render(<DisplayDispatcher />)

    expect(screen.getByTestId('display-dispatcher-error')).toBeInTheDocument()
    await user.click(screen.getByTestId('display-dispatcher-retry'))
    expect(refetch).toHaveBeenCalled()
  })

  it('renders DisplaySetupPanel when authenticated user has zero gyms', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: [] }))

    render(<DisplayDispatcher />)

    const stub = screen.getByTestId('display-setup-panel-stub')
    expect(stub).toBeInTheDocument()
    expect(stub).toHaveAttribute('data-user-id', 'user-1')
  })

  it('renders Navigate replace when exactly one gym', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: [makeGym({ id: 'gym-solo' })] }))

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('navigate-spy')).toBeInTheDocument()
    expect(navigateProps.current).toEqual(
      expect.objectContaining({
        to: '/display/gym/$gymId',
        params: { gymId: 'gym-solo' },
        replace: true,
      }),
    )
  })

  it('renders DisplayChooser with the full gym list when 2+ gyms', () => {
    const gyms = [makeGym({ id: 'a' }), makeGym({ id: 'b' }), makeGym({ id: 'c' })]
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: gyms }))

    render(<DisplayDispatcher />)

    const stub = screen.getByTestId('display-chooser-stub')
    expect(stub).toBeInTheDocument()
    expect(stub).toHaveAttribute('data-gym-count', '3')
    expect(stub).toHaveAttribute('data-user-id', 'user-1')
  })
})
