// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { buildExercise, resetFactoryCounters } from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

// Mock the adapter module -- all hooks call getAdapter() to get the adapter
let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Import hooks after mock is set up
import { useExercises, useExercise, useCreateExercise } from '../use-exercises'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
})

describe('useExercises', () => {
  it('returns exercise list from adapter', async () => {
    const exercises = [buildExercise({ name: 'Squat' }), buildExercise({ name: 'Bench Press' })]
    vi.mocked(mockAdapter.getExercises).mockResolvedValue(exercises)

    const { result } = renderHook(() => useExercises(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Squat')
    expect(result.current.data![1].name).toBe('Bench Press')
  })

  it('passes filters to adapter', async () => {
    vi.mocked(mockAdapter.getExercises).mockResolvedValue([])

    const filters = { category: 'BARBELL' as const }
    renderHook(() => useExercises(filters), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(mockAdapter.getExercises).toHaveBeenCalledWith(filters)
    })
  })

  it('returns empty array when no exercises exist', async () => {
    vi.mocked(mockAdapter.getExercises).mockResolvedValue([])

    const { result } = renderHook(() => useExercises(), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })
})

describe('useExercise', () => {
  it('returns a single exercise by ID', async () => {
    const exercise = buildExercise({ id: 'ex-1', name: 'Deadlift' })
    vi.mocked(mockAdapter.getExercise).mockResolvedValue(exercise)

    const { result } = renderHook(() => useExercise('ex-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.name).toBe('Deadlift')
    expect(mockAdapter.getExercise).toHaveBeenCalledWith('ex-1')
  })

  it('does not fetch when id is empty', async () => {
    const { result } = renderHook(() => useExercise(''), { wrapper: TestWrapper })

    // Query should not be enabled
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getExercise).not.toHaveBeenCalled()
  })
})

describe('useCreateExercise', () => {
  it('calls adapter.createExercise and returns result', async () => {
    const created = buildExercise({ id: 'ex-new', name: 'New Exercise' })
    vi.mocked(mockAdapter.createExercise).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateExercise(), { wrapper: TestWrapper })

    const returned = await result.current.mutateAsync({
      name: 'New Exercise',
      aliases: [],
      category: 'BODYWEIGHT',
      movementPattern: 'PUSH',
      muscleGroups: { primary: ['CHEST'], secondary: [] },
      isBilateral: true,
      supports1RM: false,
      equipmentRequired: ['NONE'],
      isCustom: true,
    })

    expect(mockAdapter.createExercise).toHaveBeenCalled()
    expect(returned.name).toBe('New Exercise')
  })
})
