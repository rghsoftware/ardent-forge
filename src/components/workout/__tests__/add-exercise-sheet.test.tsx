// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import type { Exercise } from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testExercise: Exercise = {
  id: 'ex-1',
  name: 'Goblet Squat',
  aliases: ['goblet'],
  category: 'BARBELL',
  movementPattern: 'PUSH',
  muscleGroups: { primary: ['QUADS'], secondary: [] },
  equipmentRequired: ['BARBELL'],
  supports1RM: true,
  isBilateral: true,
  isCustom: false,
  isPublic: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

const newExercise: Exercise = {
  ...testExercise,
  id: 'ex-new-1',
  name: 'Hack Squat',
  isCustom: true,
  isPublic: false,
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Bypass debounce so search filtering is synchronous in tests
vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: (value: string) => value,
}))

// Hoist mutable hook state so beforeEach can drive loading / error / data
const mockExercisesState = vi.hoisted(() => ({
  data: [] as Exercise[],
  isError: false,
}))
const mockRecentState = vi.hoisted(() => ({
  data: [] as Exercise[],
  isError: false,
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => mockExercisesState,
  useRecentlyUsedExercises: () => mockRecentState,
}))

// CreateExerciseSheet test double: renders content when open so callbacks
// can be triggered and props inspected
vi.mock('@/components/exercises/create-exercise-sheet', () => ({
  CreateExerciseSheet: vi.fn(),
}))

// Import components after mocks are registered (vi.mock is hoisted automatically)
import { AddExerciseSheet } from '../add-exercise-sheet'
import { CreateExerciseSheet } from '@/components/exercises/create-exercise-sheet'

// Configures CreateExerciseSheet to render a minimal test surface when open
function setupCreateSheetMock(exercise: Exercise = newExercise) {
  vi.mocked(CreateExerciseSheet).mockImplementation(({ open, onCreated, defaultName }) => {
    if (!open) return <></>
    return (
      <div data-testid="create-exercise-sheet">
        <span data-testid="create-sheet-default-name">{defaultName}</span>
        <button onClick={() => onCreated?.(exercise)}>submit-create</button>
      </div>
    )
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AddExerciseSheet', () => {
  const onOpenChange = vi.fn()
  const onExerciseSelected = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange,
    onExerciseSelected,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExercisesState.data = [testExercise]
    mockExercisesState.isError = false
    mockRecentState.data = []
    mockRecentState.isError = false
    setupCreateSheetMock()
  })

  // -------------------------------------------------------------------------
  // Search no-match → Create CTA
  // -------------------------------------------------------------------------

  it('renders "Create exercise" button when search has no matches', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'zzz')

    expect(screen.getByText('No matches')).toBeInTheDocument()
    expect(screen.getByText('Create exercise')).toBeInTheDocument()
  })

  it('does not show "Create exercise" button when search has results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    // "goblet" matches testExercise by alias
    await user.type(screen.getByPlaceholderText('Search exercises'), 'goblet')

    expect(screen.queryByText('No matches')).not.toBeInTheDocument()
    expect(screen.queryByText('Create exercise')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Create CTA → CreateExerciseSheet opens
  // -------------------------------------------------------------------------

  it('opens CreateExerciseSheet when "Create exercise" is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'zzz')
    await user.click(screen.getByText('Create exercise'))

    await waitFor(() => expect(screen.getByTestId('create-exercise-sheet')).toBeInTheDocument())
  })

  // -------------------------------------------------------------------------
  // defaultName wiring
  // -------------------------------------------------------------------------

  it('passes the current search query as defaultName to CreateExerciseSheet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'Hack Sq')
    await user.click(screen.getByText('Create exercise'))

    await waitFor(() =>
      expect(screen.getByTestId('create-sheet-default-name')).toHaveTextContent('Hack Sq'),
    )
  })

  // -------------------------------------------------------------------------
  // Post-create contract (handleSelect used as onCreated)
  // -------------------------------------------------------------------------

  it('calls onExerciseSelected with STRAIGHT_SETS after exercise is created', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'Hack Squat')
    await user.click(screen.getByText('Create exercise'))
    fireEvent.click(await screen.findByText('submit-create'))

    expect(onExerciseSelected).toHaveBeenCalledWith(newExercise, 'STRAIGHT_SETS')
  })

  it('calls onOpenChange(false) after exercise is created', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'Hack Squat')
    await user.click(screen.getByText('Create exercise'))
    fireEvent.click(await screen.findByText('submit-create'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('clears the search query after exercise is created', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'Hack Squat')
    await user.click(screen.getByText('Create exercise'))
    fireEvent.click(await screen.findByText('submit-create'))

    await waitFor(() => expect(screen.getByPlaceholderText('Search exercises')).toHaveValue(''))
  })

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('shows error message when exercises query fails', () => {
    mockExercisesState.isError = true
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    expect(screen.getByText('Failed to load exercises. Please try again.')).toBeInTheDocument()
  })

  it('hides Create exercise CTA when exercises query fails', async () => {
    const user = userEvent.setup()
    mockExercisesState.isError = true
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    // Type a query that would show no-match CTA under normal conditions
    await user.type(screen.getByPlaceholderText('Search exercises'), 'zzz')

    expect(screen.queryByText('Create exercise')).not.toBeInTheDocument()
  })
})
