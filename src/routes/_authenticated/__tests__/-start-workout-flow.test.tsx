// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GymPickerChoice } from '@/lib/gym-picker-storage'

// ---------------------------------------------------------------------------
// F018 (S025-T) -- start-workout-flow integration test
//
// Exercises the picker-gated start-workout flow in src/routes/_authenticated/
// index.tsx. The picker is stubbed with a deferred promise so each test case
// can drive the resolution deterministically. The spec-required assertions are:
//
//   (a) user picks a gym -> configureDisplayPublisher({ gymId }) with the
//       right ID; writeLastGymChoice is called; navigate fires
//   (b) user picks Private -> configureDisplayPublisher({ gymId: null });
//       writeLastGymChoice('private')
//   (c) user cancels the picker -> NO workout is created and publisher is
//       not configured
//   (d) workout creation throws after picker resolves -> setStartError is
//       reached (we observe via the visible error message)
//
// The test uses createFileRoute capture + renderWithProviders, same pattern
// as src/routes/__tests__/-connect.test.tsx and
// src/routes/display/__tests__/-gym-route.test.tsx.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockNavigate,
  mockStartWorkout,
  mockStartProgrammedWorkout,
  mockConfigureDisplayPublisher,
  mockWriteLastGymChoice,
  mockOpenGymPicker,
  capturedComponent,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn()
  const mockStartWorkout = vi.fn()
  const mockStartProgrammedWorkout = vi.fn()
  const mockConfigureDisplayPublisher = vi.fn()
  const mockWriteLastGymChoice = vi.fn()
  const mockOpenGymPicker = vi.fn<(args: { userId: string }) => Promise<GymPickerChoice | null>>()
  const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }
  return {
    mockNavigate,
    mockStartWorkout,
    mockStartProgrammedWorkout,
    mockConfigureDisplayPublisher,
    mockWriteLastGymChoice,
    mockOpenGymPicker,
    capturedComponent,
  }
})

// ---------------------------------------------------------------------------
// Module mocks -- register before importing the route module
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => {
  return {
    createFileRoute: () => (config: { component?: React.ComponentType }) => {
      capturedComponent.current = config.component
      return { ...config }
    },
    useNavigate: () => mockNavigate,
  }
})

// Auth stub -- a signed-in user.
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isGuest: false,
    loading: false,
  }),
}))

// Active workout hook stub. startWorkout / startProgrammedWorkout are the
// two functions index.tsx awaits before configuring the publisher.
vi.mock('@/hooks/use-active-workout', () => ({
  useActiveWorkout: () => ({
    startWorkout: mockStartWorkout,
    startProgrammedWorkout: mockStartProgrammedWorkout,
    isStarting: false,
  }),
}))

// Empty recent workouts -- avoid rendering history cards in the harness.
vi.mock('@/hooks/use-workout-logs', () => ({
  useWorkoutLogs: () => ({ data: [], isError: false }),
  useDeleteWorkoutLog: () => ({ mutate: vi.fn(), isPending: false }),
}))

// No active program -- this keeps the Program section from rendering and
// makes the default Start Workout CTA the "Execute Workout" primary button.
vi.mock('@/hooks/use-programs', () => ({
  useActiveProgram: () => ({ data: null, isLoading: false, isError: false }),
  useProgramFull: () => ({ data: null, isLoading: false, isError: false }),
}))

vi.mock('@/hooks/use-event-items', () => ({
  useNextUpcomingEvent: () => ({ data: null, isError: false }),
}))

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboarding: () => ({
    markRouteVisited: vi.fn(),
    resetOnboarding: vi.fn(),
  }),
}))

vi.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: (selector: (s: { firstWorkoutCompleted: boolean }) => unknown) =>
    selector({ firstWorkoutCompleted: false }),
}))

// Gym picker stub. openGymPicker is the hoisted mock above; GymPickerPortal
// renders nothing (the test drives resolution via openGymPicker directly).
vi.mock('@/hooks/use-gym-picker', () => ({
  useGymPicker: () => ({
    openGymPicker: mockOpenGymPicker,
    GymPickerPortal: () => null,
  }),
}))

vi.mock('@/lib/display-realtime', () => ({
  configureDisplayPublisher: mockConfigureDisplayPublisher,
}))

vi.mock('@/lib/gym-picker-storage', () => ({
  writeLastGymChoice: mockWriteLastGymChoice,
}))

// Stubs for all the presentational components in the route -- they don't
// matter to this integration test but TodayPage imports them at the top.
vi.mock('@/components/workout/crash-recovery-dialog', () => ({
  CrashRecoveryDialog: () => null,
}))
vi.mock('@/components/today/program-session-card', () => ({
  ProgramSessionCard: ({ onStartSession }: { onStartSession?: () => void }) => (
    <button type="button" data-testid="start-programmed-session" onClick={onStartSession}>
      Start Programmed
    </button>
  ),
}))
vi.mock('@/components/program/time-travel-sheet', () => ({
  TimeTravelSheet: () => null,
}))
vi.mock('@/components/event-builder/event-countdown-badge', () => ({
  EventCountdownBadge: () => null,
}))
vi.mock('@/components/shared/ghost-session-preview', () => ({
  GhostSessionPreview: () => null,
}))
vi.mock('@/components/onboarding/welcome-card', () => ({
  WelcomeCard: () => null,
}))
vi.mock('@/components/onboarding/onboarding-hint', () => ({
  OnboardingHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Import the module under test AFTER all mocks are registered. This
// triggers createFileRoute and captures the component.
import '../index'

// ---------------------------------------------------------------------------
// Helper -- a controllable deferred used in the "cancel" test case so we can
// assert that nothing else happens while the picker is open.
// ---------------------------------------------------------------------------

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// ---------------------------------------------------------------------------
// Common render -- uses renderWithProviders only if the component needs a
// QueryClient. TodayPage's query hooks are all mocked so a plain render is
// sufficient here, but we still wrap a minimal provider in case any child
// accidentally touches useQuery.
// ---------------------------------------------------------------------------

function renderTodayPage() {
  const Component = capturedComponent.current
  if (!Component) throw new Error('TodayPage component was not captured from createFileRoute')
  return render(<Component />)
}

// ===========================================================================
// Tests
// ===========================================================================

describe('TodayPage start-workout flow (F018)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartWorkout.mockResolvedValue({ id: 'workout-abc' })
    mockStartProgrammedWorkout.mockResolvedValue({ id: 'workout-abc' })
  })

  // -------------------------------------------------------------------------
  // (a) User picks gym A
  // -------------------------------------------------------------------------

  it('picks a gym: configures publisher with gymId, persists choice, navigates to log', async () => {
    mockOpenGymPicker.mockResolvedValue('gym-a')
    const user = userEvent.setup()

    renderTodayPage()

    await user.click(screen.getByRole('button', { name: /execute workout/i }))

    await waitFor(() => {
      expect(mockOpenGymPicker).toHaveBeenCalledWith({ userId: 'user-1' })
    })

    await waitFor(() => {
      expect(mockStartWorkout).toHaveBeenCalledWith('user-1')
    })

    expect(mockConfigureDisplayPublisher).toHaveBeenCalledTimes(1)
    expect(mockConfigureDisplayPublisher).toHaveBeenCalledWith({
      gymId: 'gym-a',
      intent: 'broadcasting',
    })

    expect(mockWriteLastGymChoice).toHaveBeenCalledTimes(1)
    expect(mockWriteLastGymChoice).toHaveBeenCalledWith('gym-a')

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/log/$workoutId',
      params: { workoutId: 'workout-abc' },
    })
  })

  // -------------------------------------------------------------------------
  // (b) User picks Private
  // -------------------------------------------------------------------------

  it('picks Private: configures publisher with intent=private and persists "private"', async () => {
    mockOpenGymPicker.mockResolvedValue('private')
    const user = userEvent.setup()

    renderTodayPage()

    await user.click(screen.getByRole('button', { name: /execute workout/i }))

    await waitFor(() => {
      expect(mockStartWorkout).toHaveBeenCalledWith('user-1')
    })

    expect(mockConfigureDisplayPublisher).toHaveBeenCalledTimes(1)
    expect(mockConfigureDisplayPublisher).toHaveBeenCalledWith({
      gymId: null,
      intent: 'private',
    })

    expect(mockWriteLastGymChoice).toHaveBeenCalledTimes(1)
    expect(mockWriteLastGymChoice).toHaveBeenCalledWith('private')

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/log/$workoutId',
      params: { workoutId: 'workout-abc' },
    })
  })

  // -------------------------------------------------------------------------
  // (c) User cancels the picker
  // -------------------------------------------------------------------------

  it('cancels the picker: no workout is created, publisher is not configured, navigate not called', async () => {
    // Controllable deferred so we can assert nothing happens while the
    // picker is open, then resolve with null to simulate cancel.
    const deferredChoice = deferred<GymPickerChoice | null>()
    mockOpenGymPicker.mockReturnValue(deferredChoice.promise)
    const user = userEvent.setup()

    renderTodayPage()

    await user.click(screen.getByRole('button', { name: /execute workout/i }))

    await waitFor(() => {
      expect(mockOpenGymPicker).toHaveBeenCalledWith({ userId: 'user-1' })
    })

    // Picker is open but no decision yet -- the handler must be suspended.
    expect(mockStartWorkout).not.toHaveBeenCalled()
    expect(mockConfigureDisplayPublisher).not.toHaveBeenCalled()
    expect(mockWriteLastGymChoice).not.toHaveBeenCalled()

    // User cancels the picker.
    await act(async () => {
      deferredChoice.resolve(null)
    })

    // Still nothing should happen -- the handler returns early on null.
    expect(mockStartWorkout).not.toHaveBeenCalled()
    expect(mockConfigureDisplayPublisher).not.toHaveBeenCalled()
    expect(mockWriteLastGymChoice).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // (d) Error path: workout creation fails after the picker resolves
  // -------------------------------------------------------------------------

  it('surfaces a friendly error message when workout creation fails after picker resolves', async () => {
    mockOpenGymPicker.mockResolvedValue('gym-a')
    mockStartWorkout.mockRejectedValue(new Error('boom'))
    // Silence the expected console.error inside the handler catch block.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    renderTodayPage()

    await user.click(screen.getByRole('button', { name: /execute workout/i }))

    // The visible error message is what the user actually sees.
    await waitFor(() => {
      expect(
        screen.getByText(/failed to start workout\. check your connection/i),
      ).toBeInTheDocument()
    })

    // The publisher must NOT have been configured -- the error happened
    // before we reached configureDisplayPublisher in the try block.
    expect(mockConfigureDisplayPublisher).not.toHaveBeenCalled()
    expect(mockWriteLastGymChoice).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()

    // The handler logged the error with the required module-name prefix.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[today-page] handleStartWorkout:'),
      expect.any(Error),
    )

    errorSpy.mockRestore()
  })
})
