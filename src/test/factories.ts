import type {
  Exercise,
  WorkoutLog,
  LoggedSet,
  LoggedActivity,
  LoggedActivityGroup,
  SessionTemplate,
  ActivityGroup,
  Activity,
  Program,
  Block,
  BlockWeek,
  ScheduledSession,
  UserProfile,
  OneRepMaxHistory,
  ProgramActivation,
  SetScheme,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// ID counters -- each factory gets unique, incrementing IDs
// ---------------------------------------------------------------------------

let exerciseCounter = 0
let workoutLogCounter = 0
let loggedSetCounter = 0
let loggedActivityCounter = 0
let loggedActivityGroupCounter = 0
let sessionTemplateCounter = 0
let activityGroupCounter = 0
let activityCounter = 0
let programCounter = 0
let blockCounter = 0
let blockWeekCounter = 0
let scheduledSessionCounter = 0
let userProfileCounter = 0
let oneRepMaxHistoryCounter = 0
let programActivationCounter = 0

/** Reset all ID counters to 0. Call in beforeEach to ensure factory-generated IDs are deterministic and test-order-independent. */
export function resetFactoryCounters(): void {
  exerciseCounter = 0
  workoutLogCounter = 0
  loggedSetCounter = 0
  loggedActivityCounter = 0
  loggedActivityGroupCounter = 0
  sessionTemplateCounter = 0
  activityGroupCounter = 0
  activityCounter = 0
  programCounter = 0
  blockCounter = 0
  blockWeekCounter = 0
  scheduledSessionCounter = 0
  userProfileCounter = 0
  oneRepMaxHistoryCounter = 0
  programActivationCounter = 0
}

// ---------------------------------------------------------------------------
// SetScheme factories
// ---------------------------------------------------------------------------

export function buildFixedSetsScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'fixedSets' }>>,
): Extract<SetScheme, { type: 'fixedSets' }> {
  return {
    type: 'fixedSets',
    sets: 3,
    reps: 5,
    load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
    ...overrides,
  }
}

export function buildPercentageSetsScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'percentageSets' }>>,
): Extract<SetScheme, { type: 'percentageSets' }> {
  return {
    type: 'percentageSets',
    sets: 5,
    reps: 3,
    percentageOf1RM: 0.85,
    ...overrides,
  }
}

export function buildWorkToMaxScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'workToMax' }>>,
): Extract<SetScheme, { type: 'workToMax' }> {
  return {
    type: 'workToMax',
    targetRepRange: { min: 1, max: 3 },
    ...overrides,
  }
}

export function buildTimedHoldScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'timedHold' }>>,
): Extract<SetScheme, { type: 'timedHold' }> {
  return {
    type: 'timedHold',
    duration: { seconds: 30 },
    sets: 3,
    ...overrides,
  }
}

export function buildForRepsScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'forReps' }>>,
): Extract<SetScheme, { type: 'forReps' }> {
  return {
    type: 'forReps',
    targetReps: 20,
    ...overrides,
  }
}

export function buildCardioSteadyStateScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'cardioSteadyState' }>>,
): Extract<SetScheme, { type: 'cardioSteadyState' }> {
  return {
    type: 'cardioSteadyState',
    duration: { seconds: 1800 },
    modality: 'RUNNING',
    ...overrides,
  }
}

export function buildCardioIntervalScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'cardioInterval' }>>,
): Extract<SetScheme, { type: 'cardioInterval' }> {
  return {
    type: 'cardioInterval',
    workDuration: { seconds: 60 },
    rest: { seconds: 30 },
    rounds: 8,
    modality: 'ROWING',
    ...overrides,
  }
}

export function buildRuckMarchScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'ruckMarch' }>>,
): Extract<SetScheme, { type: 'ruckMarch' }> {
  return {
    type: 'ruckMarch',
    loadWeight: { value: 45, unit: 'lb' },
    distance: { value: 4, unit: 'mi' },
    modality: 'RUCKING',
    ...overrides,
  }
}

export function buildEmomScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'emom' }>>,
): Extract<SetScheme, { type: 'emom' }> {
  return {
    type: 'emom',
    repsPerMinute: 5,
    totalMinutes: 10,
    ...overrides,
  }
}

export function buildAmrapTimedScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'amrapTimed' }>>,
): Extract<SetScheme, { type: 'amrapTimed' }> {
  return {
    type: 'amrapTimed',
    timeCap: { seconds: 720 },
    ...overrides,
  }
}

export function buildDescendingRepsScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'descendingReps' }>>,
): Extract<SetScheme, { type: 'descendingReps' }> {
  return {
    type: 'descendingReps',
    repLadder: [10, 8, 6, 4, 2],
    ...overrides,
  }
}

export function buildPercentageOfMaxRepsScheme(
  overrides?: Partial<Extract<SetScheme, { type: 'percentageOfMaxReps' }>>,
): Extract<SetScheme, { type: 'percentageOfMaxReps' }> {
  return {
    type: 'percentageOfMaxReps',
    percentage: 0.5,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Entity factories
// ---------------------------------------------------------------------------

export function buildExercise(overrides?: Partial<Exercise>): Exercise {
  exerciseCounter++
  return {
    id: `exercise-${exerciseCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    name: `Test Exercise ${exerciseCounter}`,
    aliases: [],
    category: 'BARBELL',
    movementPattern: 'SQUAT',
    muscleGroups: { primary: ['QUADS'], secondary: ['GLUTES'] },
    isBilateral: true,
    supports1RM: true,
    equipmentRequired: ['BARBELL', 'SQUAT_RACK'],
    isCustom: false,
    ...overrides,
  }
}

export function buildWorkoutLog(overrides?: Partial<WorkoutLog>): WorkoutLog {
  workoutLogCounter++
  return {
    id: `workout-log-${workoutLogCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T11:30:00.000Z',
    userId: 'user-1',
    startedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}

export function buildLoggedSet(overrides?: Partial<LoggedSet>): LoggedSet {
  loggedSetCounter++
  return {
    id: `logged-set-${loggedSetCounter}`,
    loggedActivityId: 'logged-activity-1',
    setNumber: 1,
    setType: 'WORKING',
    completed: false,
    ...overrides,
  }
}

export function buildLoggedActivity(overrides?: Partial<LoggedActivity>): LoggedActivity {
  loggedActivityCounter++
  return {
    id: `logged-activity-${loggedActivityCounter}`,
    loggedGroupId: 'logged-group-1',
    exerciseId: 'exercise-1',
    ordinal: 1,
    ...overrides,
  }
}

export function buildLoggedActivityGroup(
  overrides?: Partial<LoggedActivityGroup>,
): LoggedActivityGroup {
  loggedActivityGroupCounter++
  return {
    id: `logged-group-${loggedActivityGroupCounter}`,
    workoutLogId: 'workout-log-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    ...overrides,
  }
}

export function buildSessionTemplate(overrides?: Partial<SessionTemplate>): SessionTemplate {
  sessionTemplateCounter++
  return {
    id: `session-template-${sessionTemplateCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    userId: 'user-1',
    name: `Test Session ${sessionTemplateCounter}`,
    category: 'STRENGTH',
    scoring: 'NONE',
    ...overrides,
  }
}

export function buildActivity(overrides?: Partial<Activity>): Activity {
  activityCounter++
  return {
    id: `activity-${activityCounter}`,
    activityGroupId: 'activity-group-1',
    exerciseId: 'exercise-1',
    setScheme: buildFixedSetsScheme(),
    ordinal: 1,
    ...overrides,
  }
}

/**
 * Build a test ActivityGroup with sensible defaults.
 * Default activities is empty to avoid hidden counter side effects. Pass activities explicitly via overrides.
 */
export function buildActivityGroup(overrides?: Partial<ActivityGroup>): ActivityGroup {
  activityGroupCounter++
  return {
    id: `activity-group-${activityGroupCounter}`,
    sessionTemplateId: 'session-template-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    activities: [],
    ...overrides,
  }
}

export function buildProgram(overrides?: Partial<Program>): Program {
  programCounter++
  return {
    id: `program-${programCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    userId: 'user-1',
    name: `Test Program ${programCounter}`,
    source: 'CUSTOM',
    isPublic: false,
    createdBy: 'user-1',
    ...overrides,
  }
}

export function buildBlock(overrides?: Partial<Block>): Block {
  blockCounter++
  return {
    id: `block-${blockCounter}`,
    programId: 'program-1',
    name: `Block ${blockCounter}`,
    ordinal: 1,
    durationWeeks: 4,
    blockType: 'ACCUMULATION',
    ...overrides,
  }
}

export function buildBlockWeek(overrides?: Partial<BlockWeek>): BlockWeek {
  blockWeekCounter++
  return {
    id: `block-week-${blockWeekCounter}`,
    blockId: 'block-1',
    weekNumber: 1,
    ...overrides,
  }
}

export function buildScheduledSession(overrides?: Partial<ScheduledSession>): ScheduledSession {
  scheduledSessionCounter++
  return {
    id: `scheduled-session-${scheduledSessionCounter}`,
    blockWeekId: 'block-week-1',
    dayLabel: 'Day 1',
    sessionType: 'STRENGTH',
    sessionTemplateId: 'session-template-1',
    ...overrides,
  }
}

export function buildUserProfile(overrides?: Partial<UserProfile>): UserProfile {
  userProfileCounter++
  return {
    id: `user-profile-${userProfileCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    exerciseMaxes: {},
    maxReps: {},
    preferredUnits: 'IMPERIAL',
    ...overrides,
  }
}

export function buildOneRepMaxHistory(overrides?: Partial<OneRepMaxHistory>): OneRepMaxHistory {
  oneRepMaxHistoryCounter++
  return {
    id: `orm-history-${oneRepMaxHistoryCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    userId: 'user-1',
    exerciseId: 'exercise-1',
    weight: { value: 315, unit: 'lb' },
    estimated: false,
    recordedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}

export function buildCompletedLoggedSet(overrides?: Partial<LoggedSet>): LoggedSet {
  return buildLoggedSet({
    completed: true,
    actualWeight: { value: 135, unit: 'lb' },
    actualReps: 5,
    ...overrides,
  })
}

export function buildProgramActivation(overrides?: Partial<ProgramActivation>): ProgramActivation {
  programActivationCounter++
  return {
    id: `program-activation-${programActivationCounter}`,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    userId: 'user-1',
    programId: 'program-1',
    currentBlockOrdinal: 1,
    currentWeekNumber: 1,
    startDate: '2026-01-15',
    ...overrides,
  }
}
