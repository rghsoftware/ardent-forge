// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
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

const frequentExerciseA: Exercise = {
  id: 'freq-1',
  name: 'Back Squat',
  aliases: ['squat'],
  category: 'BARBELL',
  movementPattern: 'SQUAT',
  muscleGroups: { primary: ['QUADS'], secondary: ['GLUTES'] },
  equipmentRequired: ['BARBELL'],
  supports1RM: true,
  isBilateral: true,
  isCustom: false,
  isPublic: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

const frequentExerciseB: Exercise = {
  id: 'freq-2',
  name: 'Deadlift',
  aliases: ['dl'],
  category: 'BARBELL',
  movementPattern: 'HINGE',
  muscleGroups: { primary: ['HAMSTRINGS'], secondary: ['GLUTES'] },
  equipmentRequired: ['BARBELL'],
  supports1RM: true,
  isBilateral: true,
  isCustom: false,
  isPublic: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
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
const mockFrequentState = vi.hoisted(() => ({
  data: [] as Exercise[],
  lastCalledUserId: undefined as string | undefined,
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => mockExercisesState,
  useRecentlyUsedExercises: () => mockRecentState,
}))

vi.mock('@/hooks/use-frequent-exercises', () => ({
  useFrequentExercises: (userId: string | undefined) => {
    mockFrequentState.lastCalledUserId = userId
    return { data: mockFrequentState.data }
  },
}))

// Import after mocks are registered
import { AddExerciseSheet } from '../add-exercise-sheet'

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
    mockFrequentState.data = []
    mockFrequentState.lastCalledUserId = undefined
  })

  it('renders the exercise search input', () => {
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search exercises')).toBeInTheDocument()
  })

  it('renders "Add Exercise" heading', () => {
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)
    expect(screen.getByText('Add Exercise')).toBeInTheDocument()
  })

  it('shows "No matches" when search has no results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'zzz')

    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('shows matching exercise when search has results', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'goblet')

    expect(screen.getByText('Goblet Squat')).toBeInTheDocument()
  })

  it('calls onExerciseSelected and closes sheet when exercise is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('Search exercises'), 'goblet')
    await user.click(screen.getByText('Goblet Squat'))

    expect(onExerciseSelected).toHaveBeenCalledWith(testExercise)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error state when exercises query fails', () => {
    mockExercisesState.isError = true
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    expect(
      screen.getByText('Could not load exercises. Check your connection and try again.'),
    ).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    renderWithProviders(<AddExerciseSheet {...defaultProps} open={false} />)
    expect(screen.queryByPlaceholderText('Search exercises')).not.toBeInTheDocument()
  })

  it('passes frequentExercises from useFrequentExercises to ExercisePickerPanel', () => {
    mockFrequentState.data = [frequentExerciseA, frequentExerciseB]
    renderWithProviders(<AddExerciseSheet {...defaultProps} userId="user-123" />)

    expect(screen.getByText('Back Squat')).toBeInTheDocument()
    expect(screen.getByText('Deadlift')).toBeInTheDocument()
  })

  it('calls useFrequentExercises with undefined when no userId is provided', () => {
    renderWithProviders(<AddExerciseSheet {...defaultProps} />)

    expect(mockFrequentState.lastCalledUserId).toBeUndefined()
  })
})
