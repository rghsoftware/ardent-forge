// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'

// Mock the hook to avoid adapter dependency
vi.mock('@/hooks/use-exercises', () => ({
  useCreateExercise: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
  }),
}))

describe('CreateExerciseSheet', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  it('renders sheet title', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('CREATE CUSTOM EXERCISE')).toBeInTheDocument()
  })

  it('renders sheet description', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Define a new exercise for your library.')).toBeInTheDocument()
  })

  it('renders name input field', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByLabelText('NAME')).toBeInTheDocument()
  })

  it('renders CATEGORY label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('CATEGORY')).toBeInTheDocument()
  })

  it('renders MOVEMENT PATTERN label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('MOVEMENT PATTERN')).toBeInTheDocument()
  })

  it('renders PRIMARY MUSCLES label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('PRIMARY MUSCLES')).toBeInTheDocument()
  })

  it('renders EQUIPMENT label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('EQUIPMENT')).toBeInTheDocument()
  })

  it('renders SUPPORTS 1RM and BILATERAL toggle labels', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('SUPPORTS 1RM')).toBeInTheDocument()
    expect(screen.getByText('BILATERAL')).toBeInTheDocument()
  })

  it('renders CREATE EXERCISE submit button', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('CREATE EXERCISE')).toBeInTheDocument()
  })

  it('shows validation error when submitting with empty name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)

    await user.click(screen.getByText('CREATE EXERCISE'))

    // React Hook Form + Zod: name is required
    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('shows validation error when no primary muscles selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)

    // Fill in name but leave muscles empty
    await user.type(screen.getByPlaceholderText('e.g. Barbell Hip Thrust'), 'Test Exercise')
    await user.click(screen.getByText('CREATE EXERCISE'))

    expect(screen.getByText('Select at least one primary muscle group')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderWithProviders(<CreateExerciseSheet open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('CREATE CUSTOM EXERCISE')).not.toBeInTheDocument()
  })
})
