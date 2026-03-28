import { vi } from 'vitest'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  Exercise,
  GroupType,
} from '@/domain/types'
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

function makeLoggedSet(overrides?: Partial<LoggedSet>): LoggedSet {
  return {
    id: 'ls-1',
    loggedActivityId: 'la-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: false,
    ...overrides,
  } as LoggedSet
}

function makeExercise(overrides?: Partial<Exercise>): Exercise {
  return {
    id: 'ex-1',
    createdAt: NOW,
    updatedAt: NOW,
    name: 'Bench Press',
    aliases: [],
    category: 'BARBELL',
    movementPattern: 'PUSH',
    muscleGroups: { primary: ['CHEST'], secondary: ['TRICEPS'] },
    isBilateral: true,
    supports1RM: true,
    equipmentRequired: ['BARBELL', 'BENCH'],
    isCustom: false,
    ...overrides,
  } as Exercise
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
// Initial state snapshot for reset assertions
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  workoutLog: null,
  loggedGroups: [],
  elapsedSeconds: 0,
  restTimer: null,
  undoAction: null,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useActiveWorkoutStore.getState()
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

afterEach(() => {
  // Prevent interval leakage between tests
  getState().cleanup()
  // Reset state fully
  useActiveWorkoutStore.setState({ ...INITIAL_STATE })
})

// ===========================================================================
// Lifecycle
// ===========================================================================

describe('lifecycle', () => {
  it('startWorkout sets workoutLog and starts elapsed timer', () => {
    vi.useFakeTimers()
    try {
      const wl = makeWorkoutLog()
      getState().startWorkout('user-1', wl)

      const state = getState()
      expect(state.workoutLog).toEqual(wl)
      expect(state.loggedGroups).toEqual([])
      expect(state.elapsedSeconds).toBe(0)
      expect(state.restTimer).toBeNull()
      expect(state.undoAction).toBeNull()

      // Advance 3 seconds -- elapsed timer should tick
      vi.advanceTimersByTime(3000)
      expect(getState().elapsedSeconds).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('startWorkout throws if already active (L-8)', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    expect(() => {
      getState().startWorkout('user-1', makeWorkoutLog({ id: 'wl-2' }))
    }).toThrow('Cannot start a new workout while one is already active')
  })

  it('finishWorkout clears all state back to initial', () => {
    vi.useFakeTimers()
    try {
      getState().startWorkout('user-1', makeWorkoutLog())
      vi.advanceTimersByTime(5000)
      expect(getState().elapsedSeconds).toBe(5)

      getState().finishWorkout()

      const state = getState()
      expect(state.workoutLog).toBeNull()
      expect(state.loggedGroups).toEqual([])
      expect(state.elapsedSeconds).toBe(0)
      expect(state.restTimer).toBeNull()
      expect(state.undoAction).toBeNull()

      // Timer should no longer tick
      vi.advanceTimersByTime(3000)
      expect(getState().elapsedSeconds).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('discardWorkout clears all state back to initial', () => {
    vi.useFakeTimers()
    try {
      getState().startWorkout('user-1', makeWorkoutLog())
      vi.advanceTimersByTime(2000)

      getState().discardWorkout()

      const state = getState()
      expect(state.workoutLog).toBeNull()
      expect(state.loggedGroups).toEqual([])
      expect(state.elapsedSeconds).toBe(0)
      expect(state.restTimer).toBeNull()
      expect(state.undoAction).toBeNull()

      // Timer should no longer tick
      vi.advanceTimersByTime(3000)
      expect(getState().elapsedSeconds).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resumeWorkout restores workoutLog, groups, and elapsedSeconds', () => {
    vi.useFakeTimers()
    try {
      const wl = makeWorkoutLog()
      const groups: LoggedActivityGroupWithActivities[] = [makeGroupWithActivities()]
      const elapsed = 120

      getState().resumeWorkout(wl, groups, elapsed)

      const state = getState()
      expect(state.workoutLog).toEqual(wl)
      expect(state.loggedGroups).toEqual(groups)
      expect(state.elapsedSeconds).toBe(120)
      expect(state.restTimer).toBeNull()
      expect(state.undoAction).toBeNull()

      // Elapsed timer should resume ticking
      vi.advanceTimersByTime(2000)
      expect(getState().elapsedSeconds).toBe(122)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ===========================================================================
// Undo
// ===========================================================================

describe('undo', () => {
  beforeEach(() => {
    // Set up a workout with one group and one activity
    const wl = makeWorkoutLog()
    const group = makeGroupWithActivities()
    useActiveWorkoutStore.setState({
      workoutLog: wl,
      loggedGroups: [group],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })
  })

  it('confirmSet creates undoAction with correct setId and loggedActivityId', () => {
    const newSet = makeLoggedSet({ id: 'ls-new' })
    getState().confirmSet('la-1', newSet)

    const { undoAction } = getState()
    expect(undoAction).not.toBeNull()
    expect(undoAction!.setId).toBe('ls-new')
    expect(undoAction!.loggedActivityId).toBe('la-1')
  })

  it('confirmSet sets undoAction.expiresAt ~10s in the future', () => {
    const before = Date.now()
    const newSet = makeLoggedSet({ id: 'ls-new' })
    getState().confirmSet('la-1', newSet)
    const after = Date.now()

    const { undoAction } = getState()
    expect(undoAction).not.toBeNull()
    // UNDO_WINDOW_MS is 10_000
    expect(undoAction!.expiresAt).toBeGreaterThanOrEqual(before + 10_000)
    expect(undoAction!.expiresAt).toBeLessThanOrEqual(after + 10_000)
  })

  it('undoLastSet removes the targeted set from the correct activity', () => {
    const newSet = makeLoggedSet({ id: 'ls-undo-target' })
    getState().confirmSet('la-1', newSet)

    // Verify set was added
    const activity = getState().loggedGroups[0].activities[0]
    expect(activity.sets).toHaveLength(1)
    expect(activity.sets[0].id).toBe('ls-undo-target')

    // Undo
    getState().undoLastSet()

    const afterUndo = getState()
    expect(afterUndo.loggedGroups[0].activities[0].sets).toHaveLength(0)
    expect(afterUndo.undoAction).toBeNull()
  })

  it('undoLastSet does nothing when undoAction is null', () => {
    // Confirm state has no undoAction
    expect(getState().undoAction).toBeNull()

    // Calling undoLastSet should not throw
    getState().undoLastSet()

    // State is unchanged
    expect(getState().loggedGroups[0].activities[0].sets).toHaveLength(0)
  })

  it('second confirmSet overwrites the previous undoAction', () => {
    const set1 = makeLoggedSet({ id: 'ls-first' })
    const set2 = makeLoggedSet({ id: 'ls-second', setNumber: 2 })

    getState().confirmSet('la-1', set1)
    expect(getState().undoAction!.setId).toBe('ls-first')

    getState().confirmSet('la-1', set2)
    expect(getState().undoAction!.setId).toBe('ls-second')

    // Both sets should be in the activity
    expect(getState().loggedGroups[0].activities[0].sets).toHaveLength(2)
  })
})

// ===========================================================================
// Rest timer
// ===========================================================================

describe('rest timer', () => {
  it('startRestTimer sets restTimer with correct remaining and total', () => {
    getState().startRestTimer(90)

    const { restTimer } = getState()
    expect(restTimer).not.toBeNull()
    expect(restTimer!.remaining).toBe(90)
    expect(restTimer!.total).toBe(90)
  })

  it('tickRest decrements remaining by 1', () => {
    getState().startRestTimer(90)
    getState().tickRest()

    expect(getState().restTimer!.remaining).toBe(89)
    expect(getState().restTimer!.total).toBe(90)
  })

  it('tickRest clears restTimer when remaining reaches 0', () => {
    getState().startRestTimer(1)

    // One tick brings remaining to 0 (or below), triggering auto-clear
    getState().tickRest()

    expect(getState().restTimer).toBeNull()
  })

  it('skipRest clears restTimer immediately', () => {
    getState().startRestTimer(90)
    expect(getState().restTimer).not.toBeNull()

    getState().skipRest()
    expect(getState().restTimer).toBeNull()
  })

  it('adjustRest applies positive delta to remaining and total', () => {
    getState().startRestTimer(60)
    getState().adjustRest(30)

    const { restTimer } = getState()
    expect(restTimer!.remaining).toBe(90)
    expect(restTimer!.total).toBe(90)
  })

  it('adjustRest applies negative delta, floors at 0', () => {
    getState().startRestTimer(20)
    getState().adjustRest(-30)

    const { restTimer } = getState()
    expect(restTimer!.remaining).toBe(0)
    expect(restTimer!.total).toBe(20)
  })
})

// ===========================================================================
// Nested updates
// ===========================================================================

describe('nested updates', () => {
  it('confirmSet targets the correct activity among multiple groups', () => {
    const group1 = makeGroupWithActivities({ id: 'lag-1' }, { id: 'la-1', loggedGroupId: 'lag-1' })
    const group2 = makeGroupWithActivities(
      { id: 'lag-2', ordinal: 2 },
      { id: 'la-2', loggedGroupId: 'lag-2' },
    )

    useActiveWorkoutStore.setState({
      workoutLog: makeWorkoutLog(),
      loggedGroups: [group1, group2],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })

    // Confirm a set for the second activity
    const newSet = makeLoggedSet({ id: 'ls-g2', loggedActivityId: 'la-2' })
    getState().confirmSet('la-2', newSet)

    const state = getState()
    // First group should be untouched
    expect(state.loggedGroups[0].activities[0].sets).toHaveLength(0)
    // Second group should have the new set
    expect(state.loggedGroups[1].activities[0].sets).toHaveLength(1)
    expect(state.loggedGroups[1].activities[0].sets[0].id).toBe('ls-g2')
  })

  it('addExerciseToWorkout preserves existing groups', () => {
    const existingGroup = makeGroupWithActivities()
    useActiveWorkoutStore.setState({
      workoutLog: makeWorkoutLog(),
      loggedGroups: [existingGroup],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })

    const exercise = makeExercise({ id: 'ex-2', name: 'Squat' })
    const newGroup = makeLoggedActivityGroup({ id: 'lag-new', ordinal: 2 })
    const newActivity = makeLoggedActivity({
      id: 'la-new',
      loggedGroupId: 'lag-new',
      exerciseId: 'ex-2',
    })

    getState().addExerciseToWorkout(exercise, 'STRAIGHT_SETS', newGroup, newActivity)

    const state = getState()
    expect(state.loggedGroups).toHaveLength(2)
    // Original group is preserved
    expect(state.loggedGroups[0].id).toBe('lag-1')
    expect(state.loggedGroups[0].activities[0].id).toBe('la-1')
    // New group was added
    expect(state.loggedGroups[1].id).toBe('lag-new')
    expect(state.loggedGroups[1].activities[0].id).toBe('la-new')
    expect(state.loggedGroups[1].activities[0].sets).toEqual([])
  })
})

// ===========================================================================
// Cleanup
// ===========================================================================

describe('cleanup', () => {
  it('cleanup() can be called without throwing even when no intervals are active', () => {
    // No workout started, no intervals active
    expect(() => getState().cleanup()).not.toThrow()
  })
})
