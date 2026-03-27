import { z } from 'zod'
import type {
  Exercise,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  UserProfile,
  OneRepMaxHistory,
} from '@/domain/types'
import {
  entityId,
  exerciseCategorySchema,
  movementPatternSchema,
  muscleGroupSpecSchema,
  equipmentSchema,
  weightSchema,
  durationSchema,
  distanceSchema,
  paceSchema,
  programContextSchema,
  prescriptionSchema,
  groupTypeSchema,
  setTypeSchema,
  preferredUnitsSchema,
  oneRepMaxSchema,
} from '@/domain/types'
import type {
  ExerciseRow,
  WorkoutLogRow,
  LoggedActivityGroupRow,
  LoggedActivityRow,
  LoggedSetRow,
  UserProfileRow,
  OneRepMaxHistoryRow,
} from './database.types'

/**
 * Bidirectional mappers between database row types and domain types.
 *
 * Naming convention:
 * - `toXxx()` converts a database row to a domain type (DB -> Domain)
 * - `fromXxx()` converts a domain type to a partial database row (Domain -> DB)
 *
 * Null/undefined conversion strategy:
 * - DB null -> Domain undefined (optional fields absent in domain model)
 * - Domain undefined -> DB null (explicit nulls for SQL columns)
 *
 * JSON columns use Zod schema validation (`.parse()`) instead of `as` casts
 * to catch data corruption at the persistence boundary.
 */

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    aliases: z.array(z.string()).parse(row.aliases),
    category: exerciseCategorySchema.parse(row.category),
    movementPattern: movementPatternSchema.parse(row.movement_pattern),
    muscleGroups: muscleGroupSpecSchema.parse(row.muscle_groups),
    isBilateral: row.is_bilateral,
    supports1RM: row.supports_1rm,
    equipmentRequired: z.array(equipmentSchema).parse(row.equipment_required),
    isCustom: row.is_custom,
  }
}

export function fromExercise(
  exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<ExerciseRow> {
  return {
    name: exercise.name,
    aliases: exercise.aliases,
    category: exercise.category,
    movement_pattern: exercise.movementPattern,
    muscle_groups: exercise.muscleGroups,
    is_bilateral: exercise.isBilateral,
    supports_1rm: exercise.supports1RM,
    equipment_required: exercise.equipmentRequired,
    is_custom: exercise.isCustom,
  }
}

// ---------------------------------------------------------------------------
// WorkoutLog
// ---------------------------------------------------------------------------

export function toWorkoutLog(row: WorkoutLogRow): WorkoutLog {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    title: row.title ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    sessionTemplateId: row.session_template_id ?? undefined,
    programContext:
      row.program_context != null ? programContextSchema.parse(row.program_context) : undefined,
    perceivedDifficulty: row.perceived_difficulty ?? undefined,
    bodyweightAtSession:
      row.bodyweight_at_session != null ? weightSchema.parse(row.bodyweight_at_session) : undefined,
    overallNotes: row.overall_notes ?? undefined,
  }
}

export function fromWorkoutLog(
  log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<WorkoutLogRow> {
  return {
    user_id: log.userId,
    title: log.title ?? null,
    started_at: log.startedAt,
    completed_at: log.completedAt ?? null,
    session_template_id: log.sessionTemplateId ?? null,
    program_context: log.programContext ?? null,
    perceived_difficulty: log.perceivedDifficulty ?? null,
    bodyweight_at_session: log.bodyweightAtSession ?? null,
    overall_notes: log.overallNotes ?? null,
  }
}

// ---------------------------------------------------------------------------
// LoggedActivityGroup
// ---------------------------------------------------------------------------

export function toLoggedActivityGroup(row: LoggedActivityGroupRow): LoggedActivityGroup {
  return {
    id: row.id,
    workoutLogId: row.workout_log_id,
    groupType: groupTypeSchema.parse(row.group_type),
    ordinal: row.ordinal,
    actualRoundsCompleted: row.actual_rounds_completed ?? undefined,
    completionTime:
      row.completion_time != null ? durationSchema.parse(row.completion_time) : undefined,
  }
}

export function fromLoggedActivityGroup(
  group: Omit<LoggedActivityGroup, 'id'>,
  userId: string,
): Partial<LoggedActivityGroupRow> {
  return {
    workout_log_id: group.workoutLogId,
    user_id: userId,
    group_type: group.groupType,
    ordinal: group.ordinal,
    actual_rounds_completed: group.actualRoundsCompleted ?? null,
    completion_time: group.completionTime ?? null,
  }
}

// ---------------------------------------------------------------------------
// LoggedActivity
// ---------------------------------------------------------------------------

export function toLoggedActivity(row: LoggedActivityRow): LoggedActivity {
  return {
    id: row.id,
    loggedGroupId: row.logged_group_id,
    exerciseId: row.exercise_id,
    ordinal: row.ordinal,
    notes: row.notes ?? undefined,
  }
}

export function fromLoggedActivity(
  activity: Omit<LoggedActivity, 'id'>,
  userId: string,
): Partial<LoggedActivityRow> {
  return {
    logged_group_id: activity.loggedGroupId,
    user_id: userId,
    exercise_id: activity.exerciseId,
    ordinal: activity.ordinal,
    notes: activity.notes ?? null,
  }
}

// ---------------------------------------------------------------------------
// LoggedSet
// ---------------------------------------------------------------------------

export function toLoggedSet(row: LoggedSetRow): LoggedSet {
  return {
    id: row.id,
    loggedActivityId: row.logged_activity_id,
    setNumber: row.set_number,
    setType: setTypeSchema.parse(row.set_type),
    prescribed: row.prescribed != null ? prescriptionSchema.parse(row.prescribed) : undefined,
    actualReps: row.actual_reps ?? undefined,
    actualWeight: row.actual_weight != null ? weightSchema.parse(row.actual_weight) : undefined,
    actualDuration:
      row.actual_duration != null ? durationSchema.parse(row.actual_duration) : undefined,
    actualDistance:
      row.actual_distance != null ? distanceSchema.parse(row.actual_distance) : undefined,
    actualPace: row.actual_pace != null ? paceSchema.parse(row.actual_pace) : undefined,
    actualHeartRate: row.actual_heart_rate ?? undefined,
    rpe: row.rpe ?? undefined,
    completed: row.completed,
    notes: row.notes ?? undefined,
    ruckLoad: row.ruck_load != null ? weightSchema.parse(row.ruck_load) : undefined,
    elevationGain:
      row.elevation_gain != null ? distanceSchema.parse(row.elevation_gain) : undefined,
  }
}

export function fromLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Partial<LoggedSetRow> {
  return {
    logged_activity_id: set.loggedActivityId,
    user_id: userId,
    set_number: set.setNumber,
    set_type: set.setType,
    prescribed: set.prescribed ?? null,
    actual_reps: set.actualReps ?? null,
    actual_weight: set.actualWeight ?? null,
    actual_duration: set.actualDuration ?? null,
    actual_distance: set.actualDistance ?? null,
    actual_pace: set.actualPace ?? null,
    actual_heart_rate: set.actualHeartRate ?? null,
    ruck_load: set.ruckLoad ?? null,
    elevation_gain: set.elevationGain ?? null,
    rpe: set.rpe ?? null,
    completed: set.completed,
    notes: set.notes ?? null,
  }
}

// ---------------------------------------------------------------------------
// UserProfile
// ---------------------------------------------------------------------------

export function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    displayName: row.display_name ?? undefined,
    preferredUnits: preferredUnitsSchema.parse(row.preferred_units),
    bodyweight: row.bodyweight != null ? weightSchema.parse(row.bodyweight) : undefined,
    trainingAge: row.training_age != null ? durationSchema.parse(row.training_age) : undefined,
    exerciseMaxes:
      row.exercise_maxes != null
        ? z.record(entityId, oneRepMaxSchema).parse(row.exercise_maxes)
        : {},
    maxReps:
      row.max_reps != null
        ? z.record(entityId, z.number().int().positive()).parse(row.max_reps)
        : {},
  }
}

export function fromUserProfile(
  profile: Partial<UserProfile> & { id: string },
): Partial<UserProfileRow> {
  const row: Partial<UserProfileRow> = { id: profile.id }

  if (profile.displayName !== undefined) row.display_name = profile.displayName ?? null
  if (profile.preferredUnits !== undefined) row.preferred_units = profile.preferredUnits
  if (profile.bodyweight !== undefined) row.bodyweight = profile.bodyweight ?? null
  if (profile.trainingAge !== undefined) row.training_age = profile.trainingAge ?? null
  if (profile.exerciseMaxes !== undefined) row.exercise_maxes = profile.exerciseMaxes
  if (profile.maxReps !== undefined) row.max_reps = profile.maxReps

  return row
}

// ---------------------------------------------------------------------------
// OneRepMaxHistory
// ---------------------------------------------------------------------------

export function toOneRepMaxHistory(row: OneRepMaxHistoryRow): OneRepMaxHistory {
  return {
    id: row.id,
    createdAt: row.created_at,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    weight: weightSchema.parse(row.weight),
    estimated: row.estimated,
    recordedAt: row.recorded_at,
  }
}

export function fromOneRepMaxHistory(
  entry: Omit<OneRepMaxHistory, 'id' | 'createdAt'>,
): Partial<OneRepMaxHistoryRow> {
  return {
    user_id: entry.userId,
    exercise_id: entry.exerciseId,
    weight: entry.weight,
    estimated: entry.estimated,
    recorded_at: entry.recordedAt,
  }
}
