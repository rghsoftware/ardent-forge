import {
  exerciseSchema,
  workoutLogSchema,
  loggedSetSchema,
  loggedActivitySchema,
  loggedActivityGroupSchema,
  sessionTemplateSchema,
  activityGroupSchema,
  activitySchema,
  programSchema,
  blockSchema,
  blockWeekSchema,
  scheduledSessionSchema,
  userProfileSchema,
  oneRepMaxHistorySchema,
  programActivationSchema,
  setSchemeSchema,
} from '@/domain/types'
import {
  buildExercise,
  buildWorkoutLog,
  buildLoggedSet,
  buildLoggedActivity,
  buildLoggedActivityGroup,
  buildSessionTemplate,
  buildActivityGroup,
  buildActivity,
  buildProgram,
  buildBlock,
  buildBlockWeek,
  buildScheduledSession,
  buildUserProfile,
  buildOneRepMaxHistory,
  buildProgramActivation,
  buildFixedSetsScheme,
  buildPercentageSetsScheme,
  buildWorkToMaxScheme,
  buildTimedHoldScheme,
  buildForRepsScheme,
  buildCardioSteadyStateScheme,
  buildCardioIntervalScheme,
  buildRuckMarchScheme,
  buildEmomScheme,
  buildAmrapTimedScheme,
  buildDescendingRepsScheme,
  buildPercentageOfMaxRepsScheme,
  resetFactoryCounters,
} from '@/test/factories'

beforeEach(() => {
  resetFactoryCounters()
})

// ---------------------------------------------------------------------------
// Entity factories -- schema validation
// ---------------------------------------------------------------------------

describe('Entity factory schema validation', () => {
  it('buildExercise passes exerciseSchema.parse()', () => {
    expect(() => exerciseSchema.parse(buildExercise())).not.toThrow()
  })

  it('buildWorkoutLog passes workoutLogSchema.parse()', () => {
    expect(() => workoutLogSchema.parse(buildWorkoutLog())).not.toThrow()
  })

  it('buildLoggedSet passes loggedSetSchema.parse()', () => {
    expect(() => loggedSetSchema.parse(buildLoggedSet())).not.toThrow()
  })

  it('buildLoggedActivity passes loggedActivitySchema.parse()', () => {
    expect(() => loggedActivitySchema.parse(buildLoggedActivity())).not.toThrow()
  })

  it('buildLoggedActivityGroup passes loggedActivityGroupSchema.parse()', () => {
    expect(() => loggedActivityGroupSchema.parse(buildLoggedActivityGroup())).not.toThrow()
  })

  it('buildSessionTemplate passes sessionTemplateSchema.parse()', () => {
    expect(() => sessionTemplateSchema.parse(buildSessionTemplate())).not.toThrow()
  })

  it('buildActivityGroup passes activityGroupSchema.parse()', () => {
    expect(() => activityGroupSchema.parse(buildActivityGroup())).not.toThrow()
  })

  it('buildActivity passes activitySchema.parse()', () => {
    expect(() => activitySchema.parse(buildActivity())).not.toThrow()
  })

  it('buildProgram passes programSchema.parse()', () => {
    expect(() => programSchema.parse(buildProgram())).not.toThrow()
  })

  it('buildBlock passes blockSchema.parse()', () => {
    expect(() => blockSchema.parse(buildBlock())).not.toThrow()
  })

  it('buildBlockWeek passes blockWeekSchema.parse()', () => {
    expect(() => blockWeekSchema.parse(buildBlockWeek())).not.toThrow()
  })

  it('buildScheduledSession passes scheduledSessionSchema.parse()', () => {
    expect(() => scheduledSessionSchema.parse(buildScheduledSession())).not.toThrow()
  })

  it('buildUserProfile passes userProfileSchema.parse()', () => {
    expect(() => userProfileSchema.parse(buildUserProfile())).not.toThrow()
  })

  it('buildOneRepMaxHistory passes oneRepMaxHistorySchema.parse()', () => {
    expect(() => oneRepMaxHistorySchema.parse(buildOneRepMaxHistory())).not.toThrow()
  })

  it('buildProgramActivation passes programActivationSchema.parse()', () => {
    expect(() => programActivationSchema.parse(buildProgramActivation())).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SetScheme factories -- schema validation
// ---------------------------------------------------------------------------

describe('SetScheme factory schema validation', () => {
  it('buildFixedSetsScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildFixedSetsScheme())).not.toThrow()
  })

  it('buildPercentageSetsScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildPercentageSetsScheme())).not.toThrow()
  })

  it('buildWorkToMaxScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildWorkToMaxScheme())).not.toThrow()
  })

  it('buildTimedHoldScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildTimedHoldScheme())).not.toThrow()
  })

  it('buildForRepsScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildForRepsScheme())).not.toThrow()
  })

  it('buildCardioSteadyStateScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildCardioSteadyStateScheme())).not.toThrow()
  })

  it('buildCardioIntervalScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildCardioIntervalScheme())).not.toThrow()
  })

  it('buildRuckMarchScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildRuckMarchScheme())).not.toThrow()
  })

  it('buildEmomScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildEmomScheme())).not.toThrow()
  })

  it('buildAmrapTimedScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildAmrapTimedScheme())).not.toThrow()
  })

  it('buildDescendingRepsScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildDescendingRepsScheme())).not.toThrow()
  })

  it('buildPercentageOfMaxRepsScheme passes setSchemeSchema.parse()', () => {
    expect(() => setSchemeSchema.parse(buildPercentageOfMaxRepsScheme())).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Override merging
// ---------------------------------------------------------------------------

describe('Factory overrides', () => {
  it('buildExercise merges overrides correctly', () => {
    const exercise = buildExercise({ name: 'Custom Name', category: 'DUMBBELL' })
    expect(exercise.name).toBe('Custom Name')
    expect(exercise.category).toBe('DUMBBELL')
    // Verify defaults are still present
    expect(exercise.id).toBeDefined()
    expect(exercise.movementPattern).toBe('SQUAT')
  })

  it('buildWorkoutLog merges overrides correctly', () => {
    const log = buildWorkoutLog({
      title: 'Morning Session',
      perceivedDifficulty: 8,
    })
    expect(log.title).toBe('Morning Session')
    expect(log.perceivedDifficulty).toBe(8)
    expect(log.userId).toBe('user-1')
  })

  it('buildLoggedSet merges overrides correctly', () => {
    const set = buildLoggedSet({
      setType: 'WARMUP',
      actualReps: 10,
      completed: true,
    })
    expect(set.setType).toBe('WARMUP')
    expect(set.actualReps).toBe(10)
    expect(set.completed).toBe(true)
  })

  it('buildProgram merges overrides correctly', () => {
    const program = buildProgram({
      name: 'Tactical Barbell',
      source: 'IMPORTED',
      isPublic: true,
    })
    expect(program.name).toBe('Tactical Barbell')
    expect(program.source).toBe('IMPORTED')
    expect(program.isPublic).toBe(true)
  })

  it('buildFixedSetsScheme merges overrides correctly', () => {
    const scheme = buildFixedSetsScheme({ sets: 5, reps: 10 })
    expect(scheme.sets).toBe(5)
    expect(scheme.reps).toBe(10)
    expect(scheme.type).toBe('fixedSets')
  })

  it('overridden factory output still passes schema validation', () => {
    const exercise = buildExercise({
      name: 'Overhead Press',
      category: 'BARBELL',
      movementPattern: 'PUSH',
      muscleGroups: { primary: ['SHOULDERS'], secondary: ['TRICEPS'] },
    })
    expect(() => exerciseSchema.parse(exercise)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Unique IDs
// ---------------------------------------------------------------------------

describe('Factory unique IDs', () => {
  it('generates unique IDs across multiple calls', () => {
    const ex1 = buildExercise()
    const ex2 = buildExercise()
    const ex3 = buildExercise()
    expect(ex1.id).not.toBe(ex2.id)
    expect(ex2.id).not.toBe(ex3.id)
  })

  it('resetFactoryCounters resets IDs', () => {
    const ex1 = buildExercise()
    resetFactoryCounters()
    const ex2 = buildExercise()
    expect(ex1.id).toBe(ex2.id)
  })
})
