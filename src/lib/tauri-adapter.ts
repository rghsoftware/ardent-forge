import { invoke } from '@tauri-apps/api/core'
import type {
  ActivityFeedOptions,
  ConnectionActivityFeedEntry,
  DataAdapter,
  ExerciseFilters,
  GroupActivityFeedEntry,
  ProgramFull,
  SessionTemplateFull,
  VaultSummary,
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
  SessionTemplate,
  ActivityGroup,
  Activity,
  Program,
  Block,
  BlockWeek,
  ScheduledSession,
  ProgramActivation,
  ShareLink,
  ShareableEntityType,
  WeeklyVolumeEntry,
  AccountabilityGroup,
  GroupMember,
  GroupInvite,
  DirectConnection,
  GroupRole,
  EventItem,
  Conversation,
  ConversationType,
  ConversationParticipant,
  Message,
  MessageType,
  MediaAttachment,
} from '@/domain/types'
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
  ProgramRow,
  BlockRow,
  BlockWeekRow,
  ScheduledSessionRow,
  ProgramActivationRow,
  AccountabilityGroupRow,
  GroupMemberRow,
  GroupInviteRow,
  DirectConnectionRow,
  ConversationRow,
  MessageRow,
  MediaAttachmentRow,
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
  toSessionTemplate,
  fromSessionTemplate,
  toActivityGroupFlat,
  fromActivityGroup,
  toActivity,
  fromActivity,
  toProgram,
  toBlock,
  toBlockWeek,
  toScheduledSession,
  toProgramActivation,
  toConversation,
  toMessage,
  toMediaAttachment,
} from './data-mapper'
import {
  toAccountabilityGroup,
  toGroupMember,
  toGroupInvite,
  toDirectConnection,
} from './sharing-mappers'

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
  created_at: string | null
  updated_at: string | null
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
  created_at: string | null
  updated_at: string | null
}

interface TauriLoggedActivityGroupResponse {
  id: string
  workout_log_id: string
  user_id: string | null
  group_type: string
  ordinal: number
  actual_rounds_completed: number | null
  completion_time: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriLoggedActivityResponse {
  id: string
  logged_group_id: string
  user_id: string | null
  exercise_id: string
  ordinal: number
  notes: string | null
  created_at: string | null
  updated_at: string | null
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
  created_at: string | null
  updated_at: string | null
}

interface TauriUserProfileResponse {
  id: string
  display_name: string | null
  preferred_units: string | null
  bodyweight: string | null
  training_age: string | null
  exercise_maxes: string | null
  max_reps: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriOneRepMaxHistoryResponse {
  id: string
  user_id: string
  exercise_id: string
  weight: string
  estimated: number | null
  recorded_at: string
  created_at: string | null
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

interface TauriSessionTemplateResponse {
  id: string
  user_id: string
  name: string
  description: string | null
  category: string
  rest_between_groups: string | null
  time_cap: string | null
  scoring: string
  created_at: string | null
  updated_at: string | null
}

interface TauriActivityGroupResponse {
  id: string
  session_template_id: string
  group_type: string
  ordinal: number
  rounds: number | null
  rest_between_rounds: string | null
  rest_between_activities: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriActivityResponse {
  id: string
  activity_group_id: string
  exercise_id: string
  ordinal: number
  set_scheme: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriSessionTemplateFull {
  template: TauriSessionTemplateResponse
  groups: TauriActivityGroupResponse[]
  activities: TauriActivityResponse[]
}

interface TauriProgramResponse {
  id: string
  user_id: string
  name: string
  description: string | null
  source: string
  duration_weeks: number | null
  is_public: number // 0 or 1 in SQLite
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriBlockResponse {
  id: string
  program_id: string
  name: string
  ordinal: number
  duration_weeks: number
  block_type: string
  created_at: string | null
  updated_at: string | null
}

interface TauriBlockWeekResponse {
  id: string
  block_id: string
  week_number: number
  created_at: string | null
  updated_at: string | null
}

interface TauriScheduledSessionResponse {
  id: string
  block_week_id: string
  day_of_week: number | null
  day_label: string
  session_type: string
  session_template_id: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriProgramActivationResponse {
  id: string
  user_id: string
  program_id: string
  current_block_ordinal: number
  current_week_number: number
  start_date: string
  created_at: string | null
  updated_at: string | null
}

interface TauriProgramFullResponse {
  program: TauriProgramResponse
  blocks: TauriBlockResponse[]
  block_weeks: TauriBlockWeekResponse[]
  scheduled_sessions: TauriScheduledSessionResponse[]
}

// ---------------------------------------------------------------------------
// Sharing response types -- mirrors sharing model structs in Rust.
// Booleans arrive as 0/1 integers. Timestamps as ISO 8601 strings
// (serialized by serde_unix).
// ---------------------------------------------------------------------------

interface TauriAccountabilityGroupResponse {
  id: string
  user_id: string
  name: string
  description: string | null
  data_retention_days: number
  created_by: string
  created_at: string | null
  updated_at: string | null
}

interface TauriGroupMemberResponse {
  id: string
  group_id: string
  user_id: string
  role: string
  share_history_before_join: number // 0/1
  joined_at: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriGroupInviteResponse {
  id: string
  group_id: string
  code: string
  created_by: string
  expires_at: string | null
  is_active: number // 0/1
  created_at: string | null
  updated_at: string | null
}

interface TauriDirectConnectionResponse {
  id: string
  requester_id: string
  recipient_id: string
  status: string
  requester_grants_write: number // 0/1
  recipient_grants_write: number // 0/1
  accepted_at: string | null
  created_at: string | null
  updated_at: string | null
}

interface TauriGroupActivityFeedEntry {
  id: string
  user_id: string
  title: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  exercise_count: number
  group_id: string
  member_role: string
}

interface TauriConnectionActivityFeedEntry {
  id: string
  user_id: string
  title: string | null
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  exercise_count: number
  connection_id: string
}

// ---------------------------------------------------------------------------
// Chat response types -- mirrors chat model structs in Rust.
// Timestamps serialized via serde_unix (required = ISO string, optional = ISO string | null).
// Booleans arrive as 0/1 integers.
// ---------------------------------------------------------------------------

interface TauriConversationResponse {
  id: string
  type: string
  title: string | null
  group_id: string | null
  created_at: string
  updated_at: string
}

interface TauriConversationParticipantResponse {
  id: string
  conversation_id: string
  user_id: string
  last_read_at: string | null
  is_archived: number // 0/1
  joined_at: string
  left_at: string | null
}

interface TauriConversationWithParticipants {
  conversation: TauriConversationResponse
  participants: TauriConversationParticipantResponse[]
}

interface TauriMessageResponse {
  id: string
  conversation_id: string
  sender_id: string | null
  message_type: string
  content: string | null
  created_at: string
  updated_at: string
  sync_status: string | null
}

interface TauriUnreadCount {
  conversation_id: string
  count: number
}

interface TauriMediaAttachmentResponse {
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

// ---------------------------------------------------------------------------
// Structured error types for Tauri AppError (mirrors Rust error.rs)
// ---------------------------------------------------------------------------

interface TauriAppError {
  kind: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION' | 'DATABASE' | 'INTERNAL'
  message: string
  field?: string
}

function isTauriAppError(e: unknown): e is TauriAppError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'kind' in e &&
    'message' in e &&
    typeof (e as TauriAppError).kind === 'string'
  )
}

export class AdapterError extends Error {
  readonly kind: TauriAppError['kind']
  readonly field?: string

  constructor(source: TauriAppError) {
    super(source.message)
    this.name = 'AdapterError'
    this.kind = source.kind
    this.field = source.field
  }
}

/** Invoke a Tauri command and translate AppError responses into AdapterError. */
async function invokeCommand<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    if (isTauriAppError(e)) throw new AdapterError(e)
    throw e
  }
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

/** Convert an ISO 8601 date string to Unix seconds for Rust commands. */
function isoToUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

/** Parse a JSON string column, throwing with context on invalid JSON. */
function parseJson(value: string | null, column: string): unknown {
  if (value == null) return null
  try {
    return JSON.parse(value)
  } catch (e) {
    throw new Error(
      `Invalid JSON in column "${column}": ${e instanceof Error ? e.message : String(e)}. ` +
        `Raw value (first 100 chars): "${value.slice(0, 100)}"`,
    )
  }
}

/** Require a non-null string value, throwing with the field name on null. */
function requireString(value: string | null | undefined, field: string): string {
  if (value == null) {
    throw new Error(`Required field "${field}" is null`)
  }
  return value
}

/**
 * Convert a 0/1 integer (as returned by SQLite via Rust) to a boolean.
 *
 * The Rust side should always provide a value for `completed` and `estimated`
 * fields -- these are declared non-nullable in database.types.ts. The fallback
 * parameter is a safety net for fields where null genuinely means "unset"
 * (e.g. is_bilateral, supports_1rm, is_custom).
 */
function intToBool(value: number | null | undefined, fallback = false): boolean {
  if (value == null) return fallback
  return value !== 0
}

function toExerciseRow(r: TauriExerciseResponse): ExerciseRow {
  if (!r.movement_pattern) {
    throw new Error(
      `Exercise "${r.name}" (${r.id}) has no movement_pattern -- this field is required by the domain model`,
    )
  }
  return {
    id: r.id,
    name: r.name,
    aliases: parseJson(r.aliases, 'aliases'),
    category: r.category,
    movement_pattern: r.movement_pattern,
    muscle_groups: parseJson(r.muscle_groups, 'muscle_groups'),
    is_bilateral: intToBool(r.is_bilateral),
    supports_1rm: intToBool(r.supports_1rm),
    equipment_required: parseJson(r.equipment_required, 'equipment_required'),
    is_custom: intToBool(r.is_custom),
    user_id: null,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toWorkoutLogRow(r: TauriWorkoutLogResponse): WorkoutLogRow {
  return {
    id: r.id,
    user_id: requireString(r.user_id, 'user_id'),
    title: r.title,
    started_at: r.started_at,
    completed_at: r.completed_at,
    session_template_id: r.session_template_id,
    program_context: parseJson(r.program_context, 'program_context'),
    perceived_difficulty: r.perceived_difficulty,
    bodyweight_at_session: parseJson(r.bodyweight_at_session, 'bodyweight_at_session'),
    overall_notes: r.overall_notes,
    event_metadata: null, // Event features deferred for Tauri offline mode (W-8)
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toLoggedActivityGroupRow(r: TauriLoggedActivityGroupResponse): LoggedActivityGroupRow {
  return {
    id: r.id,
    workout_log_id: r.workout_log_id,
    user_id: requireString(r.user_id, 'user_id'),
    group_type: r.group_type,
    ordinal: r.ordinal,
    actual_rounds_completed: r.actual_rounds_completed,
    completion_time: parseJson(r.completion_time, 'completion_time'),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toLoggedActivityRow(r: TauriLoggedActivityResponse): LoggedActivityRow {
  return {
    id: r.id,
    logged_group_id: r.logged_group_id,
    user_id: requireString(r.user_id, 'user_id'),
    exercise_id: r.exercise_id,
    ordinal: r.ordinal,
    notes: r.notes,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toLoggedSetRow(r: TauriLoggedSetResponse): LoggedSetRow {
  return {
    id: r.id,
    logged_activity_id: r.logged_activity_id,
    user_id: requireString(r.user_id, 'user_id'),
    set_number: r.set_number,
    set_type: r.set_type,
    prescribed: parseJson(r.prescribed, 'prescribed'),
    actual_reps: r.actual_reps,
    actual_weight: parseJson(r.actual_weight, 'actual_weight'),
    actual_duration: parseJson(r.actual_duration, 'actual_duration'),
    actual_distance: parseJson(r.actual_distance, 'actual_distance'),
    actual_pace: parseJson(r.actual_pace, 'actual_pace'),
    actual_heart_rate: r.actual_heart_rate,
    ruck_load: parseJson(r.ruck_load, 'ruck_load'),
    elevation_gain: parseJson(r.elevation_gain, 'elevation_gain'),
    rpe: r.rpe,
    completed: intToBool(r.completed),
    notes: r.notes,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toUserProfileRow(r: TauriUserProfileResponse): UserProfileRow {
  return {
    id: r.id,
    display_name: r.display_name,
    preferred_units: r.preferred_units ?? 'IMPERIAL',
    bodyweight: parseJson(r.bodyweight, 'bodyweight'),
    training_age: parseJson(r.training_age, 'training_age'),
    exercise_maxes: parseJson(r.exercise_maxes, 'exercise_maxes'),
    max_reps: parseJson(r.max_reps, 'max_reps'),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toOneRepMaxHistoryRow(r: TauriOneRepMaxHistoryResponse): OneRepMaxHistoryRow {
  return {
    id: r.id,
    user_id: r.user_id,
    exercise_id: r.exercise_id,
    weight: parseJson(r.weight, 'weight'),
    estimated: intToBool(r.estimated),
    recorded_at: r.recorded_at,
    created_at: r.created_at ?? new Date().toISOString(),
  }
}

function toSessionTemplateRowFromTauri(r: TauriSessionTemplateResponse): SessionTemplateRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on session template row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on session template row', r)
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    description: r.description,
    category: r.category,
    rest_between_groups: r.rest_between_groups,
    time_cap: r.time_cap,
    scoring: r.scoring,
    event_metadata: null, // Event features deferred for Tauri offline mode (W-8)
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toActivityGroupRowFromTauri(r: TauriActivityGroupResponse): ActivityGroupRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on activity group row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on activity group row', r)
  return {
    id: r.id,
    session_template_id: r.session_template_id,
    group_type: r.group_type,
    ordinal: r.ordinal,
    rounds: r.rounds,
    rest_between_rounds: r.rest_between_rounds,
    rest_between_activities: r.rest_between_activities,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toActivityRowFromTauri(r: TauriActivityResponse): ActivityRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on activity row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on activity row', r)
  return {
    id: r.id,
    activity_group_id: r.activity_group_id,
    exercise_id: r.exercise_id,
    ordinal: r.ordinal,
    set_scheme: r.set_scheme,
    notes: r.notes,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toProgramRowFromTauri(r: TauriProgramResponse): ProgramRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on program row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on program row', r)
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    description: r.description,
    source: r.source,
    duration_weeks: r.duration_weeks,
    is_public: r.is_public !== 0,
    created_by: r.created_by,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toBlockRowFromTauri(r: TauriBlockResponse): BlockRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on block row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on block row', r)
  return {
    id: r.id,
    program_id: r.program_id,
    name: r.name,
    ordinal: r.ordinal,
    duration_weeks: r.duration_weeks,
    block_type: r.block_type,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toBlockWeekRowFromTauri(r: TauriBlockWeekResponse): BlockWeekRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on block_week row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on block_week row', r)
  return {
    id: r.id,
    block_id: r.block_id,
    week_number: r.week_number,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toScheduledSessionRowFromTauri(r: TauriScheduledSessionResponse): ScheduledSessionRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on scheduled_session row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on scheduled_session row', r)
  return {
    id: r.id,
    block_week_id: r.block_week_id,
    day_of_week: r.day_of_week,
    day_label: r.day_label,
    session_type: r.session_type,
    session_template_id: r.session_template_id,
    notes: r.notes,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toProgramActivationRowFromTauri(r: TauriProgramActivationResponse): ProgramActivationRow {
  if (!r.created_at) console.warn('tauri-adapter: null created_at on program_activation row', r)
  if (!r.updated_at) console.warn('tauri-adapter: null updated_at on program_activation row', r)
  return {
    id: r.id,
    user_id: r.user_id,
    program_id: r.program_id,
    current_block_ordinal: r.current_block_ordinal,
    current_week_number: r.current_week_number,
    start_date: r.start_date,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Sharing row converters: Tauri Response -> TS Row types
// ---------------------------------------------------------------------------

function toAccountabilityGroupRowFromTauri(
  r: TauriAccountabilityGroupResponse,
): AccountabilityGroupRow {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in AccountabilityGroup ${r.id}`)
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    description: r.description,
    data_retention_days: r.data_retention_days,
    created_by: r.created_by,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toGroupMemberRowFromTauri(r: TauriGroupMemberResponse): GroupMemberRow {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in GroupMember ${r.id}`)
  return {
    id: r.id,
    group_id: r.group_id,
    user_id: r.user_id,
    role: r.role as 'COACH' | 'MEMBER',
    share_history_before_join: intToBool(r.share_history_before_join),
    joined_at: r.joined_at ?? new Date().toISOString(),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toGroupInviteRowFromTauri(r: TauriGroupInviteResponse): GroupInviteRow {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in GroupInvite ${r.id}`)
  return {
    id: r.id,
    group_id: r.group_id,
    code: r.code,
    created_by: r.created_by,
    expires_at: r.expires_at ?? new Date().toISOString(),
    is_active: intToBool(r.is_active),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toDirectConnectionRowFromTauri(r: TauriDirectConnectionResponse): DirectConnectionRow {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in DirectConnection ${r.id}`)
  return {
    id: r.id,
    requester_id: r.requester_id,
    recipient_id: r.recipient_id,
    status: r.status as 'PENDING' | 'ACTIVE' | 'DECLINED',
    requester_grants_write: intToBool(r.requester_grants_write),
    recipient_grants_write: intToBool(r.recipient_grants_write),
    accepted_at: r.accepted_at,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Chat row converters: Tauri Response -> TS Row types
// ---------------------------------------------------------------------------

function toConversationRowFromTauri(r: TauriConversationResponse): ConversationRow {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    group_id: r.group_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

function toMessageRowFromTauri(r: TauriMessageResponse): MessageRow {
  return {
    id: r.id,
    conversation_id: r.conversation_id,
    sender_id: r.sender_id,
    message_type: r.message_type,
    content: r.content,
    created_at: r.created_at,
    updated_at: r.updated_at,
    sync_status: r.sync_status ?? undefined,
  }
}

function toMediaAttachmentRowFromTauri(r: TauriMediaAttachmentResponse): MediaAttachmentRow {
  return {
    id: r.id,
    message_id: r.message_id,
    provider: r.provider,
    provider_asset_id: r.provider_asset_id,
    media_type: r.media_type,
    original_filename: r.original_filename,
    mime_type: r.mime_type,
    thumbnail_url: r.thumbnail_url,
    playback_url: r.playback_url,
    duration_seconds: r.duration_seconds,
    file_size_bytes: r.file_size_bytes,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

// ---------------------------------------------------------------------------
// TauriAdapter
// ---------------------------------------------------------------------------

export class TauriAdapter implements DataAdapter {
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
  }

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

    const rows = await invokeCommand<TauriExerciseResponse[]>('get_exercises', {
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
    const row = await invokeCommand<TauriExerciseResponse | null>('get_exercise', { id })
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

    const row = await invokeCommand<TauriExerciseResponse>('create_exercise', { exercise: input })
    return toExercise(toExerciseRow(row))
  }

  // ---------------------------------------------------------------------------
  // Workout log operations
  // ---------------------------------------------------------------------------

  async getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]> {
    const rows = await invokeCommand<TauriWorkoutLogResponse[]>('get_workout_logs', {
      user_id: userId,
      limit: limit ?? null,
    })
    return rows.map((r) => toWorkoutLog(toWorkoutLogRow(r)))
  }

  async getWorkoutLogsSummary(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkoutLogSummary[]> {
    const summaries = await invokeCommand<TauriWorkoutLogSummary[]>('get_workout_logs_summary', {
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
    const row = await invokeCommand<TauriWorkoutLogResponse | null>('get_workout_log', { id })
    return row ? toWorkoutLog(toWorkoutLogRow(row)) : null
  }

  async getWorkoutLogFull(id: string): Promise<{
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  } | null> {
    const full = await invokeCommand<TauriWorkoutLogFull | null>('get_workout_log_full', { id })
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
      started_at: isoToUnixSeconds(partial.started_at!),
      completed_at: partial.completed_at ? isoToUnixSeconds(partial.completed_at) : null,
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

    const row = await invokeCommand<TauriWorkoutLogResponse>('create_workout_log', { log: input })
    return toWorkoutLog(toWorkoutLogRow(row))
  }

  async updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog> {
    const row = await invokeCommand<TauriWorkoutLogResponse>('update_workout_log', {
      id: log.id,
      title: log.title ?? null,
      completed_at: log.completedAt ? isoToUnixSeconds(log.completedAt) : null,
      overall_notes: log.overallNotes ?? null,
      perceived_difficulty: log.perceivedDifficulty ?? null,
    })
    return toWorkoutLog(toWorkoutLogRow(row))
  }

  async deleteWorkoutLog(id: string): Promise<void> {
    await invokeCommand<void>('delete_workout_log', { id })
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

    const row = await invokeCommand<TauriLoggedActivityGroupResponse>(
      'create_logged_activity_group',
      {
        group: input,
        user_id: userId,
      },
    )
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

    const row = await invokeCommand<TauriLoggedActivityResponse>('create_logged_activity', {
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

    const row = await invokeCommand<TauriLoggedSetResponse>('create_logged_set', {
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

    const row = await invokeCommand<TauriLoggedSetResponse>('update_logged_set', {
      set: input,
      user_id: userId,
    })
    return toLoggedSet(toLoggedSetRow(row))
  }

  // ---------------------------------------------------------------------------
  // User profile operations
  // ---------------------------------------------------------------------------

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = await invokeCommand<TauriUserProfileResponse | null>('get_user_profile', {
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

    const row = await invokeCommand<TauriUserProfileResponse>('update_user_profile', {
      profile: input,
    })
    return toUserProfile(toUserProfileRow(row))
  }

  async saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory> {
    const partial = fromOneRepMaxHistory(entry)
    const row = await invokeCommand<TauriOneRepMaxHistoryResponse>('save_one_rep_max', {
      user_id: partial.user_id!,
      exercise_id: partial.exercise_id!,
      weight: JSON.stringify(partial.weight),
      estimated: partial.estimated ?? null,
      recorded_at: isoToUnixSeconds(partial.recorded_at!),
    })
    return toOneRepMaxHistory(toOneRepMaxHistoryRow(row))
  }

  // ---------------------------------------------------------------------------
  // Exercise history operations
  // ---------------------------------------------------------------------------

  async getOneRepMaxHistory(userId: string, exerciseId: string): Promise<OneRepMaxHistory[]> {
    const rows = await invokeCommand<TauriOneRepMaxHistoryResponse[]>('get_one_rep_max_history', {
      user_id: userId,
      exercise_id: exerciseId,
    })
    return rows.map((r) => toOneRepMaxHistory(toOneRepMaxHistoryRow(r)))
  }

  async getRecentlyUsedExerciseIds(userId: string, limit = 10): Promise<string[]> {
    return invokeCommand<string[]>('get_recently_used_exercise_ids', {
      user_id: userId,
      limit,
    })
  }

  async getExerciseWorkoutHistory(
    userId: string,
    exerciseId: string,
    limit = 10,
  ): Promise<WorkoutWithSets[]> {
    const results = await invokeCommand<TauriWorkoutWithSets[]>('get_exercise_workout_history', {
      user_id: userId,
      exercise_id: exerciseId,
      limit,
    })

    return results.map((r) => ({
      log: toWorkoutLog(toWorkoutLogRow(r.log)),
      sets: r.sets.map((s) => toLoggedSet(toLoggedSetRow(s))),
    }))
  }

  // ---------------------------------------------------------------------------
  // Transactional workout creation
  // ---------------------------------------------------------------------------

  async createWorkoutLogFull(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
    groups: Array<{
      group: Omit<LoggedActivityGroup, 'id'>
      activities: Array<{
        activity: Omit<LoggedActivity, 'id'>
        sets: Array<Omit<LoggedSet, 'id'>>
      }>
    }>,
    userId: string,
  ): Promise<{
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  }> {
    const input = {
      log: {
        user_id: userId,
        title: log.title ?? null,
        started_at: isoToUnixSeconds(log.startedAt),
        completed_at: log.completedAt ? isoToUnixSeconds(log.completedAt) : null,
        session_template_id: log.sessionTemplateId ?? null,
        program_context: log.programContext ? JSON.stringify(log.programContext) : null,
        overall_notes: log.overallNotes ?? null,
        perceived_difficulty: log.perceivedDifficulty ?? null,
        bodyweight_at_session: log.bodyweightAtSession
          ? JSON.stringify(log.bodyweightAtSession)
          : null,
      },
      groups: groups.map((g) => ({
        group: {
          workout_log_id: '', // will be set server-side
          group_type: g.group.groupType,
          ordinal: g.group.ordinal,
          actual_rounds_completed: g.group.actualRoundsCompleted ?? null,
          completion_time: g.group.completionTime ? JSON.stringify(g.group.completionTime) : null,
        },
        activities: g.activities.map((a) => ({
          activity: {
            logged_group_id: '', // will be set server-side
            exercise_id: a.activity.exerciseId,
            ordinal: a.activity.ordinal,
            notes: a.activity.notes ?? null,
          },
          sets: a.sets.map((s) => ({
            logged_activity_id: '', // will be set server-side
            set_number: s.setNumber,
            set_type: s.setType,
            prescribed: s.prescribed ? JSON.stringify(s.prescribed) : null,
            actual_reps: s.actualReps ?? null,
            actual_weight: s.actualWeight ? JSON.stringify(s.actualWeight) : null,
            actual_duration: s.actualDuration ? JSON.stringify(s.actualDuration) : null,
            actual_distance: s.actualDistance ? JSON.stringify(s.actualDistance) : null,
            actual_pace: s.actualPace ? JSON.stringify(s.actualPace) : null,
            actual_heart_rate: s.actualHeartRate ?? null,
            ruck_load: s.ruckLoad ? JSON.stringify(s.ruckLoad) : null,
            elevation_gain: s.elevationGain ? JSON.stringify(s.elevationGain) : null,
            rpe: s.rpe ?? null,
            completed: s.completed ?? null,
            notes: s.notes ?? null,
          })),
        })),
      })),
    }

    const result = await invokeCommand<{
      log: TauriWorkoutLogResponse
      groups: TauriLoggedActivityGroupResponse[]
      activities: TauriLoggedActivityResponse[]
      sets: TauriLoggedSetResponse[]
    }>('create_workout_log_full', { input, user_id: userId })

    return {
      log: toWorkoutLog(toWorkoutLogRow(result.log)),
      groups: result.groups.map((g) => toLoggedActivityGroup(toLoggedActivityGroupRow(g))),
      activities: result.activities.map((a) => toLoggedActivity(toLoggedActivityRow(a))),
      sets: result.sets.map((s) => toLoggedSet(toLoggedSetRow(s))),
    }
  }

  // ---------------------------------------------------------------------------
  // Session template operations
  // ---------------------------------------------------------------------------

  async getSessionTemplates(userId: string): Promise<SessionTemplate[]> {
    const rows = await invokeCommand<TauriSessionTemplateResponse[]>('get_session_templates', {
      user_id: userId,
    })
    return rows.map((r) => toSessionTemplate(toSessionTemplateRowFromTauri(r)))
  }

  async getSessionTemplate(id: string): Promise<SessionTemplate | null> {
    const row = await invokeCommand<TauriSessionTemplateResponse | null>('get_session_template', {
      id,
    })
    return row ? toSessionTemplate(toSessionTemplateRowFromTauri(row)) : null
  }

  async getSessionTemplateFull(id: string): Promise<SessionTemplateFull | null> {
    const full = await invokeCommand<TauriSessionTemplateFull | null>('get_session_template_full', {
      id,
    })
    if (!full) return null

    return {
      template: toSessionTemplate(toSessionTemplateRowFromTauri(full.template)),
      groups: full.groups.map((g) => toActivityGroupFlat(toActivityGroupRowFromTauri(g))),
      activities: full.activities.map((a) => toActivity(toActivityRowFromTauri(a))),
      eventItems: [],
    }
  }

  async createSessionTemplateFull(
    template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    groups: Array<{
      group: Omit<ActivityGroup, 'id' | 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull> {
    const partial = fromSessionTemplate(template)
    const input = {
      user_id: partial.user_id ?? null,
      name: partial.name!,
      description: partial.description ?? null,
      category: partial.category!,
      rest_between_groups: partial.rest_between_groups ?? null,
      time_cap: partial.time_cap ?? null,
      scoring: partial.scoring ?? null,
    }

    const groupsInput = groups.map((g) => {
      const gPartial = fromActivityGroup(g.group)
      return {
        group: {
          group_type: gPartial.group_type!,
          ordinal: gPartial.ordinal!,
          rounds: gPartial.rounds ?? null,
          rest_between_rounds: gPartial.rest_between_rounds ?? null,
          rest_between_activities: gPartial.rest_between_activities ?? null,
        },
        activities: g.activities.map((a) => {
          const aPartial = fromActivity(a)
          return {
            exercise_id: aPartial.exercise_id!,
            ordinal: aPartial.ordinal!,
            set_scheme: aPartial.set_scheme!,
            notes: aPartial.notes ?? null,
          }
        }),
      }
    })

    const result = await invokeCommand<TauriSessionTemplateFull>('create_session_template_full', {
      template: input,
      groups: groupsInput,
    })

    return {
      template: toSessionTemplate(toSessionTemplateRowFromTauri(result.template)),
      groups: result.groups.map((g) => toActivityGroupFlat(toActivityGroupRowFromTauri(g))),
      activities: result.activities.map((a) => toActivity(toActivityRowFromTauri(a))),
      eventItems: [],
    }
  }

  async updateSessionTemplateFull(
    template: SessionTemplate,
    groups: Array<{
      group: Omit<ActivityGroup, 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull> {
    const partial = fromSessionTemplate(template)
    const input = {
      id: template.id,
      user_id: partial.user_id ?? null,
      name: partial.name!,
      description: partial.description ?? null,
      category: partial.category!,
      rest_between_groups: partial.rest_between_groups ?? null,
      time_cap: partial.time_cap ?? null,
      scoring: partial.scoring ?? null,
    }

    const groupsInput = groups.map((g) => {
      const gPartial = fromActivityGroup(g.group)
      return {
        group: {
          id: g.group.id || null,
          group_type: gPartial.group_type!,
          ordinal: gPartial.ordinal!,
          rounds: gPartial.rounds ?? null,
          rest_between_rounds: gPartial.rest_between_rounds ?? null,
          rest_between_activities: gPartial.rest_between_activities ?? null,
        },
        activities: g.activities.map((a) => {
          const aPartial = fromActivity(a)
          return {
            exercise_id: aPartial.exercise_id!,
            ordinal: aPartial.ordinal!,
            set_scheme: aPartial.set_scheme!,
            notes: aPartial.notes ?? null,
          }
        }),
      }
    })

    const result = await invokeCommand<TauriSessionTemplateFull>('update_session_template_full', {
      template: input,
      groups: groupsInput,
    })

    return {
      template: toSessionTemplate(toSessionTemplateRowFromTauri(result.template)),
      groups: result.groups.map((g) => toActivityGroupFlat(toActivityGroupRowFromTauri(g))),
      activities: result.activities.map((a) => toActivity(toActivityRowFromTauri(a))),
      eventItems: [],
    }
  }

  async deleteSessionTemplate(id: string): Promise<void> {
    await invokeCommand<void>('delete_session_template', { id })
  }

  async cloneSessionTemplate(_id: string, _userId: string): Promise<SessionTemplateFull> {
    throw new Error('Not implemented in offline mode')
  }

  // ---------------------------------------------------------------------------
  // Event item operations (deferred for offline/Tauri -- W-8)
  // ---------------------------------------------------------------------------

  async getEventItems(_parentId: string, _parentType: 'template' | 'log'): Promise<EventItem[]> {
    throw new Error('Not implemented in offline mode')
  }

  async saveEventItem(
    _item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
    _parentId: string,
    _parentType: 'template' | 'log',
  ): Promise<EventItem> {
    throw new Error('Not implemented in offline mode')
  }

  async updateEventItem(_item: EventItem): Promise<EventItem> {
    throw new Error('Not implemented in offline mode')
  }

  async deleteEventItem(_itemId: string): Promise<void> {
    throw new Error('Not implemented in offline mode')
  }

  async toggleEventItemPacked(_itemId: string, _isPacked: boolean): Promise<EventItem> {
    throw new Error('Not implemented in offline mode')
  }

  async reorderEventItems(_items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    throw new Error('Not implemented in offline mode')
  }

  // ---------------------------------------------------------------------------
  // Program operations
  // ---------------------------------------------------------------------------

  async getPrograms(userId: string): Promise<Program[]> {
    const rows = await invokeCommand<TauriProgramResponse[]>('get_programs', {
      user_id: userId,
    })
    return rows.map((r) => toProgram(toProgramRowFromTauri(r)))
  }

  async getProgramFull(id: string): Promise<ProgramFull | null> {
    const result = await invokeCommand<TauriProgramFullResponse | null>('get_program_full', { id })
    if (!result) return null
    return {
      program: toProgram(toProgramRowFromTauri(result.program)),
      blocks: result.blocks.map((r) => toBlock(toBlockRowFromTauri(r))),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(toBlockWeekRowFromTauri(r))),
      scheduledSessions: result.scheduled_sessions.map((r) =>
        toScheduledSession(toScheduledSessionRowFromTauri(r)),
      ),
    }
  }

  async createProgramFull(
    program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>,
    blocks: Array<{
      block: Omit<Block, 'id' | 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'id' | 'blockId'>
        sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
      }>
    }>,
  ): Promise<ProgramFull> {
    const input = {
      program: {
        id: null,
        user_id: program.userId,
        name: program.name,
        description: program.description ?? null,
        source: program.source,
        duration_weeks: program.durationWeeks ?? null,
        is_public: program.isPublic,
        created_by: program.createdBy ?? null,
      },
      blocks: blocks.map(({ block, weeks }) => ({
        block: {
          id: null,
          name: block.name,
          ordinal: block.ordinal,
          duration_weeks: block.durationWeeks,
          block_type: block.blockType,
        },
        weeks: weeks.map(({ week, sessions }) => ({
          week: {
            id: null,
            week_number: week.weekNumber,
          },
          sessions: sessions.map((s) => ({
            id: null,
            day_of_week: s.dayOfWeek ?? null,
            day_label: s.dayLabel,
            session_type: s.sessionType,
            session_template_id: s.sessionTemplateId,
            notes: s.notes ?? null,
          })),
        })),
      })),
    }

    const result = await invokeCommand<TauriProgramFullResponse>('create_program_full', input)
    return {
      program: toProgram(toProgramRowFromTauri(result.program)),
      blocks: result.blocks.map((r) => toBlock(toBlockRowFromTauri(r))),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(toBlockWeekRowFromTauri(r))),
      scheduledSessions: result.scheduled_sessions.map((r) =>
        toScheduledSession(toScheduledSessionRowFromTauri(r)),
      ),
    }
  }

  async updateProgramFull(
    program: Program,
    blocks: Array<{
      block: Omit<Block, 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'blockId'>
        sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
      }>
    }>,
  ): Promise<ProgramFull> {
    const input = {
      program: {
        id: program.id,
        user_id: program.userId,
        name: program.name,
        description: program.description ?? null,
        source: program.source,
        duration_weeks: program.durationWeeks ?? null,
        is_public: program.isPublic,
        created_by: program.createdBy ?? null,
      },
      blocks: blocks.map(({ block, weeks }) => ({
        block: {
          id: block.id || null,
          name: block.name,
          ordinal: block.ordinal,
          duration_weeks: block.durationWeeks,
          block_type: block.blockType,
        },
        weeks: weeks.map(({ week, sessions }) => ({
          week: {
            id: week.id || null,
            week_number: week.weekNumber,
          },
          sessions: sessions.map((s) => ({
            id: null,
            day_of_week: s.dayOfWeek ?? null,
            day_label: s.dayLabel,
            session_type: s.sessionType,
            session_template_id: s.sessionTemplateId,
            notes: s.notes ?? null,
          })),
        })),
      })),
    }

    const result = await invokeCommand<TauriProgramFullResponse>('update_program_full', input)
    return {
      program: toProgram(toProgramRowFromTauri(result.program)),
      blocks: result.blocks.map((r) => toBlock(toBlockRowFromTauri(r))),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(toBlockWeekRowFromTauri(r))),
      scheduledSessions: result.scheduled_sessions.map((r) =>
        toScheduledSession(toScheduledSessionRowFromTauri(r)),
      ),
    }
  }

  async deleteProgram(id: string): Promise<void> {
    await invokeCommand<void>('delete_program', { id })
  }

  async assignProgramToMember(
    programId: string,
    memberId: string,
    groupId: string,
  ): Promise<Program> {
    const row = await invokeCommand<TauriProgramResponse>('assign_program_to_member', {
      caller_id: this.userId,
      program_id: programId,
      member_id: memberId,
      group_id: groupId,
    })
    return toProgram(toProgramRowFromTauri(row))
  }

  // ---------------------------------------------------------------------------
  // Program activation operations
  // ---------------------------------------------------------------------------

  async getActiveProgram(userId: string): Promise<ProgramActivation | null> {
    const row = await invokeCommand<TauriProgramActivationResponse | null>('get_active_program', {
      user_id: userId,
    })
    return row ? toProgramActivation(toProgramActivationRowFromTauri(row)) : null
  }

  async setActiveProgram(
    userId: string,
    programId: string,
    startDate?: string,
  ): Promise<ProgramActivation> {
    const row = await invokeCommand<TauriProgramActivationResponse>('set_active_program', {
      user_id: userId,
      program_id: programId,
      start_date: startDate ?? null,
    })
    return toProgramActivation(toProgramActivationRowFromTauri(row))
  }

  async updateActiveProgram(
    userId: string,
    updates: { currentBlockOrdinal?: number; currentWeekNumber?: number },
  ): Promise<ProgramActivation> {
    const row = await invokeCommand<TauriProgramActivationResponse>('update_active_program', {
      user_id: userId,
      current_block_ordinal: updates.currentBlockOrdinal ?? null,
      current_week_number: updates.currentWeekNumber ?? null,
    })
    return toProgramActivation(toProgramActivationRowFromTauri(row))
  }

  async clearActiveProgram(userId: string): Promise<void> {
    await invokeCommand<void>('clear_active_program', { user_id: userId })
  }

  // ---------------------------------------------------------------------------
  // Share link operations (not supported offline -- require Supabase)
  // ---------------------------------------------------------------------------

  async getShareLinks(_userId: string): Promise<ShareLink[]> {
    throw new Error('Share links are not supported in offline mode')
  }

  async getShareLinksForEntity(
    _entityType: ShareableEntityType,
    _entityId: string,
  ): Promise<ShareLink[]> {
    throw new Error('Share links are not supported in offline mode')
  }

  async createShareLink(
    _link: Omit<ShareLink, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<ShareLink> {
    throw new Error('Share links are not supported in offline mode')
  }

  async revokeShareLink(_id: string): Promise<void> {
    throw new Error('Share links are not supported in offline mode')
  }

  async deleteShareLink(_id: string): Promise<void> {
    throw new Error('Share links are not supported in offline mode')
  }

  // ---------------------------------------------------------------------------
  // Analytics operations
  // ---------------------------------------------------------------------------

  async getWeeklyVolume(
    userId: string,
    exerciseId: string,
    weeks = 8,
  ): Promise<WeeklyVolumeEntry[]> {
    // No dedicated Rust command exists yet, so fetch exercise workout history
    // and aggregate tonnage by week in TypeScript.
    // Use a generous limit to capture enough weeks of data.
    const history = await this.getExerciseWorkoutHistory(userId, exerciseId, weeks * 7)

    const weekMap = new Map<string, { label: string; tonnage: number; unit: 'lb' | 'kg' }>()

    for (const { log, sets } of history) {
      const startedAt = new Date(log.startedAt)
      const weekStart = getMonday(startedAt)
      const weekKey = weekStart.toISOString().slice(0, 10)

      for (const set of sets) {
        if (!set.completed || set.actualWeight == null || set.actualReps == null) continue

        const tonnage = set.actualWeight.value * set.actualReps
        const existing = weekMap.get(weekKey)
        if (existing) {
          existing.tonnage += tonnage
        } else {
          const label = formatWeekLabel(weekStart)
          weekMap.set(weekKey, {
            label,
            tonnage,
            unit: set.actualWeight.unit,
          })
        }
      }
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, weeks)
      .reverse()
      .map(([weekStart, entry]) => ({
        weekLabel: entry.label,
        weekStart,
        tonnage: Math.round(entry.tonnage),
        unit: entry.unit,
      }))
  }

  async getVaultSummary(userId: string): Promise<VaultSummary> {
    // Fetch all completed workout logs and compute stats client-side.
    const logs = await this.getWorkoutLogs(userId)
    const completedLogs = logs.filter((l) => l.completedAt != null)

    const monday = getMonday(new Date())

    let totalWorkouts = 0
    let totalVolumeLb = 0
    let thisWeekWorkouts = 0
    let thisWeekVolumeLb = 0

    for (const log of completedLogs) {
      totalWorkouts++
      const isThisWeek = new Date(log.startedAt) >= monday
      if (isThisWeek) thisWeekWorkouts++

      // Fetch full workout data to calculate volume
      const full = await this.getWorkoutLogFull(log.id)
      if (!full) continue

      for (const set of full.sets) {
        if (!set.completed || set.actualWeight == null || set.actualReps == null) continue

        let weightLb = set.actualWeight.value
        if (set.actualWeight.unit === 'kg') {
          weightLb = set.actualWeight.value * 2.20462
        }
        const volume = weightLb * set.actualReps
        totalVolumeLb += volume
        if (isThisWeek) thisWeekVolumeLb += volume
      }
    }

    return {
      totalWorkouts,
      totalVolumeLb: Math.round(totalVolumeLb),
      thisWeekWorkouts,
      thisWeekVolumeLb: Math.round(thisWeekVolumeLb),
    }
  }

  // ---------------------------------------------------------------------------
  // Accountability Group operations
  // ---------------------------------------------------------------------------

  async createGroup(
    group: Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>,
  ): Promise<AccountabilityGroup> {
    const row = await invokeCommand<TauriAccountabilityGroupResponse>('create_group', {
      name: group.name,
      description: group.description ?? null,
      data_retention_days: group.dataRetentionDays ?? 30,
      user_id: this.userId,
    })
    return toAccountabilityGroup(toAccountabilityGroupRowFromTauri(row))
  }

  async getGroups(): Promise<AccountabilityGroup[]> {
    const rows = await invokeCommand<TauriAccountabilityGroupResponse[]>('get_groups', {
      user_id: this.userId,
    })
    return rows.map((r) => toAccountabilityGroup(toAccountabilityGroupRowFromTauri(r)))
  }

  async getGroup(id: string): Promise<AccountabilityGroup | null> {
    const row = await invokeCommand<TauriAccountabilityGroupResponse | null>('get_group', { id })
    return row ? toAccountabilityGroup(toAccountabilityGroupRowFromTauri(row)) : null
  }

  async updateGroup(
    id: string,
    updates: Partial<Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>>,
  ): Promise<AccountabilityGroup> {
    const row = await invokeCommand<TauriAccountabilityGroupResponse>('update_group', {
      id,
      name: updates.name ?? null,
      description: updates.description ?? null,
      data_retention_days: updates.dataRetentionDays ?? null,
    })
    return toAccountabilityGroup(toAccountabilityGroupRowFromTauri(row))
  }

  async deleteGroup(id: string): Promise<void> {
    await invokeCommand<void>('delete_group', { id, user_id: this.userId })
  }

  // ---------------------------------------------------------------------------
  // Group Member operations
  // ---------------------------------------------------------------------------

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const rows = await invokeCommand<TauriGroupMemberResponse[]>('get_group_members', {
      group_id: groupId,
    })
    return rows.map((r) => toGroupMember(toGroupMemberRowFromTauri(r)))
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await invokeCommand<void>('remove_group_member', {
      group_id: groupId,
      user_id: userId,
      caller_id: this.userId,
    })
  }

  async updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<GroupMember> {
    const row = await invokeCommand<TauriGroupMemberResponse>('update_member_role', {
      group_id: groupId,
      user_id: userId,
      role,
      caller_id: this.userId,
    })
    return toGroupMember(toGroupMemberRowFromTauri(row))
  }

  // ---------------------------------------------------------------------------
  // Group Invite operations
  // ---------------------------------------------------------------------------

  async createInvite(groupId: string): Promise<GroupInvite> {
    const row = await invokeCommand<TauriGroupInviteResponse>('create_invite', {
      group_id: groupId,
      user_id: this.userId,
    })
    return toGroupInvite(toGroupInviteRowFromTauri(row))
  }

  async getGroupInvites(groupId: string): Promise<GroupInvite[]> {
    const rows = await invokeCommand<TauriGroupInviteResponse[]>('get_group_invites', {
      group_id: groupId,
    })
    return rows.map((r) => toGroupInvite(toGroupInviteRowFromTauri(r)))
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await invokeCommand<void>('revoke_invite', { invite_id: inviteId, user_id: this.userId })
  }

  async joinGroupByCode(code: string): Promise<GroupMember> {
    const row = await invokeCommand<TauriGroupMemberResponse>('join_group_by_code', {
      code,
      user_id: this.userId,
    })
    return toGroupMember(toGroupMemberRowFromTauri(row))
  }

  // ---------------------------------------------------------------------------
  // Direct Connection operations
  // ---------------------------------------------------------------------------

  async requestConnection(recipientId: string): Promise<DirectConnection> {
    const row = await invokeCommand<TauriDirectConnectionResponse>('request_connection', {
      requester_id: this.userId,
      recipient_id: recipientId,
    })
    return toDirectConnection(toDirectConnectionRowFromTauri(row))
  }

  async getConnections(): Promise<DirectConnection[]> {
    const rows = await invokeCommand<TauriDirectConnectionResponse[]>('get_connections', {
      user_id: this.userId,
    })
    return rows.map((r) => toDirectConnection(toDirectConnectionRowFromTauri(r)))
  }

  async getPendingConnections(): Promise<DirectConnection[]> {
    const rows = await invokeCommand<TauriDirectConnectionResponse[]>('get_pending_connections', {
      user_id: this.userId,
    })
    return rows.map((r) => toDirectConnection(toDirectConnectionRowFromTauri(r)))
  }

  async acceptConnection(connectionId: string): Promise<DirectConnection> {
    const row = await invokeCommand<TauriDirectConnectionResponse>('accept_connection', {
      connection_id: connectionId,
      user_id: this.userId,
    })
    return toDirectConnection(toDirectConnectionRowFromTauri(row))
  }

  async declineConnection(connectionId: string): Promise<DirectConnection> {
    const row = await invokeCommand<TauriDirectConnectionResponse>('decline_connection', {
      connection_id: connectionId,
      user_id: this.userId,
    })
    return toDirectConnection(toDirectConnectionRowFromTauri(row))
  }

  async removeConnection(connectionId: string): Promise<void> {
    await invokeCommand<void>('remove_connection', {
      connection_id: connectionId,
      user_id: this.userId,
    })
  }

  async updateConnectionWriteAccess(
    connectionId: string,
    grantsWrite: boolean,
  ): Promise<DirectConnection> {
    const row = await invokeCommand<TauriDirectConnectionResponse>(
      'update_connection_write_access',
      {
        connection_id: connectionId,
        user_id: this.userId,
        grants_write: grantsWrite,
      },
    )
    return toDirectConnection(toDirectConnectionRowFromTauri(row))
  }

  // ---------------------------------------------------------------------------
  // Activity Feed operations
  // ---------------------------------------------------------------------------

  async getGroupActivityFeed(
    groupId: string,
    options: ActivityFeedOptions = {},
  ): Promise<GroupActivityFeedEntry[]> {
    const { before, limit = 20 } = options

    const entries = await invokeCommand<TauriGroupActivityFeedEntry[]>('get_group_activity_feed', {
      group_id: groupId,
      user_id: this.userId,
      before: before ? isoToUnixSeconds(before) : null,
      limit,
    })

    return entries.map((e) => ({
      id: e.id,
      userId: e.user_id,
      title: e.title,
      startedAt: e.started_at,
      completedAt: e.completed_at,
      durationSeconds: e.duration_seconds,
      exerciseCount: e.exercise_count,
      groupId: e.group_id,
      memberRole: e.member_role as GroupRole,
    }))
  }

  async getConnectionActivityFeed(
    options: ActivityFeedOptions = {},
  ): Promise<ConnectionActivityFeedEntry[]> {
    const { before, limit = 20 } = options

    const entries = await invokeCommand<TauriConnectionActivityFeedEntry[]>(
      'get_connection_activity_feed',
      {
        user_id: this.userId,
        before: before ? isoToUnixSeconds(before) : null,
        limit,
      },
    )

    return entries.map((e) => ({
      id: e.id,
      userId: e.user_id,
      title: e.title,
      startedAt: e.started_at,
      completedAt: e.completed_at,
      durationSeconds: e.duration_seconds,
      exerciseCount: e.exercise_count,
      connectionId: e.connection_id,
    }))
  }

  // ---------------------------------------------------------------------------
  // Chat operations
  // ---------------------------------------------------------------------------

  async createConversation(
    type: ConversationType,
    participantIds: string[],
    title?: string,
    groupId?: string,
  ): Promise<Conversation> {
    const result = await invokeCommand<TauriConversationWithParticipants>('create_conversation', {
      input: {
        conversation_type: type,
        title: title ?? null,
        group_id: groupId ?? null,
        participant_user_ids: participantIds,
      },
    })
    return toConversation(toConversationRowFromTauri(result.conversation))
  }

  async getConversations(): Promise<Conversation[]> {
    const results = await invokeCommand<TauriConversationWithParticipants[]>('get_conversations', {
      user_id: this.userId,
    })
    return results.map((r) => toConversation(toConversationRowFromTauri(r.conversation)))
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const result = await invokeCommand<TauriConversationWithParticipants | null>(
      'get_conversation',
      { id },
    )
    return result ? toConversation(toConversationRowFromTauri(result.conversation)) : null
  }

  async findDirectConversation(otherUserId: string): Promise<Conversation | null> {
    // No dedicated Rust command -- filter client-side from user's conversations
    const conversations = await this.getConversations()
    // For direct conversations, fetch participants to check membership
    for (const conv of conversations) {
      if (conv.type !== 'direct') continue
      const full = await invokeCommand<TauriConversationWithParticipants | null>(
        'get_conversation',
        { id: conv.id },
      )
      if (!full) continue
      const participantUserIds = full.participants
        .filter((p) => p.left_at == null)
        .map((p) => p.user_id)
      if (participantUserIds.includes(this.userId) && participantUserIds.includes(otherUserId)) {
        return conv
      }
    }
    return null
  }

  async sendMessage(
    conversationId: string,
    messageType: MessageType,
    content?: string,
  ): Promise<Message> {
    const row = await invokeCommand<TauriMessageResponse>('send_message', {
      input: {
        conversation_id: conversationId,
        sender_id: this.userId,
        message_type: messageType,
        content: content ?? null,
      },
    })
    return toMessage(toMessageRowFromTauri(row))
  }

  async getMessages(conversationId: string, limit: number, offset: number): Promise<Message[]> {
    const rows = await invokeCommand<TauriMessageResponse[]>('get_messages', {
      conversation_id: conversationId,
      limit,
      offset,
    })
    return rows.map((r) => toMessage(toMessageRowFromTauri(r)))
  }

  async getMessagesSince(conversationId: string, since: string): Promise<Message[]> {
    // No dedicated Rust command -- fetch all messages and filter client-side
    // Use a large limit to capture messages since the timestamp
    const all = await invokeCommand<TauriMessageResponse[]>('get_messages', {
      conversation_id: conversationId,
      limit: 1000,
      offset: 0,
    })
    const sinceTime = new Date(since).getTime()
    return all
      .filter((r) => new Date(r.created_at).getTime() > sinceTime)
      .map((r) => toMessage(toMessageRowFromTauri(r)))
  }

  async updateLastRead(conversationId: string): Promise<void> {
    await invokeCommand<TauriConversationParticipantResponse>('update_last_read', {
      conversation_id: conversationId,
      user_id: this.userId,
    })
  }

  async getUnreadCounts(): Promise<Map<string, number>> {
    const counts = await invokeCommand<TauriUnreadCount[]>('get_unread_counts', {
      user_id: this.userId,
    })
    const map = new Map<string, number>()
    for (const c of counts) {
      map.set(c.conversation_id, c.count)
    }
    return map
  }

  async addParticipant(conversationId: string, userId: string): Promise<ConversationParticipant> {
    // No dedicated Rust command -- create a new conversation with the added
    // participant is the intended flow. For now, throw as unsupported in
    // offline mode; the UI should use createConversation to add members.
    throw new Error(
      `addParticipant is not supported in offline mode. ` +
        `Re-create the conversation to add user ${userId} to ${conversationId}.`,
    )
  }

  async leaveConversation(conversationId: string): Promise<void> {
    await invokeCommand<TauriConversationParticipantResponse>('leave_conversation', {
      conversation_id: conversationId,
      user_id: this.userId,
    })
  }

  async toggleArchive(conversationId: string): Promise<void> {
    await invokeCommand<TauriConversationParticipantResponse>('toggle_archive', {
      conversation_id: conversationId,
      user_id: this.userId,
    })
  }

  async saveMediaAttachment(
    messageId: string,
    attachment: Omit<MediaAttachment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MediaAttachment> {
    const row = await invokeCommand<TauriMediaAttachmentResponse>('save_media_attachment', {
      input: {
        id: null,
        message_id: messageId,
        provider: attachment.provider,
        provider_asset_id: attachment.providerAssetId ?? null,
        media_type: attachment.mediaType,
        original_filename: attachment.originalFilename ?? null,
        mime_type: attachment.mimeType ?? null,
        thumbnail_url: attachment.thumbnailUrl ?? null,
        playback_url: attachment.playbackUrl ?? null,
        duration_seconds: attachment.durationSeconds ?? null,
        file_size_bytes: attachment.fileSizeBytes ?? null,
        status: attachment.status,
      },
    })
    return toMediaAttachment(toMediaAttachmentRowFromTauri(row))
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Monday at 00:00 UTC of the week containing the given date. */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Formats a date as "Mon DD" (e.g. "Mar 24"). */
function formatWeekLabel(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')}`
}
