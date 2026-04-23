import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import type { WorkoutLog, LoggedActivityGroup, LoggedActivity, GroupType } from '@/domain/types'
import type { LoggedActivityGroupWithActivities } from '@/stores/active-workout-store'

// ---------------------------------------------------------------------------
// Fixtures -- minimal objects satisfying required fields
// ---------------------------------------------------------------------------

const NOW = '2026-03-27T10:00:00Z'

function makeWorkoutLog(overrides?: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: 'wl-1',
    createdAt: NOW,
    updatedAt: NOW,
    userId: 'user-1',
    startedAt: NOW,
    ...overrides,
  } as WorkoutLog
}

function makeLoggedActivityGroup(overrides?: Partial<LoggedActivityGroup>): LoggedActivityGroup {
  return {
    id: 'lag-1',
    workoutLogId: 'wl-1',
    groupType: 'STRAIGHT_SETS' as GroupType,
    ordinal: 1,
    ...overrides,
  } as LoggedActivityGroup
}

function makeLoggedActivity(overrides?: Partial<LoggedActivity>): LoggedActivity {
  return {
    id: 'la-1',
    loggedGroupId: 'lag-1',
    exerciseId: 'ex-1',
    ordinal: 1,
    ...overrides,
  } as LoggedActivity
}

function makeGroupWithActivities(
  groupOverrides?: Partial<LoggedActivityGroup>,
  activityOverrides?: Partial<LoggedActivity>,
): LoggedActivityGroupWithActivities {
  return {
    ...makeLoggedActivityGroup(groupOverrides),
    activities: [
      {
        ...makeLoggedActivity(activityOverrides),
        sets: [],
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useActiveWorkoutStore.getState()
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  // Prevent interval leakage between tests
  getState().cleanup()
  // Reset state fully
  useActiveWorkoutStore.setState({
    workoutLog: null,
    loggedGroups: [],
    elapsedSeconds: 0,
    restTimer: null,
    undoAction: null,
  })
  vi.useRealTimers()
})

// ===========================================================================
// _onRestExpired callback mechanism
// ===========================================================================

describe('_onRestExpired callback', () => {
  it('onExpired callback fires exactly once when browser timer counts to zero', () => {
    const onExpired = vi.fn()
    const start = Date.now()

    getState().startRestTimer(3, undefined, undefined, onExpired)

    // Tick 1: 1s elapsed, remaining -> 2
    vi.setSystemTime(start + 1000)
    getState().tickRest()
    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).not.toBeNull()
    expect(getState().restTimer!.remaining).toBe(2)

    // Tick 2: 2s elapsed, remaining -> 1
    vi.setSystemTime(start + 2000)
    getState().tickRest()
    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).not.toBeNull()
    expect(getState().restTimer!.remaining).toBe(1)

    // Tick 3: 3s elapsed, remaining -> 0, callback fires and timer clears
    vi.setSystemTime(start + 3000)
    getState().tickRest()
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(getState().restTimer).toBeNull()

    // Subsequent ticks should not fire the callback again
    getState().tickRest()
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('onExpired callback is NOT called on skipRest()', () => {
    const onExpired = vi.fn()

    getState().startRestTimer(60, undefined, undefined, onExpired)
    expect(getState().restTimer).not.toBeNull()

    getState().skipRest()

    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).toBeNull()
  })

  it('onExpired callback is cleared when a new timer starts', () => {
    const callbackA = vi.fn()
    const callbackB = vi.fn()

    // Start timer with callback A, then immediately replace with callback B
    getState().startRestTimer(5, undefined, undefined, callbackA)
    const start = Date.now()
    getState().startRestTimer(2, undefined, undefined, callbackB)

    // Tick to zero (2 ticks for the second timer)
    vi.setSystemTime(start + 1000)
    getState().tickRest()
    vi.setSystemTime(start + 2000)
    getState().tickRest()

    // Only callback B should have been called
    expect(callbackA).not.toHaveBeenCalled()
    expect(callbackB).toHaveBeenCalledTimes(1)
    expect(getState().restTimer).toBeNull()
  })

  it('cleanup() clears onExpired without calling it', () => {
    const onExpired = vi.fn()

    getState().startRestTimer(30, undefined, undefined, onExpired)
    expect(getState().restTimer).not.toBeNull()

    getState().cleanup()

    expect(onExpired).not.toHaveBeenCalled()

    // Ticking after cleanup should not fire the callback (restTimer was not
    // cleared by cleanup itself -- it only clears intervals and the callback).
    // However, the module-level _onRestExpired is now null, so even if we
    // manually tick, the callback reference is gone.
  })

  it('onExpired is null when no callback provided -- ticking to zero does not throw', () => {
    const start = Date.now()
    getState().startRestTimer(1)

    // Advance to expiry and tick -- the ?. operator should handle null gracefully
    vi.setSystemTime(start + 1000)
    expect(() => getState().tickRest()).not.toThrow()
    expect(getState().restTimer).toBeNull()
  })

  it('onExpired throwing during tickRest still clears timer state', () => {
    const throwing = vi.fn().mockImplementation(() => {
      throw new Error('callback error')
    })
    const start = Date.now()
    getState().startRestTimer(1, undefined, undefined, throwing)

    // Advance to expiry -- error is caught internally, does not propagate
    vi.setSystemTime(start + 1000)
    expect(() => getState().tickRest()).not.toThrow()
    expect(getState().restTimer).toBeNull()
    expect(throwing).toHaveBeenCalledTimes(1)

    // Subsequent ticks must not fire the callback again
    getState().tickRest()
    expect(throwing).toHaveBeenCalledTimes(1)
  })

  it('onExpired throwing during recalcRestTimer still clears timer state', () => {
    const throwing = vi.fn().mockImplementation(() => {
      throw new Error('callback error')
    })
    const start = Date.now()
    getState().startRestTimer(60, undefined, undefined, throwing)

    // Advance clock past expiry -- error is caught internally, does not propagate
    vi.setSystemTime(start + 70_000)
    expect(() => getState().recalcRestTimer()).not.toThrow()
    expect(getState().restTimer).toBeNull()
    expect(throwing).toHaveBeenCalledTimes(1)

    // Subsequent calls must be no-ops
    getState().recalcRestTimer()
    expect(throwing).toHaveBeenCalledTimes(1)
  })

  it('finishWorkout clears onExpired without calling it', () => {
    const onExpired = vi.fn()

    // Start a workout so finishWorkout has something to clear
    getState().startWorkout('user-1', makeWorkoutLog())
    useActiveWorkoutStore.setState({
      loggedGroups: [makeGroupWithActivities()],
    })

    getState().startRestTimer(60, 'Bench Press', 3, onExpired)
    expect(getState().restTimer).not.toBeNull()

    getState().finishWorkout()

    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).toBeNull()
    expect(getState().workoutLog).toBeNull()
  })

  it('recalcRestTimer fires onExpired and nulls restTimer when timer expired', () => {
    const onExpired = vi.fn()
    const start = Date.now()
    getState().startRestTimer(60, undefined, undefined, onExpired)

    // Advance clock past expiry
    vi.setSystemTime(start + 70_000)

    getState().recalcRestTimer()

    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(getState().restTimer).toBeNull()
  })

  it('recalcRestTimer corrects remaining to wall-clock value when timer still running', () => {
    const start = Date.now()
    getState().startRestTimer(60)

    // Advance clock by 20s
    vi.setSystemTime(start + 20_000)

    getState().recalcRestTimer()

    expect(getState().restTimer).not.toBeNull()
    expect(getState().restTimer!.remaining).toBe(40)
  })

  it('recalcRestTimer is a no-op when restTimer is null', () => {
    expect(getState().restTimer).toBeNull()
    expect(() => getState().recalcRestTimer()).not.toThrow()
  })

  it('recalcRestTimer fires onExpired at exact expiry boundary', () => {
    const onExpired = vi.fn()
    const start = Date.now()
    getState().startRestTimer(60, undefined, undefined, onExpired)

    vi.setSystemTime(start + 60_000)

    getState().recalcRestTimer()

    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(getState().restTimer).toBeNull()
  })

  it('adjustRest negative delta shifts startedAt earlier and wall-clock recalc confirms it', () => {
    const start = Date.now()
    getState().startRestTimer(60)

    getState().adjustRest(-30)

    const timer = getState().restTimer!
    // startedAt should have been shifted 30s into the past
    expect(timer.startedAt).toBeLessThanOrEqual(start - 30_000 + 50) // 50ms tolerance

    // Wall-clock recalc after the shift should yield ~30s remaining
    vi.setSystemTime(start)
    getState().recalcRestTimer()
    const afterRecalc = getState().restTimer!
    expect(afterRecalc.remaining).toBeGreaterThanOrEqual(29)
    expect(afterRecalc.remaining).toBeLessThanOrEqual(30)
  })

  it('discardWorkout clears onExpired without calling it', () => {
    const onExpired = vi.fn()

    // Start a workout so discardWorkout has something to clear
    getState().startWorkout('user-1', makeWorkoutLog())
    useActiveWorkoutStore.setState({
      loggedGroups: [makeGroupWithActivities()],
    })

    getState().startRestTimer(60, 'Squat', 1, onExpired)
    expect(getState().restTimer).not.toBeNull()

    getState().discardWorkout()

    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).toBeNull()
    expect(getState().workoutLog).toBeNull()
  })
})
