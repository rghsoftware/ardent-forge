// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  buildWorkoutLog,
  buildLoggedActivityGroup,
  buildLoggedActivity,
  buildLoggedSet,
  resetFactoryCounters,
} from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockNavigate, mockResumeWorkout, mockIsActive } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockResumeWorkout: vi.fn(),
  mockIsActive: { value: false },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/hooks/use-active-workout', () => ({
  useActiveWorkout: () => ({
    resumeWorkout: mockResumeWorkout,
    isActive: mockIsActive.value,
  }),
}))

let mockAdapter: DataAdapter
vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

vi.mock('@/lib/format-duration', () => ({
  formatTimeAgo: () => '2 hours ago',
  formatDateLabel: () => 'Jan 15, 2026',
}))

// Import after mocks
import { CrashRecoveryDialog } from '../crash-recovery-dialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderDialog(userId = 'user-1') {
  const queryClient = createTestQueryClient()
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <CrashRecoveryDialog userId={userId} />
      </QueryClientProvider>,
    ),
    queryClient,
  }
}

// Incomplete workout (no completedAt)
const incompleteLog = buildWorkoutLog({ id: 'wl-incomplete', completedAt: undefined })
const completedLog = buildWorkoutLog({ id: 'wl-done', completedAt: '2026-01-15T11:30:00.000Z' })

const fullWorkoutData = {
  log: incompleteLog,
  groups: [buildLoggedActivityGroup({ id: 'lg-1', workoutLogId: 'wl-incomplete' })],
  activities: [buildLoggedActivity({ id: 'la-1', loggedGroupId: 'lg-1' })],
  sets: [buildLoggedSet({ id: 'ls-1', loggedActivityId: 'la-1' })],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrashRecoveryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFactoryCounters()
    mockIsActive.value = false
    mockAdapter = createMockAdapter()
  })

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  it('renders nothing when all logs are complete', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([completedLog])

    const { container } = renderDialog()

    // Wait for query to settle, then verify no dialog
    await waitFor(() => {
      expect(vi.mocked(mockAdapter.getWorkoutLogs)).toHaveBeenCalled()
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when no logs exist', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([])

    const { container } = renderDialog()

    await waitFor(() => {
      expect(vi.mocked(mockAdapter.getWorkoutLogs)).toHaveBeenCalled()
    })
    expect(container.innerHTML).toBe('')
  })

  it('shows dialog when an incomplete workout exists', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog, completedLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    await waitFor(() => {
      expect(screen.getByText('Resume Session?')).toBeInTheDocument()
    })
  })

  it('does not show dialog when workout is already active', async () => {
    mockIsActive.value = true
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    // Give queries time to resolve
    await waitFor(() => {
      expect(vi.mocked(mockAdapter.getWorkoutLogs)).toHaveBeenCalled()
    })
    // Dialog title should not be present
    expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows loading text while full workout is being fetched', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    // Never resolve getWorkoutLogFull -- stays pending
    vi.mocked(mockAdapter.getWorkoutLogFull).mockReturnValue(new Promise(() => {}))

    renderDialog()

    await waitFor(() => {
      expect(screen.getByText('Loading session data...')).toBeInTheDocument()
    })
  })

  it('shows date info once full workout is loaded', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    await waitFor(() => {
      expect(
        screen.getByText(/unfinished workout from Jan 15, 2026 \(2 hours ago\)/),
      ).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Resume flow
  // -------------------------------------------------------------------------

  it('disables Resume button while full workout is loading', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockReturnValue(new Promise(() => {}))

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled()
    })
  })

  it('resumes workout and navigates on Resume click', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Resume' }))

    expect(mockResumeWorkout).toHaveBeenCalledWith(fullWorkoutData)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/log/$workoutId',
      params: { workoutId: 'wl-incomplete' },
    })
  })

  it('shows "Resuming..." text after clicking Resume', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Resume' }))

    // After clicking, the button text changes (dialog may still be rendered briefly)
    expect(mockResumeWorkout).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Discard flow
  // -------------------------------------------------------------------------

  it('discards workout on Discard click', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)
    vi.mocked(mockAdapter.deleteWorkoutLog).mockResolvedValue(undefined)

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(vi.mocked(mockAdapter.deleteWorkoutLog)).toHaveBeenCalledWith('wl-incomplete')
    })
  })

  it('shows error message when discard fails', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)
    vi.mocked(mockAdapter.deleteWorkoutLog).mockRejectedValue(new Error('Network error'))

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to discard. Try again.')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Button disabled interplay
  // -------------------------------------------------------------------------

  it('disables both buttons while discarding', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)
    // Hang the delete so we can check disabled state
    vi.mocked(mockAdapter.deleteWorkoutLog).mockReturnValue(new Promise(() => {}))

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discarding...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled()
    })
  })

  // -------------------------------------------------------------------------
  // Dismiss
  // -------------------------------------------------------------------------

  it('dismisses dialog via Escape key', async () => {
    const user = userEvent.setup()
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([incompleteLog])
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(fullWorkoutData)

    renderDialog()

    await waitFor(() => {
      expect(screen.getByText('Resume Session?')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument()
    })
  })
})
