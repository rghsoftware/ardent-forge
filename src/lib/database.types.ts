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
  display_visible: boolean | null
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
  event_metadata: unknown
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
  user_id: string
  name: string
  description: string | null
  category: string
  rest_between_groups: string | null
  time_cap: string | null
  scoring: string
  event_metadata: string | null
  last_assigned_at: string | null
  created_at: string
  updated_at: string
}

export interface EventItemRow {
  id: string
  session_template_id: string | null
  workout_log_id: string | null
  user_id: string
  name: string
  category: string | null
  quantity: number
  is_packed: boolean
  sort_order: number
  notes: string | null
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

export interface ProgramRow {
  id: string
  user_id: string
  name: string
  description: string | null
  source: string
  duration_weeks: number | null
  is_public: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BlockRow {
  id: string
  program_id: string
  name: string
  ordinal: number
  duration_weeks: number
  block_type: string
  created_at: string
  updated_at: string
}

export interface BlockWeekRow {
  id: string
  block_id: string
  week_number: number
  created_at: string
  updated_at: string
}

export interface ScheduledSessionRow {
  id: string
  block_week_id: string
  day_of_week: number | null
  day_label: string
  session_type: string
  session_template_id: string
  notes: string | null
  overrides: unknown | null
  created_at: string
  updated_at: string
}

export interface ProgramActivationRow {
  id: string
  user_id: string
  program_id: string
  current_block_ordinal: number
  current_week_number: number
  start_date: string
  created_at: string
  updated_at: string
}

export interface AccountabilityGroupRow {
  id: string
  user_id: string
  name: string
  description: string | null
  data_retention_days: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface GroupMemberRow {
  id: string
  group_id: string
  user_id: string
  role: 'COACH' | 'MEMBER'
  share_history_before_join: boolean
  joined_at: string
  created_at: string
  updated_at: string
}

export interface GroupInviteRow {
  id: string
  group_id: string
  code: string
  created_by: string
  expires_at: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DirectConnectionRow {
  id: string
  requester_id: string
  recipient_id: string
  status: 'PENDING' | 'ACTIVE' | 'DECLINED'
  requester_grants_write: boolean
  recipient_grants_write: boolean
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface ShareLinkRow {
  id: string
  token: string
  entity_type: 'PROGRAM' | 'WORKOUT_LOG'
  entity_id: string
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConversationRow {
  id: string
  type: string
  title: string | null
  group_id: string | null
  created_at: string
  updated_at: string
}

export interface ConversationParticipantRow {
  id: string
  conversation_id: string
  user_id: string
  last_read_at: string | null
  is_archived: boolean
  joined_at: string
  left_at: string | null
}

export interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string | null
  message_type: string
  content: string | null
  created_at: string
  updated_at: string
  sync_status?: string
}

export interface MediaAttachmentRow {
  id: string
  message_id: string
  provider: string
  provider_asset_id: string | null
  media_type: string
  original_filename: string | null
  mime_type: string | null
  thumbnail_url: string | null
  playback_url: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  status: string
  created_at: string
  updated_at: string
}
