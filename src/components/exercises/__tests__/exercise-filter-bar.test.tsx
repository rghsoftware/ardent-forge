// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseFilterBar } from '@/components/exercises/exercise-filter-bar'

describe('ExerciseFilterBar', () => {
  const onCategoryChange = vi.fn()
  const onMuscleGroupChange = vi.fn()
  const onMovementPatternChange = vi.fn()

  const defaultProps = {
    onCategoryChange,
    onMuscleGroupChange,
    onMovementPatternChange,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders category filter chips', () => {
    render(<ExerciseFilterBar {...defaultProps} />)
    // formatLabel replaces _ with space, so these appear as-is for single-word values
    expect(screen.getByText('BARBELL')).toBeInTheDocument()
    expect(screen.getByText('DUMBBELL')).toBeInTheDocument()
    expect(screen.getByText('KETTLEBELL')).toBeInTheDocument()
    expect(screen.getByText('BODYWEIGHT')).toBeInTheDocument()
    expect(screen.getByText('MACHINE')).toBeInTheDocument()
  })

  it('renders muscle group filter chips', () => {
    render(<ExerciseFilterBar {...defaultProps} />)
    expect(screen.getByText('CHEST')).toBeInTheDocument()
    expect(screen.getByText('BACK')).toBeInTheDocument()
    expect(screen.getByText('QUADS')).toBeInTheDocument()
  })

  it('renders movement pattern filter chips', () => {
    render(<ExerciseFilterBar {...defaultProps} />)
    expect(screen.getByText('SQUAT')).toBeInTheDocument()
    expect(screen.getByText('HINGE')).toBeInTheDocument()
    expect(screen.getByText('PUSH')).toBeInTheDocument()
    expect(screen.getByText('PULL')).toBeInTheDocument()
  })

  it('clicking a category filter triggers onCategoryChange', async () => {
    const user = userEvent.setup()
    render(<ExerciseFilterBar {...defaultProps} />)
    await user.click(screen.getByText('BARBELL'))
    expect(onCategoryChange).toHaveBeenCalledWith('BARBELL')
  })

  it('clicking an already active category deactivates it (passes undefined)', async () => {
    const user = userEvent.setup()
    render(<ExerciseFilterBar {...defaultProps} activeCategory="BARBELL" />)
    await user.click(screen.getByText('BARBELL'))
    expect(onCategoryChange).toHaveBeenCalledWith(undefined)
  })

  it('clicking a muscle group filter triggers onMuscleGroupChange', async () => {
    const user = userEvent.setup()
    render(<ExerciseFilterBar {...defaultProps} />)
    await user.click(screen.getByText('CHEST'))
    expect(onMuscleGroupChange).toHaveBeenCalledWith('CHEST')
  })

  it('clicking a movement pattern filter triggers onMovementPatternChange', async () => {
    const user = userEvent.setup()
    render(<ExerciseFilterBar {...defaultProps} />)
    await user.click(screen.getByText('SQUAT'))
    expect(onMovementPatternChange).toHaveBeenCalledWith('SQUAT')
  })
})
