// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'

// Mock onboarding store to avoid AuthProvider dependency
vi.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: () => false,
}))

vi.mock('@/components/onboarding/onboarding-hint', () => ({
  OnboardingHint: () => null,
}))

// Mock active-workout-store so tests are self-contained
vi.mock('@/stores/active-workout-store', () => ({
  useActiveWorkoutStore: (selector: (s: { setActivityNote: () => void; loggedGroups: [] }) => unknown) =>
    selector({ setActivityNote: vi.fn(), loggedGroups: [] }),
}))

// Mock NoteAffordance -- not relevant to these tests
vi.mock('@/components/workout/notes/note-affordance', () => ({
  NoteAffordance: () => null,
}))

// Mock Icon so chevron is queryable
vi.mock('@/components/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`}>{name}</span>,
}))

// Mock SetRow to isolate ExerciseBlock logic
vi.mock('@/components/workout/set-row', () => ({
  SetRow: ({
    setNumber,
    prescribedWeight,
    prescribedReps,
    onUnconfirm,
  }: {
    setNumber: number
    prescribedWeight?: { value: number; unit: string }
    prescribedReps?: number
    onUnconfirm?: () => void
  }) => (
    <div data-testid={`set-row-${setNumber}`}>
      Set {setNumber}
      {prescribedWeight && <span>Rx: {prescribedWeight.value}</span>}
      {prescribedReps != null && <span>Rx reps: {prescribedReps}</span>}
      {onUnconfirm && (
        <button onClick={onUnconfirm} aria-label={`Undo set ${setNumber}`}>
          Undo
        </button>
      )}
    </div>
  ),
}))

describe('ExerciseBlock', () => {
  const baseSets: SetRowData[] = [
    { id: 's1', setNumber: 1, confirmed: false },
    { id: 's2', setNumber: 2, confirmed: false },
    { id: 's3', setNumber: 3, confirmed: true },
  ]

  const defaultProps = {
    exerciseName: 'Back Squat',
    sets: baseSets,
    loggedActivityId: 'la-1',
    onConfirmSet: vi.fn(),
  }

  it('renders the exercise name', () => {
    render(<ExerciseBlock {...defaultProps} />)
    expect(screen.getByText('Back Squat')).toBeInTheDocument()
  })

  it('has an accessible section label', () => {
    render(<ExerciseBlock {...defaultProps} />)
    expect(screen.getByLabelText('Back Squat exercise')).toBeInTheDocument()
  })

  it('renders the correct number of set rows', () => {
    render(<ExerciseBlock {...defaultProps} />)
    expect(screen.getByTestId('set-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('set-row-2')).toBeInTheDocument()
    expect(screen.getByTestId('set-row-3')).toBeInTheDocument()
  })

  it('shows ad-hoc column headers (WEIGHT/REPS) when no prescribed data', () => {
    render(<ExerciseBlock {...defaultProps} />)
    expect(screen.getByText('WEIGHT')).toBeInTheDocument()
    expect(screen.getByText('REPS')).toBeInTheDocument()
    expect(screen.queryByText('PRESCRIBED')).not.toBeInTheDocument()
  })

  it('shows prescribed column headers (PRESCRIBED/ACTUAL) when sets have prescription', () => {
    const prescribedSets: SetRowData[] = [
      {
        id: 's1',
        setNumber: 1,
        confirmed: false,
        prescribedWeight: { value: 225, unit: 'lb' },
        prescribedReps: 5,
      },
    ]
    render(<ExerciseBlock {...defaultProps} sets={prescribedSets} />)
    expect(screen.getByText('PRESCRIBED')).toBeInTheDocument()
    expect(screen.getByText('ACTUAL')).toBeInTheDocument()
    expect(screen.queryByText('WEIGHT')).not.toBeInTheDocument()
  })

  it('always shows SET and STATUS column headers', () => {
    render(<ExerciseBlock {...defaultProps} />)
    expect(screen.getByText('SET')).toBeInTheDocument()
    expect(screen.getByText('STATUS')).toBeInTheDocument()
  })

  it('passes onUnconfirm to confirmed set rows when onUnconfirmSet is provided', async () => {
    const user = userEvent.setup()
    const onUnconfirmSet = vi.fn()
    const confirmedSets: SetRowData[] = [
      { id: 's1', setNumber: 1, confirmed: true },
      { id: 's2', setNumber: 2, confirmed: false },
    ]
    render(
      <ExerciseBlock
        {...defaultProps}
        sets={confirmedSets}
        onUnconfirmSet={onUnconfirmSet}
      />,
    )

    // Only the confirmed set (s1) should have an undo button
    const undoBtn = screen.getByLabelText('Undo set 1')
    await user.click(undoBtn)

    expect(onUnconfirmSet).toHaveBeenCalledWith('la-1', 's1')
    // Unconfirmed set should not have an undo button
    expect(screen.queryByLabelText('Undo set 2')).not.toBeInTheDocument()
  })

  describe('done affordance (A-001, A-002)', () => {
    it('[A-001] Done button is visible with zero confirmed sets', () => {
      const noConfirmedSets: SetRowData[] = [
        { id: 's1', setNumber: 1, confirmed: false },
        { id: 's2', setNumber: 2, confirmed: false },
      ]
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={noConfirmedSets}
          onSkipExercise={vi.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    it('[A-001] Done button is visible when sets array is empty', () => {
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={[]}
          onSkipExercise={vi.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    it('[A-002] Done button is visible with confirmed sets present', () => {
      const withConfirmed: SetRowData[] = [
        { id: 's1', setNumber: 1, confirmed: true },
        { id: 's2', setNumber: 2, confirmed: true },
        { id: 's3', setNumber: 3, confirmed: false },
      ]
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={withConfirmed}
          onSkipExercise={vi.fn()}
        />,
      )
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
    })

    it('Done button calls onSkipExercise when tapped', async () => {
      const user = userEvent.setup()
      const onSkipExercise = vi.fn()
      render(
        <ExerciseBlock
          {...defaultProps}
          onSkipExercise={onSkipExercise}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(onSkipExercise).toHaveBeenCalledOnce()
    })
  })

  describe('collapsed state when isDone=true (A-004, A-005)', () => {
    it('[A-004] isDone=true renders single-row summary with exercise name', () => {
      render(
        <ExerciseBlock
          {...defaultProps}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.getByText('Back Squat')).toBeInTheDocument()
    })

    it('[A-004] isDone=true renders confirmed set count badge', () => {
      const withConfirmed: SetRowData[] = [
        { id: 's1', setNumber: 1, confirmed: true },
        { id: 's2', setNumber: 2, confirmed: true },
        { id: 's3', setNumber: 3, confirmed: true },
      ]
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={withConfirmed}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.getByText('3 SETS')).toBeInTheDocument()
    })

    it('[A-004] isDone=true with 1 confirmed set shows singular SET badge', () => {
      const oneConfirmed: SetRowData[] = [
        { id: 's1', setNumber: 1, confirmed: true },
      ]
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={oneConfirmed}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.getByText('1 SET')).toBeInTheDocument()
    })

    it('[A-004] isDone=true with 0 confirmed sets shows 0 SETS badge', () => {
      const noConfirmed: SetRowData[] = [
        { id: 's1', setNumber: 1, confirmed: false },
      ]
      render(
        <ExerciseBlock
          {...defaultProps}
          sets={noConfirmed}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.getByText('0 SETS')).toBeInTheDocument()
    })

    it('[A-004] isDone=true does NOT render the full set list', () => {
      render(
        <ExerciseBlock
          {...defaultProps}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.queryByTestId('set-row-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('set-row-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('set-row-3')).not.toBeInTheDocument()
    })

    it('[A-004] isDone=true does NOT render column headers (WEIGHT, REPS, SET, STATUS)', () => {
      render(
        <ExerciseBlock
          {...defaultProps}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.queryByText('WEIGHT')).not.toBeInTheDocument()
      expect(screen.queryByText('REPS')).not.toBeInTheDocument()
    })

    it('[A-005] Tapping the expand chevron calls onExpandToggle', async () => {
      const user = userEvent.setup()
      const onExpandToggle = vi.fn()
      render(
        <ExerciseBlock
          {...defaultProps}
          isDone={true}
          onExpandToggle={onExpandToggle}
        />,
      )
      const expandBtn = screen.getByRole('button', { name: 'Expand Back Squat' })
      await user.click(expandBtn)
      expect(onExpandToggle).toHaveBeenCalledOnce()
    })

    it('isDone=true renders accessible section label', () => {
      render(
        <ExerciseBlock
          {...defaultProps}
          isDone={true}
          onExpandToggle={vi.fn()}
        />,
      )
      expect(screen.getByLabelText('Back Squat exercise')).toBeInTheDocument()
    })
  })

  describe('full set UI when isDone=false', () => {
    it('isDone=false (default) renders the full set list', () => {
      render(<ExerciseBlock {...defaultProps} />)
      expect(screen.getByTestId('set-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('set-row-2')).toBeInTheDocument()
      expect(screen.getByTestId('set-row-3')).toBeInTheDocument()
    })

    it('isDone=false renders column headers', () => {
      render(<ExerciseBlock {...defaultProps} />)
      expect(screen.getByText('WEIGHT')).toBeInTheDocument()
      expect(screen.getByText('REPS')).toBeInTheDocument()
    })
  })
})
