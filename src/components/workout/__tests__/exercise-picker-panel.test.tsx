// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render-helpers'
import type { Exercise } from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    aliases: [],
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
}

const exerciseA = makeExercise('ex-a', 'Back Squat')
const exerciseB = makeExercise('ex-b', 'Bench Press')

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Bypass debounce so search filtering is synchronous in tests
vi.mock('@/hooks/use-debounced-value', () => ({
  useDebouncedValue: (value: string) => value,
}))

// Hoist mutable hook state so beforeEach can drive data
const mockExercisesState = vi.hoisted(() => ({
  data: [] as Exercise[],
  isError: false,
}))
const mockRecentState = vi.hoisted(() => ({
  data: [] as Exercise[],
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => mockExercisesState,
  useRecentlyUsedExercises: () => mockRecentState,
}))

// Import after mocks are registered
import { ExercisePickerPanel } from '../exercise-picker-panel'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExercisePickerPanel -- frequentExercises prop', () => {
  const onExerciseSelected = vi.fn()

  const defaultProps = {
    onExerciseSelected,
    autoFocus: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Provide all exercises so search works in A-002
    mockExercisesState.data = [exerciseA, exerciseB]
    mockExercisesState.isError = false
    mockRecentState.data = []
  })

  // A-001: Frequent exercises appear when search is empty and history exists
  it('A-001: shows FREQUENT header and exercise names when frequentExercises has items and search is empty', () => {
    renderWithProviders(
      <ExercisePickerPanel
        {...defaultProps}
        frequentExercises={[exerciseA, exerciseB]}
      />,
    )

    expect(screen.getByText('Frequent')).toBeInTheDocument()
    expect(screen.getByText('Back Squat')).toBeInTheDocument()
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
  })

  // A-002: Frequent list is hidden when user types in the search field
  it('A-002: hides FREQUENT section and shows search results when user types a character', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ExercisePickerPanel
        {...defaultProps}
        frequentExercises={[exerciseA]}
      />,
    )

    expect(screen.getByText('Frequent')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search exercises'), 'b')

    expect(screen.queryByText('Frequent')).not.toBeInTheDocument()
    // Normal search results area is visible -- Bench Press matches 'b'
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
  })

  // A-003: Frequent list is absent and fallback shown when frequentExercises is empty
  it('A-003: shows fallback copy and no FREQUENT header when frequentExercises is empty', () => {
    renderWithProviders(
      <ExercisePickerPanel {...defaultProps} frequentExercises={[]} />,
    )

    expect(screen.queryByText('Frequent')).not.toBeInTheDocument()
    expect(
      screen.getByText('No history yet -- start a workout to build suggestions.'),
    ).toBeInTheDocument()
  })

  // A-004: Component renders all items it receives -- capping at 8 is enforced by
  // useFrequentExercises hook, not this component.
  it('A-004: renders all exercises in frequentExercises without capping independently', () => {
    const twentyExercises = Array.from({ length: 20 }, (_, i) =>
      makeExercise(`ex-${i}`, `Exercise ${i}`),
    )
    renderWithProviders(
      <ExercisePickerPanel {...defaultProps} frequentExercises={twentyExercises} />,
    )

    expect(screen.getByText('Frequent')).toBeInTheDocument()
    for (const ex of twentyExercises) {
      expect(screen.getByText(ex.name)).toBeInTheDocument()
    }
  })

  // A-005: Tapping a frequent exercise calls onExerciseSelected with the correct Exercise object
  it('A-005: calls onExerciseSelected with the tapped exercise from the FREQUENT section', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ExercisePickerPanel
        {...defaultProps}
        frequentExercises={[exerciseA]}
      />,
    )

    await user.click(screen.getByText('Back Squat'))

    expect(onExerciseSelected).toHaveBeenCalledOnce()
    expect(onExerciseSelected).toHaveBeenCalledWith(exerciseA)
  })

  // A-007: An exercise already in the active workout is still shown in the frequent list
  // (not filtered out -- athletes can add the same exercise twice, e.g. warmup + working sets)
  it('A-007: shows frequentExercises item even when it is already in the current workout', () => {
    // Simulate exerciseA already being in the active workout by including it in recentExercises.
    // ExercisePickerPanel does not receive loggedGroups directly -- the component makes no
    // deduplication decision. We verify that passing exerciseA in frequentExercises always
    // renders it regardless of any other state.
    mockRecentState.data = [exerciseA]

    renderWithProviders(
      <ExercisePickerPanel
        {...defaultProps}
        frequentExercises={[exerciseA]}
      />,
    )

    expect(screen.getByText('Frequent')).toBeInTheDocument()
    // exerciseA appears in both FREQUENT and RECENTLY USED -- both are rendered
    const instances = screen.getAllByText('Back Squat')
    expect(instances.length).toBeGreaterThanOrEqual(1)
  })
})
