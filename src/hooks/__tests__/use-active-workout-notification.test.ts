// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { buildWorkoutLog, buildExercise, resetFactoryCounters } from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/domain/types/notification'
import type { DataAdapter } from '@/lib/data-adapter'
import type { LoggedActivityGroup, LoggedActivity, LoggedSet } from '@/domain/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

const mockGetNotificationPreferences = vi.fn()
const mockSendRestTimerNotification = vi.fn()

vi.mock('@/lib/notification-service', () => ({
  getNotificationPreferences: (...args: unknown[]) => mockGetNotificationPreferences(...args),
  sendRestTimerNotification: (...args: unknown[]) => mockSendRestTimerNotification(...args),
}))

import { useActiveWorkout } from '../use-active-workout'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PREFS = { ...DEFAULT_NOTIFICATION_PREFERENCES }

/**
 * Intercept startRestTimer calls by wrapping the store's implementation.
 * Must be called BEFORE renderHook so the hook picks up the wrapped function.
 */
function interceptStartRestTimer() {
  const calls: unknown[][] = []
  const original = useActiveWorkoutStore.getState().startRestTimer

  useActiveWorkoutStore.setState({
    startRestTimer: (...args: Parameters<typeof original>) => {
      calls.push(args)
      // Don't call original -- it uses setInterval which complicates cleanup.
      // We only need to verify the arguments passed.
    },
  })

  return { calls, restore: () => useActiveWorkoutStore.setState({ startRestTimer: original }) }
}

/** Set up a started workout with one exercise so confirmSet has a valid target. */
async function setupWorkoutWithExercise(result: { current: ReturnType<typeof useActiveWorkout> }) {
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

  await act(async () => {
    await result.current.startWorkout('user-1')
  })

  const exercise = buildExercise({ id: 'ex-squat', name: 'Squat' })
  await act(async () => {
    await result.current.addExercise(exercise, 'STRAIGHT_SETS')
  })

  return { createdLog, savedActivity }
}

/** Build a minimal set data object for confirmSet. */
function buildSetData(overrides?: Partial<Omit<LoggedSet, 'id'>>): Omit<LoggedSet, 'id'> {
  return {
    loggedActivityId: 'la-1',
    setNumber: 1,
    setType: 'WORKING' as const,
    completed: false,
    actualReps: 5,
    actualWeight: { value: 225, unit: 'lb' as const },
    ...overrides,
  }
}

/** Mock createLoggedSet to return a saved set. */
function mockCreateLoggedSet(overrides?: Partial<LoggedSet>) {
  const savedSet: LoggedSet = {
    id: 'ls-1',
    loggedActivityId: 'la-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: true,
    actualReps: 5,
    actualWeight: { value: 225, unit: 'lb' as const },
    ...overrides,
  }
  vi.mocked(mockAdapter.createLoggedSet).mockResolvedValue(savedSet)
  return savedSet
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
  useActiveWorkoutStore.getState().discardWorkout()

  mockGetNotificationPreferences.mockResolvedValue(DEFAULT_PREFS)
  mockSendRestTimerNotification.mockResolvedValue(undefined)
})

afterEach(() => {
  useActiveWorkoutStore.getState().cleanup()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('confirmSet notification wiring', () => {
  it('passes onExpired callback to startRestTimer when restSeconds > 0', async () => {
    const spy = interceptStartRestTimer()

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })
    await setupWorkoutWithExercise(result)
    mockCreateLoggedSet()

    await act(async () => {
      await result.current.confirmSet('la-1', buildSetData(), 90, 'Squat')
    })

    // Wait for the async getNotificationPreferences().then() to fire
    await act(async () => {
      await vi.waitFor(() => {
        expect(spy.calls.length).toBeGreaterThan(0)
      })
    })

    const [seconds, exerciseName, setNumber, onExpired] = spy.calls[0]
    expect(seconds).toBe(90)
    expect(exerciseName).toBe('Squat')
    expect(setNumber).toBe(1)
    expect(typeof onExpired).toBe('function')

    // Call the captured onExpired callback
    await act(async () => {
      await (onExpired as () => void)()
    })

    expect(mockSendRestTimerNotification).toHaveBeenCalledWith('Squat', 1, DEFAULT_PREFS)

    spy.restore()
  })

  it('does not start rest timer when restSeconds is 0', async () => {
    const spy = interceptStartRestTimer()

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })
    await setupWorkoutWithExercise(result)
    mockCreateLoggedSet()

    await act(async () => {
      await result.current.confirmSet('la-1', buildSetData(), 0)
    })

    // Give async code a chance to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(spy.calls.length).toBe(0)

    spy.restore()
  })

  it('passes correct exerciseName and setNumber to sendRestTimerNotification', async () => {
    const spy = interceptStartRestTimer()

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })
    await setupWorkoutWithExercise(result)
    mockCreateLoggedSet({ setNumber: 3, actualReps: 8, actualWeight: { value: 185, unit: 'lb' } })

    await act(async () => {
      await result.current.confirmSet('la-1', buildSetData({ setNumber: 3 }), 60, 'Bench Press')
    })

    await act(async () => {
      await vi.waitFor(() => {
        expect(spy.calls.length).toBeGreaterThan(0)
      })
    })

    const onExpired = spy.calls[0][3] as () => void
    expect(typeof onExpired).toBe('function')

    await act(async () => {
      await onExpired()
    })

    expect(mockSendRestTimerNotification).toHaveBeenCalledWith('Bench Press', 3, DEFAULT_PREFS)

    spy.restore()
  })

  it('starts timer without onExpired callback when notification prefs fail to load', async () => {
    mockGetNotificationPreferences.mockRejectedValue(new Error('Storage unavailable'))

    const spy = interceptStartRestTimer()

    const { result } = renderHook(() => useActiveWorkout(), { wrapper: TestWrapper })
    await setupWorkoutWithExercise(result)
    mockCreateLoggedSet()

    // Suppress expected console.error from the catch block
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      await result.current.confirmSet('la-1', buildSetData(), 120, 'Deadlift')
    })

    // Wait for the rejected promise's catch handler to fire
    await act(async () => {
      await vi.waitFor(() => {
        expect(spy.calls.length).toBeGreaterThan(0)
      })
    })

    // startRestTimer should still be called, but without the onExpired callback
    const [seconds, exerciseName, setNumber, onExpired] = spy.calls[0]
    expect(seconds).toBe(120)
    expect(exerciseName).toBe('Deadlift')
    expect(setNumber).toBe(1)
    expect(onExpired).toBeUndefined()

    consoleErrorSpy.mockRestore()
    spy.restore()
  })
})
