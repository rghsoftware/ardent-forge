// TODO: Regenerate via `bunx supabase gen types typescript --local > src/lib/database.types.ts`
// once connected to a live instance.

export interface ExerciseRow {
  id: string
  name: string
  aliases: unknown
  category: string
  movement_pattern: string
  muscle_groups: unknown
  is_bilateral: boolean
  supports_1rm: boolean
  equipment_required: unknown
  is_custom: boolean
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface UserProfileRow {
  id: string
  display_name: string | null
  preferred_units: string
  bodyweight: unknown
  training_age: unknown
  exercise_maxes: unknown
  max_reps: unknown
  created_at: string
  updated_at: string
}

export interface WorkoutLogRow {
  id: string
  user_id: string
  title: string | null
  started_at: string
  completed_at: string | null
  session_template_id: string | null
  program_context: unknown
  perceived_difficulty: number | null
  bodyweight_at_session: unknown
  overall_notes: string | null
  created_at: string
  updated_at: string
}

export interface LoggedActivityGroupRow {
  id: string
  workout_log_id: string
  user_id: string
  group_type: string
  ordinal: number
  completion_time: unknown
  actual_rounds_completed: number | null
  created_at: string
  updated_at: string
}

export interface LoggedActivityRow {
  id: string
  logged_group_id: string
  user_id: string
  exercise_id: string
  ordinal: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LoggedSetRow {
  id: string
  logged_activity_id: string
  user_id: string
  set_number: number
  set_type: string
  prescribed: unknown
  actual_reps: number | null
  actual_weight: unknown
  actual_duration: unknown
  actual_distance: unknown
  actual_pace: unknown
  actual_heart_rate: number | null
  ruck_load: unknown
  elevation_gain: unknown
  rpe: number | null
  completed: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OneRepMaxHistoryRow {
  id: string
  user_id: string
  exercise_id: string
  weight: unknown
  estimated: boolean
  recorded_at: string
  created_at: string
}

export interface SessionTemplateRow {
  id: string
  user_id: string | null
  name: string
  description: string | null
  category: string
  rest_between_groups: string | null
  time_cap: string | null
  scoring: string | null
  created_at: string
  updated_at: string
}

export interface ActivityGroupRow {
  id: string
  session_template_id: string
  group_type: string
  ordinal: number
  rounds: number | null
  rest_between_rounds: string | null
  rest_between_activities: string | null
  created_at: string
  updated_at: string
}

export interface ActivityRow {
  id: string
  activity_group_id: string
  exercise_id: string
  ordinal: number
  set_scheme: string
  notes: string | null
  created_at: string
  updated_at: string
}
