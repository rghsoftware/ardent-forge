// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render-helpers'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Mocks
//
// We mock useGyms so we can drive the membership list per-test, and we mock
// getActiveGymId so we can drive the publisher's active gym without having
// to initialize and configure the real module state.
// ---------------------------------------------------------------------------

const mockUseGyms = vi.fn()
vi.mock('@/hooks/use-gyms', () => ({
  useGyms: (...args: unknown[]) => mockUseGyms(...args),
}))

const mockGetActiveGymId = vi.fn()
vi.mock('@/lib/display-publisher', () => ({
  getActiveGymId: () => mockGetActiveGymId(),
}))

// Import after mocks are registered
import { ActiveWorkoutGymLabel } from '../active-workout-gym-label'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-1',
    name: 'Home Gym',
    ownerUserId: 'user-1',
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    ...overrides,
  }
}

interface UseGymsState {
  data?: Gym[]
  isLoading?: boolean
  isError?: boolean
}

function stubGyms({ data, isLoading = false, isError = false }: UseGymsState) {
  mockUseGyms.mockReturnValue({
    data,
    isLoading,
    isError,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActiveWorkoutGymLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // (a) 1-gym user -- renders nothing (M23)
  // -------------------------------------------------------------------------
  it('renders nothing when the user has only one gym membership', () => {
    stubGyms({ data: [makeGym({ id: 'gym-only', name: 'Home Garage' })] })
    mockGetActiveGymId.mockReturnValue('gym-only')

    const { container } = renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('active-workout-gym-label')).not.toBeInTheDocument()
  })

  it('renders nothing when the user has zero gym memberships', () => {
    stubGyms({ data: [] })
    mockGetActiveGymId.mockReturnValue(null)

    const { container } = renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing while the gyms query is loading (data is undefined)', () => {
    stubGyms({ isLoading: true })
    mockGetActiveGymId.mockReturnValue('gym-a')

    const { container } = renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(container).toBeEmptyDOMElement()
  })

  // -------------------------------------------------------------------------
  // (b) 2-gym user with active gym A -- renders OPERATOR · <NAME>
  // -------------------------------------------------------------------------
  it('renders OPERATOR · GYM NAME for a multi-gym user when the active gym resolves', () => {
    stubGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'Home Garage' }),
        makeGym({ id: 'gym-b', name: 'Crossfit Downtown' }),
      ],
    })
    mockGetActiveGymId.mockReturnValue('gym-a')

    renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    const label = screen.getByTestId('active-workout-gym-label')
    expect(label).toBeInTheDocument()
    expect(label).toHaveTextContent('OPERATOR · HOME GARAGE')
  })

  it('uppercases the gym name even if stored in mixed case', () => {
    stubGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'gRiTty BaSemeNt' }),
        makeGym({ id: 'gym-b', name: 'Home Gym' }),
      ],
    })
    mockGetActiveGymId.mockReturnValue('gym-a')

    renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(screen.getByTestId('active-workout-gym-label')).toHaveTextContent(
      'OPERATOR · GRITTY BASEMENT',
    )
  })

  // -------------------------------------------------------------------------
  // (c) Gym name lookup miss -- renders nothing (defensive)
  // -------------------------------------------------------------------------
  it('renders nothing when the active gym id is not in the user memberships', () => {
    stubGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'Home Garage' }),
        makeGym({ id: 'gym-b', name: 'Crossfit Downtown' }),
      ],
    })
    // Publisher thinks the active gym is one the user has since left.
    mockGetActiveGymId.mockReturnValue('gym-ghost')

    const { container } = renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('active-workout-gym-label')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // (d) getActiveGymId() === null -- Private workout, renders nothing
  // -------------------------------------------------------------------------
  it('renders nothing when getActiveGymId returns null (Private workout)', () => {
    stubGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'Home Garage' }),
        makeGym({ id: 'gym-b', name: 'Crossfit Downtown' }),
      ],
    })
    mockGetActiveGymId.mockReturnValue(null)

    const { container } = renderWithProviders(<ActiveWorkoutGymLabel userId="user-1" />)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('active-workout-gym-label')).not.toBeInTheDocument()
  })
})
