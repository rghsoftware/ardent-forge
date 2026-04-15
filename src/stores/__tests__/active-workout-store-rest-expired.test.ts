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

    getState().startRestTimer(3, undefined, undefined, onExpired)

    // Tick 1: remaining 3 -> 2
    getState().tickRest()
    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).not.toBeNull()
    expect(getState().restTimer!.remaining).toBe(2)

    // Tick 2: remaining 2 -> 1
    getState().tickRest()
    expect(onExpired).not.toHaveBeenCalled()
    expect(getState().restTimer).not.toBeNull()
    expect(getState().restTimer!.remaining).toBe(1)

    // Tick 3: remaining 1 -> 0, callback fires and timer clears
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

    // Start timer with callback A
    getState().startRestTimer(5, undefined, undefined, callbackA)

    // Start a new timer with callback B before A expires
    getState().startRestTimer(2, undefined, undefined, callbackB)

    // Tick to zero (2 ticks for the second timer)
    getState().tickRest()
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
    // Start rest timer without onExpired parameter
    getState().startRestTimer(1)

    // Tick to zero -- the ?. operator should handle null gracefully
    expect(() => getState().tickRest()).not.toThrow()
    expect(getState().restTimer).toBeNull()
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
