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
    expect(screen.getByText('Create Custom Exercise')).toBeInTheDocument()
  })

  it('renders sheet description', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Define a new exercise for your library.')).toBeInTheDocument()
  })

  it('renders name input field', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('renders Category label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('renders Movement pattern label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Movement pattern')).toBeInTheDocument()
  })

  it('renders Primary muscles label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Primary muscles')).toBeInTheDocument()
  })

  it('renders Equipment label', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Equipment')).toBeInTheDocument()
  })

  it('renders Supports 1RM and Bilateral toggle labels', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Supports 1RM')).toBeInTheDocument()
    expect(screen.getByText('Bilateral')).toBeInTheDocument()
  })

  it('renders Create exercise submit button', () => {
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Create exercise')).toBeInTheDocument()
  })

  it('shows validation error when submitting with empty name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)

    await user.click(screen.getByText('Create exercise'))

    // React Hook Form + Zod: name is required
    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('shows validation error when no primary muscles selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateExerciseSheet {...defaultProps} />)

    // Fill in name but leave muscles empty
    await user.type(screen.getByPlaceholderText('e.g. Barbell Hip Thrust'), 'Test Exercise')
    await user.click(screen.getByText('Create exercise'))

    expect(screen.getByText('Select at least one primary muscle group')).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderWithProviders(<CreateExerciseSheet open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('Create Custom Exercise')).not.toBeInTheDocument()
  })
})
