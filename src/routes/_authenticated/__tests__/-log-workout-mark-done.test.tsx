// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// F023 (S002-T) -- mark-done route wiring tests
//
// Tests the handleMarkDone wiring in log.$workoutId.tsx:
//   [A-003] Pending input row cleared when mark-done fires
//   [A-007] Confirmed sets on activity untouched after mark-done
//   [A-008] skippedActivityIds contains activityId after mark-done
//   Block renders collapsed after mark-done (isDone=true)
//   Block re-expands on chevron tap [A-005]
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockNavigate,
  mockSkipActivity,
  mockFinishWorkout,
  mockDiscardWorkout,
  mockPauseWorkout,
  mockUnpauseWorkout,
  mockConfirmSet,
  mockUnconfirmSet,
  mockDeleteSet,
  mockRemoveActivity,
  mockAddExercise,
  mockSkipRest,
  mockAdjustRest,
  storeState,
  capturedComponent,
  capturedExerciseBlockProps,
} = vi.hoisted(() => {
  const mockNavigate = vi.fn()
  const mockSkipActivity = vi.fn()
  const mockFinishWorkout = vi.fn().mockResolvedValue(undefined)
  const mockDiscardWorkout = vi.fn().mockResolvedValue(undefined)
  const mockPauseWorkout = vi.fn().mockResolvedValue(undefined)
  const mockUnpauseWorkout = vi.fn().mockResolvedValue(undefined)
  const mockConfirmSet = vi.fn().mockResolvedValue(undefined)
  const mockUnconfirmSet = vi.fn().mockResolvedValue(undefined)
  const mockDeleteSet = vi.fn().mockResolvedValue(undefined)
  const mockRemoveActivity = vi.fn().mockResolvedValue(undefined)
  const mockAddExercise = vi.fn().mockResolvedValue(undefined)
  const mockSkipRest = vi.fn()
  const mockAdjustRest = vi.fn()

  // Mutable store state -- tests mutate this to control what the component sees.
  const storeState = {
    skippedActivityIds: new Set<string>(),
    skipActivity: mockSkipActivity,
  }

  const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }

  // Each render of ExerciseBlock captures the most-recently-rendered props for
  // each loggedActivityId so tests can inspect isDone, onSkipExercise, etc.
  const capturedExerciseBlockProps: Map<
    string,
    {
      isDone?: boolean
      onSkipExercise?: () => void
      onExpandToggle?: () => void
      onAddSet?: () => void
      sets: Array<{ id: string; confirmed: boolean; isPending?: boolean }>
    }
  > = new Map()

  return {
    mockNavigate,
    mockSkipActivity,
    mockFinishWorkout,
    mockDiscardWorkout,
    mockPauseWorkout,
    mockUnpauseWorkout,
    mockConfirmSet,
    mockUnconfirmSet,
    mockDeleteSet,
    mockRemoveActivity,
    mockAddExercise,
    mockSkipRest,
    mockAdjustRest,
    storeState,
    capturedComponent,
    capturedExerciseBlockProps,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component?: React.ComponentType }) => {
    capturedComponent.current = config.component
    return { ...config }
  },
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

vi.mock('@/hooks/use-active-workout', () => ({
  useActiveWorkout: () => ({
    workoutLog: {
      id: 'wl-1',
      userId: 'user-1',
      startedAt: new Date().toISOString(),
      totalPausedMs: 0,
      pausedAt: null,
      programContext: null,
      eventMetadata: null,
    },
    loggedGroups: [
      {
        id: 'group-1',
        groupType: 'STRAIGHT_SETS',
        activities: [
          {
            id: 'act-1',
            exerciseId: 'ex-1',
            sets: [
              { id: 'set-1', completed: true, setNumber: 1, actualWeight: { value: 135, unit: 'lb' }, actualReps: 5 },
              { id: 'set-2', completed: true, setNumber: 2, actualWeight: { value: 135, unit: 'lb' }, actualReps: 5 },
            ],
          },
        ],
      },
    ],
    isActive: true,
    isProgrammedWorkout: false,
    elapsedSeconds: 0,
    restTimer: null,
    undoAction: null,
    confirmSet: mockConfirmSet,
    unconfirmSet: mockUnconfirmSet,
    undoSet: vi.fn().mockResolvedValue(undefined),
    deleteSet: mockDeleteSet,
    removeActivity: mockRemoveActivity,
    finishWorkout: mockFinishWorkout,
    discardWorkout: mockDiscardWorkout,
    pauseWorkout: mockPauseWorkout,
    unpauseWorkout: mockUnpauseWorkout,
    addExercise: mockAddExercise,
    skipRest: mockSkipRest,
    adjustRest: mockAdjustRest,
    isConfirmingSet: false,
    isFinishing: false,
    isDiscarding: false,
  }),
}))

const mockSetElapsedSeconds = vi.fn()

vi.mock('@/stores/active-workout-store', () => {
  const hook = (
    selector: (s: { skippedActivityIds: Set<string>; skipActivity: (id: string) => void }) =>
      unknown,
  ) => selector(storeState)
  hook.getState = () => ({
    skipActivity: storeState.skipActivity,
    skippedActivityIds: storeState.skippedActivityIds,
    setElapsedSeconds: mockSetElapsedSeconds,
    elapsedSeconds: 0,
    pauseWorkout: vi.fn(),
    unpauseWorkout: vi.fn(),
  })
  return { useActiveWorkoutStore: hook }
})

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => ({
    data: [{ id: 'ex-1', name: 'Back Squat', category: 'BARBELL' }],
  }),
}))

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: () => ({ data: null }),
}))

vi.mock('@/hooks/use-onboarding', () => ({
  useOnboarding: () => ({ markFirstWorkoutCompleted: vi.fn() }),
}))

vi.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: (selector: (s: { firstWorkoutCompleted: boolean }) => unknown) =>
    selector({ firstWorkoutCompleted: true }),
}))

vi.mock('@/hooks/use-programs', () => ({
  useProgramFull: () => ({ data: null }),
}))

vi.mock('@/hooks/use-display-broadcast', () => ({
  useDisplayBroadcast: () => ({
    publishFocus: vi.fn(),
    publishUnfocus: vi.fn(),
    isBroadcasting: false,
  }),
}))

vi.mock('@/lib/display-realtime', () => ({
  getActiveGymId: () => null,
}))

vi.mock('@/components/onboarding/onboarding-hint', () => ({
  OnboardingHint: () => null,
}))

vi.mock('@/components/workout/workout-header', () => ({
  WorkoutHeader: () => <div data-testid="workout-header" />,
}))

vi.mock('@/components/workout/workout-paused-bar', () => ({
  WorkoutPausedBar: () => null,
}))

vi.mock('@/components/workout/error-banner', () => ({
  ErrorBanner: () => null,
}))

vi.mock('@/components/workout/workout-header-menu', () => ({
  WorkoutHeaderMenu: () => null,
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

vi.mock('@/components/workout/workout-summary', () => ({
  WorkoutSummary: () => null,
}))

vi.mock('@/components/event-builder/event-detail', () => ({
  EventDetail: () => null,
}))

// ExerciseBlock is the key component under observation. We capture its props
// so tests can assert on isDone, onSkipExercise, onExpandToggle, and sets.
vi.mock('@/components/workout/exercise-block', () => ({
  ExerciseBlock: (props: {
    loggedActivityId: string
    isDone?: boolean
    onSkipExercise?: () => void
    onExpandToggle?: () => void
    onAddSet?: () => void
    sets: Array<{ id: string; confirmed: boolean; isPending?: boolean }>
    exerciseName: string
  }) => {
    // Capture props for assertions.
    capturedExerciseBlockProps.set(props.loggedActivityId, {
      isDone: props.isDone,
      onSkipExercise: props.onSkipExercise,
      onExpandToggle: props.onExpandToggle,
      onAddSet: props.onAddSet,
      sets: props.sets,
    })
    return (
      <div data-testid={`exercise-block-${props.loggedActivityId}`} data-is-done={props.isDone ? 'true' : 'false'}>
        <button onClick={props.onSkipExercise}>Done</button>
        <button onClick={props.onAddSet}>Add Set</button>
        {props.isDone && (
          <button onClick={props.onExpandToggle} aria-label="Expand">
            Expand
          </button>
        )}
      </div>
    )
  },
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/pr-detection', () => ({
  detectPersonalRecords: () => [],
}))

vi.mock('@/lib/workout-utils', () => ({
  getExerciseModality: () => 'strength',
  parseNumericInput: (v: string) => parseFloat(v) || null,
  DEFAULT_CIRCUIT_REPS: 10,
}))

// Import after mocks -- triggers createFileRoute capture.
import '../log.$workoutId'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const Component = capturedComponent.current
  if (!Component) throw new Error('ActiveWorkoutPage not captured from createFileRoute')
  return render(<Component />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('log.$workoutId mark-done wiring (F023 S002-T)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.skippedActivityIds = new Set()
    storeState.skipActivity = mockSkipActivity
    capturedExerciseBlockProps.clear()
    // Keep skipActivity side-effect: add to set when called.
    mockSkipActivity.mockImplementation((id: string) => {
      storeState.skippedActivityIds = new Set(storeState.skippedActivityIds).add(id)
    })
  })

  // -------------------------------------------------------------------------
  // [A-008] skippedActivityIds contains activityId after mark-done
  // -------------------------------------------------------------------------

  it('[A-008] clicking Done calls skipActivity with the activityId', async () => {
    const user = userEvent.setup()
    renderPage()

    const doneBtn = screen.getByRole('button', { name: 'Done' })
    await user.click(doneBtn)

    expect(mockSkipActivity).toHaveBeenCalledWith('act-1')
  })

  // -------------------------------------------------------------------------
  // Block renders collapsed after mark-done (isDone=true)
  // -------------------------------------------------------------------------

  it('ExerciseBlock receives isDone=true after mark-done fires', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage()

    // Before mark-done: isDone should be false.
    expect(capturedExerciseBlockProps.get('act-1')?.isDone).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Done' }))

    // skipActivity added act-1 to skippedActivityIds; re-render to reflect new state.
    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    expect(capturedExerciseBlockProps.get('act-1')?.isDone).toBe(true)
  })

  // -------------------------------------------------------------------------
  // [A-003] Pending input row cleared when mark-done fires
  // -------------------------------------------------------------------------

  it('[A-003] pending input row is cleared when mark-done fires', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage()

    // The fixture has 2 confirmed sets so no pending row is auto-added on mount.
    // Verify the precondition: no pending row yet.
    expect(capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.isPending)).toHaveLength(0)

    // Click "Add Set" to explicitly set pendingInputs['act-1'] = true via the
    // route's onAddSet handler. This is the real path that exercises setPendingInputs.
    await user.click(screen.getByRole('button', { name: 'Add Set' }))

    // Re-render so the component re-derives set rows from the updated pendingInputs state.
    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // PRECONDITION: pending row is now present before clicking Done.
    const pendingBefore = capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.isPending)
    expect(pendingBefore).toHaveLength(1)

    // Click Done -- triggers handleMarkDone which calls:
    //   skipActivity(activityId)
    //   setPendingInputs((prev) => ({ ...prev, [activityId]: false }))
    await user.click(screen.getByRole('button', { name: 'Done' }))

    // Re-render to reflect updated pendingInputs state (false) and skippedActivityIds.
    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // POSTCONDITION: pending row is gone after mark-done.
    const pendingAfter = capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.isPending)
    expect(pendingAfter).toHaveLength(0)

    // Confirmed sets are untouched (still 2).
    const confirmedSets = capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.confirmed)
    expect(confirmedSets).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // [A-007] Confirmed sets untouched after mark-done
  // -------------------------------------------------------------------------

  it('[A-007] confirmed sets are not removed when mark-done fires', async () => {
    const user = userEvent.setup()
    renderPage()

    // Before: 2 confirmed sets
    const setsBefore = capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.confirmed)
    expect(setsBefore).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Done' }))

    // After: still 2 confirmed sets passed to ExerciseBlock
    const setsAfter = capturedExerciseBlockProps.get('act-1')?.sets.filter((s) => s.confirmed)
    expect(setsAfter).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // [A-005] Block re-expands on chevron tap
  // -------------------------------------------------------------------------

  it('[A-005] block re-expands when onExpandToggle is called after mark-done', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage()

    // Mark done
    await user.click(screen.getByRole('button', { name: 'Done' }))

    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // Block should now be collapsed (isDone=true) and Expand button visible.
    expect(capturedExerciseBlockProps.get('act-1')?.isDone).toBe(true)

    const expandBtn = screen.getByRole('button', { name: 'Expand' })
    await user.click(expandBtn)

    // After expand: isDone should be false (act-1 is in expandedDoneActivityIds).
    // Re-render to pick up the state change.
    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    expect(capturedExerciseBlockProps.get('act-1')?.isDone).toBe(false)
  })
})
