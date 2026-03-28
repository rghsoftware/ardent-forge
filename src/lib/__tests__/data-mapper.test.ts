import { describe, it, expect } from 'vitest'
import { ZodError } from 'zod'
import {
  toExercise,
  fromExercise,
  toWorkoutLog,
  fromWorkoutLog,
  toLoggedActivityGroup,
  fromLoggedActivityGroup,
  toLoggedActivity,
  fromLoggedActivity,
  toLoggedSet,
  fromLoggedSet,
  toUserProfile,
  fromUserProfile,
  toOneRepMaxHistory,
  fromOneRepMaxHistory,
  toSessionTemplate,
  fromSessionTemplate,
  toActivityGroupFlat,
  fromActivityGroup,
  toActivity,
  fromActivity,
} from '../data-mapper'
import type {
  ExerciseRow,
  WorkoutLogRow,
  LoggedActivityGroupRow,
  LoggedActivityRow,
  LoggedSetRow,
  UserProfileRow,
  OneRepMaxHistoryRow,
  SessionTemplateRow,
  ActivityGroupRow,
  ActivityRow,
} from '../database.types'

// ===========================================================================
// Shared fixtures -- realistic data matching actual schema shapes
// ===========================================================================

const now = '2025-06-15T10:00:00Z'
const later = '2025-06-15T11:30:00Z'

// ---------------------------------------------------------------------------
// Exercise fixtures
// ---------------------------------------------------------------------------

const exerciseRow: ExerciseRow = {
  id: 'ex-squat-001',
  name: 'Barbell Back Squat',
  aliases: ['Back Squat', 'Low Bar Squat'],
  category: 'BARBELL',
  movement_pattern: 'SQUAT',
  muscle_groups: { primary: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'CORE'] },
  is_bilateral: true,
  supports_1rm: true,
  equipment_required: ['BARBELL', 'SQUAT_RACK'],
  is_custom: false,
  user_id: null,
  created_at: now,
  updated_at: now,
}

const exerciseRowMinimal: ExerciseRow = {
  id: 'ex-pushup-002',
  name: 'Push-up',
  aliases: [],
  category: 'BODYWEIGHT',
  movement_pattern: 'PUSH',
  muscle_groups: { primary: ['CHEST'], secondary: [] },
  is_bilateral: true,
  supports_1rm: false,
  equipment_required: ['NONE'],
  is_custom: false,
  user_id: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// WorkoutLog fixtures
// ---------------------------------------------------------------------------

const workoutLogRowFull: WorkoutLogRow = {
  id: 'wl-001',
  user_id: 'user-001',
  title: 'Upper Body Day',
  started_at: now,
  completed_at: later,
  session_template_id: 'st-001',
  program_context: {
    programId: 'prog-001',
    blockId: 'block-001',
    weekNumber: 3,
    dayLabel: 'Monday',
  },
  perceived_difficulty: 7,
  bodyweight_at_session: { value: 185, unit: 'lb' },
  overall_notes: 'Felt strong today',
  created_at: now,
  updated_at: later,
}

const workoutLogRowNulls: WorkoutLogRow = {
  id: 'wl-002',
  user_id: 'user-001',
  title: null,
  started_at: now,
  completed_at: null,
  session_template_id: null,
  program_context: null,
  perceived_difficulty: null,
  bodyweight_at_session: null,
  overall_notes: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// LoggedActivityGroup fixtures
// ---------------------------------------------------------------------------

const groupRowFull: LoggedActivityGroupRow = {
  id: 'lag-001',
  workout_log_id: 'wl-001',
  user_id: 'user-001',
  group_type: 'STRAIGHT_SETS',
  ordinal: 1,
  actual_rounds_completed: 4,
  completion_time: { seconds: 1800 },
  created_at: now,
  updated_at: now,
}

const groupRowNulls: LoggedActivityGroupRow = {
  id: 'lag-002',
  workout_log_id: 'wl-001',
  user_id: 'user-001',
  group_type: 'SUPERSET',
  ordinal: 2,
  actual_rounds_completed: null,
  completion_time: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// LoggedActivity fixtures
// ---------------------------------------------------------------------------

const activityRowFull: LoggedActivityRow = {
  id: 'la-001',
  logged_group_id: 'lag-001',
  user_id: 'user-001',
  exercise_id: 'ex-squat-001',
  ordinal: 1,
  notes: 'Focus on depth',
  created_at: now,
  updated_at: now,
}

const activityRowNulls: LoggedActivityRow = {
  id: 'la-002',
  logged_group_id: 'lag-001',
  user_id: 'user-001',
  exercise_id: 'ex-pushup-002',
  ordinal: 2,
  notes: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// LoggedSet fixtures
// ---------------------------------------------------------------------------

const setRowFull: LoggedSetRow = {
  id: 'ls-001',
  logged_activity_id: 'la-001',
  user_id: 'user-001',
  set_number: 1,
  set_type: 'WORKING',
  prescribed: { reps: 5, weight: { value: 225, unit: 'lb' } },
  actual_reps: 5,
  actual_weight: { value: 225, unit: 'lb' },
  actual_duration: { seconds: 45 },
  actual_distance: { value: 0, unit: 'm' },
  actual_pace: { minutesPerUnit: 8.5, unit: 'mi' },
  actual_heart_rate: 155,
  ruck_load: { value: 45, unit: 'lb' },
  elevation_gain: { value: 100, unit: 'm' },
  rpe: 8,
  completed: true,
  notes: 'Solid set',
  created_at: now,
  updated_at: now,
}

const setRowNulls: LoggedSetRow = {
  id: 'ls-002',
  logged_activity_id: 'la-001',
  user_id: 'user-001',
  set_number: 2,
  set_type: 'WARMUP',
  prescribed: null,
  actual_reps: null,
  actual_weight: null,
  actual_duration: null,
  actual_distance: null,
  actual_pace: null,
  actual_heart_rate: null,
  ruck_load: null,
  elevation_gain: null,
  rpe: null,
  completed: false,
  notes: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// UserProfile fixtures
// ---------------------------------------------------------------------------

const userProfileRowFull: UserProfileRow = {
  id: 'user-001',
  display_name: 'Coach Hamilton',
  preferred_units: 'IMPERIAL',
  bodyweight: { value: 200, unit: 'lb' },
  training_age: { seconds: 157680000 }, // ~5 years
  exercise_maxes: {
    'ex-squat-001': {
      weight: { value: 405, unit: 'lb' },
      testedAt: '2025-06-01T00:00:00Z',
      estimated: false,
    },
  },
  max_reps: { 'ex-pullup-001': 20 },
  created_at: now,
  updated_at: now,
}

const userProfileRowNulls: UserProfileRow = {
  id: 'user-002',
  display_name: null,
  preferred_units: 'METRIC',
  bodyweight: null,
  training_age: null,
  exercise_maxes: null,
  max_reps: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// OneRepMaxHistory fixtures
// ---------------------------------------------------------------------------

const ormhRow: OneRepMaxHistoryRow = {
  id: 'ormh-001',
  user_id: 'user-001',
  exercise_id: 'ex-squat-001',
  weight: { value: 405, unit: 'lb' },
  estimated: false,
  recorded_at: '2025-06-10T09:00:00Z',
  created_at: now,
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// toExercise / fromExercise
// ---------------------------------------------------------------------------

describe('toExercise / fromExercise', () => {
  it('maps a fully populated exercise row to domain type', () => {
    const result = toExercise(exerciseRow)
    expect(result.id).toBe('ex-squat-001')
    expect(result.name).toBe('Barbell Back Squat')
    expect(result.aliases).toEqual(['Back Squat', 'Low Bar Squat'])
    expect(result.category).toBe('BARBELL')
    expect(result.movementPattern).toBe('SQUAT')
    expect(result.muscleGroups).toEqual({
      primary: ['QUADS', 'GLUTES'],
      secondary: ['HAMSTRINGS', 'CORE'],
    })
    expect(result.isBilateral).toBe(true)
    expect(result.supports1RM).toBe(true)
    expect(result.equipmentRequired).toEqual(['BARBELL', 'SQUAT_RACK'])
    expect(result.isCustom).toBe(false)
    expect(result.createdAt).toBe(now)
    expect(result.updatedAt).toBe(now)
  })

  it('maps a minimal exercise row (empty arrays, BODYWEIGHT category)', () => {
    const result = toExercise(exerciseRowMinimal)
    expect(result.id).toBe('ex-pushup-002')
    expect(result.aliases).toEqual([])
    expect(result.category).toBe('BODYWEIGHT')
    expect(result.muscleGroups.secondary).toEqual([])
    expect(result.equipmentRequired).toEqual(['NONE'])
  })

  it('throws ZodError on invalid category enum', () => {
    const bad = { ...exerciseRow, category: 'POWERLIFTING' }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on invalid movement_pattern enum', () => {
    const bad = { ...exerciseRow, movement_pattern: 'JUMP' }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on malformed muscle_groups JSON (missing primary)', () => {
    const bad = { ...exerciseRow, muscle_groups: { secondary: ['CORE'] } }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on muscle_groups with invalid muscle name', () => {
    const bad = {
      ...exerciseRow,
      muscle_groups: { primary: ['INVALID_MUSCLE'], secondary: [] },
    }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on aliases that is not an array', () => {
    const bad = { ...exerciseRow, aliases: 'not-an-array' }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on aliases with non-string elements', () => {
    const bad = { ...exerciseRow, aliases: [42, true] }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('throws ZodError on equipment_required with invalid equipment', () => {
    const bad = { ...exerciseRow, equipment_required: ['MAGIC_WAND'] }
    expect(() => toExercise(bad)).toThrow(ZodError)
  })

  it('fromExercise maps domain exercise to DB row shape', () => {
    const domain = toExercise(exerciseRow)
    const { id: _, createdAt: _c, updatedAt: _u, ...domainBody } = domain
    const row = fromExercise(domainBody)
    expect(row.name).toBe('Barbell Back Squat')
    expect(row.category).toBe('BARBELL')
    expect(row.movement_pattern).toBe('SQUAT')
    expect(row.muscle_groups).toEqual({
      primary: ['QUADS', 'GLUTES'],
      secondary: ['HAMSTRINGS', 'CORE'],
    })
    expect(row.is_bilateral).toBe(true)
    expect(row.supports_1rm).toBe(true)
    expect(row.equipment_required).toEqual(['BARBELL', 'SQUAT_RACK'])
    expect(row.is_custom).toBe(false)
  })

  it('fromExercise omits id, created_at, updated_at', () => {
    const domain = toExercise(exerciseRow)
    const { id: _, createdAt: _c, updatedAt: _u, ...domainBody } = domain
    const row = fromExercise(domainBody)
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('created_at')
    expect(row).not.toHaveProperty('updated_at')
  })

  it('round-trip: toExercise(row) -> fromExercise -> matches original row fields', () => {
    const domain = toExercise(exerciseRow)
    const { id: _, createdAt: _c, updatedAt: _u, ...domainBody } = domain
    const roundTripped = fromExercise(domainBody)
    expect(roundTripped.name).toBe(exerciseRow.name)
    expect(roundTripped.category).toBe(exerciseRow.category)
    expect(roundTripped.movement_pattern).toBe(exerciseRow.movement_pattern)
    expect(roundTripped.muscle_groups).toEqual(exerciseRow.muscle_groups)
    expect(roundTripped.is_bilateral).toBe(exerciseRow.is_bilateral)
    expect(roundTripped.supports_1rm).toBe(exerciseRow.supports_1rm)
    expect(roundTripped.equipment_required).toEqual(exerciseRow.equipment_required)
    expect(roundTripped.is_custom).toBe(exerciseRow.is_custom)
  })
})

// ---------------------------------------------------------------------------
// toWorkoutLog / fromWorkoutLog
// ---------------------------------------------------------------------------

describe('toWorkoutLog / fromWorkoutLog', () => {
  it('maps a fully populated workout log row to domain type', () => {
    const result = toWorkoutLog(workoutLogRowFull)
    expect(result.id).toBe('wl-001')
    expect(result.userId).toBe('user-001')
    expect(result.title).toBe('Upper Body Day')
    expect(result.startedAt).toBe(now)
    expect(result.completedAt).toBe(later)
    expect(result.sessionTemplateId).toBe('st-001')
    expect(result.programContext).toEqual({
      programId: 'prog-001',
      blockId: 'block-001',
      weekNumber: 3,
      dayLabel: 'Monday',
    })
    expect(result.perceivedDifficulty).toBe(7)
    expect(result.bodyweightAtSession).toEqual({ value: 185, unit: 'lb' })
    expect(result.overallNotes).toBe('Felt strong today')
  })

  it('maps null optional fields to undefined', () => {
    const result = toWorkoutLog(workoutLogRowNulls)
    expect(result.title).toBeUndefined()
    expect(result.completedAt).toBeUndefined()
    expect(result.sessionTemplateId).toBeUndefined()
    expect(result.programContext).toBeUndefined()
    expect(result.perceivedDifficulty).toBeUndefined()
    expect(result.bodyweightAtSession).toBeUndefined()
    expect(result.overallNotes).toBeUndefined()
  })

  it('throws ZodError on invalid program_context JSON shape', () => {
    const bad = { ...workoutLogRowFull, program_context: { invalid: true } }
    expect(() => toWorkoutLog(bad)).toThrow(ZodError)
  })

  it('throws ZodError on program_context with non-positive weekNumber', () => {
    const bad = {
      ...workoutLogRowFull,
      program_context: {
        programId: 'prog-001',
        blockId: 'block-001',
        weekNumber: 0,
        dayLabel: 'Monday',
      },
    }
    expect(() => toWorkoutLog(bad)).toThrow(ZodError)
  })

  it('throws ZodError on malformed bodyweight_at_session (negative value)', () => {
    const bad = { ...workoutLogRowFull, bodyweight_at_session: { value: -5, unit: 'lb' } }
    expect(() => toWorkoutLog(bad)).toThrow(ZodError)
  })

  it('throws ZodError on bodyweight_at_session with zero value', () => {
    const bad = { ...workoutLogRowFull, bodyweight_at_session: { value: 0, unit: 'kg' } }
    expect(() => toWorkoutLog(bad)).toThrow(ZodError)
  })

  it('throws ZodError on bodyweight_at_session with invalid unit', () => {
    const bad = { ...workoutLogRowFull, bodyweight_at_session: { value: 80, unit: 'stone' } }
    expect(() => toWorkoutLog(bad)).toThrow(ZodError)
  })

  it('fromWorkoutLog maps undefined optional fields to null', () => {
    const domain = toWorkoutLog(workoutLogRowNulls)
    const { id: _, createdAt: _c, updatedAt: _u, ...body } = domain
    const row = fromWorkoutLog(body)
    expect(row.title).toBeNull()
    expect(row.completed_at).toBeNull()
    expect(row.session_template_id).toBeNull()
    expect(row.program_context).toBeNull()
    expect(row.perceived_difficulty).toBeNull()
    expect(row.bodyweight_at_session).toBeNull()
    expect(row.overall_notes).toBeNull()
  })

  it('fromWorkoutLog maps populated optional fields correctly', () => {
    const domain = toWorkoutLog(workoutLogRowFull)
    const { id: _, createdAt: _c, updatedAt: _u, ...body } = domain
    const row = fromWorkoutLog(body)
    expect(row.user_id).toBe('user-001')
    expect(row.title).toBe('Upper Body Day')
    expect(row.completed_at).toBe(later)
    expect(row.session_template_id).toBe('st-001')
    expect(row.program_context).toEqual({
      programId: 'prog-001',
      blockId: 'block-001',
      weekNumber: 3,
      dayLabel: 'Monday',
    })
    expect(row.perceived_difficulty).toBe(7)
    expect(row.bodyweight_at_session).toEqual({ value: 185, unit: 'lb' })
    expect(row.overall_notes).toBe('Felt strong today')
  })

  it('fromWorkoutLog omits id, created_at, updated_at', () => {
    const domain = toWorkoutLog(workoutLogRowFull)
    const { id: _, createdAt: _c, updatedAt: _u, ...body } = domain
    const row = fromWorkoutLog(body)
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('created_at')
    expect(row).not.toHaveProperty('updated_at')
  })

  it('round-trip: preserves non-null data fields', () => {
    const domain = toWorkoutLog(workoutLogRowFull)
    const { id: _, createdAt: _c, updatedAt: _u, ...body } = domain
    const roundTripped = fromWorkoutLog(body)
    expect(roundTripped.user_id).toBe(workoutLogRowFull.user_id)
    expect(roundTripped.title).toBe(workoutLogRowFull.title)
    expect(roundTripped.started_at).toBe(workoutLogRowFull.started_at)
    expect(roundTripped.completed_at).toBe(workoutLogRowFull.completed_at)
    expect(roundTripped.session_template_id).toBe(workoutLogRowFull.session_template_id)
    expect(roundTripped.overall_notes).toBe(workoutLogRowFull.overall_notes)
  })
})

// ---------------------------------------------------------------------------
// toLoggedActivityGroup / fromLoggedActivityGroup
// ---------------------------------------------------------------------------

describe('toLoggedActivityGroup / fromLoggedActivityGroup', () => {
  it('maps a fully populated group row to domain type', () => {
    const result = toLoggedActivityGroup(groupRowFull)
    expect(result.id).toBe('lag-001')
    expect(result.workoutLogId).toBe('wl-001')
    expect(result.groupType).toBe('STRAIGHT_SETS')
    expect(result.ordinal).toBe(1)
    expect(result.actualRoundsCompleted).toBe(4)
    expect(result.completionTime).toEqual({ seconds: 1800 })
  })

  it('maps null optional fields to undefined', () => {
    const result = toLoggedActivityGroup(groupRowNulls)
    expect(result.actualRoundsCompleted).toBeUndefined()
    expect(result.completionTime).toBeUndefined()
  })

  it('throws ZodError on invalid group_type enum', () => {
    const bad = { ...groupRowFull, group_type: 'INVALID_GROUP' }
    expect(() => toLoggedActivityGroup(bad)).toThrow(ZodError)
  })

  it('throws ZodError on each invalid group_type value', () => {
    for (const badType of ['TABATA', 'TRISET', '']) {
      expect(() => toLoggedActivityGroup({ ...groupRowFull, group_type: badType })).toThrow(
        ZodError,
      )
    }
  })

  it('accepts all valid group types', () => {
    const validTypes = [
      'STRAIGHT_SETS',
      'SUPERSET',
      'CIRCUIT',
      'COMPLEX',
      'EMOM',
      'AMRAP',
      'COUPLET',
    ]
    for (const groupType of validTypes) {
      const result = toLoggedActivityGroup({ ...groupRowFull, group_type: groupType })
      expect(result.groupType).toBe(groupType)
    }
  })

  it('throws ZodError on malformed completion_time (negative seconds)', () => {
    const bad = { ...groupRowFull, completion_time: { seconds: -10 } }
    expect(() => toLoggedActivityGroup(bad)).toThrow(ZodError)
  })

  it('throws ZodError on completion_time with non-integer seconds', () => {
    const bad = { ...groupRowFull, completion_time: { seconds: 45.5 } }
    expect(() => toLoggedActivityGroup(bad)).toThrow(ZodError)
  })

  it('fromLoggedActivityGroup maps undefined optional fields to null', () => {
    const domain = toLoggedActivityGroup(groupRowNulls)
    const { id: _, ...body } = domain
    const row = fromLoggedActivityGroup(body, 'user-001')
    expect(row.actual_rounds_completed).toBeNull()
    expect(row.completion_time).toBeNull()
  })

  it('fromLoggedActivityGroup maps populated optional fields correctly', () => {
    const domain = toLoggedActivityGroup(groupRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedActivityGroup(body, 'user-001')
    expect(row.workout_log_id).toBe('wl-001')
    expect(row.user_id).toBe('user-001')
    expect(row.group_type).toBe('STRAIGHT_SETS')
    expect(row.ordinal).toBe(1)
    expect(row.actual_rounds_completed).toBe(4)
    expect(row.completion_time).toEqual({ seconds: 1800 })
  })

  it('fromLoggedActivityGroup omits id', () => {
    const domain = toLoggedActivityGroup(groupRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedActivityGroup(body, 'user-001')
    expect(row).not.toHaveProperty('id')
  })

  it('round-trip: preserves non-null data fields', () => {
    const domain = toLoggedActivityGroup(groupRowFull)
    const { id: _, ...body } = domain
    const roundTripped = fromLoggedActivityGroup(body, 'user-001')
    expect(roundTripped.workout_log_id).toBe(groupRowFull.workout_log_id)
    expect(roundTripped.group_type).toBe(groupRowFull.group_type)
    expect(roundTripped.ordinal).toBe(groupRowFull.ordinal)
    expect(roundTripped.actual_rounds_completed).toBe(groupRowFull.actual_rounds_completed)
    expect(roundTripped.completion_time).toEqual(groupRowFull.completion_time)
  })
})

// ---------------------------------------------------------------------------
// toLoggedActivity / fromLoggedActivity
// ---------------------------------------------------------------------------

describe('toLoggedActivity / fromLoggedActivity', () => {
  it('maps a fully populated activity row to domain type', () => {
    const result = toLoggedActivity(activityRowFull)
    expect(result.id).toBe('la-001')
    expect(result.loggedGroupId).toBe('lag-001')
    expect(result.exerciseId).toBe('ex-squat-001')
    expect(result.ordinal).toBe(1)
    expect(result.notes).toBe('Focus on depth')
  })

  it('maps null notes to undefined', () => {
    const result = toLoggedActivity(activityRowNulls)
    expect(result.notes).toBeUndefined()
  })

  it('fromLoggedActivity maps undefined notes to null', () => {
    const domain = toLoggedActivity(activityRowNulls)
    const { id: _, ...body } = domain
    const row = fromLoggedActivity(body, 'user-001')
    expect(row.notes).toBeNull()
  })

  it('fromLoggedActivity maps present notes correctly', () => {
    const domain = toLoggedActivity(activityRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedActivity(body, 'user-001')
    expect(row.notes).toBe('Focus on depth')
    expect(row.logged_group_id).toBe('lag-001')
    expect(row.user_id).toBe('user-001')
    expect(row.exercise_id).toBe('ex-squat-001')
    expect(row.ordinal).toBe(1)
  })

  it('fromLoggedActivity omits id', () => {
    const domain = toLoggedActivity(activityRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedActivity(body, 'user-001')
    expect(row).not.toHaveProperty('id')
  })

  it('round-trip: preserves data fields', () => {
    const domain = toLoggedActivity(activityRowFull)
    const { id: _, ...body } = domain
    const roundTripped = fromLoggedActivity(body, 'user-001')
    expect(roundTripped.logged_group_id).toBe(activityRowFull.logged_group_id)
    expect(roundTripped.exercise_id).toBe(activityRowFull.exercise_id)
    expect(roundTripped.ordinal).toBe(activityRowFull.ordinal)
    expect(roundTripped.notes).toBe(activityRowFull.notes)
  })
})

// ---------------------------------------------------------------------------
// toLoggedSet / fromLoggedSet
// ---------------------------------------------------------------------------

describe('toLoggedSet / fromLoggedSet', () => {
  it('maps a fully populated set row to domain type', () => {
    const result = toLoggedSet(setRowFull)
    expect(result.id).toBe('ls-001')
    expect(result.loggedActivityId).toBe('la-001')
    expect(result.setNumber).toBe(1)
    expect(result.setType).toBe('WORKING')
    expect(result.prescribed).toEqual({ reps: 5, weight: { value: 225, unit: 'lb' } })
    expect(result.actualReps).toBe(5)
    expect(result.actualWeight).toEqual({ value: 225, unit: 'lb' })
    expect(result.actualDuration).toEqual({ seconds: 45 })
    expect(result.actualDistance).toEqual({ value: 0, unit: 'm' })
    expect(result.actualPace).toEqual({ minutesPerUnit: 8.5, unit: 'mi' })
    expect(result.actualHeartRate).toBe(155)
    expect(result.rpe).toBe(8)
    expect(result.completed).toBe(true)
    expect(result.notes).toBe('Solid set')
    expect(result.ruckLoad).toEqual({ value: 45, unit: 'lb' })
    expect(result.elevationGain).toEqual({ value: 100, unit: 'm' })
  })

  it('maps null optional fields to undefined', () => {
    const result = toLoggedSet(setRowNulls)
    expect(result.prescribed).toBeUndefined()
    expect(result.actualReps).toBeUndefined()
    expect(result.actualWeight).toBeUndefined()
    expect(result.actualDuration).toBeUndefined()
    expect(result.actualDistance).toBeUndefined()
    expect(result.actualPace).toBeUndefined()
    expect(result.actualHeartRate).toBeUndefined()
    expect(result.rpe).toBeUndefined()
    expect(result.notes).toBeUndefined()
    expect(result.ruckLoad).toBeUndefined()
    expect(result.elevationGain).toBeUndefined()
  })

  it('throws ZodError on invalid set_type enum', () => {
    const bad = { ...setRowFull, set_type: 'FAILURE' }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on empty string set_type', () => {
    const bad = { ...setRowFull, set_type: '' }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('accepts all valid set types', () => {
    const validTypes = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']
    for (const setType of validTypes) {
      const result = toLoggedSet({ ...setRowFull, set_type: setType })
      expect(result.setType).toBe(setType)
    }
  })

  it('throws ZodError on invalid prescribed JSON (empty object fails refine)', () => {
    const bad = { ...setRowFull, prescribed: {} }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on prescribed with negative reps', () => {
    const bad = { ...setRowFull, prescribed: { reps: -1 } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on prescribed with zero reps', () => {
    const bad = { ...setRowFull, prescribed: { reps: 0 } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on prescribed weight with negative value', () => {
    const bad = {
      ...setRowFull,
      prescribed: { weight: { value: -100, unit: 'lb' } },
    }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_weight with zero value', () => {
    const bad = { ...setRowFull, actual_weight: { value: 0, unit: 'lb' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_weight with invalid unit', () => {
    const bad = { ...setRowFull, actual_weight: { value: 100, unit: 'stone' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_duration with negative seconds', () => {
    const bad = { ...setRowFull, actual_duration: { seconds: -5 } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_duration with non-integer seconds', () => {
    const bad = { ...setRowFull, actual_duration: { seconds: 30.5 } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_distance with negative value', () => {
    const bad = { ...setRowFull, actual_distance: { value: -1, unit: 'mi' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_distance with invalid unit', () => {
    const bad = { ...setRowFull, actual_distance: { value: 5, unit: 'furlongs' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_pace with zero minutesPerUnit', () => {
    const bad = { ...setRowFull, actual_pace: { minutesPerUnit: 0, unit: 'mi' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_pace with negative minutesPerUnit', () => {
    const bad = { ...setRowFull, actual_pace: { minutesPerUnit: -5, unit: 'km' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on actual_pace with invalid unit', () => {
    const bad = { ...setRowFull, actual_pace: { minutesPerUnit: 8, unit: 'm' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on ruck_load with zero value', () => {
    const bad = { ...setRowFull, ruck_load: { value: 0, unit: 'lb' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('throws ZodError on elevation_gain with invalid unit', () => {
    const bad = { ...setRowFull, elevation_gain: { value: 50, unit: 'ft' } }
    expect(() => toLoggedSet(bad)).toThrow(ZodError)
  })

  it('fromLoggedSet maps undefined optional fields to null', () => {
    const domain = toLoggedSet(setRowNulls)
    const { id: _, ...body } = domain
    const row = fromLoggedSet(body, 'user-001')
    expect(row.prescribed).toBeNull()
    expect(row.actual_reps).toBeNull()
    expect(row.actual_weight).toBeNull()
    expect(row.actual_duration).toBeNull()
    expect(row.actual_distance).toBeNull()
    expect(row.actual_pace).toBeNull()
    expect(row.actual_heart_rate).toBeNull()
    expect(row.ruck_load).toBeNull()
    expect(row.elevation_gain).toBeNull()
    expect(row.rpe).toBeNull()
    expect(row.notes).toBeNull()
  })

  it('fromLoggedSet maps populated optional fields correctly', () => {
    const domain = toLoggedSet(setRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedSet(body, 'user-001')
    expect(row.logged_activity_id).toBe('la-001')
    expect(row.user_id).toBe('user-001')
    expect(row.set_number).toBe(1)
    expect(row.set_type).toBe('WORKING')
    expect(row.prescribed).toEqual({ reps: 5, weight: { value: 225, unit: 'lb' } })
    expect(row.actual_reps).toBe(5)
    expect(row.actual_weight).toEqual({ value: 225, unit: 'lb' })
    expect(row.actual_duration).toEqual({ seconds: 45 })
    expect(row.actual_distance).toEqual({ value: 0, unit: 'm' })
    expect(row.actual_pace).toEqual({ minutesPerUnit: 8.5, unit: 'mi' })
    expect(row.actual_heart_rate).toBe(155)
    expect(row.rpe).toBe(8)
    expect(row.completed).toBe(true)
    expect(row.notes).toBe('Solid set')
    expect(row.ruck_load).toEqual({ value: 45, unit: 'lb' })
    expect(row.elevation_gain).toEqual({ value: 100, unit: 'm' })
  })

  it('fromLoggedSet omits id', () => {
    const domain = toLoggedSet(setRowFull)
    const { id: _, ...body } = domain
    const row = fromLoggedSet(body, 'user-001')
    expect(row).not.toHaveProperty('id')
  })

  it('round-trip: preserves non-null data fields', () => {
    const domain = toLoggedSet(setRowFull)
    const { id: _, ...body } = domain
    const roundTripped = fromLoggedSet(body, 'user-001')
    expect(roundTripped.set_number).toBe(setRowFull.set_number)
    expect(roundTripped.set_type).toBe(setRowFull.set_type)
    expect(roundTripped.prescribed).toEqual(setRowFull.prescribed)
    expect(roundTripped.actual_reps).toBe(setRowFull.actual_reps)
    expect(roundTripped.actual_weight).toEqual(setRowFull.actual_weight)
    expect(roundTripped.rpe).toBe(setRowFull.rpe)
    expect(roundTripped.completed).toBe(setRowFull.completed)
    expect(roundTripped.notes).toBe(setRowFull.notes)
  })

  it('round-trip: null fields survive toLoggedSet -> fromLoggedSet', () => {
    const domain = toLoggedSet(setRowNulls)
    const { id: _, ...body } = domain
    const roundTripped = fromLoggedSet(body, 'user-001')
    expect(roundTripped.prescribed).toBeNull()
    expect(roundTripped.actual_reps).toBeNull()
    expect(roundTripped.actual_weight).toBeNull()
    expect(roundTripped.actual_duration).toBeNull()
    expect(roundTripped.actual_distance).toBeNull()
    expect(roundTripped.actual_pace).toBeNull()
    expect(roundTripped.actual_heart_rate).toBeNull()
    expect(roundTripped.ruck_load).toBeNull()
    expect(roundTripped.elevation_gain).toBeNull()
    expect(roundTripped.rpe).toBeNull()
    expect(roundTripped.notes).toBeNull()
  })

  it('prescribed with only notes satisfies the at-least-one-field refine', () => {
    const row = { ...setRowFull, prescribed: { notes: 'Go heavy' } }
    const result = toLoggedSet(row)
    expect(result.prescribed).toEqual({ notes: 'Go heavy' })
  })

  it('prescribed with only loadSpec passes validation', () => {
    const row = {
      ...setRowFull,
      prescribed: { loadSpec: { type: 'rpe', target: 8 } },
    }
    const result = toLoggedSet(row)
    expect(result.prescribed?.loadSpec).toEqual({ type: 'rpe', target: 8 })
  })

  it('prescribed with only duration passes validation', () => {
    const row = {
      ...setRowFull,
      prescribed: { duration: { seconds: 60 } },
    }
    const result = toLoggedSet(row)
    expect(result.prescribed?.duration).toEqual({ seconds: 60 })
  })

  it('prescribed with only distance passes validation', () => {
    const row = {
      ...setRowFull,
      prescribed: { distance: { value: 400, unit: 'm' } },
    }
    const result = toLoggedSet(row)
    expect(result.prescribed?.distance).toEqual({ value: 400, unit: 'm' })
  })
})

// ---------------------------------------------------------------------------
// toUserProfile / fromUserProfile
// ---------------------------------------------------------------------------

describe('toUserProfile / fromUserProfile', () => {
  it('maps a fully populated user profile row to domain type', () => {
    const result = toUserProfile(userProfileRowFull)
    expect(result.id).toBe('user-001')
    expect(result.displayName).toBe('Coach Hamilton')
    expect(result.preferredUnits).toBe('IMPERIAL')
    expect(result.bodyweight).toEqual({ value: 200, unit: 'lb' })
    expect(result.trainingAge).toEqual({ seconds: 157680000 })
    expect(result.exerciseMaxes).toEqual({
      'ex-squat-001': {
        weight: { value: 405, unit: 'lb' },
        testedAt: '2025-06-01T00:00:00Z',
        estimated: false,
      },
    })
    expect(result.maxReps).toEqual({ 'ex-pullup-001': 20 })
    expect(result.createdAt).toBe(now)
    expect(result.updatedAt).toBe(now)
  })

  it('maps null optional fields to undefined (display_name)', () => {
    const result = toUserProfile(userProfileRowNulls)
    expect(result.displayName).toBeUndefined()
  })

  it('maps null bodyweight to undefined', () => {
    const result = toUserProfile(userProfileRowNulls)
    expect(result.bodyweight).toBeUndefined()
  })

  it('maps null training_age to undefined', () => {
    const result = toUserProfile(userProfileRowNulls)
    expect(result.trainingAge).toBeUndefined()
  })

  it('maps null exercise_maxes to empty object', () => {
    const result = toUserProfile(userProfileRowNulls)
    expect(result.exerciseMaxes).toEqual({})
  })

  it('maps null max_reps to empty object', () => {
    const result = toUserProfile(userProfileRowNulls)
    expect(result.maxReps).toEqual({})
  })

  it('throws ZodError on invalid preferred_units enum', () => {
    const bad = { ...userProfileRowFull, preferred_units: 'STONE' }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on empty string preferred_units', () => {
    const bad = { ...userProfileRowFull, preferred_units: '' }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on malformed bodyweight (zero value)', () => {
    const bad = { ...userProfileRowFull, bodyweight: { value: 0, unit: 'kg' } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on malformed bodyweight (negative value)', () => {
    const bad = { ...userProfileRowFull, bodyweight: { value: -10, unit: 'lb' } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on bodyweight with invalid unit', () => {
    const bad = { ...userProfileRowFull, bodyweight: { value: 180, unit: 'stone' } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on training_age with negative seconds', () => {
    const bad = { ...userProfileRowFull, training_age: { seconds: -1 } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on training_age with non-integer seconds', () => {
    const bad = { ...userProfileRowFull, training_age: { seconds: 100.5 } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on exercise_maxes with invalid oneRepMax (zero weight)', () => {
    const bad = {
      ...userProfileRowFull,
      exercise_maxes: {
        'ex-squat-001': {
          weight: { value: 0, unit: 'lb' },
          testedAt: '2025-06-01T00:00:00Z',
          estimated: false,
        },
      },
    }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on max_reps with zero value', () => {
    const bad = { ...userProfileRowFull, max_reps: { 'ex-pullup-001': 0 } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on max_reps with negative value', () => {
    const bad = { ...userProfileRowFull, max_reps: { 'ex-pullup-001': -5 } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  it('throws ZodError on max_reps with non-integer value', () => {
    const bad = { ...userProfileRowFull, max_reps: { 'ex-pullup-001': 12.5 } }
    expect(() => toUserProfile(bad)).toThrow(ZodError)
  })

  // fromUserProfile conditional logic
  it('fromUserProfile only includes id when no optional fields set', () => {
    const row = fromUserProfile({ id: 'user-003' })
    expect(row).toEqual({ id: 'user-003' })
  })

  it('fromUserProfile includes displayName when explicitly set', () => {
    const row = fromUserProfile({ id: 'user-003', displayName: 'New Name' })
    expect(row.display_name).toBe('New Name')
    expect(row).not.toHaveProperty('preferred_units')
    expect(row).not.toHaveProperty('bodyweight')
    expect(row).not.toHaveProperty('training_age')
    expect(row).not.toHaveProperty('exercise_maxes')
    expect(row).not.toHaveProperty('max_reps')
  })

  it('fromUserProfile includes preferredUnits when explicitly set', () => {
    const row = fromUserProfile({ id: 'user-003', preferredUnits: 'METRIC' })
    expect(row.preferred_units).toBe('METRIC')
    expect(row).not.toHaveProperty('display_name')
  })

  it('fromUserProfile includes bodyweight when explicitly set', () => {
    const row = fromUserProfile({ id: 'user-003', bodyweight: { value: 180, unit: 'lb' } })
    expect(row.bodyweight).toEqual({ value: 180, unit: 'lb' })
  })

  it('fromUserProfile skips displayName when value is undefined (guard uses !== undefined)', () => {
    // When displayName is undefined, the !== undefined guard is false,
    // so the field is not added to the row at all
    const row = fromUserProfile({ id: 'user-003', displayName: undefined })
    expect(row).not.toHaveProperty('display_name')
  })

  it('fromUserProfile skips bodyweight when value is undefined', () => {
    const row = fromUserProfile({ id: 'user-003', bodyweight: undefined })
    expect(row).not.toHaveProperty('bodyweight')
  })

  it('fromUserProfile skips trainingAge when value is undefined', () => {
    const row = fromUserProfile({ id: 'user-003', trainingAge: undefined })
    expect(row).not.toHaveProperty('training_age')
  })

  it('fromUserProfile includes displayName empty string (truthy !== undefined check)', () => {
    const row = fromUserProfile({ id: 'user-003', displayName: '' })
    expect(row.display_name).toBe('')
  })

  it('fromUserProfile includes exerciseMaxes when explicitly set', () => {
    const maxes = {
      'ex-bench-001': {
        weight: { value: 275, unit: 'lb' as const },
        testedAt: '2025-06-01T00:00:00Z',
        estimated: false,
      },
    }
    const row = fromUserProfile({ id: 'user-003', exerciseMaxes: maxes })
    expect(row.exercise_maxes).toEqual(maxes)
  })

  it('fromUserProfile includes maxReps when explicitly set', () => {
    const row = fromUserProfile({ id: 'user-003', maxReps: { 'ex-dip-001': 25 } })
    expect(row.max_reps).toEqual({ 'ex-dip-001': 25 })
  })

  it('fromUserProfile includes multiple fields when all set', () => {
    const row = fromUserProfile({
      id: 'user-003',
      displayName: 'Athlete',
      preferredUnits: 'IMPERIAL',
      bodyweight: { value: 200, unit: 'lb' },
      trainingAge: { seconds: 31536000 },
      exerciseMaxes: {},
      maxReps: {},
    })
    expect(row.id).toBe('user-003')
    expect(row.display_name).toBe('Athlete')
    expect(row.preferred_units).toBe('IMPERIAL')
    expect(row.bodyweight).toEqual({ value: 200, unit: 'lb' })
    expect(row.training_age).toEqual({ seconds: 31536000 })
    expect(row.exercise_maxes).toEqual({})
    expect(row.max_reps).toEqual({})
  })

  it('fromUserProfile does not include createdAt or updatedAt', () => {
    const row = fromUserProfile({
      id: 'user-003',
      displayName: 'Test',
      preferredUnits: 'METRIC',
    })
    expect(row).not.toHaveProperty('created_at')
    expect(row).not.toHaveProperty('updated_at')
  })
})

// ---------------------------------------------------------------------------
// toOneRepMaxHistory / fromOneRepMaxHistory
// ---------------------------------------------------------------------------

describe('toOneRepMaxHistory / fromOneRepMaxHistory', () => {
  it('maps a valid one rep max history row to domain type', () => {
    const result = toOneRepMaxHistory(ormhRow)
    expect(result.id).toBe('ormh-001')
    expect(result.createdAt).toBe(now)
    expect(result.userId).toBe('user-001')
    expect(result.exerciseId).toBe('ex-squat-001')
    expect(result.weight).toEqual({ value: 405, unit: 'lb' })
    expect(result.estimated).toBe(false)
    expect(result.recordedAt).toBe('2025-06-10T09:00:00Z')
  })

  it('does not include updatedAt in result', () => {
    const result = toOneRepMaxHistory(ormhRow)
    expect(result).not.toHaveProperty('updatedAt')
  })

  it('does not include updated_at even if source row had extra properties', () => {
    // The row type has no updated_at, but test defense against accidental spread
    const result = toOneRepMaxHistory(ormhRow)
    expect(Object.keys(result)).not.toContain('updatedAt')
    expect(Object.keys(result)).not.toContain('updated_at')
  })

  it('maps estimated true correctly', () => {
    const row = { ...ormhRow, estimated: true }
    const result = toOneRepMaxHistory(row)
    expect(result.estimated).toBe(true)
  })

  it('throws ZodError on weight with zero value', () => {
    const bad = { ...ormhRow, weight: { value: 0, unit: 'lb' } }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight with negative value', () => {
    const bad = { ...ormhRow, weight: { value: -100, unit: 'kg' } }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight with invalid unit', () => {
    const bad = { ...ormhRow, weight: { value: 405, unit: 'stone' } }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight missing value field', () => {
    const bad = { ...ormhRow, weight: { unit: 'lb' } }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight missing unit field', () => {
    const bad = { ...ormhRow, weight: { value: 405 } }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight as a plain number (not an object)', () => {
    const bad = { ...ormhRow, weight: 405 }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('throws ZodError on weight as a string', () => {
    const bad = { ...ormhRow, weight: '405 lb' }
    expect(() => toOneRepMaxHistory(bad)).toThrow(ZodError)
  })

  it('accepts weight in kg', () => {
    const row = { ...ormhRow, weight: { value: 180, unit: 'kg' } }
    const result = toOneRepMaxHistory(row)
    expect(result.weight).toEqual({ value: 180, unit: 'kg' })
  })

  it('fromOneRepMaxHistory maps domain to DB row shape', () => {
    const domain = toOneRepMaxHistory(ormhRow)
    const { id: _, createdAt: _c, ...body } = domain
    const row = fromOneRepMaxHistory(body)
    expect(row.user_id).toBe('user-001')
    expect(row.exercise_id).toBe('ex-squat-001')
    expect(row.weight).toEqual({ value: 405, unit: 'lb' })
    expect(row.estimated).toBe(false)
    expect(row.recorded_at).toBe('2025-06-10T09:00:00Z')
  })

  it('fromOneRepMaxHistory omits id and created_at', () => {
    const domain = toOneRepMaxHistory(ormhRow)
    const { id: _, createdAt: _c, ...body } = domain
    const row = fromOneRepMaxHistory(body)
    expect(row).not.toHaveProperty('id')
    expect(row).not.toHaveProperty('created_at')
  })

  it('round-trip: preserves data fields', () => {
    const domain = toOneRepMaxHistory(ormhRow)
    const { id: _, createdAt: _c, ...body } = domain
    const roundTripped = fromOneRepMaxHistory(body)
    expect(roundTripped.user_id).toBe(ormhRow.user_id)
    expect(roundTripped.exercise_id).toBe(ormhRow.exercise_id)
    expect(roundTripped.weight).toEqual(ormhRow.weight)
    expect(roundTripped.estimated).toBe(ormhRow.estimated)
    expect(roundTripped.recorded_at).toBe(ormhRow.recorded_at)
  })
})

// ---------------------------------------------------------------------------
// Cross-cutting: Zod validation edge cases on JSON fields
// ---------------------------------------------------------------------------

describe('Cross-cutting Zod validation on JSON fields', () => {
  describe('weightSchema validation via toLoggedSet', () => {
    it('rejects weight with value as string', () => {
      const bad = { ...setRowFull, actual_weight: { value: '225', unit: 'lb' } }
      expect(() => toLoggedSet(bad)).toThrow(ZodError)
    })

    it('rejects weight with missing fields', () => {
      const bad = { ...setRowFull, actual_weight: {} }
      expect(() => toLoggedSet(bad)).toThrow(ZodError)
    })

    it('rejects weight as null when field is supposed to be JSON', () => {
      // When field is non-null, the parse path is taken; null skips it.
      // This tests that a non-null but invalid shape fails.
      const bad = { ...setRowFull, actual_weight: 'not-json' }
      expect(() => toLoggedSet(bad)).toThrow(ZodError)
    })
  })

  describe('durationSchema validation via toLoggedActivityGroup', () => {
    it('rejects duration with string seconds', () => {
      const bad = { ...groupRowFull, completion_time: { seconds: '1800' } }
      expect(() => toLoggedActivityGroup(bad)).toThrow(ZodError)
    })

    it('rejects duration with missing seconds field', () => {
      const bad = { ...groupRowFull, completion_time: { minutes: 30 } }
      expect(() => toLoggedActivityGroup(bad)).toThrow(ZodError)
    })

    it('accepts duration with zero seconds', () => {
      const row = { ...groupRowFull, completion_time: { seconds: 0 } }
      const result = toLoggedActivityGroup(row)
      expect(result.completionTime).toEqual({ seconds: 0 })
    })
  })

  describe('distanceSchema validation via toLoggedSet', () => {
    it('rejects distance with string value', () => {
      const bad = { ...setRowFull, actual_distance: { value: '400', unit: 'm' } }
      expect(() => toLoggedSet(bad)).toThrow(ZodError)
    })

    it('accepts distance with zero value (nonnegative)', () => {
      const row = { ...setRowFull, actual_distance: { value: 0, unit: 'km' } }
      const result = toLoggedSet(row)
      expect(result.actualDistance).toEqual({ value: 0, unit: 'km' })
    })

    it('accepts all valid distance units', () => {
      for (const unit of ['mi', 'km', 'm', 'yd']) {
        const row = { ...setRowFull, actual_distance: { value: 1, unit } }
        const result = toLoggedSet(row)
        expect(result.actualDistance?.unit).toBe(unit)
      }
    })
  })

  describe('paceSchema validation via toLoggedSet', () => {
    it('rejects pace with string minutesPerUnit', () => {
      const bad = { ...setRowFull, actual_pace: { minutesPerUnit: '8', unit: 'mi' } }
      expect(() => toLoggedSet(bad)).toThrow(ZodError)
    })

    it('accepts all valid pace units', () => {
      for (const unit of ['mi', 'km']) {
        const row = { ...setRowFull, actual_pace: { minutesPerUnit: 7.5, unit } }
        const result = toLoggedSet(row)
        expect(result.actualPace?.unit).toBe(unit)
      }
    })
  })

  describe('programContextSchema validation via toWorkoutLog', () => {
    it('rejects program_context missing programId', () => {
      const bad = {
        ...workoutLogRowFull,
        program_context: { blockId: 'b-1', weekNumber: 1, dayLabel: 'Mon' },
      }
      expect(() => toWorkoutLog(bad)).toThrow(ZodError)
    })

    it('rejects program_context missing blockId', () => {
      const bad = {
        ...workoutLogRowFull,
        program_context: { programId: 'p-1', weekNumber: 1, dayLabel: 'Mon' },
      }
      expect(() => toWorkoutLog(bad)).toThrow(ZodError)
    })

    it('rejects program_context with empty programId', () => {
      const bad = {
        ...workoutLogRowFull,
        program_context: { programId: '', blockId: 'b-1', weekNumber: 1, dayLabel: 'Mon' },
      }
      expect(() => toWorkoutLog(bad)).toThrow(ZodError)
    })

    it('rejects program_context with weekNumber of 0', () => {
      const bad = {
        ...workoutLogRowFull,
        program_context: { programId: 'p-1', blockId: 'b-1', weekNumber: 0, dayLabel: 'Mon' },
      }
      expect(() => toWorkoutLog(bad)).toThrow(ZodError)
    })

    it('rejects program_context with negative weekNumber', () => {
      const bad = {
        ...workoutLogRowFull,
        program_context: { programId: 'p-1', blockId: 'b-1', weekNumber: -1, dayLabel: 'Mon' },
      }
      expect(() => toWorkoutLog(bad)).toThrow(ZodError)
    })
  })

  describe('oneRepMaxSchema validation via toUserProfile', () => {
    it('rejects exercise_maxes with missing testedAt', () => {
      const bad = {
        ...userProfileRowFull,
        exercise_maxes: {
          'ex-squat-001': {
            weight: { value: 405, unit: 'lb' },
            estimated: false,
          },
        },
      }
      expect(() => toUserProfile(bad)).toThrow(ZodError)
    })

    it('rejects exercise_maxes with invalid testedAt format', () => {
      const bad = {
        ...userProfileRowFull,
        exercise_maxes: {
          'ex-squat-001': {
            weight: { value: 405, unit: 'lb' },
            testedAt: 'not-a-date',
            estimated: false,
          },
        },
      }
      expect(() => toUserProfile(bad)).toThrow(ZodError)
    })

    it('rejects exercise_maxes with negative weight', () => {
      const bad = {
        ...userProfileRowFull,
        exercise_maxes: {
          'ex-squat-001': {
            weight: { value: -100, unit: 'lb' },
            testedAt: '2025-06-01T00:00:00Z',
            estimated: false,
          },
        },
      }
      expect(() => toUserProfile(bad)).toThrow(ZodError)
    })
  })
})

// ---------------------------------------------------------------------------
// Structural completeness: verify all mapper functions exist
// ---------------------------------------------------------------------------

describe('Mapper function exports', () => {
  it('exports toExercise as a function', () => {
    expect(typeof toExercise).toBe('function')
  })

  it('exports fromExercise as a function', () => {
    expect(typeof fromExercise).toBe('function')
  })

  it('exports toWorkoutLog as a function', () => {
    expect(typeof toWorkoutLog).toBe('function')
  })

  it('exports fromWorkoutLog as a function', () => {
    expect(typeof fromWorkoutLog).toBe('function')
  })

  it('exports toLoggedActivityGroup as a function', () => {
    expect(typeof toLoggedActivityGroup).toBe('function')
  })

  it('exports fromLoggedActivityGroup as a function', () => {
    expect(typeof fromLoggedActivityGroup).toBe('function')
  })

  it('exports toLoggedActivity as a function', () => {
    expect(typeof toLoggedActivity).toBe('function')
  })

  it('exports fromLoggedActivity as a function', () => {
    expect(typeof fromLoggedActivity).toBe('function')
  })

  it('exports toLoggedSet as a function', () => {
    expect(typeof toLoggedSet).toBe('function')
  })

  it('exports fromLoggedSet as a function', () => {
    expect(typeof fromLoggedSet).toBe('function')
  })

  it('exports toUserProfile as a function', () => {
    expect(typeof toUserProfile).toBe('function')
  })

  it('exports fromUserProfile as a function', () => {
    expect(typeof fromUserProfile).toBe('function')
  })

  it('exports toOneRepMaxHistory as a function', () => {
    expect(typeof toOneRepMaxHistory).toBe('function')
  })

  it('exports fromOneRepMaxHistory as a function', () => {
    expect(typeof fromOneRepMaxHistory).toBe('function')
  })

  it('exports toSessionTemplate as a function', () => {
    expect(typeof toSessionTemplate).toBe('function')
  })

  it('exports fromSessionTemplate as a function', () => {
    expect(typeof fromSessionTemplate).toBe('function')
  })

  it('exports toActivityGroupFlat as a function', () => {
    expect(typeof toActivityGroupFlat).toBe('function')
  })

  it('exports fromActivityGroup as a function', () => {
    expect(typeof fromActivityGroup).toBe('function')
  })

  it('exports toActivity as a function', () => {
    expect(typeof toActivity).toBe('function')
  })

  it('exports fromActivity as a function', () => {
    expect(typeof fromActivity).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// SessionTemplate fixtures
// ---------------------------------------------------------------------------

const sessionTemplateRowFull: SessionTemplateRow = {
  id: 'st-001',
  user_id: 'user-001',
  name: 'Upper Body Strength',
  description: 'Heavy pressing and pulling',
  category: 'STRENGTH',
  rest_between_groups: JSON.stringify({ seconds: 120 }),
  time_cap: JSON.stringify({ seconds: 3600 }),
  scoring: 'NONE',
  created_at: now,
  updated_at: now,
}

const sessionTemplateRowNulls: SessionTemplateRow = {
  id: 'st-002',
  user_id: 'user-001',
  name: 'Quick WOD',
  description: null,
  category: 'CONDITIONING',
  rest_between_groups: null,
  time_cap: null,
  scoring: 'FOR_TIME',
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// ActivityGroup fixtures
// ---------------------------------------------------------------------------

const activityGroupRowFull: ActivityGroupRow = {
  id: 'ag-001',
  session_template_id: 'st-001',
  group_type: 'STRAIGHT_SETS',
  ordinal: 1,
  rounds: 4,
  rest_between_rounds: JSON.stringify({ seconds: 90 }),
  rest_between_activities: JSON.stringify({ seconds: 60 }),
  created_at: now,
  updated_at: now,
}

const activityGroupRowNulls: ActivityGroupRow = {
  id: 'ag-002',
  session_template_id: 'st-001',
  group_type: 'SUPERSET',
  ordinal: 2,
  rounds: null,
  rest_between_rounds: null,
  rest_between_activities: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// Activity fixtures
// ---------------------------------------------------------------------------

const fixedSetsScheme = {
  type: 'fixedSets',
  sets: 3,
  reps: 5,
  load: { type: 'absolute', weight: { value: 225, unit: 'lb' } },
}

const cardioIntervalScheme = {
  type: 'cardioInterval',
  workDuration: { seconds: 30 },
  rest: { seconds: 60 },
  rounds: 10,
  modality: 'RUNNING',
}

const activityRowWithFixedSets: ActivityRow = {
  id: 'act-001',
  activity_group_id: 'ag-001',
  exercise_id: 'ex-squat-001',
  ordinal: 1,
  set_scheme: JSON.stringify(fixedSetsScheme),
  notes: 'Focus on depth',
  created_at: now,
  updated_at: now,
}

const activityRowWithCardioInterval: ActivityRow = {
  id: 'act-002',
  activity_group_id: 'ag-001',
  exercise_id: 'ex-run-001',
  ordinal: 2,
  set_scheme: JSON.stringify(cardioIntervalScheme),
  notes: null,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// toSessionTemplate / fromSessionTemplate
// ---------------------------------------------------------------------------

describe('toSessionTemplate / fromSessionTemplate', () => {
  it('toSessionTemplate: maps fully populated row', () => {
    const result = toSessionTemplate(sessionTemplateRowFull)
    expect(result.id).toBe('st-001')
    expect(result.userId).toBe('user-001')
    expect(result.name).toBe('Upper Body Strength')
    expect(result.description).toBe('Heavy pressing and pulling')
    expect(result.category).toBe('STRENGTH')
    expect(result.restBetweenGroups).toEqual({ seconds: 120 })
    expect(result.timeCap).toEqual({ seconds: 3600 })
    expect(result.scoring).toBe('NONE')
    expect(result.createdAt).toBe(now)
    expect(result.updatedAt).toBe(now)
  })

  it('toSessionTemplate: handles null optional fields', () => {
    const result = toSessionTemplate(sessionTemplateRowNulls)
    expect(result.description).toBeUndefined()
    expect(result.restBetweenGroups).toBeUndefined()
    expect(result.timeCap).toBeUndefined()
  })

  it('toSessionTemplate: throws on invalid category', () => {
    const bad = { ...sessionTemplateRowFull, category: 'YOGA' }
    expect(() => toSessionTemplate(bad)).toThrow(ZodError)
  })

  it('round-trip: fromSessionTemplate -> toSessionTemplate preserves data', () => {
    const domain = toSessionTemplate(sessionTemplateRowFull)
    const { id: _, createdAt: _c, updatedAt: _u, ...body } = domain
    const row = fromSessionTemplate(body)
    // Reconstruct a full row for round-trip verification
    const fullRow: SessionTemplateRow = {
      id: 'st-roundtrip',
      created_at: now,
      updated_at: now,
      ...row,
    } as SessionTemplateRow
    const roundTripped = toSessionTemplate(fullRow)
    expect(roundTripped.userId).toBe(domain.userId)
    expect(roundTripped.name).toBe(domain.name)
    expect(roundTripped.description).toBe(domain.description)
    expect(roundTripped.category).toBe(domain.category)
    expect(roundTripped.restBetweenGroups).toEqual(domain.restBetweenGroups)
    expect(roundTripped.timeCap).toEqual(domain.timeCap)
    expect(roundTripped.scoring).toBe(domain.scoring)
  })
})

// ---------------------------------------------------------------------------
// toActivityGroupFlat / fromActivityGroup
// ---------------------------------------------------------------------------

describe('toActivityGroupFlat / fromActivityGroup', () => {
  it('toActivityGroupFlat: maps fully populated row', () => {
    const result = toActivityGroupFlat(activityGroupRowFull)
    expect(result.id).toBe('ag-001')
    expect(result.sessionTemplateId).toBe('st-001')
    expect(result.groupType).toBe('STRAIGHT_SETS')
    expect(result.ordinal).toBe(1)
    expect(result.rounds).toBe(4)
    expect(result.restBetweenRounds).toEqual({ seconds: 90 })
    expect(result.restBetweenActivities).toEqual({ seconds: 60 })
  })

  it('toActivityGroupFlat: handles null optional fields (rounds, rest durations)', () => {
    const result = toActivityGroupFlat(activityGroupRowNulls)
    expect(result.rounds).toBeUndefined()
    expect(result.restBetweenRounds).toBeUndefined()
    expect(result.restBetweenActivities).toBeUndefined()
  })

  it('toActivityGroupFlat: throws on invalid group_type', () => {
    const bad = { ...activityGroupRowFull, group_type: 'TRISET' }
    expect(() => toActivityGroupFlat(bad)).toThrow(ZodError)
  })

  it('round-trip preserves data', () => {
    const domain = toActivityGroupFlat(activityGroupRowFull)
    const { id: _, ...body } = domain
    const row = fromActivityGroup(body)
    expect(row.session_template_id).toBe(activityGroupRowFull.session_template_id)
    expect(row.group_type).toBe(activityGroupRowFull.group_type)
    expect(row.ordinal).toBe(activityGroupRowFull.ordinal)
    expect(row.rounds).toBe(activityGroupRowFull.rounds)
    // rest durations are stored as JSON strings -- verify round-trip consistency
    expect(row.rest_between_rounds).toBe(activityGroupRowFull.rest_between_rounds)
    expect(row.rest_between_activities).toBe(activityGroupRowFull.rest_between_activities)
  })
})

// ---------------------------------------------------------------------------
// toActivity / fromActivity
// ---------------------------------------------------------------------------

describe('toActivity / fromActivity', () => {
  it('toActivity: maps fixedSets set_scheme', () => {
    const result = toActivity(activityRowWithFixedSets)
    expect(result.id).toBe('act-001')
    expect(result.exerciseId).toBe('ex-squat-001')
    expect(result.ordinal).toBe(1)
    expect(result.setScheme.type).toBe('fixedSets')
    if (result.setScheme.type === 'fixedSets') {
      expect(result.setScheme.sets).toBe(3)
      expect(result.setScheme.reps).toBe(5)
    }
    expect(result.notes).toBe('Focus on depth')
  })

  it('toActivity: maps cardioInterval set_scheme', () => {
    const result = toActivity(activityRowWithCardioInterval)
    expect(result.setScheme.type).toBe('cardioInterval')
    if (result.setScheme.type === 'cardioInterval') {
      expect(result.setScheme.workDuration).toEqual({ seconds: 30 })
      expect(result.setScheme.rest).toEqual({ seconds: 60 })
      expect(result.setScheme.rounds).toBe(10)
      expect(result.setScheme.modality).toBe('RUNNING')
    }
  })

  it('toActivity: preserves activityGroupId', () => {
    const result = toActivity(activityRowWithFixedSets)
    expect(result.activityGroupId).toBe('ag-001')
  })

  it('toActivity: throws on invalid set_scheme JSON', () => {
    const bad = { ...activityRowWithFixedSets, set_scheme: '{"type":"unknownType"}' }
    expect(() => toActivity(bad)).toThrow(ZodError)
  })

  it('toActivity: handles null notes', () => {
    const result = toActivity(activityRowWithCardioInterval)
    expect(result.notes).toBeUndefined()
  })

  it('fromActivity: includes activity_group_id in output', () => {
    const domain = toActivity(activityRowWithFixedSets)
    const { id: _, ...body } = domain
    const row = fromActivity(body)
    expect(row.activity_group_id).toBe('ag-001')
  })

  it('round-trip: activityGroupId preserved', () => {
    const domain = toActivity(activityRowWithFixedSets)
    const { id: _, ...body } = domain
    const row = fromActivity(body)
    // Reconstruct full row for round-trip
    const fullRow: ActivityRow = {
      id: 'act-roundtrip',
      created_at: now,
      updated_at: now,
      ...row,
    } as ActivityRow
    const roundTripped = toActivity(fullRow)
    expect(roundTripped.activityGroupId).toBe(domain.activityGroupId)
    expect(roundTripped.exerciseId).toBe(domain.exerciseId)
    expect(roundTripped.ordinal).toBe(domain.ordinal)
    expect(roundTripped.setScheme).toEqual(domain.setScheme)
    expect(roundTripped.notes).toBe(domain.notes)
  })
})
