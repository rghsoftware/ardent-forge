// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// F023 (S003-T) -- handleFinish pending-row discard + all-done banner tests
//
//   [A-006] All pending input rows absent from persisted workout after FINISH
//   All-done banner visible when every activity is in skippedActivityIds
//   All-done banner hidden when at least one activity is not done
//   Banner absent when loggedGroups is empty
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
  workoutState,
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

  // Mutable workout state -- tests mutate this to change loggedGroups and flags.
  const workoutState = {
    isProgrammedWorkout: false,
    loggedGroups: [
      {
        id: 'group-1',
        groupType: 'STRAIGHT_SETS',
        activities: [
          {
            id: 'act-1',
            exerciseId: 'ex-1',
            sets: [
              {
                id: 'set-1',
                completed: true,
                setNumber: 1,
                actualWeight: { value: 135, unit: 'lb' },
                actualReps: 5,
              },
            ],
          },
          {
            id: 'act-2',
            exerciseId: 'ex-1',
            sets: [],
          },
        ],
      },
    ],
  }

  const capturedComponent: { current: React.ComponentType | undefined } = { current: undefined }

  const capturedExerciseBlockProps: Map<
    string,
    {
      isDone?: boolean
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
    workoutState,
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
    loggedGroups: workoutState.loggedGroups,
    isActive: true,
    isProgrammedWorkout: workoutState.isProgrammedWorkout,
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
  WorkoutPausedBar: (props: { onFinish: () => void }) => (
    <button data-testid="finish-workout" onClick={props.onFinish}>
      Finish
    </button>
  ),
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

// ExerciseBlock renders a "Done" button and captures props for assertions.
vi.mock('@/components/workout/exercise-block', () => ({
  ExerciseBlock: (props: {
    loggedActivityId: string
    isDone?: boolean
    onSkipExercise?: () => void
    onExpandToggle?: () => void
    sets: Array<{ id: string; confirmed: boolean; isPending?: boolean }>
    exerciseName: string
  }) => {
    capturedExerciseBlockProps.set(props.loggedActivityId, {
      isDone: props.isDone,
      sets: props.sets,
    })
    return (
      <div data-testid={`exercise-block-${props.loggedActivityId}`}>
        <button onClick={props.onSkipExercise}>Done</button>
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

describe('log.$workoutId finish handling + all-done banner (F023 S003-T)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.skippedActivityIds = new Set()
    storeState.skipActivity = mockSkipActivity
    capturedExerciseBlockProps.clear()
    mockSkipActivity.mockImplementation((id: string) => {
      storeState.skippedActivityIds = new Set(storeState.skippedActivityIds).add(id)
    })
    mockFinishWorkout.mockResolvedValue(undefined)
    workoutState.isProgrammedWorkout = false
    // Reset to two-activity group
    workoutState.loggedGroups = [
      {
        id: 'group-1',
        groupType: 'STRAIGHT_SETS',
        activities: [
          {
            id: 'act-1',
            exerciseId: 'ex-1',
            sets: [
              {
                id: 'set-1',
                completed: true,
                setNumber: 1,
                actualWeight: { value: 135, unit: 'lb' },
                actualReps: 5,
              },
            ],
          },
          {
            id: 'act-2',
            exerciseId: 'ex-1',
            sets: [],
          },
        ],
      },
    ]
  })

  // -------------------------------------------------------------------------
  // [A-006] FINISH clears pending input rows before persisting
  // -------------------------------------------------------------------------

  it('[A-006] clicking FINISH calls finishWorkout and removes pending rows from the DOM', async () => {
    const user = userEvent.setup()
    renderPage()

    // act-2 has 0 confirmed sets => the route auto-adds a pending row for it on mount.
    const act2PropsBefore = capturedExerciseBlockProps.get('act-2')
    const pendingRowsBefore = act2PropsBefore?.sets.filter((s) => s.isPending) ?? []
    expect(pendingRowsBefore).toHaveLength(1)

    // The WorkoutPausedBar mock exposes a FINISH button. Clicking it invokes handleFinish,
    // which calls setPendingInputs({}) then awaits finishWorkout().
    await act(async () => {
      await user.click(screen.getByTestId('finish-workout'))
    })

    // finishWorkout must have been called exactly once.
    expect(mockFinishWorkout).toHaveBeenCalledOnce()

    // After handleFinish resolves, setShowSummary(true) fires and the route
    // switches to WorkoutSummary -- exercise blocks leave the DOM entirely,
    // which also removes all pending rows.
    expect(screen.queryByTestId('exercise-block-act-2')).not.toBeInTheDocument()
  })

  it('all-done banner is visible after all activities are skipped', async () => {
    // act-2 has 0 confirmed sets => route adds a pending row automatically
    const { rerender } = renderPage()
    const act2Props = capturedExerciseBlockProps.get('act-2')
    const pendingRows = act2Props?.sets.filter((s) => s.isPending) ?? []
    expect(pendingRows).toHaveLength(1)

    // Skip all activities to trigger the all-done banner.
    await act(async () => {
      storeState.skippedActivityIds = new Set(['act-1', 'act-2'])
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // After all activities are skipped, the banner should appear.
    expect(screen.getByText(/ALL EXERCISES DONE/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // All-done banner -- visible when all activities are done
  // -------------------------------------------------------------------------

  it('all-done banner is visible when every activity is in skippedActivityIds', async () => {
    // Mark both activities as done before rendering.
    storeState.skippedActivityIds = new Set(['act-1', 'act-2'])

    renderPage()

    expect(screen.getByText(/ALL EXERCISES DONE/i)).toBeInTheDocument()
    expect(screen.getByText(/READY TO FINISH/i)).toBeInTheDocument()
  })

  it('all-done banner is visible after tapping Done on all activities', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage()

    // Banner should not be visible initially.
    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()

    // Mark act-1 done.
    const doneButtons = screen.getAllByRole('button', { name: 'Done' })
    await user.click(doneButtons[0])

    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // Only one activity done -- banner still hidden.
    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()

    // Mark act-2 done.
    const doneButtons2 = screen.getAllByRole('button', { name: 'Done' })
    await user.click(doneButtons2[doneButtons2.length - 1])

    await act(async () => {
      const C = capturedComponent.current!
      rerender(<C />)
    })

    // Both activities done -- banner appears.
    expect(screen.getByText(/ALL EXERCISES DONE/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // All-done banner -- hidden when at least one activity is not done
  // -------------------------------------------------------------------------

  it('all-done banner is hidden when at least one activity is not yet done', () => {
    // Only act-1 is skipped; act-2 is not.
    storeState.skippedActivityIds = new Set(['act-1'])

    renderPage()

    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()
  })

  it('all-done banner is hidden when no activities are done', () => {
    storeState.skippedActivityIds = new Set()

    renderPage()

    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Banner absent when loggedGroups is empty
  // -------------------------------------------------------------------------

  it('all-done banner is absent when loggedGroups is empty', () => {
    workoutState.loggedGroups = []
    storeState.skippedActivityIds = new Set()

    renderPage()

    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()
  })

  it('all-done banner is absent when loggedGroups is empty even if skippedActivityIds is non-empty', () => {
    workoutState.loggedGroups = []
    // skippedActivityIds with stale IDs should not trigger the banner.
    storeState.skippedActivityIds = new Set(['stale-act-1'])

    renderPage()

    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // CIRCUIT filter -- P20-001: CIRCUIT groups are excluded from allActivitiesDone
  // -------------------------------------------------------------------------

  it('all-done banner appears when straight-set activities are done even if a CIRCUIT group is present', () => {
    // Set up a workout with one STRAIGHT_SETS group and one CIRCUIT group.
    // The CIRCUIT group's activities should NOT need to be in skippedActivityIds
    // for the banner to appear, because allActivitiesDone filters out CIRCUIT groups.
    workoutState.loggedGroups = [
      {
        id: 'group-straight',
        groupType: 'STRAIGHT_SETS',
        activities: [
          {
            id: 'straight-act-1',
            exerciseId: 'ex-1',
            sets: [
              {
                id: 'set-s1',
                completed: true,
                setNumber: 1,
                actualWeight: { value: 135, unit: 'lb' },
                actualReps: 5,
              },
            ],
          },
        ],
      },
      {
        id: 'group-circuit',
        groupType: 'CIRCUIT',
        activities: [
          {
            id: 'circuit-act-1',
            exerciseId: 'ex-1',
            sets: [],
          },
          {
            id: 'circuit-act-2',
            exerciseId: 'ex-1',
            sets: [],
          },
        ],
      },
    ]

    // Only the straight-set activity is in skippedActivityIds.
    // Circuit activities are intentionally absent.
    storeState.skippedActivityIds = new Set(['straight-act-1'])

    renderPage()

    // Banner must appear because all non-CIRCUIT activities are done.
    expect(screen.getByText(/ALL EXERCISES DONE/i)).toBeInTheDocument()
    expect(screen.getByText(/READY TO FINISH/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Programmed workout -- banner absent when isProgrammedWorkout=true
  // -------------------------------------------------------------------------

  it('all-done banner is absent when isProgrammedWorkout=true, even if all activities are done', () => {
    // Mark all activities as done.
    storeState.skippedActivityIds = new Set(['act-1', 'act-2'])
    // Switch to a programmed workout context.
    workoutState.isProgrammedWorkout = true

    renderPage()

    // The entire sticky footer (including the banner) is wrapped in
    // {!isProgrammedWorkout && (...)} so neither the banner nor the
    // "Add exercise" button should be present.
    expect(screen.queryByText(/ALL EXERCISES DONE/i)).not.toBeInTheDocument()
  })
})
