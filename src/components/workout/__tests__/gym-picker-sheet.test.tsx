// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Mock the useGyms hook so we can drive loading / error / data states
// directly from each test. We also mock the gym-picker-storage module so the
// sticky default is controllable without reaching into localStorage.
// ---------------------------------------------------------------------------

const mockUseGyms = vi.fn()
vi.mock('@/hooks/use-gyms', () => ({
  useGyms: (...args: unknown[]) => mockUseGyms(...args),
}))

const mockReadLastGymChoice = vi.fn()
vi.mock('@/lib/gym-picker-storage', () => ({
  readLastGymChoice: () => mockReadLastGymChoice(),
}))

// Import after mocks are registered
import { GymPickerSheet } from '../gym-picker-sheet'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-1',
    name: 'Home Gym',
    ownerUserId: 'user-1',
    isDefault: false,
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

describe('GymPickerSheet', () => {
  const onResolve = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockReadLastGymChoice.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Loading state (h)
  // -------------------------------------------------------------------------

  it('shows a skeleton while gyms are loading', () => {
    stubGyms({ isLoading: true })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-skeleton')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error state (i) -- per .claude/rules/error-handling.md
  // -------------------------------------------------------------------------

  it('renders an error message when the gyms query fails', () => {
    stubGyms({ isError: true })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-error')).toBeInTheDocument()
    expect(screen.getByText('Failed to load gyms')).toBeInTheDocument()
    expect(screen.queryByTestId('gym-picker-row-private')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // (a) Zero-gym user -- only Private row + hint text
  // -------------------------------------------------------------------------

  it('renders only the Private row and a hint for zero-gym users', () => {
    stubGyms({ data: [] })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-row-private')).toBeInTheDocument()
    expect(
      screen.getByText(/Join a gym from settings to publish your workouts to a TV/i),
    ).toBeInTheDocument()
    // No gym rows are rendered
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('preselects Private for a zero-gym user', () => {
    stubGyms({ data: [] })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    const privateRow = screen.getByTestId('gym-picker-row-private')
    expect(privateRow).toHaveAttribute('aria-pressed', 'true')
  })

  // -------------------------------------------------------------------------
  // (b) Single-gym user -- gym + Private; sticky default = gym
  // -------------------------------------------------------------------------

  it('preselects the gym row when sticky default is the user single gym', () => {
    const gym = makeGym({ id: 'gym-home', name: 'Home Gym' })
    stubGyms({ data: [gym] })
    mockReadLastGymChoice.mockReturnValue('gym-home')

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    const gymRow = screen.getByTestId('gym-picker-row-gym-home')
    const privateRow = screen.getByTestId('gym-picker-row-private')

    expect(gymRow).toHaveAttribute('aria-pressed', 'true')
    expect(privateRow).toHaveAttribute('aria-pressed', 'false')
  })

  it('single-gym user can still tap Private to switch', async () => {
    const user = userEvent.setup()
    const gym = makeGym({ id: 'gym-home', name: 'Home Gym' })
    stubGyms({ data: [gym] })
    mockReadLastGymChoice.mockReturnValue('gym-home')

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    await user.click(screen.getByTestId('gym-picker-row-private'))
    expect(onResolve).toHaveBeenCalledWith('private')
  })

  // -------------------------------------------------------------------------
  // (c) Multi-gym user -- all gyms + Private; sticky default highlighted
  // -------------------------------------------------------------------------

  it('renders all gyms plus Private for a multi-gym user', () => {
    stubGyms({
      data: [
        makeGym({ id: 'gym-a', name: 'Garage' }),
        makeGym({ id: 'gym-b', name: 'Home Gym' }),
        makeGym({ id: 'gym-c', name: 'Commercial' }),
      ],
    })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-row-gym-a')).toBeInTheDocument()
    expect(screen.getByTestId('gym-picker-row-gym-b')).toBeInTheDocument()
    expect(screen.getByTestId('gym-picker-row-gym-c')).toBeInTheDocument()
    expect(screen.getByTestId('gym-picker-row-private')).toBeInTheDocument()
  })

  it('highlights the sticky default gym for a multi-gym user', () => {
    stubGyms({
      data: [makeGym({ id: 'gym-a', name: 'Garage' }), makeGym({ id: 'gym-b', name: 'Home Gym' })],
    })
    mockReadLastGymChoice.mockReturnValue('gym-b')

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-row-gym-a')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('gym-picker-row-gym-b')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('gym-picker-row-private')).toHaveAttribute('aria-pressed', 'false')
  })

  // -------------------------------------------------------------------------
  // (d) Sticky default invalid -- falls back to Private
  // -------------------------------------------------------------------------

  it('falls back to Private when the stored gym is no longer in the user memberships', () => {
    stubGyms({
      data: [makeGym({ id: 'gym-a', name: 'Garage' }), makeGym({ id: 'gym-b', name: 'Home Gym' })],
    })
    // Stored choice points to a gym the user has since left
    mockReadLastGymChoice.mockReturnValue('gym-ghost')

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    expect(screen.getByTestId('gym-picker-row-private')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('gym-picker-row-gym-a')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('gym-picker-row-gym-b')).toHaveAttribute('aria-pressed', 'false')
  })

  // -------------------------------------------------------------------------
  // (e) Tapping a gym row calls onResolve with the gym id
  // -------------------------------------------------------------------------

  it('calls onResolve with the gym id when a gym row is tapped', async () => {
    const user = userEvent.setup()
    stubGyms({
      data: [makeGym({ id: 'gym-a', name: 'Garage' }), makeGym({ id: 'gym-b', name: 'Home Gym' })],
    })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    await user.click(screen.getByTestId('gym-picker-row-gym-a'))
    expect(onResolve).toHaveBeenCalledWith('gym-a')
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // (f) Tapping Private row calls onResolve('private')
  // -------------------------------------------------------------------------

  it('calls onResolve with "private" when the Private row is tapped', async () => {
    const user = userEvent.setup()
    stubGyms({ data: [makeGym({ id: 'gym-a', name: 'Garage' })] })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    await user.click(screen.getByTestId('gym-picker-row-private'))
    expect(onResolve).toHaveBeenCalledWith('private')
    expect(onResolve).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // (g) Escape key and outside click fire onCancel
  // -------------------------------------------------------------------------

  it('calls onCancel when the user presses Escape', async () => {
    const user = userEvent.setup()
    stubGyms({ data: [makeGym({ id: 'gym-a', name: 'Garage' })] })

    renderWithProviders(
      <GymPickerSheet open userId="user-1" onResolve={onResolve} onCancel={onCancel} />,
    )

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
    expect(onResolve).not.toHaveBeenCalled()
  })
})
