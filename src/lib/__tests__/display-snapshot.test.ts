import { describe, it, expect, vi } from 'vitest'
import { buildDisplaySnapshot } from '@/lib/display-snapshot'
import type { SnapshotContext } from '@/lib/display-snapshot'
import type { WorkoutLog } from '@/domain/types/workout-log'
import type {
  LoggedActivityGroupWithActivities,
  LoggedActivityWithSets,
} from '@/stores/active-workout-store'
import type { LoggedSet } from '@/domain/types/workout-log'

// ---------------------------------------------------------------------------
// Helpers -- minimal valid fixtures
// ---------------------------------------------------------------------------

function makeWorkoutLog(overrides?: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: 'log-1',
    createdAt: '2026-04-03T09:00:00Z',
    updatedAt: '2026-04-03T09:00:00Z',
    userId: 'user-abc',
    title: 'Morning Strength',
    startedAt: '2026-04-03T09:00:00Z',
    ...overrides,
  } as WorkoutLog
}

function makeSet(overrides?: Partial<LoggedSet>): LoggedSet {
  return {
    id: 'set-1',
    loggedActivityId: 'act-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: true,
    actualReps: 5,
    actualWeight: { value: 225, unit: 'lb' },
    prescribed: {
      reps: 5,
      weight: { value: 225, unit: 'lb' },
    },
    ...overrides,
  } as LoggedSet
}

function makeActivity(
  exerciseId: string,
  sets: LoggedSet[] = [makeSet()],
): LoggedActivityWithSets {
  return {
    id: `act-${exerciseId}`,
    loggedGroupId: 'group-1',
    exerciseId,
    ordinal: 1,
    sets,
  } as LoggedActivityWithSets
}

function makeGroup(
  activities: LoggedActivityWithSets[] = [makeActivity('ex-1')],
): LoggedActivityGroupWithActivities {
  return {
    id: 'group-1',
    workoutLogId: 'log-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    activities,
  } as LoggedActivityGroupWithActivities
}

function makeContext(overrides?: Partial<SnapshotContext>): SnapshotContext {
  return {
    userId: 'user-abc',
    displayName: 'Robert',
    exerciseNameMap: {
      'ex-1': 'Bench Press',
      'ex-2': 'Squat',
    },
    sessionType: 'STRENGTH',
    ...overrides,
  }
}

function makeState(overrides?: {
  workoutLog?: WorkoutLog | null
  loggedGroups?: LoggedActivityGroupWithActivities[]
  restTimer?: { remaining: number; total: number } | null
}) {
  return {
    workoutLog: makeWorkoutLog(),
    loggedGroups: [makeGroup()],
    restTimer: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildDisplaySnapshot
// ---------------------------------------------------------------------------

describe('buildDisplaySnapshot', () => {
  it('produces correct session_name, current_exercise, exercise_index, and total_exercises', () => {
    const state = makeState()
    const context = makeContext()
    const snapshot = buildDisplaySnapshot(state, context)

    expect(snapshot.session_name).toBe('Morning Strength')
    expect(snapshot.current_exercise).toBe('Bench Press')
    expect(snapshot.exercise_index).toBe(0)
    expect(snapshot.total_exercises).toBe(1)
  })

  it('maps prescribed and actual set data correctly', () => {
    const set = makeSet({
      setNumber: 2,
      prescribed: { reps: 8, weight: { value: 185, unit: 'lb' } },
      actualReps: 7,
      actualWeight: { value: 185, unit: 'lb' },
      completed: true,
    })
    const state = makeState({
      loggedGroups: [makeGroup([makeActivity('ex-1', [set])])],
    })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.sets).toHaveLength(1)
    expect(snapshot.sets[0]).toEqual({
      set_number: 2,
      prescribed: { reps: 8, weight: { value: 185, unit: 'lb' } },
      actual: { reps: 7, weight: { value: 185, unit: 'lb' } },
      completed: true,
    })
  })

  it('omits prescribed when not fully present on the logged set', () => {
    const set = makeSet({
      setNumber: 1,
      prescribed: undefined,
      actualReps: 5,
      actualWeight: { value: 225, unit: 'lb' },
      completed: true,
    })
    const state = makeState({
      loggedGroups: [makeGroup([makeActivity('ex-1', [set])])],
    })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.sets[0].prescribed).toBeUndefined()
    expect(snapshot.sets[0].actual).toEqual({
      reps: 5,
      weight: { value: 225, unit: 'lb' },
    })
  })

  it('produces rest_timer { state: "idle" } when restTimer is null', () => {
    const state = makeState({ restTimer: null })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.rest_timer).toEqual({ state: 'idle' })
  })

  it('produces rest_timer { state: "running" } with started_at and total_seconds when active', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const state = makeState({
      restTimer: { remaining: 50, total: 90 },
    })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.rest_timer.state).toBe('running')
    if (snapshot.rest_timer.state === 'running') {
      expect(snapshot.rest_timer.total_seconds).toBe(90)
      // started_at should be an ISO string roughly (total - remaining) seconds ago
      const startedMs = new Date(snapshot.rest_timer.started_at).getTime()
      const elapsedSeconds = 90 - 50 // 40 seconds elapsed
      expect(startedMs).toBe(now - elapsedSeconds * 1000)
    }

    vi.restoreAllMocks()
  })

  it('falls back to "Unknown Exercise" when exercise ID is not in the name map', () => {
    const unknownActivity = makeActivity('ex-unknown', [makeSet()])
    const state = makeState({
      loggedGroups: [makeGroup([unknownActivity])],
    })
    const context = makeContext({ exerciseNameMap: {} })
    const snapshot = buildDisplaySnapshot(state, context)

    expect(snapshot.current_exercise).toBe('Unknown Exercise')
  })

  it('sets is_visible to true always', () => {
    const snapshot = buildDisplaySnapshot(makeState(), makeContext())
    expect(snapshot.is_visible).toBe(true)
  })

  it('defaults session_name to "Ad Hoc Workout" when title is undefined', () => {
    const state = makeState({
      workoutLog: makeWorkoutLog({ title: undefined }),
    })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.session_name).toBe('Ad Hoc Workout')
  })

  it('throws when workoutLog is null', () => {
    const state = makeState({ workoutLog: null })

    expect(() => buildDisplaySnapshot(state, makeContext())).toThrow(
      'buildDisplaySnapshot requires an active workout',
    )
  })

  it('handles multiple groups with multiple activities for correct index and total', () => {
    const act1 = makeActivity('ex-1', [makeSet()])
    const act2 = makeActivity('ex-2', [makeSet({ id: 'set-2', setNumber: 1 })])
    const group1 = makeGroup([act1])
    const group2: LoggedActivityGroupWithActivities = {
      ...makeGroup([act2]),
      id: 'group-2',
      ordinal: 2,
    }
    const state = makeState({ loggedGroups: [group1, group2] })
    const context = makeContext()
    const snapshot = buildDisplaySnapshot(state, context)

    expect(snapshot.total_exercises).toBe(2)
    expect(snapshot.exercise_index).toBe(1)
    // Current exercise is the last in the flattened list
    expect(snapshot.current_exercise).toBe('Squat')
  })

  it('handles empty loggedGroups with sensible defaults', () => {
    const state = makeState({ loggedGroups: [] })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.current_exercise).toBe('No Exercise')
    expect(snapshot.exercise_index).toBe(0)
    expect(snapshot.total_exercises).toBe(1) // Math.max(0, 1)
    expect(snapshot.sets).toEqual([])
  })

  it('passes through userId and displayName from context', () => {
    const context = makeContext({ userId: 'u-99', displayName: 'Athlete' })
    const snapshot = buildDisplaySnapshot(makeState(), context)

    expect(snapshot.user_id).toBe('u-99')
    expect(snapshot.display_name).toBe('Athlete')
  })

  it('passes through sessionType from context', () => {
    const context = makeContext({ sessionType: 'CONDITIONING' })
    const snapshot = buildDisplaySnapshot(makeState(), context)

    expect(snapshot.session_type).toBe('CONDITIONING')
  })

  it('passes through workout_started_at from workoutLog', () => {
    const state = makeState({
      workoutLog: makeWorkoutLog({ startedAt: '2026-04-03T15:30:00Z' }),
    })
    const snapshot = buildDisplaySnapshot(state, makeContext())

    expect(snapshot.workout_started_at).toBe('2026-04-03T15:30:00Z')
  })
})
