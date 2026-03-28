import { invoke } from '@tauri-apps/api/core'
import type {
  DataAdapter,
  ExerciseFilters,
  WorkoutLogSummary,
  WorkoutWithSets,
} from './data-adapter'
import type {
  Exercise,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  UserProfile,
  OneRepMaxHistory,
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
} from './data-mapper'

// ---------------------------------------------------------------------------
// Rust Response types -- mirrors models.rs Response structs as received by TS.
// Timestamps are ISO 8601 strings; JSON columns are strings or null;
// booleans arrive as 0/1 integers (Option<i32> in Rust).
// ---------------------------------------------------------------------------

interface TauriExerciseResponse {
  id: string
  name: string
  aliases: string | null
  category: string
  movement_pattern: string | null
  muscle_groups: string | null
  is_bilateral: number | null
  supports_1rm: number | null
  equipment_required: string | null
  is_custom: number | null
  created_at: string
  updated_at: string
}

interface TauriWorkoutLogResponse {
  id: string
  user_id: string | null
  title: string | null
  started_at: string
  completed_at: string | null
  session_template_id: string | null
  program_context: string | null
  overall_notes: string | null
  perceived_difficulty: number | null
  bodyweight_at_session: string | null
  created_at: string
  updated_at: string
}

interface TauriLoggedActivityGroupResponse {
  id: string
  workout_log_id: string
  user_id: string | null
  group_type: string
  ordinal: number
  actual_rounds_completed: number | null
  completion_time: string | null
  created_at: string
  updated_at: string
}

interface TauriLoggedActivityResponse {
  id: string
  logged_group_id: string
  user_id: string | null
  exercise_id: string
  ordinal: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface TauriLoggedSetResponse {
  id: string
  logged_activity_id: string
  user_id: string | null
  set_number: number
  set_type: string
  prescribed: string | null
  actual_reps: number | null
  actual_weight: string | null
  actual_duration: string | null
  actual_distance: string | null
  actual_pace: string | null
  actual_heart_rate: number | null
  ruck_load: string | null
  elevation_gain: string | null
  rpe: number | null
  completed: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface TauriUserProfileResponse {
  id: string
  display_name: string | null
  preferred_units: string | null
  bodyweight: string | null
  training_age: string | null
  exercise_maxes: string | null
  max_reps: string | null
  created_at: string
  updated_at: string
}

interface TauriOneRepMaxHistoryResponse {
  id: string
  user_id: string
  exercise_id: string
  weight: string
  estimated: number | null
  recorded_at: string
  created_at: string
}

interface TauriWorkoutLogSummary {
  log: TauriWorkoutLogResponse
  exercise_names: string[]
  set_count: number
  exercise_count: number
}

interface TauriWorkoutLogFull {
  log: TauriWorkoutLogResponse
  groups: TauriLoggedActivityGroupResponse[]
  activities: TauriLoggedActivityResponse[]
  sets: TauriLoggedSetResponse[]
}

interface TauriWorkoutWithSets {
  log: TauriWorkoutLogResponse
  sets: TauriLoggedSetResponse[]
}

// ---------------------------------------------------------------------------
// Conversion helpers: Tauri Response -> TS Row types
//
// The existing mapper functions (toExercise, toWorkoutLog, etc.) expect the
// database.types.ts Row shapes. Tauri commands return slightly different shapes:
//   - booleans as 0/1 integers
//   - JSON columns as raw strings instead of parsed objects
// These helpers bridge that gap.
// ---------------------------------------------------------------------------

function parseJsonOrNull(value: string | null): unknown {
  if (value == null) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function intToBool(value: number | null | undefined, fallback = false): boolean {
  if (value == null) return fallback
  return value !== 0
}

function toExerciseRow(r: TauriExerciseResponse): ExerciseRow {
  return {
    id: r.id,
    name: r.name,
    aliases: parseJsonOrNull(r.aliases),
    category: r.category,
    movement_pattern: r.movement_pattern ?? '',
    muscle_groups: parseJsonOrNull(r.muscle_groups),
    is_bilateral: intToBool(r.is_bilateral),
    supports_1rm: intToBool(r.supports_1rm),
    equipment_required: parseJsonOrNull(r.equipment_required),
    is_custom: intToBool(r.is_custom),
    user_id: null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toWorkoutLogRow(r: TauriWorkoutLogResponse): WorkoutLogRow {
  return {
    id: r.id,
    user_id: r.user_id ?? '',
    title: r.title,
    started_at: r.started_at,
    completed_at: r.completed_at,
    session_template_id: r.session_template_id,
    program_context: parseJsonOrNull(r.program_context),
    perceived_difficulty: r.perceived_difficulty,
    bodyweight_at_session: parseJsonOrNull(r.bodyweight_at_session),
    overall_notes: r.overall_notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toLoggedActivityGroupRow(r: TauriLoggedActivityGroupResponse): LoggedActivityGroupRow {
  return {
    id: r.id,
    workout_log_id: r.workout_log_id,
    user_id: r.user_id ?? '',
    group_type: r.group_type,
    ordinal: r.ordinal,
    actual_rounds_completed: r.actual_rounds_completed,
    completion_time: parseJsonOrNull(r.completion_time),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toLoggedActivityRow(r: TauriLoggedActivityResponse): LoggedActivityRow {
  return {
    id: r.id,
    logged_group_id: r.logged_group_id,
    user_id: r.user_id ?? '',
    exercise_id: r.exercise_id,
    ordinal: r.ordinal,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toLoggedSetRow(r: TauriLoggedSetResponse): LoggedSetRow {
  return {
    id: r.id,
    logged_activity_id: r.logged_activity_id,
    user_id: r.user_id ?? '',
    set_number: r.set_number,
    set_type: r.set_type,
    prescribed: parseJsonOrNull(r.prescribed),
    actual_reps: r.actual_reps,
    actual_weight: parseJsonOrNull(r.actual_weight),
    actual_duration: parseJsonOrNull(r.actual_duration),
    actual_distance: parseJsonOrNull(r.actual_distance),
    actual_pace: parseJsonOrNull(r.actual_pace),
    actual_heart_rate: r.actual_heart_rate,
    ruck_load: parseJsonOrNull(r.ruck_load),
    elevation_gain: parseJsonOrNull(r.elevation_gain),
    rpe: r.rpe,
    completed: intToBool(r.completed),
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toUserProfileRow(r: TauriUserProfileResponse): UserProfileRow {
  return {
    id: r.id,
    display_name: r.display_name,
    preferred_units: r.preferred_units ?? 'IMPERIAL',
    bodyweight: parseJsonOrNull(r.bodyweight),
    training_age: parseJsonOrNull(r.training_age),
    exercise_maxes: parseJsonOrNull(r.exercise_maxes),
    max_reps: parseJsonOrNull(r.max_reps),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toOneRepMaxHistoryRow(r: TauriOneRepMaxHistoryResponse): OneRepMaxHistoryRow {
  return {
    id: r.id,
    user_id: r.user_id,
    exercise_id: r.exercise_id,
    weight: parseJsonOrNull(r.weight),
    estimated: intToBool(r.estimated),
    recorded_at: r.recorded_at,
    created_at: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// TauriAdapter
// ---------------------------------------------------------------------------

export class TauriAdapter implements DataAdapter {
  constructor(_userId: string) {}

  // ---------------------------------------------------------------------------
  // Exercise operations
  // ---------------------------------------------------------------------------

  async getExercises(filters?: ExerciseFilters): Promise<Exercise[]> {
    // Build the Rust ExerciseFilters shape
    const rustFilters = filters
      ? {
          category: filters.category ?? null,
          movement_pattern: filters.movementPattern ?? null,
          search: filters.searchQuery ?? null,
          is_custom: filters.isCustom ?? null,
        }
      : null

    const rows = await invoke<TauriExerciseResponse[]>('get_exercises', {
      filters: rustFilters,
    })

    let exercises = rows.map((r) => toExercise(toExerciseRow(r)))

    // The Rust command does not filter by muscleGroup, so apply client-side
    // (mirrors SupabaseAdapter's behavior for search queries)
    if (filters?.muscleGroup) {
      exercises = exercises.filter((e) => e.muscleGroups.primary.includes(filters.muscleGroup!))
    }

    return exercises
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const row = await invoke<TauriExerciseResponse | null>('get_exercise', { id })
    return row ? toExercise(toExerciseRow(row)) : null
  }

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Exercise> {
    const partial = fromExercise(exercise)
    const input = {
      name: partial.name!,
      aliases: partial.aliases != null ? JSON.stringify(partial.aliases) : null,
      category: partial.category!,
      movement_pattern: partial.movement_pattern ?? null,
      muscle_groups: partial.muscle_groups != null ? JSON.stringify(partial.muscle_groups) : null,
      is_bilateral: partial.is_bilateral ?? null,
      supports_1rm: partial.supports_1rm ?? null,
      equipment_required:
        partial.equipment_required != null ? JSON.stringify(partial.equipment_required) : null,
    }

    const row = await invoke<TauriExerciseResponse>('create_exercise', { exercise: input })
    return toExercise(toExerciseRow(row))
  }

  // ---------------------------------------------------------------------------
  // Workout log operations
  // ---------------------------------------------------------------------------

  async getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]> {
    const rows = await invoke<TauriWorkoutLogResponse[]>('get_workout_logs', {
      user_id: userId,
      limit: limit ?? null,
    })
    return rows.map((r) => toWorkoutLog(toWorkoutLogRow(r)))
  }

  async getWorkoutLogsSummary(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkoutLogSummary[]> {
    const summaries = await invoke<TauriWorkoutLogSummary[]>('get_workout_logs_summary', {
      user_id: userId,
      limit: options?.limit ?? null,
      offset: options?.offset ?? null,
    })

    return summaries.map((s) => ({
      log: toWorkoutLog(toWorkoutLogRow(s.log)),
      exerciseNames: s.exercise_names,
      setCount: s.set_count,
      exerciseCount: s.exercise_count,
    }))
  }

  async getWorkoutLog(id: string): Promise<WorkoutLog | null> {
    const row = await invoke<TauriWorkoutLogResponse | null>('get_workout_log', { id })
    return row ? toWorkoutLog(toWorkoutLogRow(row)) : null
  }

  async getWorkoutLogFull(id: string): Promise<{
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  } | null> {
    const full = await invoke<TauriWorkoutLogFull | null>('get_workout_log_full', { id })
    if (!full) return null

    return {
      log: toWorkoutLog(toWorkoutLogRow(full.log)),
      groups: full.groups.map((g) => toLoggedActivityGroup(toLoggedActivityGroupRow(g))),
      activities: full.activities.map((a) => toLoggedActivity(toLoggedActivityRow(a))),
      sets: full.sets.map((s) => toLoggedSet(toLoggedSetRow(s))),
    }
  }

  async createWorkoutLog(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkoutLog> {
    const partial = fromWorkoutLog(log)
    const input = {
      user_id: partial.user_id!,
      title: partial.title ?? null,
      started_at: new Date(partial.started_at!).getTime(),
      completed_at: partial.completed_at ? new Date(partial.completed_at).getTime() : null,
      session_template_id: partial.session_template_id ?? null,
      program_context:
        partial.program_context != null ? JSON.stringify(partial.program_context) : null,
      overall_notes: partial.overall_notes ?? null,
      perceived_difficulty: partial.perceived_difficulty ?? null,
      bodyweight_at_session:
        partial.bodyweight_at_session != null
          ? JSON.stringify(partial.bodyweight_at_session)
          : null,
    }

    const row = await invoke<TauriWorkoutLogResponse>('create_workout_log', { log: input })
    return toWorkoutLog(toWorkoutLogRow(row))
  }

  async updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog> {
    const row = await invoke<TauriWorkoutLogResponse>('update_workout_log', {
      id: log.id,
      title: log.title ?? null,
      completed_at: log.completedAt ? new Date(log.completedAt).getTime() : null,
      overall_notes: log.overallNotes ?? null,
      perceived_difficulty: log.perceivedDifficulty ?? null,
    })
    return toWorkoutLog(toWorkoutLogRow(row))
  }

  async deleteWorkoutLog(id: string): Promise<void> {
    await invoke('delete_workout_log', { id })
  }

  // ---------------------------------------------------------------------------
  // LoggedActivityGroup
  // ---------------------------------------------------------------------------

  async createLoggedActivityGroup(
    group: Omit<LoggedActivityGroup, 'id'>,
    userId: string,
  ): Promise<LoggedActivityGroup> {
    const partial = fromLoggedActivityGroup(group, userId)
    const input = {
      workout_log_id: partial.workout_log_id!,
      group_type: partial.group_type!,
      ordinal: partial.ordinal!,
      actual_rounds_completed: partial.actual_rounds_completed ?? null,
      completion_time:
        partial.completion_time != null ? JSON.stringify(partial.completion_time) : null,
    }

    const row = await invoke<TauriLoggedActivityGroupResponse>('create_logged_activity_group', {
      group: input,
      user_id: userId,
    })
    return toLoggedActivityGroup(toLoggedActivityGroupRow(row))
  }

  // ---------------------------------------------------------------------------
  // LoggedActivity
  // ---------------------------------------------------------------------------

  async createLoggedActivity(
    activity: Omit<LoggedActivity, 'id'>,
    userId: string,
  ): Promise<LoggedActivity> {
    const partial = fromLoggedActivity(activity, userId)
    const input = {
      logged_group_id: partial.logged_group_id!,
      exercise_id: partial.exercise_id!,
      ordinal: partial.ordinal!,
      notes: partial.notes ?? null,
    }

    const row = await invoke<TauriLoggedActivityResponse>('create_logged_activity', {
      activity: input,
      user_id: userId,
    })
    return toLoggedActivity(toLoggedActivityRow(row))
  }

  // ---------------------------------------------------------------------------
  // LoggedSet
  // ---------------------------------------------------------------------------

  async createLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Promise<LoggedSet> {
    const partial = fromLoggedSet(set, userId)
    const input = {
      logged_activity_id: partial.logged_activity_id!,
      set_number: partial.set_number!,
      set_type: partial.set_type!,
      prescribed: partial.prescribed != null ? JSON.stringify(partial.prescribed) : null,
      actual_reps: partial.actual_reps ?? null,
      actual_weight: partial.actual_weight != null ? JSON.stringify(partial.actual_weight) : null,
      actual_duration:
        partial.actual_duration != null ? JSON.stringify(partial.actual_duration) : null,
      actual_distance:
        partial.actual_distance != null ? JSON.stringify(partial.actual_distance) : null,
      actual_pace: partial.actual_pace != null ? JSON.stringify(partial.actual_pace) : null,
      actual_heart_rate: partial.actual_heart_rate ?? null,
      ruck_load: partial.ruck_load != null ? JSON.stringify(partial.ruck_load) : null,
      elevation_gain:
        partial.elevation_gain != null ? JSON.stringify(partial.elevation_gain) : null,
      rpe: partial.rpe ?? null,
      completed: partial.completed ?? null,
      notes: partial.notes ?? null,
    }

    const row = await invoke<TauriLoggedSetResponse>('create_logged_set', {
      set: input,
      user_id: userId,
    })
    return toLoggedSet(toLoggedSetRow(row))
  }

  async updateLoggedSet(set: LoggedSet, userId: string): Promise<LoggedSet> {
    const partial = fromLoggedSet(set, userId)
    const input = {
      id: set.id,
      logged_activity_id: partial.logged_activity_id!,
      set_number: partial.set_number!,
      set_type: partial.set_type!,
      prescribed: partial.prescribed != null ? JSON.stringify(partial.prescribed) : null,
      actual_reps: partial.actual_reps ?? null,
      actual_weight: partial.actual_weight != null ? JSON.stringify(partial.actual_weight) : null,
      actual_duration:
        partial.actual_duration != null ? JSON.stringify(partial.actual_duration) : null,
      actual_distance:
        partial.actual_distance != null ? JSON.stringify(partial.actual_distance) : null,
      actual_pace: partial.actual_pace != null ? JSON.stringify(partial.actual_pace) : null,
      actual_heart_rate: partial.actual_heart_rate ?? null,
      ruck_load: partial.ruck_load != null ? JSON.stringify(partial.ruck_load) : null,
      elevation_gain:
        partial.elevation_gain != null ? JSON.stringify(partial.elevation_gain) : null,
      rpe: partial.rpe ?? null,
      completed: partial.completed ?? null,
      notes: partial.notes ?? null,
    }

    const row = await invoke<TauriLoggedSetResponse>('update_logged_set', {
      set: input,
      user_id: userId,
    })
    return toLoggedSet(toLoggedSetRow(row))
  }

  // ---------------------------------------------------------------------------
  // User profile operations
  // ---------------------------------------------------------------------------

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = await invoke<TauriUserProfileResponse | null>('get_user_profile', {
      user_id: userId,
    })
    return row ? toUserProfile(toUserProfileRow(row)) : null
  }

  async updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    const partial = fromUserProfile(profile)
    const input = {
      id: partial.id!,
      display_name: partial.display_name ?? null,
      preferred_units: partial.preferred_units ?? null,
      bodyweight: partial.bodyweight != null ? JSON.stringify(partial.bodyweight) : null,
      training_age: partial.training_age != null ? JSON.stringify(partial.training_age) : null,
      exercise_maxes:
        partial.exercise_maxes != null ? JSON.stringify(partial.exercise_maxes) : null,
      max_reps: partial.max_reps != null ? JSON.stringify(partial.max_reps) : null,
    }

    const row = await invoke<TauriUserProfileResponse>('update_user_profile', { profile: input })
    return toUserProfile(toUserProfileRow(row))
  }

  async saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory> {
    const partial = fromOneRepMaxHistory(entry)
    const row = await invoke<TauriOneRepMaxHistoryResponse>('save_one_rep_max', {
      user_id: partial.user_id!,
      exercise_id: partial.exercise_id!,
      weight: JSON.stringify(partial.weight),
      estimated: partial.estimated ?? null,
      recorded_at: new Date(partial.recorded_at!).getTime(),
    })
    return toOneRepMaxHistory(toOneRepMaxHistoryRow(row))
  }

  // ---------------------------------------------------------------------------
  // Exercise history operations
  // ---------------------------------------------------------------------------

  async getOneRepMaxHistory(userId: string, exerciseId: string): Promise<OneRepMaxHistory[]> {
    const rows = await invoke<TauriOneRepMaxHistoryResponse[]>('get_one_rep_max_history', {
      user_id: userId,
      exercise_id: exerciseId,
    })
    return rows.map((r) => toOneRepMaxHistory(toOneRepMaxHistoryRow(r)))
  }

  async getRecentlyUsedExerciseIds(userId: string, limit = 10): Promise<string[]> {
    return invoke<string[]>('get_recently_used_exercise_ids', {
      user_id: userId,
      limit,
    })
  }

  async getExerciseWorkoutHistory(
    userId: string,
    exerciseId: string,
    limit = 10,
  ): Promise<WorkoutWithSets[]> {
    const results = await invoke<TauriWorkoutWithSets[]>('get_exercise_workout_history', {
      user_id: userId,
      exercise_id: exerciseId,
      limit,
    })

    return results.map((r) => ({
      log: toWorkoutLog(toWorkoutLogRow(r.log)),
      sets: r.sets.map((s) => toLoggedSet(toLoggedSetRow(s))),
    }))
  }
}
