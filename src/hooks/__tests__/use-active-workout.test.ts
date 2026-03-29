// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { buildWorkoutLog, buildExercise, resetFactoryCounters } from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import type { DataAdapter } from '@/lib/data-adapter'
import type { LoggedActivityGroup, LoggedActivity, LoggedSet } from '@/domain/types'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import { useActiveWorkout } from '../use-active-workout'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
  // Reset the Zustand store to initial state before each test
  useActiveWorkoutStore.getState().discardWorkout()
})

afterEach(() => {
  useActiveWorkoutStore.getState().cleanup()
})

// ---------------------------------------------------------------------------
// State tests
// ---------------------------------------------------------------------------

describe('useActiveWorkout state', () => {
  it('initially has no active workout', () => {
    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    expect(result.current.isActive).toBe(false)
    expect(result.current.workoutLog).toBeNull()
    expect(result.current.loggedGroups).toEqual([])
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.restTimer).toBeNull()
    expect(result.current.undoAction).toBeNull()
    expect(result.current.isProgrammedWorkout).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Start workout
// ---------------------------------------------------------------------------

describe('startWorkout', () => {
  it('creates a workout log and activates the store', async () => {
    const createdLog = buildWorkoutLog({ id: 'wl-new', userId: 'user-1' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(createdLog)

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    let log: typeof createdLog | undefined
    await act(async () => {
      log = await result.current.startWorkout('user-1')
    })

    expect(log).toBeDefined()
    expect(log!.id).toBe('wl-new')
    expect(mockAdapter.createWorkoutLog).toHaveBeenCalled()
    expect(result.current.isActive).toBe(true)
    expect(result.current.workoutLog?.id).toBe('wl-new')
  })

  it('throws when createWorkoutLog fails', async () => {
    vi.mocked(mockAdapter.createWorkoutLog).mockRejectedValue(new Error('DB error'))

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await expect(act(() => result.current.startWorkout('user-1'))).rejects.toThrow('DB error')
  })
})

// ---------------------------------------------------------------------------
// Add exercise
// ---------------------------------------------------------------------------

describe('addExercise', () => {
  it('creates group and activity, then updates store', async () => {
    const createdLog = buildWorkoutLog({ id: 'wl-1', userId: 'user-1' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(createdLog)

    const savedGroup: LoggedActivityGroup = {
      id: 'lag-1',
      workoutLogId: 'wl-1',
      groupType: 'STRAIGHT_SETS',
      ordinal: 1,
    }
    const savedActivity: LoggedActivity = {
      id: 'la-1',
      loggedGroupId: 'lag-1',
      exerciseId: 'ex-squat',
      ordinal: 1,
    }
    vi.mocked(mockAdapter.createLoggedActivityGroup).mockResolvedValue(savedGroup)
    vi.mocked(mockAdapter.createLoggedActivity).mockResolvedValue(savedActivity)

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.startWorkout('user-1')
    })

    const exercise = buildExercise({ id: 'ex-squat', name: 'Squat' })

    await act(async () => {
      await result.current.addExercise(exercise, 'STRAIGHT_SETS')
    })

    expect(mockAdapter.createLoggedActivityGroup).toHaveBeenCalled()
    expect(mockAdapter.createLoggedActivity).toHaveBeenCalled()
    expect(result.current.loggedGroups).toHaveLength(1)
  })

  it('throws when no active workout', async () => {
    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    const exercise = buildExercise()

    await expect(act(() => result.current.addExercise(exercise, 'STRAIGHT_SETS'))).rejects.toThrow(
      'No active workout',
    )
  })
})

// ---------------------------------------------------------------------------
// Finish workout
// ---------------------------------------------------------------------------

describe('finishWorkout', () => {
  it('marks workout as completed and clears store', async () => {
    const createdLog = buildWorkoutLog({ id: 'wl-1', userId: 'user-1' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(createdLog)
    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue({
      ...createdLog,
      completedAt: '2026-01-15T11:00:00.000Z',
    })

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.startWorkout('user-1')
    })

    expect(result.current.isActive).toBe(true)

    await act(async () => {
      await result.current.finishWorkout()
    })

    expect(mockAdapter.updateWorkoutLog).toHaveBeenCalled()
    expect(result.current.isActive).toBe(false)
    expect(result.current.workoutLog).toBeNull()
  })

  it('throws when no active workout', async () => {
    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await expect(act(() => result.current.finishWorkout())).rejects.toThrow(
      'No active workout to finish',
    )
  })
})

// ---------------------------------------------------------------------------
// Discard workout
// ---------------------------------------------------------------------------

describe('discardWorkout', () => {
  it('deletes workout log and clears store', async () => {
    const createdLog = buildWorkoutLog({ id: 'wl-1', userId: 'user-1' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(createdLog)
    vi.mocked(mockAdapter.deleteWorkoutLog).mockResolvedValue(undefined)

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.startWorkout('user-1')
    })

    expect(result.current.isActive).toBe(true)

    await act(async () => {
      await result.current.discardWorkout()
    })

    expect(mockAdapter.deleteWorkoutLog).toHaveBeenCalledWith('wl-1')
    expect(result.current.isActive).toBe(false)
    expect(result.current.workoutLog).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Resume workout
// ---------------------------------------------------------------------------

describe('resumeWorkout', () => {
  it('hydrates store from full workout data', async () => {
    const log = buildWorkoutLog({ id: 'wl-1', startedAt: new Date().toISOString() })
    const groups: LoggedActivityGroup[] = [
      { id: 'lag-1', workoutLogId: 'wl-1', groupType: 'STRAIGHT_SETS', ordinal: 1 },
    ]
    const activities: LoggedActivity[] = [
      { id: 'la-1', loggedGroupId: 'lag-1', exerciseId: 'ex-1', ordinal: 1 },
    ]
    const sets: LoggedSet[] = [
      {
        id: 'ls-1',
        loggedActivityId: 'la-1',
        setNumber: 1,
        setType: 'WORKING',
        completed: true,
      },
    ]

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    act(() => {
      result.current.resumeWorkout({ log, groups, activities, sets })
    })

    expect(result.current.isActive).toBe(true)
    expect(result.current.workoutLog?.id).toBe('wl-1')
    expect(result.current.loggedGroups).toHaveLength(1)
    expect(result.current.loggedGroups[0].activities).toHaveLength(1)
    expect(result.current.loggedGroups[0].activities[0].sets).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Store-only actions
// ---------------------------------------------------------------------------

describe('store-only actions', () => {
  it('skipRest clears rest timer', async () => {
    const createdLog = buildWorkoutLog({ id: 'wl-1', userId: 'user-1' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(createdLog)

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    await act(async () => {
      await result.current.startWorkout('user-1')
    })

    // skipRest is a store-only action, should not throw even without a rest timer
    act(() => {
      result.current.skipRest()
    })

    expect(result.current.restTimer).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Loading state flags
// ---------------------------------------------------------------------------

describe('loading states', () => {
  it('exposes isStarting flag', () => {
    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })

    // Before any mutation, all loading flags should be false
    expect(result.current.isStarting).toBe(false)
    expect(result.current.isAddingExercise).toBe(false)
    expect(result.current.isConfirmingSet).toBe(false)
    expect(result.current.isFinishing).toBe(false)
    expect(result.current.isDiscarding).toBe(false)
  })
})
