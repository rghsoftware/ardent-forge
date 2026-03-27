import type {
  Exercise,
  ExerciseCategory,
  MovementPattern,
  MuscleGroupSpec,
  Equipment,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  SetType,
  Prescription,
  Weight,
  Duration,
  Distance,
  Pace,
  ProgramContext,
  UserProfile,
  PreferredUnits,
  OneRepMax,
  OneRepMaxHistory,
} from '@/domain/types'
import type { GroupType } from '@/domain/types'
import type {
  ExerciseRow,
  WorkoutLogRow,
  LoggedActivityGroupRow,
  LoggedActivityRow,
  LoggedSetRow,
  UserProfileRow,
  OneRepMaxHistoryRow,
} from './database.types'

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    aliases: row.aliases as string[],
    category: row.category as ExerciseCategory,
    movementPattern: row.movement_pattern as MovementPattern,
    muscleGroups: row.muscle_groups as MuscleGroupSpec,
    isBilateral: row.is_bilateral,
    supports1RM: row.supports_1rm,
    equipmentRequired: row.equipment_required as Equipment[],
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
    programContext: (row.program_context as ProgramContext) ?? undefined,
    perceivedDifficulty: row.perceived_difficulty ?? undefined,
    bodyweightAtSession: (row.bodyweight_at_session as Weight) ?? undefined,
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
    groupType: row.group_type as GroupType,
    ordinal: row.ordinal,
    actualRoundsCompleted: row.actual_rounds_completed ?? undefined,
    completionTime: (row.completion_time as Duration) ?? undefined,
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
    setType: row.set_type as SetType,
    prescribed: (row.prescribed as Prescription) ?? undefined,
    actualReps: row.actual_reps ?? undefined,
    actualWeight: (row.actual_weight as Weight) ?? undefined,
    actualDuration: (row.actual_duration as Duration) ?? undefined,
    actualDistance: (row.actual_distance as Distance) ?? undefined,
    actualPace: (row.actual_pace as Pace) ?? undefined,
    actualHeartRate: row.actual_heart_rate ?? undefined,
    rpe: row.rpe ?? undefined,
    completed: row.completed,
    notes: row.notes ?? undefined,
    ruckLoad: (row.ruck_load as Weight) ?? undefined,
    elevationGain: (row.elevation_gain as Distance) ?? undefined,
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
    preferredUnits: row.preferred_units as PreferredUnits,
    bodyweight: (row.bodyweight as Weight) ?? undefined,
    trainingAge: (row.training_age as Duration) ?? undefined,
    exerciseMaxes: (row.exercise_maxes as Record<string, OneRepMax>) ?? {},
    maxReps: (row.max_reps as Record<string, number>) ?? {},
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
    updatedAt: row.created_at,
    userId: row.user_id,
    exerciseId: row.exercise_id,
    weight: row.weight as Weight,
    estimated: row.estimated,
    recordedAt: row.recorded_at,
  }
}

export function fromOneRepMaxHistory(
  entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<OneRepMaxHistoryRow> {
  return {
    user_id: entry.userId,
    exercise_id: entry.exerciseId,
    weight: entry.weight,
    estimated: entry.estimated,
    recorded_at: entry.recordedAt,
  }
}
