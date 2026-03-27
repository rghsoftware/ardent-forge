import {
  workoutLogSchema,
  loggedSetSchema,
  loggedActivityGroupSchema,
  loggedActivitySchema,
  prescriptionSchema,
} from '@/domain/types'

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

// Minimal base for a valid LoggedActivityGroup
const baseLoggedActivityGroup = {
  id: 'lag-1',
  workoutLogId: 'wl-1',
  groupType: 'STRAIGHT_SETS',
  ordinal: 1,
}

// Minimal base for a valid LoggedActivity
const baseLoggedActivity = {
  id: 'la-1',
  loggedGroupId: 'lag-1',
  exerciseId: 'ex-1',
  ordinal: 1,
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

describe('L-2: completedAt must be strictly after startedAt', () => {
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
  it('rejects completedAt equal to startedAt (strict >)', () => {
    expect(
      workoutLogSchema.safeParse({
        ...baseWorkoutLog,
        completedAt: '2025-01-15T14:00:00Z',
      }).success,
    ).toBe(false)
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
  it('accepts rpe of 7.5 (half-value)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 7.5 }).success).toBe(true)
  })
  it('rejects rpe of 7.3 (not a half-value)', () => {
    expect(loggedSetSchema.safeParse({ ...baseLoggedSet, rpe: 7.3 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Prescription minimum-one-field constraint
// ---------------------------------------------------------------------------

describe('Prescription minimum-one-field constraint', () => {
  it('rejects empty prescription with no fields set', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        prescribed: {},
      }).success,
    ).toBe(false)
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

// ---------------------------------------------------------------------------
// loggedActivityGroupSchema
// ---------------------------------------------------------------------------

describe('loggedActivityGroupSchema', () => {
  it('accepts valid group with all required fields', () => {
    expect(loggedActivityGroupSchema.safeParse(baseLoggedActivityGroup).success).toBe(true)
  })

  it('accepts group with optional actualRoundsCompleted', () => {
    const withRounds = { ...baseLoggedActivityGroup, actualRoundsCompleted: 3 }
    expect(loggedActivityGroupSchema.safeParse(withRounds).success).toBe(true)
  })

  it('accepts group with optional completionTime', () => {
    const withTime = { ...baseLoggedActivityGroup, completionTime: { seconds: 600 } }
    expect(loggedActivityGroupSchema.safeParse(withTime).success).toBe(true)
  })

  it('rejects ordinal of 0 (must be positive integer)', () => {
    const bad = { ...baseLoggedActivityGroup, ordinal: 0 }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative ordinal', () => {
    const bad = { ...baseLoggedActivityGroup, ordinal: -1 }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer ordinal', () => {
    const bad = { ...baseLoggedActivityGroup, ordinal: 1.5 }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects actualRoundsCompleted of 0 when present (must be positive)', () => {
    const bad = { ...baseLoggedActivityGroup, actualRoundsCompleted: 0 }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer actualRoundsCompleted when present', () => {
    const bad = { ...baseLoggedActivityGroup, actualRoundsCompleted: 2.5 }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects invalid completionTime when present (negative seconds)', () => {
    const bad = { ...baseLoggedActivityGroup, completionTime: { seconds: -1 } }
    expect(loggedActivityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing workoutLogId', () => {
    const { workoutLogId: _, ...noWlId } = baseLoggedActivityGroup as Record<string, unknown>
    expect(loggedActivityGroupSchema.safeParse(noWlId).success).toBe(false)
  })

  it('rejects missing groupType', () => {
    const { groupType: _, ...noType } = baseLoggedActivityGroup as Record<string, unknown>
    expect(loggedActivityGroupSchema.safeParse(noType).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// loggedActivitySchema
// ---------------------------------------------------------------------------

describe('loggedActivitySchema', () => {
  it('accepts valid activity with all required fields', () => {
    expect(loggedActivitySchema.safeParse(baseLoggedActivity).success).toBe(true)
  })

  it('accepts activity with optional notes', () => {
    const withNotes = { ...baseLoggedActivity, notes: 'Felt strong' }
    expect(loggedActivitySchema.safeParse(withNotes).success).toBe(true)
  })

  it('rejects ordinal of 0 (must be positive integer)', () => {
    const bad = { ...baseLoggedActivity, ordinal: 0 }
    expect(loggedActivitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative ordinal', () => {
    const bad = { ...baseLoggedActivity, ordinal: -1 }
    expect(loggedActivitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer ordinal', () => {
    const bad = { ...baseLoggedActivity, ordinal: 1.5 }
    expect(loggedActivitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects empty exerciseId (must be non-empty string)', () => {
    const bad = { ...baseLoggedActivity, exerciseId: '' }
    expect(loggedActivitySchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing loggedGroupId', () => {
    const { loggedGroupId: _, ...noGroupId } = baseLoggedActivity as Record<string, unknown>
    expect(loggedActivitySchema.safeParse(noGroupId).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// prescriptionSchema positive-path tests
// ---------------------------------------------------------------------------

describe('prescriptionSchema positive-path tests', () => {
  it('accepts prescription with only reps', () => {
    expect(prescriptionSchema.safeParse({ reps: 5 }).success).toBe(true)
  })

  it('accepts prescription with only weight', () => {
    expect(prescriptionSchema.safeParse({ weight: { value: 135, unit: 'lb' } }).success).toBe(true)
  })

  it('accepts prescription with only duration', () => {
    expect(prescriptionSchema.safeParse({ duration: { seconds: 60 } }).success).toBe(true)
  })

  it('accepts prescription with only distance', () => {
    expect(prescriptionSchema.safeParse({ distance: { value: 400, unit: 'm' } }).success).toBe(true)
  })

  it('accepts prescription with only loadSpec', () => {
    expect(prescriptionSchema.safeParse({ loadSpec: { type: 'bodyweight' } }).success).toBe(true)
  })

  it('accepts prescription with only notes', () => {
    expect(prescriptionSchema.safeParse({ notes: 'Go heavy' }).success).toBe(true)
  })

  it('accepts full prescription with all fields', () => {
    const full = {
      reps: 5,
      weight: { value: 225, unit: 'lb' },
      duration: { seconds: 120 },
      distance: { value: 1, unit: 'mi' },
      loadSpec: { type: 'absolute', weight: { value: 225, unit: 'lb' } },
      notes: 'Work up to top set',
    }
    expect(prescriptionSchema.safeParse(full).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// C3: L-5 actualHeartRate and actualPace tests
// ---------------------------------------------------------------------------

describe('L-5: completed set with actualHeartRate or actualPace', () => {
  it('accepts completed set with only actualHeartRate', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualHeartRate: 155,
      }).success,
    ).toBe(true)
  })

  it('accepts completed set with only actualPace', () => {
    expect(
      loggedSetSchema.safeParse({
        ...baseLoggedSet,
        completed: true,
        actualPace: { minutesPerUnit: 8.5, unit: 'mi' },
      }).success,
    ).toBe(true)
  })
})
