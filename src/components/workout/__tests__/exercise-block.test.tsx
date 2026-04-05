// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { ExerciseBlock, type SetRowData } from '@/components/workout/exercise-block'

// Mock onboarding store to avoid AuthProvider dependency
vi.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: () => false,
}))

vi.mock('@/components/onboarding/onboarding-hint', () => ({
  OnboardingHint: () => null,
}))

// Mock SetRow to isolate ExerciseBlock logic
vi.mock('@/components/workout/set-row', () => ({
  SetRow: ({
    setNumber,
    prescribedWeight,
    prescribedReps,
  }: {
    setNumber: number
    prescribedWeight?: { value: number; unit: string }
    prescribedReps?: number
  }) => (
    <div data-testid={`set-row-${setNumber}`}>
      Set {setNumber}
      {prescribedWeight && <span>Rx: {prescribedWeight.value}</span>}
      {prescribedReps != null && <span>Rx reps: {prescribedReps}</span>}
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
})
