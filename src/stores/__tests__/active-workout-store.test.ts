import { useActiveWorkoutStore } from '@/stores/active-workout-store'
import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
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
  it('startWorkout sets workoutLog and leaves elapsed timer to the log page (D-1)', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    const state = getState()
    expect(state.workoutLog).toEqual(wl)
    expect(state.loggedGroups).toEqual([])
    expect(state.elapsedSeconds).toBe(0)
    expect(state.restTimer).toBeNull()
    expect(state.undoAction).toBeNull()

    // Elapsed is now driven by setElapsedSeconds from the log page, not the store.
    getState().setElapsedSeconds(3)
    expect(getState().elapsedSeconds).toBe(3)
  })

  it('startWorkout throws if already active (L-8)', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    expect(() => {
      getState().startWorkout('user-1', makeWorkoutLog({ id: 'wl-2' }))
    }).toThrow('Cannot start a new workout while one is already active')
  })

  it('finishWorkout clears all state back to initial', () => {
    getState().startWorkout('user-1', makeWorkoutLog())
    getState().setElapsedSeconds(5)
    expect(getState().elapsedSeconds).toBe(5)

    getState().finishWorkout()

    const state = getState()
    expect(state.workoutLog).toBeNull()
    expect(state.loggedGroups).toEqual([])
    expect(state.elapsedSeconds).toBe(0)
    expect(state.restTimer).toBeNull()
    expect(state.undoAction).toBeNull()
  })

  it('discardWorkout clears all state back to initial', () => {
    getState().startWorkout('user-1', makeWorkoutLog())
    getState().setElapsedSeconds(2)

    getState().discardWorkout()

    const state = getState()
    expect(state.workoutLog).toBeNull()
    expect(state.loggedGroups).toEqual([])
    expect(state.elapsedSeconds).toBe(0)
    expect(state.restTimer).toBeNull()
    expect(state.undoAction).toBeNull()
  })

  it('resumeWorkout restores workoutLog, groups, and elapsedSeconds', () => {
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

  it('tickRest corrects remaining to wall-clock value', () => {
    getState().startRestTimer(90)
    // Shift startedAt back 1s to simulate 1s of elapsed time
    useActiveWorkoutStore.setState((s) => ({
      restTimer: s.restTimer ? { ...s.restTimer, startedAt: s.restTimer.startedAt - 1000 } : null,
    }))
    getState().tickRest()

    expect(getState().restTimer!.remaining).toBe(89)
    expect(getState().restTimer!.total).toBe(90)
  })

  it('tickRest clears restTimer when elapsed exceeds total', () => {
    getState().startRestTimer(1)
    // Shift startedAt back 2s so the timer has expired
    useActiveWorkoutStore.setState((s) => ({
      restTimer: s.restTimer ? { ...s.restTimer, startedAt: s.restTimer.startedAt - 2000 } : null,
    }))
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

    const newGroup = makeLoggedActivityGroup({ id: 'lag-new', ordinal: 2 })
    const newActivity = makeLoggedActivity({
      id: 'la-new',
      loggedGroupId: 'lag-new',
      exerciseId: 'ex-2',
    })

    getState().addExerciseToWorkout(newGroup, newActivity)

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
// startProgrammedWorkout
// ===========================================================================

describe('startProgrammedWorkout', () => {
  it('throws when a workout is already active (L-8 invariant)', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    const programmedWl = makeWorkoutLog({
      id: 'wl-programmed',
      programContext: {
        programId: 'prog-1',
        blockId: 'block-1',
        weekNumber: 1,
        dayLabel: 'Day 1',
      },
    })
    const groups: LoggedActivityGroupWithActivities[] = [makeGroupWithActivities()]

    expect(() => {
      getState().startProgrammedWorkout(programmedWl, groups)
    }).toThrow('Cannot start')
  })

  it('accepts workout without programContext (standalone template workout)', () => {
    const wlNoProgramContext = makeWorkoutLog({ id: 'wl-no-ctx' })
    const groups: LoggedActivityGroupWithActivities[] = [makeGroupWithActivities()]

    getState().startProgrammedWorkout(wlNoProgramContext, groups)

    const state = getState()
    expect(state.workoutLog).toEqual(wlNoProgramContext)
    expect(state.loggedGroups).toEqual(groups)
    expect(state.elapsedSeconds).toBe(0)
    expect(state.restTimer).toBeNull()
    expect(state.undoAction).toBeNull()
  })

  it('sets workoutLog and pre-filled groups when valid', () => {
    const programmedWl = makeWorkoutLog({
      id: 'wl-prog',
      programContext: {
        programId: 'prog-1',
        blockId: 'block-1',
        weekNumber: 2,
        dayLabel: 'Day A',
      },
    })
    const groups: LoggedActivityGroupWithActivities[] = [makeGroupWithActivities()]

    getState().startProgrammedWorkout(programmedWl, groups)

    const state = getState()
    expect(state.workoutLog).toEqual(programmedWl)
    expect(state.loggedGroups).toEqual(groups)
    expect(state.elapsedSeconds).toBe(0)
    expect(state.restTimer).toBeNull()
    expect(state.undoAction).toBeNull()

    // Elapsed ticking is now owned by the log page (D-1); use setElapsedSeconds.
    getState().setElapsedSeconds(2)
    expect(getState().elapsedSeconds).toBe(2)
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

// ===========================================================================
// Notes (F020) -- session / activity / set note setters
// ===========================================================================

describe('notes (F020)', () => {
  it('setSessionNote updates overallNotes and noteTags on the active workoutLog', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    getState().setSessionNote({ text: 'low sleep, scaled down', tags: ['LOW ENERGY'] })

    const log = getState().workoutLog
    expect(log?.overallNotes).toBe('low sleep, scaled down')
    expect(log?.noteTags).toEqual(['LOW ENERGY'])
  })

  it('setSessionNote normalizes tags via noteTagSchema transform', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    getState().setSessionNote({ text: '', tags: ['  felt  heavy  ', 'pr attempt'] })

    expect(getState().workoutLog?.noteTags).toEqual(['FELT HEAVY', 'PR ATTEMPT'])
  })

  it('setSessionNote is a no-op without an active workoutLog', () => {
    getState().setSessionNote({ text: 'anything', tags: [] })
    expect(getState().workoutLog).toBeNull()
  })

  it('setSessionNote rejects invalid content at the boundary (silently warns)', () => {
    const wl = makeWorkoutLog({ overallNotes: 'pre-existing' })
    getState().startWorkout('user-1', wl)

    // Tag exceeds 32-char max -- noteContentSchema should reject
    const over = 'A'.repeat(33)
    getState().setSessionNote({ text: 'x', tags: [over] })

    // State unchanged
    expect(getState().workoutLog?.overallNotes).toBe('pre-existing')
  })

  it('setActivityNote updates notes and noteTags on the matching activity', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)
    useActiveWorkoutStore.setState({
      loggedGroups: [makeGroupWithActivities()],
    })

    getState().setActivityNote('la-1', {
      text: 'switched to safety bar',
      tags: ['SUBSTITUTION'],
    })

    const activity = getState().loggedGroups[0].activities[0]
    expect(activity.notes).toBe('switched to safety bar')
    expect(activity.noteTags).toEqual(['SUBSTITUTION'])
  })

  it('setActivityNote does nothing when activityId is not found', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)
    useActiveWorkoutStore.setState({
      loggedGroups: [makeGroupWithActivities()],
    })

    getState().setActivityNote('nope', { text: 'x', tags: [] })

    const activity = getState().loggedGroups[0].activities[0]
    expect(activity.notes).toBeUndefined()
    expect(activity.noteTags).toBeUndefined()
  })

  it('note state survives a crash-recovery snapshot round-trip (JSON serialize/deserialize)', () => {
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)
    useActiveWorkoutStore.setState({
      loggedGroups: [
        {
          ...makeLoggedActivityGroup(),
          activities: [
            {
              ...makeLoggedActivity(),
              sets: [makeLoggedSet()],
            },
          ],
        },
      ],
    })
    getState().setSessionNote({ text: 'session level', tags: ['FAST'] })
    getState().setActivityNote('la-1', { text: 'activity level', tags: ['SCALED'] })

    // Capture the snapshot shape crash-recovery would serialize
    const snapshot = {
      workoutLog: getState().workoutLog,
      loggedGroups: getState().loggedGroups,
      elapsedSeconds: getState().elapsedSeconds,
    }
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot

    expect(roundTripped.workoutLog?.overallNotes).toBe('session level')
    expect(roundTripped.workoutLog?.noteTags).toEqual(['FAST'])
    expect(roundTripped.loggedGroups[0].activities[0].notes).toBe('activity level')
    expect(roundTripped.loggedGroups[0].activities[0].noteTags).toEqual(['SCALED'])
  })
})

// ===========================================================================
// deleteSet (F018 -- PR #109)
// ===========================================================================

describe('deleteSet', () => {
  beforeEach(() => {
    const wl = makeWorkoutLog()
    const group: LoggedActivityGroupWithActivities = {
      ...makeLoggedActivityGroup(),
      activities: [
        {
          ...makeLoggedActivity(),
          sets: [
            makeLoggedSet({ id: 'ls-a', setNumber: 1 }),
            makeLoggedSet({ id: 'ls-b', setNumber: 2 }),
          ],
        },
      ],
    }
    useActiveWorkoutStore.setState({
      workoutLog: wl,
      loggedGroups: [group],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })
  })

  it('removes the target set from its activity', () => {
    getState().deleteSet('la-1', 'ls-a')

    const sets = getState().loggedGroups[0].activities[0].sets
    expect(sets).toHaveLength(1)
    expect(sets[0].id).toBe('ls-b')
  })

  it('clears undoAction when undoAction.setId matches the deleted set', () => {
    useActiveWorkoutStore.setState({
      undoAction: {
        setId: 'ls-a',
        loggedActivityId: 'la-1',
        expiresAt: Date.now() + 10_000,
      },
    })

    getState().deleteSet('la-1', 'ls-a')

    expect(getState().undoAction).toBeNull()
  })

  it('does not clear undoAction when setId does not match', () => {
    const undoAction = {
      setId: 'ls-other',
      loggedActivityId: 'la-1',
      expiresAt: Date.now() + 10_000,
    }
    useActiveWorkoutStore.setState({ undoAction })

    getState().deleteSet('la-1', 'ls-a')

    expect(getState().undoAction).toEqual(undoAction)
  })
})

// ===========================================================================
// unconfirmSet (F018 -- PR #109)
// ===========================================================================

describe('unconfirmSet', () => {
  beforeEach(() => {
    const wl = makeWorkoutLog()
    const group: LoggedActivityGroupWithActivities = {
      ...makeLoggedActivityGroup(),
      activities: [
        {
          ...makeLoggedActivity(),
          sets: [
            makeLoggedSet({ id: 'ls-a', setNumber: 1, completed: true }),
            makeLoggedSet({ id: 'ls-b', setNumber: 2, completed: true }),
          ],
        },
      ],
    }
    useActiveWorkoutStore.setState({
      workoutLog: wl,
      loggedGroups: [group],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })
  })

  it('sets completed=false on the target set', () => {
    getState().unconfirmSet('la-1', 'ls-a')

    const sets = getState().loggedGroups[0].activities[0].sets
    const target = sets.find((s) => s.id === 'ls-a')
    expect(target?.completed).toBe(false)
  })

  it('does not affect other sets', () => {
    getState().unconfirmSet('la-1', 'ls-a')

    const sets = getState().loggedGroups[0].activities[0].sets
    const other = sets.find((s) => s.id === 'ls-b')
    expect(other?.completed).toBe(true)
  })
})

// ===========================================================================
// removeActivity (F018 -- PR #109)
// ===========================================================================

describe('removeActivity', () => {
  beforeEach(() => {
    const wl = makeWorkoutLog()
    const group1: LoggedActivityGroupWithActivities = {
      ...makeLoggedActivityGroup({ id: 'lag-1' }),
      activities: [
        {
          ...makeLoggedActivity({ id: 'la-1', loggedGroupId: 'lag-1' }),
          sets: [makeLoggedSet({ id: 'ls-a', loggedActivityId: 'la-1' })],
        },
      ],
    }
    const group2: LoggedActivityGroupWithActivities = {
      ...makeLoggedActivityGroup({ id: 'lag-2', ordinal: 2 }),
      activities: [
        {
          ...makeLoggedActivity({ id: 'la-2', loggedGroupId: 'lag-2' }),
          sets: [makeLoggedSet({ id: 'ls-b', loggedActivityId: 'la-2' })],
        },
      ],
    }
    useActiveWorkoutStore.setState({
      workoutLog: wl,
      loggedGroups: [group1, group2],
      elapsedSeconds: 0,
      restTimer: null,
      undoAction: null,
    })
  })

  it('removes the target activity (and empties the group)', () => {
    getState().removeActivity('la-1')

    const groups = getState().loggedGroups
    // Group with only the removed activity is pruned
    expect(groups).toHaveLength(1)
    expect(groups[0].id).toBe('lag-2')
    expect(groups[0].activities[0].id).toBe('la-2')
  })

  it('clears undoAction when the undo belongs to the removed activity', () => {
    useActiveWorkoutStore.setState({
      undoAction: {
        setId: 'ls-a',
        loggedActivityId: 'la-1',
        expiresAt: Date.now() + 10_000,
      },
    })

    getState().removeActivity('la-1')

    expect(getState().undoAction).toBeNull()
  })

  it('does not clear undoAction when the undo belongs to a different activity', () => {
    const undoAction = {
      setId: 'ls-b',
      loggedActivityId: 'la-2',
      expiresAt: Date.now() + 10_000,
    }
    useActiveWorkoutStore.setState({ undoAction })

    getState().removeActivity('la-1')

    expect(getState().undoAction).toEqual(undoAction)
  })
})

// ===========================================================================
// skipActivity (F018 -- PR #109)
// ===========================================================================

describe('skipActivity', () => {
  it('adds the activity id to skippedActivityIds', () => {
    getState().skipActivity('la-1')

    const { skippedActivityIds } = getState()
    expect(skippedActivityIds.has('la-1')).toBe(true)
    expect(skippedActivityIds.size).toBe(1)
  })

  it('accumulates multiple skipped activity ids', () => {
    getState().skipActivity('la-1')
    getState().skipActivity('la-2')

    const { skippedActivityIds } = getState()
    expect(skippedActivityIds.size).toBe(2)
    expect(skippedActivityIds.has('la-1')).toBe(true)
    expect(skippedActivityIds.has('la-2')).toBe(true)
  })

  it('finishWorkout resets skippedActivityIds to a fresh empty Set (no shared reference)', () => {
    // Start a workout so finishWorkout has a realistic lifecycle context.
    const wl = makeWorkoutLog()
    getState().startWorkout('user-1', wl)

    getState().skipActivity('la-1')
    getState().skipActivity('la-2')
    expect(getState().skippedActivityIds.size).toBe(2)

    // finishWorkout spreads initialState. If initialState.skippedActivityIds
    // were a shared reference, it would still hold the mutated entries here.
    getState().finishWorkout()

    const { skippedActivityIds } = getState()
    expect(skippedActivityIds.size).toBe(0)
    expect(skippedActivityIds.has('la-1')).toBe(false)
    expect(skippedActivityIds.has('la-2')).toBe(false)

    // Re-skipping after reset should not resurrect the prior entries.
    getState().skipActivity('la-3')
    expect(getState().skippedActivityIds.size).toBe(1)
    expect(getState().skippedActivityIds.has('la-3')).toBe(true)
  })
})
