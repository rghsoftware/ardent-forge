// @vitest-environment happy-dom
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from '@/domain/types'
import type { LoggedActivityGroupWithActivities } from '@/stores/active-workout-store'

// ---------------------------------------------------------------------------
// Captured prop containers -- initialized via vi.hoisted so they exist before
// vi.mock factories execute.
// ---------------------------------------------------------------------------
const { capturedBlocks, capturedBar } = vi.hoisted(() => ({
  capturedBlocks: {} as Record<string, { onPendingDirty?: () => void; onSkipExercise?: () => void }>,
  capturedBar: {} as { onFinish?: () => void; onDiscard?: () => void },
}))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/workout/workout-header', () => ({
  WorkoutHeader: () => <div data-testid="workout-header" />,
}))

vi.mock('@/components/workout/workout-paused-bar', () => ({
  WorkoutPausedBar: (props: any) => {
    capturedBar.onFinish = props.onFinish
    capturedBar.onDiscard = props.onDiscard
    return <div data-testid="workout-paused-bar" />
  },
}))

vi.mock('@/components/workout/error-banner', () => ({
  ErrorBanner: (props: any) => <div data-testid="error-banner">{props.message}</div>,
}))

vi.mock('@/components/workout/workout-header-menu', () => ({
  WorkoutHeaderMenu: () => null,
}))

vi.mock('@/components/workout/exercise-block', () => ({
  ExerciseBlock: (props: any) => {
    capturedBlocks[props.loggedActivityId] = props
    return <div data-testid={`exercise-block-${props.loggedActivityId}`} />
  },
}))

vi.mock('@/components/workout/program-context-banner', () => ({
  ProgramContextBanner: () => null,
}))

vi.mock('@/components/workout/rest-view', () => ({
  RestView: () => null,
}))

vi.mock('@/components/workout/rest-timer-banner', () => ({
  RestTimerBanner: () => null,
}))

vi.mock('@/components/workout/undo-banner', () => ({
  UndoBanner: () => null,
}))

vi.mock('@/components/workout/add-exercise-sheet', () => ({
  AddExerciseSheet: () => null,
}))

vi.mock('@/components/workout/cardio-panel', () => ({
  CardioPanel: () => null,
}))

vi.mock('@/components/workout/ruck-panel', () => ({
  RuckPanel: () => null,
}))

vi.mock('@/components/workout/circuit-panel', () => ({
  CircuitPanel: () => null,
}))

vi.mock('@/components/onboarding/onboarding-hint', () => ({
  OnboardingHint: () => null,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/lib/workout-utils', () => ({
  getExerciseModality: () => 'strength',
  DEFAULT_CIRCUIT_REPS: 10,
}))

// Import component after mocks are set up
import { StrengthWorkoutView } from '../strength-workout-view'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroup(activityId = 'act-1'): LoggedActivityGroupWithActivities {
  return {
    id: 'group-1',
    workoutLogId: 'wl-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    activities: [
      {
        id: activityId,
        loggedGroupId: 'group-1',
        exerciseId: 'ex-1',
        ordinal: 1,
        sets: [],
      },
    ],
  }
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    workoutLog: { id: 'wl-1', userId: 'user-1' },
    loggedGroups: [makeGroup()],
    elapsedSeconds: 0,
    isPauseSupported: false,
    isPaused: false,
    handlePause: vi.fn(),
    handleResume: vi.fn(),
    handleFinish: vi.fn().mockResolvedValue(undefined),
    handleDiscard: vi.fn().mockResolvedValue(undefined),
    handleAddExercise: vi.fn().mockResolvedValue(undefined),
    handleConfirmSet: vi.fn(),
    handleUndoSet: vi.fn().mockResolvedValue(undefined),
    handleUnconfirmSet: vi.fn().mockResolvedValue(undefined),
    handleMarkDone: vi.fn(),
    handleExpandDone: vi.fn(),
    isBroadcasting: false,
    publishFocus: vi.fn(),
    publishUnfocus: vi.fn(),
    isFinishing: false,
    isDiscarding: false,
    isConfirmingSet: false,
    isProgrammedWorkout: false,
    firstWorkoutCompleted: true,
    confirmedSetCount: 1,
    activeFocusId: null,
    allActivitiesDone: false,
    skippedActivityIds: new Set<string>(),
    expandedDoneActivityIds: new Set<string>(),
    exerciseMap: { 'ex-1': { id: 'ex-1', name: 'Squat', category: 'BARBELL' } as Exercise },
    exerciseNames: { 'ex-1': 'Squat' },
    restTimer: null,
    restMinimized: false,
    setRestMinimized: vi.fn(),
    undoAction: null,
    pendingInputs: {},
    setPendingInputs: vi.fn(),
    programBannerProps: null,
    confirmSet: vi.fn().mockResolvedValue(undefined),
    deleteSet: vi.fn().mockResolvedValue(undefined),
    removeActivity: vi.fn().mockResolvedValue(undefined),
    skipRest: vi.fn(),
    adjustRest: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StrengthWorkoutView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset captured prop containers between tests
    for (const key of Object.keys(capturedBlocks)) delete capturedBlocks[key]
    capturedBar.onFinish = undefined
    capturedBar.onDiscard = undefined
  })

  // -------------------------------------------------------------------------
  // Finish guard (handleFinishWithGuard)
  // -------------------------------------------------------------------------

  describe('finish guard', () => {
    it('calls handleFinish directly when no dirty rows exist', async () => {
      const handleFinish = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleFinish })} />)

      act(() => {
        capturedBar.onFinish?.()
      })

      expect(handleFinish).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Unconfirmed set')).not.toBeInTheDocument()
    })

    it('shows the "Unconfirmed set" dialog instead of calling handleFinish when a dirty row exists', () => {
      const handleFinish = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleFinish })} />)

      // Dirty the activity
      act(() => {
        capturedBlocks['act-1'].onPendingDirty?.()
      })

      // Trigger finish
      act(() => {
        capturedBar.onFinish?.()
      })

      expect(screen.getByText('Unconfirmed set')).toBeInTheDocument()
      expect(handleFinish).not.toHaveBeenCalled()
    })

    it('calls handleFinish when "Finish" inside the dirty dialog is clicked', async () => {
      const user = userEvent.setup()
      const handleFinish = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleFinish })} />)

      act(() => {
        capturedBlocks['act-1'].onPendingDirty?.()
      })
      act(() => {
        capturedBar.onFinish?.()
      })

      // Dialog is open -- click the Finish button inside it
      const finishBtn = screen.getByRole('button', { name: /^Finish$/i })
      await user.click(finishBtn)

      expect(handleFinish).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Unconfirmed set')).not.toBeInTheDocument()
    })

    it('does not call handleFinish when "Cancel" inside the dirty dialog is clicked', async () => {
      const user = userEvent.setup()
      const handleFinish = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleFinish })} />)

      act(() => {
        capturedBlocks['act-1'].onPendingDirty?.()
      })
      act(() => {
        capturedBar.onFinish?.()
      })

      const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i })
      await user.click(cancelBtn)

      expect(handleFinish).not.toHaveBeenCalled()
      expect(screen.queryByText('Unconfirmed set')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // P22-009 regression guard: pendingDirty cleared when skip fires
  // -------------------------------------------------------------------------

  describe('pendingDirty cleared on skip (P22-009 regression guard)', () => {
    it('clears pendingDirty for an activity when onSkipExercise fires, so finish proceeds without dialog', () => {
      const handleFinish = vi.fn().mockResolvedValue(undefined)
      const handleMarkDone = vi.fn()
      render(<StrengthWorkoutView {...makeProps({ handleFinish, handleMarkDone })} />)

      // Mark as dirty
      act(() => {
        capturedBlocks['act-1'].onPendingDirty?.()
      })

      // Skip the exercise -- should clear dirty state
      act(() => {
        capturedBlocks['act-1'].onSkipExercise?.()
      })

      expect(handleMarkDone).toHaveBeenCalledWith('act-1')

      // Finish should now call handleFinish directly without showing the dialog
      act(() => {
        capturedBar.onFinish?.()
      })

      expect(handleFinish).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Unconfirmed set')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Discard dialog
  // -------------------------------------------------------------------------

  describe('discard dialog', () => {
    it('opens the discard dialog when WorkoutPausedBar.onDiscard fires', () => {
      render(<StrengthWorkoutView {...makeProps()} />)

      act(() => {
        capturedBar.onDiscard?.()
      })

      expect(screen.getByText('Discard workout')).toBeInTheDocument()
    })

    it('closes the discard dialog without calling handleDiscard when "Cancel" is clicked', async () => {
      const user = userEvent.setup()
      const handleDiscard = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleDiscard })} />)

      act(() => {
        capturedBar.onDiscard?.()
      })

      const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i })
      await user.click(cancelBtn)

      expect(handleDiscard).not.toHaveBeenCalled()
      expect(screen.queryByText('Discard workout')).not.toBeInTheDocument()
    })

    it('calls handleDiscard when "Discard" is clicked', async () => {
      const user = userEvent.setup()
      const handleDiscard = vi.fn().mockResolvedValue(undefined)
      render(<StrengthWorkoutView {...makeProps({ handleDiscard })} />)

      act(() => {
        capturedBar.onDiscard?.()
      })

      const discardBtn = screen.getByRole('button', { name: /^Discard$/i })
      await user.click(discardBtn)

      expect(handleDiscard).toHaveBeenCalledTimes(1)
    })
  })
})
