import { workoutLogSchema, loggedSetSchema } from '@/domain/types'

// Minimal base for a valid WorkoutLog
const baseWorkoutLog = {
  id: 'wl-1',
  createdAt: '2025-01-15T14:00:00Z',
  updatedAt: '2025-01-15T15:30:00Z',
  userId: 'user-1',
  startedAt: '2025-01-15T14:00:00Z',
}

// Minimal base for a valid LoggedSet (not completed, so no actual measurements required)
const baseLoggedSet = {
  id: 'ls-1',
  loggedActivityId: 'la-1',
  setNumber: 1,
  setType: 'WORKING',
  completed: false,
}

// ---------------------------------------------------------------------------
// L-1: WorkoutLog must have startedAt
// ---------------------------------------------------------------------------

describe('L-1: WorkoutLog must have startedAt', () => {
  it('accepts a valid workout log with startedAt', () => {
    expect(workoutLogSchema.safeParse(baseWorkoutLog).success).toBe(true)
  })
  it('rejects workout log missing startedAt', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { startedAt, ...withoutStartedAt } = baseWorkoutLog
    expect(workoutLogSchema.safeParse(withoutStartedAt).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// L-2: completedAt must be after startedAt (L-2 invariant)
// ---------------------------------------------------------------------------

describe('L-2: completedAt must be after (or equal to) startedAt', () => {
  it('accepts workout log without completedAt (in-progress)', () => {
    expect(workoutLogSchema.safeParse(baseWorkoutLog).success).toBe(true)
  })
  it('accepts completedAt after startedAt', () => {
    expect(
      workoutLogSchema.safeParse({
        ...baseWorkoutLog,
        completedAt: '2025-01-15T15:30:00Z',
      }).success,
    ).toBe(true)
  })
  it('accepts completedAt equal to startedAt (edge case)', () => {
    expect(
      workoutLogSchema.safeParse({
        ...baseWorkoutLog,
        completedAt: '2025-01-15T14:00:00Z',
      }).success,
    ).toBe(true)
  })
  it('rejects completedAt before startedAt', () => {
    expect(
      workoutLogSchema.safeParse({
        ...baseWorkoutLog,
        completedAt: '2025-01-15T13:00:00Z',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// L-6: perceivedDifficulty must be 1-10 (optional field)
// ---------------------------------------------------------------------------

describe('L-6: perceivedDifficulty must be integer 1-10', () => {
  it('accepts perceivedDifficulty of 1 (minimum)', () => {
    expect(workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 1 }).success).toBe(
      true,
    )
  })
  it('accepts perceivedDifficulty of 10 (maximum)', () => {
    expect(workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 10 }).success).toBe(
      true,
    )
  })
  it('accepts perceivedDifficulty of 5 (mid-range)', () => {
    expect(workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 5 }).success).toBe(
      true,
    )
  })
  it('accepts missing perceivedDifficulty (optional field)', () => {
    expect(workoutLogSchema.safeParse(baseWorkoutLog).success).toBe(true)
  })
  it('rejects perceivedDifficulty of 0', () => {
    expect(workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 0 }).success).toBe(
      false,
    )
  })
  it('rejects perceivedDifficulty of 11', () => {
    expect(workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 11 }).success).toBe(
      false,
    )
  })
  it('rejects non-integer perceivedDifficulty', () => {
    expect(
      workoutLogSchema.safeParse({ ...baseWorkoutLog, perceivedDifficulty: 7.5 }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// L-3: setNumber must be >= 1
// ---------------------------------------------------------------------------

describe('L-3: LoggedSet setNumber must be >= 1', () => {
  it('accepts setNumber of 1 (minimum)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setNumber: 1 }).success).toBe(true)
  })
  it('accepts setNumber of 5', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setNumber: 5 }).success).toBe(true)
  })
  it('rejects setNumber of 0', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setNumber: 0 }).success).toBe(false)
  })
  it('rejects negative setNumber', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setNumber: -1 }).success).toBe(false)
  })
  it('rejects non-integer setNumber', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setNumber: 1.5 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// L-5: Completed set must have at least one actual measurement
// ---------------------------------------------------------------------------

describe('L-5: Completed set must have at least one actual measurement', () => {
  it('accepts completed set with actualReps', () => {
    expect(
      loggedSetSchema.safeParse({ ...baseLoggedSet, completed: true, actualReps: 5 }).success,
    ).toBe(true)
  })
  it('accepts completed set with actualWeight', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualWeight: { value: 225, unit: 'lb' },
      }).success,
    ).toBe(true)
  })
  it('accepts completed set with actualDuration', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualDuration: { seconds: 60 },
      }).success,
    ).toBe(true)
  })
  it('accepts completed set with actualDistance', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualDistance: { value: 400, unit: 'm' },
      }).success,
    ).toBe(true)
  })
  it('accepts completed set with multiple actual measurements', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualReps: 5,
        actualWeight: { value: 185, unit: 'lb' },
      }).success,
    ).toBe(true)
  })
  it('rejects completed: true with no actual measurements', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, completed: true }).success).toBe(false)
  })
  it('accepts incomplete set with no actual measurements', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, completed: false }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// L-7: RPE must be 1-10 (optional, can be decimal)
// ---------------------------------------------------------------------------

describe('L-7: LoggedSet rpe must be 1-10', () => {
  it('accepts rpe of 1 (minimum)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 1 }).success).toBe(true)
  })
  it('accepts rpe of 10 (maximum)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 10 }).success).toBe(true)
  })
  it('accepts decimal rpe (e.g. 7.5)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 7.5 }).success).toBe(true)
  })
  it('accepts rpe of 5.5', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 5.5 }).success).toBe(true)
  })
  it('accepts missing rpe (optional field)', () => {
    expect(loggedSetSchema.safeParse(baseLoggedSet).success).toBe(true)
  })
  it('rejects rpe of 0', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 0 }).success).toBe(false)
  })
  it('rejects rpe of 11', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 11 }).success).toBe(false)
  })
  it('rejects negative rpe', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SetType enum validation
// ---------------------------------------------------------------------------

describe('LoggedSet setType enum', () => {
  it('accepts all valid set types', () => {
    const validSetTypes = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']
    for (const setType of validSetTypes) {
      expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setType }).success).toBe(true)
    }
  })
  it('rejects invalid set type', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, setType: 'INVALID' }).success).toBe(false)
  })
})
