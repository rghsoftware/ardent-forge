// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// S015-T: integration tests for /display DisplayDispatcher (F019)
//
// P15-042: File renamed from -dispatcher-route.test.tsx -- it does NOT
// test the TanStack Router route shell (which is a 5-line module covered
// by -gym-route.test.tsx). It mounts the DisplayDispatcher component
// directly, driving auth and gym query state from mocked hooks, so it
// exercises the integration seam between the dispatcher, sub-views, and
// shared mutations without the real RouterProvider.
// ---------------------------------------------------------------------------

const {
  mockUseAuth,
  mockUseGyms,
  mockUseCreateGym,
  mockUseUserProfile,
  mockUseQrScanner,
  navigateProps,
  navigateFn,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseGyms: vi.fn(),
  mockUseCreateGym: vi.fn(),
  mockUseUserProfile: vi.fn(),
  mockUseQrScanner: vi.fn(),
  navigateProps: { current: undefined as Record<string, unknown> | undefined },
  navigateFn: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Navigate: (props: Record<string, unknown>) => {
    navigateProps.current = props
    return <div data-testid="navigate-spy" data-to={String(props.to)} />
  },
  useNavigate: () => navigateFn,
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string
    params: Record<string, string>
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={to.replace('$gymId', params.gymId)} data-testid={`link-${params.gymId}`} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/hooks/use-gyms', () => ({
  useGyms: (...args: unknown[]) => mockUseGyms(...args),
  useCreateGym: () => mockUseCreateGym(),
}))

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}))

vi.mock('@/hooks/use-qr-scanner', () => ({
  useQrScanner: () => mockUseQrScanner(),
}))

import { DisplayDispatcher } from '@/components/display/display-dispatcher'

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

interface MutationStub {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
  isError: boolean
  error: unknown
}
function makeMutation(overrides: Partial<MutationStub> = {}): MutationStub {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  navigateProps.current = undefined
  mockUseUserProfile.mockReturnValue({ data: { displayName: 'Alice' } })
  mockUseQrScanner.mockReturnValue(null)
  mockUseCreateGym.mockReturnValue(makeMutation())
})

// ---------------------------------------------------------------------------
// TA5: single-gym → Navigate replace
// ---------------------------------------------------------------------------

describe('TA5: single-gym dispatcher redirect', () => {
  it('renders Navigate replace to the user only gym', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: [makeGym({ id: 'gym-A' })] }))

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('navigate-spy')).toBeInTheDocument()
    expect(navigateProps.current).toEqual(
      expect.objectContaining({
        to: '/display/gym/$gymId',
        params: { gymId: 'gym-A' },
        replace: true,
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// TA6: 2+ gyms → chooser
// ---------------------------------------------------------------------------

describe('TA6: chooser for 2+ gyms', () => {
  it('renders one Link row per membership', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(
      gymsState({
        data: [makeGym({ id: 'A', name: 'Alpha' }), makeGym({ id: 'B', name: 'Bravo' })],
      }),
    )

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('link-A')).toBeInTheDocument()
    expect(screen.getByTestId('link-B')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TA8: 0 gyms → setup panel (Panel A + Panel B)
// ---------------------------------------------------------------------------

describe('TA8: zero-gym setup panel', () => {
  it('renders both Panel A and Panel B', () => {
    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: [] }))

    render(<DisplayDispatcher />)

    expect(screen.getByTestId('display-setup-panel-a-input')).toBeInTheDocument()
    expect(screen.getByTestId('display-setup-panel-b-submit')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TA13: 0 gyms → Personal display creates and navigates
// ---------------------------------------------------------------------------

describe('TA13: personal display creation flow', () => {
  it('clicks Create personal display, calls createGym, and navigates with replace', async () => {
    const user = userEvent.setup()
    const mutation = makeMutation()
    mockUseCreateGym.mockReturnValue(mutation)

    mockUseAuth.mockReturnValue(authState())
    mockUseGyms.mockReturnValue(gymsState({ data: [] }))

    render(<DisplayDispatcher />)

    await user.click(screen.getByTestId('display-setup-panel-b-submit'))

    expect(mutation.mutate).toHaveBeenCalledWith(
      { name: "Alice's Training" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )

    // Simulate the server returning the new gym.
    const { onSuccess } = mutation.mutate.mock.calls[0]![1] as {
      onSuccess: (gym: Gym) => void
    }
    onSuccess(makeGym({ id: 'new-gym', name: "Alice's Training" }))

    await waitFor(() => {
      expect(navigateFn).toHaveBeenCalledWith({
        to: '/display/gym/$gymId',
        params: { gymId: 'new-gym' },
        replace: true,
      })
    })
  })
})

// ---------------------------------------------------------------------------
// TA17: unauthenticated → Legacy "DISPLAY NOT CONFIGURED" page
// ---------------------------------------------------------------------------

describe('TA17: unauthenticated legacy page', () => {
  it('renders the F018-shipped DISPLAY NOT CONFIGURED copy unchanged', () => {
    mockUseAuth.mockReturnValue(authState({ user: null }))
    mockUseGyms.mockReturnValue(gymsState({ data: undefined }))

    render(<DisplayDispatcher />)

    expect(screen.getByText('DISPLAY NOT CONFIGURED')).toBeInTheDocument()
    expect(screen.getByText('Ask the gym owner for the display URL.')).toBeInTheDocument()
    expect(screen.getByText(/Expected format: \/display\/gym\/<gym-id>/)).toBeInTheDocument()
  })
})
