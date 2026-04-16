// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { buildExercise, resetFactoryCounters } from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { Exercise } from '@/domain/types'

// Mock the adapter module
let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Mock useExercises so we can control the allExercises cache independently
let mockAllExercises: Exercise[] = []

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: () => ({ data: mockAllExercises }),
}))

// Import hook after mocks are set up
import { useFrequentExercises } from '../use-frequent-exercises'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
  mockAllExercises = []
})

describe('useFrequentExercises', () => {
  it('A-008 -- returns full Exercise objects for IDs returned by adapter', async () => {
    const ex1 = buildExercise({ id: 'id-1', name: 'Squat' })
    const ex2 = buildExercise({ id: 'id-2', name: 'Bench Press' })
    mockAllExercises = [ex1, ex2, buildExercise({ id: 'id-3', name: 'Deadlift' })]

    vi.mocked(mockAdapter.getFrequentExerciseIds).mockResolvedValue(['id-1', 'id-2'])

    const { result } = renderHook(() => useFrequentExercises('user-001'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0]).toEqual(ex1)
    expect(result.current.data![1]).toEqual(ex2)
  })

  it('A-006 -- preserves order returned by adapter (frequency rank)', async () => {
    const exA = buildExercise({ id: 'id-a', name: 'Exercise A' })
    const exB = buildExercise({ id: 'id-b', name: 'Exercise B' })
    mockAllExercises = [exA, exB]

    // Adapter returns b before a (b has higher set count)
    vi.mocked(mockAdapter.getFrequentExerciseIds).mockResolvedValue(['id-b', 'id-a'])

    const { result } = renderHook(() => useFrequentExercises('user-001'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0]).toEqual(exB)
    expect(result.current.data![1]).toEqual(exA)
  })

  it('is disabled when userId is undefined', () => {
    mockAllExercises = [buildExercise({ id: 'id-1' })]

    const { result } = renderHook(() => useFrequentExercises(undefined), {
      wrapper: TestWrapper,
    })

    // Query should not be enabled -- fetchStatus is idle, adapter never called
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getFrequentExerciseIds).not.toHaveBeenCalled()
  })

  it('silently drops unknown IDs not in the exercise cache', async () => {
    const knownExercise = buildExercise({ id: 'id-known', name: 'Known Exercise' })
    mockAllExercises = [knownExercise]

    // Adapter returns a known ID and an ID not in the cache
    vi.mocked(mockAdapter.getFrequentExerciseIds).mockResolvedValue(['id-known', 'id-unknown'])

    const { result } = renderHook(() => useFrequentExercises('user-001'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0]).toEqual(knownExercise)
  })
})
