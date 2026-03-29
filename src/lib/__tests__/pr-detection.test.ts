import { detectPersonalRecords } from '../pr-detection'
import type { WorkoutLog, LoggedActivity, LoggedSet, UserProfile } from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers -- minimal valid objects for test setup
// ---------------------------------------------------------------------------

const now = new Date().toISOString()

function makeWorkoutLog(overrides?: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: 'wl-1',
    userId: 'user-1',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as WorkoutLog
}

function makeActivity(overrides?: Partial<LoggedActivity>): LoggedActivity {
  return {
    id: 'la-1',
    loggedGroupId: 'lag-1',
    exerciseId: 'ex-bench',
    ordinal: 1,
    ...overrides,
  }
}

function makeSet(overrides?: Partial<LoggedSet>): LoggedSet {
  return {
    id: 'ls-1',
    loggedActivityId: 'la-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: true,
    ...overrides,
  } as LoggedSet
}

function makeUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  return {
    id: 'user-1',
    exerciseMaxes: {},
    maxReps: {},
    preferredUnits: 'IMPERIAL',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as UserProfile
}

const exerciseNames: Record<string, string> = {
  'ex-bench': 'Bench Press',
  'ex-pullup': 'Pull-up',
  'ex-squat': 'Back Squat',
}

// ===========================================================================
// detectPersonalRecords
// ===========================================================================

describe('detectPersonalRecords', () => {
  it('returns empty array when sets array is empty', () => {
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets: [] },
      makeUserProfile(),
      exerciseNames,
    )
    expect(result).toEqual([])
  })

  it('returns empty array when new best equals existing (not strictly greater)', () => {
    const profile = makeUserProfile({
      exerciseMaxes: {
        'ex-bench': { weight: { value: 225, unit: 'lb' }, testedAt: now, estimated: false },
      },
    })
    const sets = [
      makeSet({
        actualReps: 1,
        actualWeight: { value: 225, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      profile,
      exerciseNames,
    )
    // 225 === 225, not strictly greater, so no 1RM PR
    const oneRm = result.find((r) => r.type === '1RM')
    expect(oneRm).toBeUndefined()
  })

  it('returns 1RM PR when heaviest single exceeds current exercise max', () => {
    const profile = makeUserProfile({
      exerciseMaxes: {
        'ex-bench': { weight: { value: 225, unit: 'lb' }, testedAt: now, estimated: false },
      },
    })
    const sets = [
      makeSet({
        id: 'ls-1',
        actualReps: 1,
        actualWeight: { value: 230, unit: 'lb' },
      }),
      makeSet({
        id: 'ls-2',
        setNumber: 2,
        actualReps: 1,
        actualWeight: { value: 215, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      profile,
      exerciseNames,
    )
    const oneRm = result.find((r) => r.type === '1RM')
    expect(oneRm).toBeDefined()
    expect(oneRm!.value).toBe(230)
    expect(oneRm!.previousBest).toBe(225)
    expect(oneRm!.exerciseName).toBe('Bench Press')
  })

  it('returns 5RM PR when heaviest 5-rep set is found', () => {
    const sets = [
      makeSet({
        actualReps: 5,
        actualWeight: { value: 185, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      makeUserProfile(),
      exerciseNames,
    )
    const fiveRm = result.find((r) => r.type === '5RM')
    expect(fiveRm).toBeDefined()
    expect(fiveRm!.value).toBe(185)
    expect(fiveRm!.previousBest).toBeNull()
  })

  it('does not return PR from WARMUP sets', () => {
    const sets = [
      makeSet({
        setType: 'WARMUP',
        actualReps: 1,
        actualWeight: { value: 500, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      makeUserProfile(),
      exerciseNames,
    )
    expect(result).toEqual([])
  })

  it('does not return PR from DROP sets', () => {
    const sets = [
      makeSet({
        setType: 'DROP',
        actualReps: 1,
        actualWeight: { value: 500, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      makeUserProfile(),
      exerciseNames,
    )
    expect(result).toEqual([])
  })

  it('handles exercises with no existing max (previousBest = null, still returns PR)', () => {
    const profile = makeUserProfile({ exerciseMaxes: {} })
    const sets = [
      makeSet({
        actualReps: 1,
        actualWeight: { value: 135, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      profile,
      exerciseNames,
    )
    const oneRm = result.find((r) => r.type === '1RM')
    expect(oneRm).toBeDefined()
    expect(oneRm!.value).toBe(135)
    expect(oneRm!.previousBest).toBeNull()
  })

  it('handles workout with no exerciseMaxes in profile', () => {
    // UserProfile where exerciseMaxes is an empty object
    const profile = makeUserProfile()
    const sets = [
      makeSet({
        actualReps: 1,
        actualWeight: { value: 315, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      profile,
      exerciseNames,
    )
    const oneRm = result.find((r) => r.type === '1RM')
    expect(oneRm).toBeDefined()
    expect(oneRm!.value).toBe(315)
    expect(oneRm!.previousBest).toBeNull()
  })

  it('detects max-reps PR for bodyweight exercises', () => {
    const activity = makeActivity({ exerciseId: 'ex-pullup' })
    const sets = [
      makeSet({
        loggedActivityId: activity.id,
        actualReps: 15,
        // no actualWeight -- bodyweight exercise
      }),
    ]
    const profile = makeUserProfile({ maxReps: { 'ex-pullup': 12 } })
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [activity], sets },
      profile,
      exerciseNames,
    )
    const maxReps = result.find((r) => r.type === 'max-reps')
    expect(maxReps).toBeDefined()
    expect(maxReps!.value).toBe(15)
    expect(maxReps!.previousBest).toBe(12)
    expect(maxReps!.unit).toBe('reps')
  })

  it('does not return max-reps PR when reps equal existing max', () => {
    const activity = makeActivity({ exerciseId: 'ex-pullup' })
    const sets = [
      makeSet({
        loggedActivityId: activity.id,
        actualReps: 12,
      }),
    ]
    const profile = makeUserProfile({ maxReps: { 'ex-pullup': 12 } })
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [activity], sets },
      profile,
      exerciseNames,
    )
    const maxReps = result.find((r) => r.type === 'max-reps')
    expect(maxReps).toBeUndefined()
  })

  it('skips incomplete sets', () => {
    const sets = [
      makeSet({
        completed: false,
        actualReps: 1,
        actualWeight: { value: 500, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      { log: makeWorkoutLog(), groups: [], activities: [makeActivity()], sets },
      makeUserProfile(),
      exerciseNames,
    )
    expect(result).toEqual([])
  })

  it('handles multiple exercises in same workout', () => {
    const benchActivity = makeActivity({ id: 'la-bench', exerciseId: 'ex-bench' })
    const squatActivity = makeActivity({ id: 'la-squat', exerciseId: 'ex-squat' })
    const sets = [
      makeSet({
        loggedActivityId: 'la-bench',
        actualReps: 1,
        actualWeight: { value: 225, unit: 'lb' },
      }),
      makeSet({
        id: 'ls-2',
        loggedActivityId: 'la-squat',
        setNumber: 1,
        actualReps: 1,
        actualWeight: { value: 315, unit: 'lb' },
      }),
    ]
    const result = detectPersonalRecords(
      {
        log: makeWorkoutLog(),
        groups: [],
        activities: [benchActivity, squatActivity],
        sets,
      },
      makeUserProfile(),
      exerciseNames,
    )
    const benchPr = result.find((r) => r.exerciseId === 'ex-bench' && r.type === '1RM')
    const squatPr = result.find((r) => r.exerciseId === 'ex-squat' && r.type === '1RM')
    expect(benchPr).toBeDefined()
    expect(squatPr).toBeDefined()
    expect(benchPr!.value).toBe(225)
    expect(squatPr!.value).toBe(315)
  })
})
