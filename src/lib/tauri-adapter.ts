import { invoke } from '@tauri-apps/api/core'
import type {
  ActivityFeedOptions,
  ConnectionActivityFeedEntry,
  DataAdapter,
  ExerciseFilters,
  GroupActivityFeedEntry,
  ProgramFilters,
  ProgramFull,
  SessionTemplateFull,
  SessionTemplateFilters,
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
  WeekStatus,
  WeekStatusValue,
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
  Gym,
  GymMember,
  GymInvitation,
  GymMemberCount,
  GymOwnershipTransfer,
  RedeemInviteError,
} from '@/domain/types'
import { z } from 'zod'
import {
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
  sessionTypeSchema,
  scoringTypeSchema,
  setSchemeSchema,
  programSourceSchema,
  blockTypeSchema,
  sessionOverridesSchema,
  weekStatusValueSchema,
  conversationSchema,
  messageSchema,
  mediaProviderSchema,
  mediaTypeSchema,
  mediaStatusSchema,
  entityId,
} from '@/domain/types'
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
  is_public: number | null
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
  note_tags: string
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
  note_tags: string
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
  created_at: string | null
  updated_at: string | null
}

interface TauriUserProfileResponse {
  id: string
  display_name: string | null
  // F018 (M10): `display_visible` removed -- was the legacy global publish
  // opt-in. The Wave 3b SQLite migration drops the column on the Tauri side
  // in lockstep with the Postgres drop in Wave 2.
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
  is_public: number // 0 or 1 in SQLite
  last_assigned_at: string | null
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
  overrides: string | null
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

interface TauriWeekStatusResponse {
  id: string
  activation_id: string
  block_ordinal: number
  week_number: number
  status: string
  created_at: string
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
  kind:
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION'
    | 'DATABASE'
    | 'INTERNAL'
    | 'UNAUTHORIZED'
    | 'SYNC'
    | 'NETWORK'
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

/**
 * Distinct error variant for operations that require an online Supabase
 * connection in the Tauri (offline-first) build. Mutation hooks can
 * `instanceof OnlineRequiredError` to surface a contextual "Offline mode"
 * banner instead of a generic failure message.
 *
 * Per .claude/rules/error-handling.md: error types at system boundaries
 * must distinguish input validation failures from network/transport
 * failures. This is the network/transport variant for the gym domain.
 */
export class OnlineRequiredError extends Error {
  readonly code = 'ONLINE_REQUIRED' as const
  readonly operation: string

  constructor(operation: string) {
    super(`${operation} requires an online connection`)
    this.name = 'OnlineRequiredError'
    this.operation = operation
  }
}

/** Invoke a Tauri command and translate AppError responses into AdapterError. */
async function invokeCommand<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    console.error(`[tauri-adapter] invokeCommand(${cmd}) failed:`, e)
    if (isTauriAppError(e)) throw new AdapterError(e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Low-level conversion utilities
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

/** Parse a note_tags JSON string into string[], falling back to [] on any error. */
function parseNoteTags(value: string | null | undefined, column: string): string[] {
  if (value == null || value === '') return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) {
      return parsed as string[]
    }
    console.warn(
      `[tauri-adapter] ${column}: expected string[], using fallback [] -- raw: ${String(value).slice(0, 120)}`,
    )
    return []
  } catch (err) {
    console.warn(
      `[tauri-adapter] ${column}: JSON parse failed, using fallback [] -- raw: ${String(value).slice(0, 120)}:`,
      err,
    )
    return []
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
function intToBool(value: number | null | undefined, field: string, fallback = false): boolean {
  if (value == null) {
    console.warn(
      `[tauri-adapter] ${field}: expected int (0/1), got null -- using fallback ${String(fallback)}`,
    )
    return fallback
  }
  return value !== 0
}

// One-shot warning when pause state is dropped on the Tauri adapter.
// Per ADR-013, pause-state persistence to local SQLite is deferred (F018).
// The interim behavior is to silently coerce paused_at/total_paused_ms to
// defaults and surface a single console.warn so callers attempting to
// persist pause data through this adapter notice.
let _pauseFieldsDropWarned = false
function _warnPauseFieldsDroppedOnce(): void {
  if (_pauseFieldsDropWarned) return
  _pauseFieldsDropWarned = true
  console.warn('[tauri-adapter] Pause state not persisted on mobile (F018/ADR-013 deferred)')
}

// ---------------------------------------------------------------------------
// Inline domain mappers: Tauri Response -> Domain types
//
// These functions replace the two-step pipeline (toXxxRow + data-mapper toXxx)
// with a single pass. Each function handles the Tauri-specific concerns
// (int->bool, JSON string parsing) and then maps directly to the domain type.
// ---------------------------------------------------------------------------

function toExercise(r: TauriExerciseResponse): Exercise {
  if (!r.movement_pattern) {
    throw new Error(
      `Exercise "${r.name}" (${r.id}) has no movement_pattern -- this field is required by the domain model`,
    )
  }
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    name: r.name,
    aliases: z.array(z.string()).parse(parseJson(r.aliases, 'aliases')),
    category: exerciseCategorySchema.parse(r.category),
    movementPattern: movementPatternSchema.parse(r.movement_pattern),
    muscleGroups: muscleGroupSpecSchema.parse(parseJson(r.muscle_groups, 'muscle_groups')),
    isBilateral: intToBool(r.is_bilateral, 'is_bilateral'),
    supports1RM: intToBool(r.supports_1rm, 'supports_1rm'),
    equipmentRequired: z
      .array(equipmentSchema)
      .parse(parseJson(r.equipment_required, 'equipment_required')),
    isCustom: intToBool(r.is_custom, 'is_custom'),
    isPublic: intToBool(r.is_public, 'is_public'),
  }
}

function fromExercise(
  exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
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
    is_public: exercise.isPublic,
  }
}

function toWorkoutLog(r: TauriWorkoutLogResponse): WorkoutLog {
  const programContext = parseJson(r.program_context, 'program_context')
  const bodyweightAtSession = parseJson(r.bodyweight_at_session, 'bodyweight_at_session')
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    userId: requireString(r.user_id, 'user_id'),
    title: r.title ?? undefined,
    startedAt: r.started_at,
    completedAt: r.completed_at ?? undefined,
    sessionTemplateId: r.session_template_id ?? undefined,
    programContext: programContext != null ? programContextSchema.parse(programContext) : undefined,
    perceivedDifficulty: r.perceived_difficulty ?? undefined,
    bodyweightAtSession:
      bodyweightAtSession != null ? weightSchema.parse(bodyweightAtSession) : undefined,
    overallNotes: r.overall_notes ?? undefined,
    noteTags: (() => {
      const tags = parseNoteTags(r.note_tags, 'workout_logs.note_tags')
      return tags.length > 0 ? tags : undefined
    })(),
    eventMetadata: undefined, // Event features deferred for Tauri offline mode (W-8)
    pausedAt: undefined, // Pause state deferred for Tauri offline mode (F018)
    totalPausedMs: 0,
  }
}

function fromWorkoutLog(
  log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
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
    note_tags: log.noteTags ?? [],
    event_metadata: null,
    paused_at: log.pausedAt ?? null,
    total_paused_ms: log.totalPausedMs ?? 0,
  }
}

function toLoggedActivityGroup(r: TauriLoggedActivityGroupResponse): LoggedActivityGroup {
  const completionTime = parseJson(r.completion_time, 'completion_time')
  return {
    id: r.id,
    workoutLogId: r.workout_log_id,
    groupType: groupTypeSchema.parse(r.group_type),
    ordinal: r.ordinal,
    actualRoundsCompleted: r.actual_rounds_completed ?? undefined,
    completionTime: completionTime != null ? durationSchema.parse(completionTime) : undefined,
  }
}

function fromLoggedActivityGroup(
  group: Omit<LoggedActivityGroup, 'id'>,
  userId: string,
): Record<string, unknown> {
  return {
    workout_log_id: group.workoutLogId,
    user_id: userId,
    group_type: group.groupType,
    ordinal: group.ordinal,
    actual_rounds_completed: group.actualRoundsCompleted ?? null,
    completion_time: group.completionTime ?? null,
  }
}

function toLoggedActivity(r: TauriLoggedActivityResponse): LoggedActivity {
  const noteTags = parseNoteTags(r.note_tags, 'logged_activities.note_tags')
  return {
    id: r.id,
    loggedGroupId: r.logged_group_id,
    exerciseId: r.exercise_id,
    ordinal: r.ordinal,
    notes: r.notes ?? undefined,
    noteTags: noteTags.length > 0 ? noteTags : undefined,
  }
}

function fromLoggedActivity(
  activity: Omit<LoggedActivity, 'id'>,
  userId: string,
): Record<string, unknown> {
  return {
    logged_group_id: activity.loggedGroupId,
    user_id: userId,
    exercise_id: activity.exerciseId,
    ordinal: activity.ordinal,
    notes: activity.notes ?? null,
    note_tags: activity.noteTags ?? [],
  }
}

function toLoggedSet(r: TauriLoggedSetResponse): LoggedSet {
  const prescribed = parseJson(r.prescribed, 'prescribed')
  const actualWeight = parseJson(r.actual_weight, 'actual_weight')
  const actualDuration = parseJson(r.actual_duration, 'actual_duration')
  const actualDistance = parseJson(r.actual_distance, 'actual_distance')
  const actualPace = parseJson(r.actual_pace, 'actual_pace')
  const ruckLoad = parseJson(r.ruck_load, 'ruck_load')
  const elevationGain = parseJson(r.elevation_gain, 'elevation_gain')
  return {
    id: r.id,
    loggedActivityId: r.logged_activity_id,
    setNumber: r.set_number,
    setType: setTypeSchema.parse(r.set_type),
    prescribed: prescribed != null ? prescriptionSchema.parse(prescribed) : undefined,
    actualReps: r.actual_reps ?? undefined,
    actualWeight: actualWeight != null ? weightSchema.parse(actualWeight) : undefined,
    actualDuration: actualDuration != null ? durationSchema.parse(actualDuration) : undefined,
    actualDistance: actualDistance != null ? distanceSchema.parse(actualDistance) : undefined,
    actualPace: actualPace != null ? paceSchema.parse(actualPace) : undefined,
    actualHeartRate: r.actual_heart_rate ?? undefined,
    rpe: r.rpe ?? undefined,
    completed: intToBool(r.completed, 'completed'),
    ruckLoad: ruckLoad != null ? weightSchema.parse(ruckLoad) : undefined,
    elevationGain: elevationGain != null ? distanceSchema.parse(elevationGain) : undefined,
  }
}

function fromLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Record<string, unknown> {
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
  }
}

function toUserProfile(r: TauriUserProfileResponse): UserProfile {
  const bodyweight = parseJson(r.bodyweight, 'bodyweight')
  const trainingAge = parseJson(r.training_age, 'training_age')
  const exerciseMaxes = parseJson(r.exercise_maxes, 'exercise_maxes')
  const maxReps = parseJson(r.max_reps, 'max_reps')
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    displayName: r.display_name ?? undefined,
    preferredUnits: preferredUnitsSchema.parse(r.preferred_units ?? 'IMPERIAL'),
    bodyweight: bodyweight != null ? weightSchema.parse(bodyweight) : undefined,
    trainingAge: trainingAge != null ? durationSchema.parse(trainingAge) : undefined,
    exerciseMaxes:
      exerciseMaxes != null ? z.record(entityId, oneRepMaxSchema).parse(exerciseMaxes) : {},
    maxReps: maxReps != null ? z.record(entityId, z.number().int().positive()).parse(maxReps) : {},
  }
}

function fromUserProfile(profile: Partial<UserProfile> & { id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = { id: profile.id }

  if (profile.displayName !== undefined) row.display_name = profile.displayName ?? null
  if (profile.preferredUnits !== undefined) row.preferred_units = profile.preferredUnits
  if (profile.bodyweight !== undefined) row.bodyweight = profile.bodyweight ?? null
  if (profile.trainingAge !== undefined) row.training_age = profile.trainingAge ?? null
  if (profile.exerciseMaxes !== undefined) row.exercise_maxes = profile.exerciseMaxes
  if (profile.maxReps !== undefined) row.max_reps = profile.maxReps

  return row
}

function toOneRepMaxHistory(r: TauriOneRepMaxHistoryResponse): OneRepMaxHistory {
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    userId: r.user_id,
    exerciseId: r.exercise_id,
    weight: weightSchema.parse(parseJson(r.weight, 'weight')),
    estimated: intToBool(r.estimated, 'estimated'),
    recordedAt: r.recorded_at,
  }
}

function fromOneRepMaxHistory(
  entry: Omit<OneRepMaxHistory, 'id' | 'createdAt'>,
): Record<string, unknown> {
  return {
    user_id: entry.userId,
    exercise_id: entry.exerciseId,
    weight: entry.weight,
    estimated: entry.estimated,
    recorded_at: entry.recordedAt,
  }
}

function toSessionTemplate(r: TauriSessionTemplateResponse): SessionTemplate {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on session template row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on session template row', r)
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    userId: r.user_id,
    name: r.name,
    description: r.description ?? undefined,
    category: sessionTypeSchema.parse(r.category),
    restBetweenGroups:
      r.rest_between_groups != null
        ? durationSchema.parse(parseJson(r.rest_between_groups, 'rest_between_groups'))
        : undefined,
    timeCap:
      r.time_cap != null ? durationSchema.parse(parseJson(r.time_cap, 'time_cap')) : undefined,
    scoring: scoringTypeSchema.parse(r.scoring),
    eventMetadata: undefined, // Event features deferred for Tauri offline mode (W-8)
    lastAssignedAt: r.last_assigned_at ?? undefined,
    isPublic: r.is_public !== 0,
  }
}

function fromSessionTemplate(
  template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
  return {
    user_id: template.userId,
    name: template.name,
    description: template.description ?? null,
    category: template.category,
    rest_between_groups: template.restBetweenGroups
      ? JSON.stringify(template.restBetweenGroups)
      : null,
    time_cap: template.timeCap ? JSON.stringify(template.timeCap) : null,
    scoring: template.scoring,
    event_metadata: template.eventMetadata ? JSON.stringify(template.eventMetadata) : null,
    is_public: template.isPublic,
  }
}

function toActivityGroupFlat(r: TauriActivityGroupResponse): Omit<ActivityGroup, 'activities'> {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on activity group row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on activity group row', r)
  return {
    id: r.id,
    sessionTemplateId: r.session_template_id,
    groupType: groupTypeSchema.parse(r.group_type),
    ordinal: r.ordinal,
    rounds: r.rounds ?? undefined,
    restBetweenRounds:
      r.rest_between_rounds != null
        ? durationSchema.parse(parseJson(r.rest_between_rounds, 'rest_between_rounds'))
        : undefined,
    restBetweenActivities:
      r.rest_between_activities != null
        ? durationSchema.parse(parseJson(r.rest_between_activities, 'rest_between_activities'))
        : undefined,
  }
}

function fromActivityGroup(
  group: Omit<ActivityGroup, 'activities'> | Omit<ActivityGroup, 'id' | 'activities'>,
  templateId?: string,
): Record<string, unknown> {
  return {
    session_template_id: templateId ?? group.sessionTemplateId,
    group_type: group.groupType,
    ordinal: group.ordinal,
    rounds: group.rounds ?? null,
    rest_between_rounds: group.restBetweenRounds ? JSON.stringify(group.restBetweenRounds) : null,
    rest_between_activities: group.restBetweenActivities
      ? JSON.stringify(group.restBetweenActivities)
      : null,
  }
}

function toActivity(r: TauriActivityResponse): Activity {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on activity row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on activity row', r)
  return {
    id: r.id,
    activityGroupId: r.activity_group_id,
    exerciseId: r.exercise_id,
    ordinal: r.ordinal,
    setScheme: setSchemeSchema.parse(parseJson(r.set_scheme, 'set_scheme')),
    notes: r.notes ?? undefined,
  }
}

function fromActivity(
  activity: Omit<Activity, 'id'> | Omit<Activity, 'id' | 'activityGroupId'>,
  groupId?: string,
): Record<string, unknown> {
  return {
    activity_group_id:
      groupId ?? ('activityGroupId' in activity ? activity.activityGroupId : undefined),
    exercise_id: activity.exerciseId,
    ordinal: activity.ordinal,
    set_scheme: JSON.stringify(activity.setScheme),
    notes: activity.notes ?? null,
  }
}

function toProgram(r: TauriProgramResponse): Program {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on program row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on program row', r)
  try {
    return {
      id: r.id,
      createdAt: r.created_at ?? new Date().toISOString(),
      updatedAt: r.updated_at ?? new Date().toISOString(),
      userId: r.user_id,
      name: r.name,
      description: r.description ?? undefined,
      source: programSourceSchema.parse(r.source),
      durationWeeks: r.duration_weeks ?? undefined,
      isPublic: r.is_public !== 0,
      createdBy: r.created_by ?? r.user_id,
    }
  } catch (err) {
    throw new Error(
      `Failed to map program "${r.name}" (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function toBlock(r: TauriBlockResponse): Block {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on block row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on block row', r)
  try {
    return {
      id: r.id,
      programId: r.program_id,
      name: r.name,
      ordinal: r.ordinal,
      durationWeeks: r.duration_weeks,
      blockType: blockTypeSchema.parse(r.block_type),
    }
  } catch (err) {
    throw new Error(
      `Failed to map block "${r.name}" (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function toBlockWeek(r: TauriBlockWeekResponse): BlockWeek {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on block_week row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on block_week row', r)
  return {
    id: r.id,
    blockId: r.block_id,
    weekNumber: r.week_number,
  }
}

function toScheduledSession(r: TauriScheduledSessionResponse): ScheduledSession {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on scheduled_session row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on scheduled_session row', r)
  try {
    let overrides: ScheduledSession['overrides']
    if (r.overrides != null) {
      try {
        const parsed = parseJson(r.overrides, 'overrides')
        overrides = sessionOverridesSchema.parse(parsed)
      } catch (err) {
        console.warn(
          `[tauri-adapter] Failed to parse overrides for scheduled session ${r.id}, falling back to undefined:`,
          err,
        )
        overrides = undefined
      }
    }
    return {
      id: r.id,
      blockWeekId: r.block_week_id,
      dayOfWeek: r.day_of_week ?? undefined,
      dayLabel: r.day_label,
      sessionType: sessionTypeSchema.parse(r.session_type),
      sessionTemplateId: r.session_template_id,
      notes: r.notes ?? undefined,
      overrides,
    }
  } catch (err) {
    throw new Error(
      `Failed to map scheduled session (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function toProgramActivation(r: TauriProgramActivationResponse): ProgramActivation {
  if (!r.created_at) console.warn('[tauri-adapter] null created_at on program_activation row', r)
  if (!r.updated_at) console.warn('[tauri-adapter] null updated_at on program_activation row', r)
  return {
    id: r.id,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
    userId: r.user_id,
    programId: r.program_id,
    currentBlockOrdinal: r.current_block_ordinal,
    currentWeekNumber: r.current_week_number,
    startDate: r.start_date,
  }
}

function toWeekStatus(r: TauriWeekStatusResponse): WeekStatus {
  return {
    id: r.id,
    activationId: r.activation_id,
    blockOrdinal: r.block_ordinal,
    weekNumber: r.week_number,
    status: weekStatusValueSchema.parse(r.status),
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Sharing domain mappers: Tauri Response -> Domain types (via sharing-mappers)
// ---------------------------------------------------------------------------

function toAccountabilityGroupRowFromTauri(r: TauriAccountabilityGroupResponse) {
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

function toGroupMemberRowFromTauri(r: TauriGroupMemberResponse) {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in GroupMember ${r.id}`)
  return {
    id: r.id,
    group_id: r.group_id,
    user_id: r.user_id,
    role: r.role as 'COACH' | 'MEMBER',
    share_history_before_join: intToBool(r.share_history_before_join, 'share_history_before_join'),
    joined_at: r.joined_at ?? new Date().toISOString(),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toGroupInviteRowFromTauri(r: TauriGroupInviteResponse) {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in GroupInvite ${r.id}`)
  return {
    id: r.id,
    group_id: r.group_id,
    code: r.code,
    created_by: r.created_by,
    expires_at: r.expires_at ?? new Date().toISOString(),
    is_active: intToBool(r.is_active, 'is_active'),
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

function toDirectConnectionRowFromTauri(r: TauriDirectConnectionResponse) {
  if (!r.created_at || !r.updated_at)
    console.warn(`[tauri-adapter] Null timestamp in DirectConnection ${r.id}`)
  return {
    id: r.id,
    requester_id: r.requester_id,
    recipient_id: r.recipient_id,
    status: r.status as 'PENDING' | 'ACTIVE' | 'DECLINED',
    requester_grants_write: intToBool(r.requester_grants_write, 'requester_grants_write'),
    recipient_grants_write: intToBool(r.recipient_grants_write, 'recipient_grants_write'),
    accepted_at: r.accepted_at,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Chat domain mappers: Tauri Response -> Domain types
// ---------------------------------------------------------------------------

function toConversation(
  r: TauriConversationResponse,
  participantUserIds: string[] = [],
): Conversation {
  try {
    return conversationSchema.parse({
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      type: r.type,
      title: r.title ?? undefined,
      groupId: r.group_id ?? undefined,
      participantUserIds,
    })
  } catch (err) {
    throw new Error(
      `Failed to map conversation (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function toMessage(r: TauriMessageResponse): Message {
  try {
    return messageSchema.parse({
      id: r.id,
      createdAt: r.created_at,
      conversationId: r.conversation_id,
      senderId: r.sender_id ?? undefined,
      messageType: r.message_type,
      content: r.content ?? undefined,
      syncStatus: r.sync_status ?? undefined,
    })
  } catch (err) {
    throw new Error(
      `Failed to map message (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function toMediaAttachment(r: TauriMediaAttachmentResponse): MediaAttachment {
  try {
    return {
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      messageId: r.message_id,
      provider: mediaProviderSchema.parse(r.provider),
      providerAssetId: r.provider_asset_id ?? undefined,
      mediaType: mediaTypeSchema.parse(r.media_type),
      originalFilename: r.original_filename ?? undefined,
      mimeType: r.mime_type ?? undefined,
      thumbnailUrl: r.thumbnail_url ?? undefined,
      playbackUrl: r.playback_url ?? undefined,
      durationSeconds: r.duration_seconds ?? undefined,
      fileSizeBytes: r.file_size_bytes ?? undefined,
      status: mediaStatusSchema.parse(r.status),
    }
  } catch (err) {
    throw new Error(
      `Failed to map media attachment (${r.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
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
    // Public scope requires an internet connection -- not available offline
    if (filters?.scope === 'public') {
      console.warn('[tauri-adapter] Public exercise browsing requires an internet connection')
      return []
    }

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

    let exercises = rows.map((r) => toExercise(r))

    // The Rust command does not filter by muscleGroup, so apply client-side
    // (mirrors SupabaseAdapter's behavior for search queries)
    if (filters?.muscleGroup) {
      exercises = exercises.filter((e) => e.muscleGroups.primary.includes(filters.muscleGroup!))
    }

    return exercises
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const row = await invokeCommand<TauriExerciseResponse | null>('get_exercise', { id })
    return row ? toExercise(row) : null
  }

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Exercise> {
    const partial = fromExercise(exercise)
    const input = {
      name: partial.name as string,
      aliases: partial.aliases != null ? JSON.stringify(partial.aliases) : null,
      category: partial.category as string,
      movement_pattern: (partial.movement_pattern as string | undefined) ?? null,
      muscle_groups: partial.muscle_groups != null ? JSON.stringify(partial.muscle_groups) : null,
      is_bilateral: (partial.is_bilateral as boolean | undefined) ?? null,
      supports_1rm: (partial.supports_1rm as boolean | undefined) ?? null,
      equipment_required:
        partial.equipment_required != null ? JSON.stringify(partial.equipment_required) : null,
    }

    const row = await invokeCommand<TauriExerciseResponse>('create_exercise', { exercise: input })
    return toExercise(row)
  }

  // ---------------------------------------------------------------------------
  // Workout log operations
  // ---------------------------------------------------------------------------

  async getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]> {
    const rows = await invokeCommand<TauriWorkoutLogResponse[]>('get_workout_logs', {
      user_id: userId,
      limit: limit ?? null,
    })
    return rows.map((r) => toWorkoutLog(r))
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
      log: toWorkoutLog(s.log),
      exerciseNames: s.exercise_names,
      setCount: s.set_count,
      exerciseCount: s.exercise_count,
    }))
  }

  async getWorkoutLog(id: string): Promise<WorkoutLog | null> {
    const row = await invokeCommand<TauriWorkoutLogResponse | null>('get_workout_log', { id })
    return row ? toWorkoutLog(row) : null
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
      log: toWorkoutLog(full.log),
      groups: full.groups.map((g) => toLoggedActivityGroup(g)),
      activities: full.activities.map((a) => toLoggedActivity(a)),
      sets: full.sets.map((s) => toLoggedSet(s)),
    }
  }

  async createWorkoutLog(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkoutLog> {
    if (log.pausedAt != null || (log.totalPausedMs ?? 0) > 0) {
      _warnPauseFieldsDroppedOnce()
    }
    const partial = fromWorkoutLog(log)
    const input = {
      user_id: partial.user_id as string,
      title: (partial.title as string | undefined) ?? null,
      started_at: isoToUnixSeconds(partial.started_at as string),
      completed_at: partial.completed_at ? isoToUnixSeconds(partial.completed_at as string) : null,
      session_template_id: (partial.session_template_id as string | undefined) ?? null,
      program_context:
        partial.program_context != null ? JSON.stringify(partial.program_context) : null,
      overall_notes: (partial.overall_notes as string | undefined) ?? null,
      note_tags: JSON.stringify(partial.note_tags ?? []),
      perceived_difficulty: (partial.perceived_difficulty as number | undefined) ?? null,
      bodyweight_at_session:
        partial.bodyweight_at_session != null
          ? JSON.stringify(partial.bodyweight_at_session)
          : null,
    }

    const row = await invokeCommand<TauriWorkoutLogResponse>('create_workout_log', { log: input })
    return toWorkoutLog(row)
  }

  async updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog> {
    if (log.pausedAt != null || (log.totalPausedMs ?? 0) > 0) {
      _warnPauseFieldsDroppedOnce()
    }
    const row = await invokeCommand<TauriWorkoutLogResponse>('update_workout_log', {
      id: log.id,
      title: log.title ?? null,
      completed_at: log.completedAt ? isoToUnixSeconds(log.completedAt) : null,
      overall_notes: log.overallNotes ?? null,
      note_tags: JSON.stringify(log.noteTags ?? []),
      perceived_difficulty: log.perceivedDifficulty ?? null,
    })
    return toWorkoutLog(row)
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
      workout_log_id: partial.workout_log_id as string,
      group_type: partial.group_type as string,
      ordinal: partial.ordinal as number,
      actual_rounds_completed: (partial.actual_rounds_completed as number | undefined) ?? null,
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
    return toLoggedActivityGroup(row)
  }

  async updateLoggedActivityGroup(
    group: LoggedActivityGroup,
    userId: string,
  ): Promise<LoggedActivityGroup> {
    const partial = fromLoggedActivityGroup(group, userId)
    const input = {
      id: group.id,
      workout_log_id: partial.workout_log_id as string,
      group_type: partial.group_type as string,
      ordinal: partial.ordinal as number,
      actual_rounds_completed: (partial.actual_rounds_completed as number | undefined) ?? null,
      completion_time:
        partial.completion_time != null ? JSON.stringify(partial.completion_time) : null,
    }

    const row = await invokeCommand<TauriLoggedActivityGroupResponse>(
      'update_logged_activity_group',
      {
        group: input,
        user_id: userId,
      },
    )
    return toLoggedActivityGroup(row)
  }

  async deleteLoggedActivityGroup(id: string): Promise<void> {
    await invokeCommand<void>('delete_logged_activity_group', { id })
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
      logged_group_id: partial.logged_group_id as string,
      exercise_id: partial.exercise_id as string,
      ordinal: partial.ordinal as number,
      notes: (partial.notes as string | undefined) ?? null,
      note_tags: JSON.stringify(partial.note_tags ?? []),
    }

    const row = await invokeCommand<TauriLoggedActivityResponse>('create_logged_activity', {
      activity: input,
      user_id: userId,
    })
    return toLoggedActivity(row)
  }

  async updateLoggedActivity(activity: LoggedActivity, userId: string): Promise<LoggedActivity> {
    const partial = fromLoggedActivity(activity, userId)
    const input = {
      id: activity.id,
      logged_group_id: partial.logged_group_id as string,
      exercise_id: partial.exercise_id as string,
      ordinal: partial.ordinal as number,
      notes: (partial.notes as string | undefined) ?? null,
      note_tags: JSON.stringify(partial.note_tags ?? []),
    }

    const row = await invokeCommand<TauriLoggedActivityResponse>('update_logged_activity', {
      activity: input,
      user_id: userId,
    })
    return toLoggedActivity(row)
  }

  async deleteLoggedActivity(id: string): Promise<void> {
    await invokeCommand<void>('delete_logged_activity', { id })
  }

  // ---------------------------------------------------------------------------
  // LoggedSet
  // ---------------------------------------------------------------------------

  async createLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Promise<LoggedSet> {
    const partial = fromLoggedSet(set, userId)
    const input = {
      logged_activity_id: partial.logged_activity_id as string,
      set_number: partial.set_number as number,
      set_type: partial.set_type as string,
      prescribed: partial.prescribed != null ? JSON.stringify(partial.prescribed) : null,
      actual_reps: (partial.actual_reps as number | undefined) ?? null,
      actual_weight: partial.actual_weight != null ? JSON.stringify(partial.actual_weight) : null,
      actual_duration:
        partial.actual_duration != null ? JSON.stringify(partial.actual_duration) : null,
      actual_distance:
        partial.actual_distance != null ? JSON.stringify(partial.actual_distance) : null,
      actual_pace: partial.actual_pace != null ? JSON.stringify(partial.actual_pace) : null,
      actual_heart_rate: (partial.actual_heart_rate as number | undefined) ?? null,
      ruck_load: partial.ruck_load != null ? JSON.stringify(partial.ruck_load) : null,
      elevation_gain:
        partial.elevation_gain != null ? JSON.stringify(partial.elevation_gain) : null,
      rpe: (partial.rpe as number | undefined) ?? null,
      completed: (partial.completed as boolean | undefined) ?? null,
    }

    const row = await invokeCommand<TauriLoggedSetResponse>('create_logged_set', {
      set: input,
      user_id: userId,
    })
    return toLoggedSet(row)
  }

  async updateLoggedSet(set: LoggedSet, userId: string): Promise<LoggedSet> {
    const partial = fromLoggedSet(set, userId)
    const input = {
      id: set.id,
      logged_activity_id: partial.logged_activity_id as string,
      set_number: partial.set_number as number,
      set_type: partial.set_type as string,
      prescribed: partial.prescribed != null ? JSON.stringify(partial.prescribed) : null,
      actual_reps: (partial.actual_reps as number | undefined) ?? null,
      actual_weight: partial.actual_weight != null ? JSON.stringify(partial.actual_weight) : null,
      actual_duration:
        partial.actual_duration != null ? JSON.stringify(partial.actual_duration) : null,
      actual_distance:
        partial.actual_distance != null ? JSON.stringify(partial.actual_distance) : null,
      actual_pace: partial.actual_pace != null ? JSON.stringify(partial.actual_pace) : null,
      actual_heart_rate: (partial.actual_heart_rate as number | undefined) ?? null,
      ruck_load: partial.ruck_load != null ? JSON.stringify(partial.ruck_load) : null,
      elevation_gain:
        partial.elevation_gain != null ? JSON.stringify(partial.elevation_gain) : null,
      rpe: (partial.rpe as number | undefined) ?? null,
      completed: (partial.completed as boolean | undefined) ?? null,
    }

    const row = await invokeCommand<TauriLoggedSetResponse>('update_logged_set', {
      set: input,
      user_id: userId,
    })
    return toLoggedSet(row)
  }

  async deleteLoggedSet(id: string): Promise<void> {
    await invokeCommand<void>('delete_logged_set', { id })
  }

  // ---------------------------------------------------------------------------
  // User profile operations
  // ---------------------------------------------------------------------------

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const row = await invokeCommand<TauriUserProfileResponse | null>('get_user_profile', {
      user_id: userId,
    })
    return row ? toUserProfile(row) : null
  }

  async updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    const partial = fromUserProfile(profile)
    // F018 (M10): `display_visible` was removed from the schema; the Rust
    // command and the SQLite migration on the Tauri side drop it in lockstep
    // (Wave 3b). We do not pass it here.
    const input = {
      id: partial.id as string,
      display_name: (partial.display_name as string | undefined) ?? null,
      preferred_units: (partial.preferred_units as string | undefined) ?? null,
      bodyweight: partial.bodyweight != null ? JSON.stringify(partial.bodyweight) : null,
      training_age: partial.training_age != null ? JSON.stringify(partial.training_age) : null,
      exercise_maxes:
        partial.exercise_maxes != null ? JSON.stringify(partial.exercise_maxes) : null,
      max_reps: partial.max_reps != null ? JSON.stringify(partial.max_reps) : null,
    }

    const row = await invokeCommand<TauriUserProfileResponse>('update_user_profile', {
      profile: input,
    })
    return toUserProfile(row)
  }

  async saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory> {
    const partial = fromOneRepMaxHistory(entry)
    const row = await invokeCommand<TauriOneRepMaxHistoryResponse>('save_one_rep_max', {
      user_id: partial.user_id as string,
      exercise_id: partial.exercise_id as string,
      weight: JSON.stringify(partial.weight),
      estimated: (partial.estimated as boolean | undefined) ?? null,
      recorded_at: isoToUnixSeconds(partial.recorded_at as string),
    })
    return toOneRepMaxHistory(row)
  }

  // ---------------------------------------------------------------------------
  // Exercise history operations
  // ---------------------------------------------------------------------------

  async getOneRepMaxHistory(userId: string, exerciseId: string): Promise<OneRepMaxHistory[]> {
    const rows = await invokeCommand<TauriOneRepMaxHistoryResponse[]>('get_one_rep_max_history', {
      user_id: userId,
      exercise_id: exerciseId,
    })
    return rows.map((r) => toOneRepMaxHistory(r))
  }

  async getRecentlyUsedExerciseIds(userId: string, limit = 10): Promise<string[]> {
    return invokeCommand<string[]>('get_recently_used_exercise_ids', {
      user_id: userId,
      limit,
    })
  }

  async getFrequentExerciseIds(
    userId: string,
    limit = 8,
    windowDays = 90,
  ): Promise<string[]> {
    return invokeCommand<string[]>('get_frequent_exercise_ids', {
      user_id: userId,
      limit,
      window_days: windowDays,
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
      log: toWorkoutLog(r.log),
      sets: r.sets.map((s) => toLoggedSet(s)),
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
        note_tags: JSON.stringify(log.noteTags ?? []),
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
            note_tags: JSON.stringify(a.activity.noteTags ?? []),
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
      log: toWorkoutLog(result.log),
      groups: result.groups.map((g) => toLoggedActivityGroup(g)),
      activities: result.activities.map((a) => toLoggedActivity(a)),
      sets: result.sets.map((s) => toLoggedSet(s)),
    }
  }

  // ---------------------------------------------------------------------------
  // Session template operations
  // ---------------------------------------------------------------------------

  async getSessionTemplates(
    userId: string,
    filters?: SessionTemplateFilters,
  ): Promise<SessionTemplate[]> {
    // Public scope requires an internet connection -- not available offline
    if (filters?.scope === 'public') {
      console.warn(
        '[tauri-adapter] Public session template browsing requires an internet connection',
      )
      return []
    }

    const rows = await invokeCommand<TauriSessionTemplateResponse[]>('get_session_templates', {
      user_id: userId,
    })

    let templates = rows.map((r) => toSessionTemplate(r))

    // Apply client-side filters for searchQuery and category
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase()
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      )
    }
    if (filters?.category) {
      templates = templates.filter((t) => t.category === filters.category)
    }

    return templates
  }

  async getSessionTemplate(id: string): Promise<SessionTemplate | null> {
    const row = await invokeCommand<TauriSessionTemplateResponse | null>('get_session_template', {
      id,
    })
    return row ? toSessionTemplate(row) : null
  }

  async getSessionTemplateFull(id: string): Promise<SessionTemplateFull | null> {
    const full = await invokeCommand<TauriSessionTemplateFull | null>('get_session_template_full', {
      id,
    })
    if (!full) return null

    return {
      template: toSessionTemplate(full.template),
      groups: full.groups.map((g) => toActivityGroupFlat(g)),
      activities: full.activities.map((a) => toActivity(a)),
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
      user_id: (partial.user_id as string | undefined) ?? null,
      name: partial.name as string,
      description: (partial.description as string | undefined) ?? null,
      category: partial.category as string,
      rest_between_groups: (partial.rest_between_groups as string | undefined) ?? null,
      time_cap: (partial.time_cap as string | undefined) ?? null,
      scoring: (partial.scoring as string | undefined) ?? null,
      is_public: (partial.is_public as boolean | undefined) ?? false,
    }

    const groupsInput = groups.map((g) => {
      const gPartial = fromActivityGroup(g.group)
      return {
        group: {
          group_type: gPartial.group_type as string,
          ordinal: gPartial.ordinal as number,
          rounds: (gPartial.rounds as number | undefined) ?? null,
          rest_between_rounds: (gPartial.rest_between_rounds as string | undefined) ?? null,
          rest_between_activities: (gPartial.rest_between_activities as string | undefined) ?? null,
        },
        activities: g.activities.map((a) => {
          const aPartial = fromActivity(a)
          return {
            exercise_id: aPartial.exercise_id as string,
            ordinal: aPartial.ordinal as number,
            set_scheme: aPartial.set_scheme as string,
            notes: (aPartial.notes as string | undefined) ?? null,
          }
        }),
      }
    })

    const result = await invokeCommand<TauriSessionTemplateFull>('create_session_template_full', {
      template: input,
      groups: groupsInput,
    })

    return {
      template: toSessionTemplate(result.template),
      groups: result.groups.map((g) => toActivityGroupFlat(g)),
      activities: result.activities.map((a) => toActivity(a)),
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
      user_id: (partial.user_id as string | undefined) ?? null,
      name: partial.name as string,
      description: (partial.description as string | undefined) ?? null,
      category: partial.category as string,
      rest_between_groups: (partial.rest_between_groups as string | undefined) ?? null,
      time_cap: (partial.time_cap as string | undefined) ?? null,
      scoring: (partial.scoring as string | undefined) ?? null,
      is_public: (partial.is_public as boolean | undefined) ?? false,
    }

    const groupsInput = groups.map((g) => {
      const gPartial = fromActivityGroup(g.group)
      return {
        group: {
          id: g.group.id || null,
          group_type: gPartial.group_type as string,
          ordinal: gPartial.ordinal as number,
          rounds: (gPartial.rounds as number | undefined) ?? null,
          rest_between_rounds: (gPartial.rest_between_rounds as string | undefined) ?? null,
          rest_between_activities: (gPartial.rest_between_activities as string | undefined) ?? null,
        },
        activities: g.activities.map((a) => {
          const aPartial = fromActivity(a)
          return {
            exercise_id: aPartial.exercise_id as string,
            ordinal: aPartial.ordinal as number,
            set_scheme: aPartial.set_scheme as string,
            notes: (aPartial.notes as string | undefined) ?? null,
          }
        }),
      }
    })

    const result = await invokeCommand<TauriSessionTemplateFull>('update_session_template_full', {
      template: input,
      groups: groupsInput,
    })

    return {
      template: toSessionTemplate(result.template),
      groups: result.groups.map((g) => toActivityGroupFlat(g)),
      activities: result.activities.map((a) => toActivity(a)),
      eventItems: [],
    }
  }

  async deleteSessionTemplate(id: string): Promise<void> {
    await invokeCommand<void>('delete_session_template', { id })
  }

  async touchSessionTemplateLastAssigned(id: string): Promise<void> {
    await invokeCommand<void>('touch_session_template_last_assigned', { id })
  }

  async cloneSessionTemplate(_id: string, _userId: string): Promise<SessionTemplateFull> {
    throw new Error('Not implemented in offline mode')
  }

  // ---------------------------------------------------------------------------
  // Public visibility operations (online-only -- require Supabase)
  // ---------------------------------------------------------------------------

  async publishProgram(_programId: string): Promise<void> {
    throw new Error('Publishing requires an internet connection')
  }

  async publishSessionTemplate(_templateId: string): Promise<void> {
    throw new Error('Publishing requires an internet connection')
  }

  async publishExercise(_exerciseId: string): Promise<void> {
    throw new Error('Publishing requires an internet connection')
  }

  async unpublishProgram(_programId: string): Promise<void> {
    throw new Error('Unpublishing requires an internet connection')
  }

  async unpublishSessionTemplate(_templateId: string): Promise<void> {
    throw new Error('Unpublishing requires an internet connection')
  }

  async unpublishExercise(_exerciseId: string): Promise<void> {
    throw new Error('Unpublishing requires an internet connection')
  }

  async clonePublicSessionTemplate(_templateId: string): Promise<string> {
    throw new Error('Cloning public templates requires an internet connection')
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

  async getPrograms(userId: string, filters?: ProgramFilters): Promise<Program[]> {
    // Public scope requires an internet connection -- not available offline
    if (filters?.scope === 'public') {
      console.warn('[tauri-adapter] Public program browsing requires an internet connection')
      return []
    }

    const rows = await invokeCommand<TauriProgramResponse[]>('get_programs', {
      user_id: userId,
    })

    let programs = rows.map((r) => toProgram(r))

    // Apply client-side filters for searchQuery and source
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase()
      programs = programs.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)),
      )
    }
    if (filters?.source) {
      programs = programs.filter((p) => p.source === filters.source)
    }

    return programs
  }

  async getProgramFull(id: string): Promise<ProgramFull | null> {
    const result = await invokeCommand<TauriProgramFullResponse | null>('get_program_full', { id })
    if (!result) return null
    return {
      program: toProgram(result.program),
      blocks: result.blocks.map((r) => toBlock(r)),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(r)),
      scheduledSessions: result.scheduled_sessions.map((r) => toScheduledSession(r)),
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
            overrides: s.overrides ? JSON.stringify(s.overrides) : null,
          })),
        })),
      })),
    }

    const result = await invokeCommand<TauriProgramFullResponse>('create_program_full', input)
    return {
      program: toProgram(result.program),
      blocks: result.blocks.map((r) => toBlock(r)),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(r)),
      scheduledSessions: result.scheduled_sessions.map((r) => toScheduledSession(r)),
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
            overrides: s.overrides ? JSON.stringify(s.overrides) : null,
          })),
        })),
      })),
    }

    const result = await invokeCommand<TauriProgramFullResponse>('update_program_full', input)
    return {
      program: toProgram(result.program),
      blocks: result.blocks.map((r) => toBlock(r)),
      blockWeeks: result.block_weeks.map((r) => toBlockWeek(r)),
      scheduledSessions: result.scheduled_sessions.map((r) => toScheduledSession(r)),
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
    return toProgram(row)
  }

  // ---------------------------------------------------------------------------
  // Program activation operations
  // ---------------------------------------------------------------------------

  async getActiveProgram(userId: string): Promise<ProgramActivation | null> {
    const row = await invokeCommand<TauriProgramActivationResponse | null>('get_active_program', {
      user_id: userId,
    })
    return row ? toProgramActivation(row) : null
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
    return toProgramActivation(row)
  }

  async updateActiveProgram(
    userId: string,
    updates: { currentBlockOrdinal?: number; currentWeekNumber?: number; startDate?: string },
  ): Promise<ProgramActivation> {
    const row = await invokeCommand<TauriProgramActivationResponse>('update_active_program', {
      user_id: userId,
      current_block_ordinal: updates.currentBlockOrdinal ?? null,
      current_week_number: updates.currentWeekNumber ?? null,
      start_date: updates.startDate ?? null,
    })
    return toProgramActivation(row)
  }

  async clearActiveProgram(userId: string): Promise<void> {
    await invokeCommand<void>('clear_active_program', { user_id: userId })
  }

  // ---------------------------------------------------------------------------
  // Week status operations (Program Time Travel)
  // ---------------------------------------------------------------------------

  async getWeekStatuses(activationId: string): Promise<WeekStatus[]> {
    const rows = await invokeCommand<TauriWeekStatusResponse[]>('get_week_statuses', {
      activation_id: activationId,
    })
    return rows.map((r) => toWeekStatus(r))
  }

  async upsertWeekStatuses(
    activationId: string,
    statuses: Array<{ blockOrdinal: number; weekNumber: number; status: WeekStatusValue }>,
  ): Promise<WeekStatus[]> {
    const rows = await invokeCommand<TauriWeekStatusResponse[]>('upsert_week_statuses', {
      activation_id: activationId,
      statuses,
    })
    return rows.map((r) => toWeekStatus(r))
  }

  async deleteWeekStatuses(
    activationId: string,
    keys: Array<{ blockOrdinal: number; weekNumber: number }>,
  ): Promise<void> {
    if (keys.length === 0) return
    await invokeCommand<void>('delete_week_statuses', {
      activation_id: activationId,
      keys,
    })
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
  // Gym operations (F018 -- online-only per Tech.md D14)
  //
  // Gyms are an online concept: the publisher only matters when there is a
  // live Supabase Realtime channel to broadcast on. Reads return empty
  // collections so offline UI renders gracefully (the picker shows only the
  // Private option) but log a one-line warn so the empty result is not
  // mistaken for "no gyms exist on this instance." Writes throw a distinct
  // `OnlineRequiredError` (P14-003) so mutation hooks can surface an
  // "Offline mode" banner instead of a generic failure message.
  // ---------------------------------------------------------------------------

  async listUserGyms(_userId: string): Promise<Gym[]> {
    console.warn(
      '[tauri-adapter] listUserGyms called in offline mode; returning empty (gyms require online)',
    )
    return []
  }

  async listAllGyms(): Promise<Gym[]> {
    console.warn(
      '[tauri-adapter] listAllGyms called in offline mode; returning empty (gyms require online)',
    )
    return []
  }

  async getGym(_gymId: string): Promise<Gym | null> {
    console.warn(
      '[tauri-adapter] getGym called in offline mode; returning null (gyms require online)',
    )
    return null
  }

  async createGym(_input: { name: string }): Promise<Gym> {
    throw new OnlineRequiredError('createGym')
  }

  async updateGym(_input: Partial<Gym> & { id: string }): Promise<Gym> {
    throw new OnlineRequiredError('updateGym')
  }

  async deleteGym(_gymId: string): Promise<void> {
    throw new OnlineRequiredError('deleteGym')
  }

  async joinGym(_gymId: string): Promise<void> {
    throw new OnlineRequiredError('joinGym')
  }

  async leaveGym(_gymId: string): Promise<void> {
    throw new OnlineRequiredError('leaveGym')
  }

  async kickGymMember(_gymId: string, _userId: string): Promise<void> {
    throw new OnlineRequiredError('kickGymMember')
  }

  async listGymMembers(_gymId: string): Promise<GymMember[]> {
    console.warn(
      '[tauri-adapter] listGymMembers called in offline mode; returning empty (gyms require online)',
    )
    return []
  }

  // ---------------------------------------------------------------------------
  // Gym invite + ownership transfer operations (F021) — all require online
  // ---------------------------------------------------------------------------

  async listGymMemberCounts(): Promise<GymMemberCount[]> {
    console.warn('[tauri-adapter] listGymMemberCounts called in offline mode; returning empty')
    return []
  }

  async createGymInvite(
    _gymId: string,
    _options?: { expiresAt?: string; maxUses?: number },
  ): Promise<GymInvitation> {
    throw new OnlineRequiredError('createGymInvite')
  }

  async listGymInvites(_gymId: string): Promise<GymInvitation[]> {
    console.warn('[tauri-adapter] listGymInvites called in offline mode; returning empty')
    return []
  }

  async redeemGymInvite(
    _token: string,
  ): Promise<{ ok: true; gymId: string } | { ok: false; error: RedeemInviteError }> {
    throw new OnlineRequiredError('redeemGymInvite')
  }

  async proposeGymTransfer(_gymId: string, _targetUserId: string): Promise<void> {
    throw new OnlineRequiredError('proposeGymTransfer')
  }

  async acceptGymTransfer(_gymId: string): Promise<void> {
    throw new OnlineRequiredError('acceptGymTransfer')
  }

  async cancelOrDeclineGymTransfer(_gymId: string): Promise<void> {
    throw new OnlineRequiredError('cancelOrDeclineGymTransfer')
  }

  async getPendingTransfer(_gymId: string): Promise<GymOwnershipTransfer | null> {
    return null
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
    if (recipientId.includes('@')) {
      throw new Error(
        'Email lookup requires an internet connection. Please use the user ID instead.',
      )
    }

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
    const createUserIds = result.participants.filter((p) => p.left_at == null).map((p) => p.user_id)
    return toConversation(result.conversation, createUserIds)
  }

  async getConversations(): Promise<Conversation[]> {
    const results = await invokeCommand<TauriConversationWithParticipants[]>('get_conversations', {
      user_id: this.userId,
    })
    return results.map((r) => {
      const userIds = r.participants.filter((p) => p.left_at == null).map((p) => p.user_id)
      return toConversation(r.conversation, userIds)
    })
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const result = await invokeCommand<TauriConversationWithParticipants | null>(
      'get_conversation',
      { id },
    )
    if (!result) return null
    const userIds = result.participants.filter((p) => p.left_at == null).map((p) => p.user_id)
    return toConversation(result.conversation, userIds)
  }

  async findDirectConversation(otherUserId: string): Promise<Conversation | null> {
    const result = await invokeCommand<TauriConversationWithParticipants | null>(
      'find_direct_conversation',
      { user_id: this.userId, other_user_id: otherUserId },
    )
    if (!result) return null
    const userIds = result.participants.filter((p) => p.left_at == null).map((p) => p.user_id)
    return toConversation(result.conversation, userIds)
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
    return toMessage(row)
  }

  async getMessages(
    conversationId: string,
    options: { before?: string; limit: number },
  ): Promise<Message[]> {
    const before = options.before
      ? Math.floor(new Date(options.before).getTime() / 1000)
      : undefined
    const rows = await invokeCommand<TauriMessageResponse[]>('get_messages', {
      conversation_id: conversationId,
      before,
      limit: options.limit,
    })
    return rows.map((r) => toMessage(r))
  }

  async getMessagesSince(conversationId: string, since: string): Promise<Message[]> {
    const sinceEpoch = Math.floor(new Date(since).getTime() / 1000)
    const rows = await invokeCommand<TauriMessageResponse[]>('get_messages_since', {
      conversation_id: conversationId,
      since: sinceEpoch,
    })
    return rows.map((r) => toMessage(r))
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
    return toMediaAttachment(row)
  }

  async getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]> {
    if (messageIds.length === 0) return []

    const rows = await invokeCommand<TauriMediaAttachmentResponse[]>('get_media_attachments', {
      message_ids: messageIds,
    })
    return rows.map((r) => toMediaAttachment(r))
  }

  async updateMediaAttachment(
    _attachmentId: string,
    _updates: Partial<
      Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>
    >,
  ): Promise<MediaAttachment> {
    // Media status updates come from the webhook edge function which uses
    // SupabaseAdapter. The Tauri offline path uses save_media_attachment
    // (INSERT OR REPLACE) for full upserts instead of partial updates.
    throw new Error('updateMediaAttachment is not supported in offline mode')
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
