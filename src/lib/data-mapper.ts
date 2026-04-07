import { z } from 'zod'

/**
 * Safely parse a value that may be a JSON string or an already-parsed object.
 * Supabase PostgREST returns JSONB columns as objects, but the Tauri SQLite
 * adapter returns them as strings. This handles both cases.
 */
function parseJsonOrValue(value: string | object): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value
}

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
  WeekStatus,
  ShareLink,
  EventItem,
  Conversation,
  ConversationParticipant,
  Message,
  MediaAttachment,
  Gym,
  GymMember,
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
  sessionTypeSchema,
  scoringTypeSchema,
  setSchemeSchema,
  programSourceSchema,
  blockTypeSchema,
  sessionOverridesSchema,
  weekStatusValueSchema,
  shareableEntityTypeSchema,
  shareTokenSchema,
  eventMetadataSchema,
  conversationSchema,
  conversationParticipantSchema,
  messageSchema,
  mediaProviderSchema,
  mediaTypeSchema,
  mediaStatusSchema,
  gymSchema,
  gymMemberSchema,
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
  ProgramWeekStatusRow,
  ShareLinkRow,
  EventItemRow,
  ConversationRow,
  ConversationParticipantRow,
  MessageRow,
  MediaAttachmentRow,
  GymRow,
  GymMemberRow,
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
    isPublic: row.is_public,
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
    is_public: exercise.isPublic,
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
    eventMetadata:
      row.event_metadata != null ? eventMetadataSchema.parse(row.event_metadata) : undefined,
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
    event_metadata: log.eventMetadata ?? null,
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
// Gym (F018, Tech.md D1) -- a physical place where lifting happens.
// ---------------------------------------------------------------------------

export function toGym(row: GymRow): Gym {
  // P14-039: defense in depth -- the row types declare these as non-null,
  // but a future migration that introduces a nullable column would silently
  // produce malformed Gym objects. Warn at the adapter boundary so the
  // failure is observable.
  if (row.id == null || row.name == null || row.owner_user_id == null) {
    console.warn('[data-mapper] toGym: missing required fields', row)
  }
  // P14-005: parse through the schema so a future Postgres migration that
  // loosens column constraints (or returns over-long names from a stale
  // view) cannot silently ship malformed Gym objects through the app. The
  // try/catch matches the convention used by toConversation/toMessage.
  try {
    return gymSchema.parse({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      name: row.name,
      ownerUserId: row.owner_user_id,
      isDefault: row.is_default,
    })
  } catch (err) {
    console.error('[data-mapper] Failed to map gym row:', err, row)
    throw new Error(`Failed to map gym row (id=${row.id}): ${(err as Error).message}`)
  }
}

export function fromGym(gym: Partial<Gym>): Partial<GymRow> {
  const row: Partial<GymRow> = {}

  if (gym.id !== undefined) row.id = gym.id
  if (gym.name !== undefined) row.name = gym.name
  if (gym.ownerUserId !== undefined) row.owner_user_id = gym.ownerUserId
  if (gym.isDefault !== undefined) row.is_default = gym.isDefault
  if (gym.createdAt !== undefined) row.created_at = gym.createdAt
  if (gym.updatedAt !== undefined) row.updated_at = gym.updatedAt

  return row
}

// ---------------------------------------------------------------------------
// GymMember (F018, Tech.md D1) -- M:N join row between a user and a gym.
// No `id` -- composite (gym_id, user_id) is the primary key.
// ---------------------------------------------------------------------------

export function toGymMember(row: GymMemberRow): GymMember {
  if (row.gym_id == null || row.user_id == null) {
    console.warn('[data-mapper] toGymMember: missing required fields', row)
  }
  // P14-005: parse through the schema for the same reason as toGym -- a
  // schema-drift event must surface as a loud failure rather than a silently
  // malformed object propagating through the app.
  try {
    return gymMemberSchema.parse({
      gymId: row.gym_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
    })
  } catch (err) {
    console.error('[data-mapper] Failed to map gym_member row:', err, row)
    throw new Error(
      `Failed to map gym_member row (gym=${row.gym_id}, user=${row.user_id}): ${(err as Error).message}`,
    )
  }
}

export function fromGymMember(member: Partial<GymMember>): Partial<GymMemberRow> {
  const row: Partial<GymMemberRow> = {}

  if (member.gymId !== undefined) row.gym_id = member.gymId
  if (member.userId !== undefined) row.user_id = member.userId
  if (member.joinedAt !== undefined) row.joined_at = member.joinedAt

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

// ---------------------------------------------------------------------------
// SessionTemplate
// ---------------------------------------------------------------------------

export function toSessionTemplate(row: SessionTemplateRow): SessionTemplate {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    category: sessionTypeSchema.parse(row.category),
    restBetweenGroups:
      row.rest_between_groups != null
        ? durationSchema.parse(parseJsonOrValue(row.rest_between_groups))
        : undefined,
    timeCap:
      row.time_cap != null ? durationSchema.parse(parseJsonOrValue(row.time_cap)) : undefined,
    scoring: scoringTypeSchema.parse(row.scoring),
    eventMetadata:
      row.event_metadata != null
        ? eventMetadataSchema.parse(parseJsonOrValue(row.event_metadata))
        : undefined,
    lastAssignedAt: row.last_assigned_at ?? undefined,
    isPublic: row.is_public,
  }
}

export function fromSessionTemplate(
  template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<SessionTemplateRow> {
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

// ---------------------------------------------------------------------------
// ActivityGroup (flat -- without nested activities)
// ---------------------------------------------------------------------------

export function toActivityGroupFlat(row: ActivityGroupRow): Omit<ActivityGroup, 'activities'> {
  return {
    id: row.id,
    sessionTemplateId: row.session_template_id,
    groupType: groupTypeSchema.parse(row.group_type),
    ordinal: row.ordinal,
    rounds: row.rounds ?? undefined,
    restBetweenRounds:
      row.rest_between_rounds != null
        ? durationSchema.parse(parseJsonOrValue(row.rest_between_rounds))
        : undefined,
    restBetweenActivities:
      row.rest_between_activities != null
        ? durationSchema.parse(parseJsonOrValue(row.rest_between_activities))
        : undefined,
  }
}

export function fromActivityGroup(
  group: Omit<ActivityGroup, 'activities'> | Omit<ActivityGroup, 'id' | 'activities'>,
  templateId?: string,
): Partial<ActivityGroupRow> {
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

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    activityGroupId: row.activity_group_id,
    exerciseId: row.exercise_id,
    ordinal: row.ordinal,
    setScheme: setSchemeSchema.parse(parseJsonOrValue(row.set_scheme)),
    notes: row.notes ?? undefined,
  }
}

export function fromActivity(
  activity: Omit<Activity, 'id'> | Omit<Activity, 'id' | 'activityGroupId'>,
  groupId?: string,
): Partial<ActivityRow> {
  return {
    activity_group_id:
      groupId ?? ('activityGroupId' in activity ? activity.activityGroupId : undefined),
    exercise_id: activity.exerciseId,
    ordinal: activity.ordinal,
    set_scheme: JSON.stringify(activity.setScheme),
    notes: activity.notes ?? null,
  }
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export function toProgram(row: ProgramRow): Program {
  try {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
      name: row.name,
      description: row.description ?? undefined,
      source: programSourceSchema.parse(row.source),
      durationWeeks: row.duration_weeks ?? undefined,
      isPublic: row.is_public,
      createdBy: row.created_by ?? row.user_id,
    }
  } catch (err) {
    throw new Error(
      `Failed to map program "${row.name}" (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromProgram(
  program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<ProgramRow> {
  return {
    user_id: program.userId,
    name: program.name,
    description: program.description ?? null,
    source: program.source,
    duration_weeks: program.durationWeeks ?? null,
    is_public: program.isPublic,
    created_by: program.createdBy ?? null,
  }
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

export function toBlock(row: BlockRow): Block {
  try {
    return {
      id: row.id,
      programId: row.program_id,
      name: row.name,
      ordinal: row.ordinal,
      durationWeeks: row.duration_weeks,
      blockType: blockTypeSchema.parse(row.block_type),
    }
  } catch (err) {
    throw new Error(
      `Failed to map block "${row.name}" (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromBlock(
  block: Omit<Block, 'id'> | Omit<Block, 'id' | 'programId'>,
  programId?: string,
): Partial<BlockRow> {
  return {
    program_id: programId ?? ('programId' in block ? block.programId : undefined),
    name: block.name,
    ordinal: block.ordinal,
    duration_weeks: block.durationWeeks,
    block_type: block.blockType,
  }
}

// ---------------------------------------------------------------------------
// BlockWeek
// ---------------------------------------------------------------------------

export function toBlockWeek(row: BlockWeekRow): BlockWeek {
  return {
    id: row.id,
    blockId: row.block_id,
    weekNumber: row.week_number,
  }
}

export function fromBlockWeek(
  week: Omit<BlockWeek, 'id'> | Omit<BlockWeek, 'id' | 'blockId'>,
  blockId?: string,
): Partial<BlockWeekRow> {
  return {
    block_id: blockId ?? ('blockId' in week ? week.blockId : undefined),
    week_number: week.weekNumber,
  }
}

// ---------------------------------------------------------------------------
// ScheduledSession
// ---------------------------------------------------------------------------

export function toScheduledSession(row: ScheduledSessionRow): ScheduledSession {
  try {
    let overrides: ScheduledSession['overrides']
    if (row.overrides != null) {
      try {
        const parsed = typeof row.overrides === 'string' ? JSON.parse(row.overrides) : row.overrides
        overrides = sessionOverridesSchema.parse(parsed)
      } catch (err) {
        console.warn(
          `[data-mapper] Failed to parse overrides for scheduled session ${row.id}, falling back to undefined:`,
          err,
        )
        overrides = undefined
      }
    }

    return {
      id: row.id,
      blockWeekId: row.block_week_id,
      dayOfWeek: row.day_of_week ?? undefined,
      dayLabel: row.day_label,
      sessionType: sessionTypeSchema.parse(row.session_type),
      sessionTemplateId: row.session_template_id,
      notes: row.notes ?? undefined,
      overrides,
    }
  } catch (err) {
    throw new Error(
      `Failed to map scheduled session (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromScheduledSession(
  session: Omit<ScheduledSession, 'id'> | Omit<ScheduledSession, 'id' | 'blockWeekId'>,
  blockWeekId?: string,
): Partial<ScheduledSessionRow> {
  return {
    block_week_id: blockWeekId ?? ('blockWeekId' in session ? session.blockWeekId : undefined),
    day_of_week: session.dayOfWeek ?? null,
    day_label: session.dayLabel,
    session_type: session.sessionType,
    session_template_id: session.sessionTemplateId,
    notes: session.notes ?? null,
    overrides: session.overrides ?? null,
  }
}

// ---------------------------------------------------------------------------
// ProgramActivation
// ---------------------------------------------------------------------------

export function toProgramActivation(row: ProgramActivationRow): ProgramActivation {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
    programId: row.program_id,
    currentBlockOrdinal: row.current_block_ordinal,
    currentWeekNumber: row.current_week_number,
    startDate: row.start_date,
  }
}

export function fromProgramActivation(
  activation: Omit<ProgramActivation, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<ProgramActivationRow> {
  return {
    user_id: activation.userId,
    program_id: activation.programId,
    current_block_ordinal: activation.currentBlockOrdinal,
    current_week_number: activation.currentWeekNumber,
    start_date: activation.startDate,
  }
}

// ---------------------------------------------------------------------------
// WeekStatus (Program Time Travel)
// ---------------------------------------------------------------------------

export function toWeekStatus(row: ProgramWeekStatusRow): WeekStatus {
  return {
    id: row.id,
    activationId: row.activation_id,
    blockOrdinal: row.block_ordinal,
    weekNumber: row.week_number,
    status: weekStatusValueSchema.parse(row.status),
    createdAt: row.created_at,
  }
}

export function fromWeekStatus(
  status: Omit<WeekStatus, 'id' | 'createdAt'>,
): Partial<ProgramWeekStatusRow> {
  return {
    activation_id: status.activationId,
    block_ordinal: status.blockOrdinal,
    week_number: status.weekNumber,
    status: status.status,
  }
}

// ---------------------------------------------------------------------------
// ShareLink
// ---------------------------------------------------------------------------

export function toShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    token: shareTokenSchema.parse(row.token),
    entityType: shareableEntityTypeSchema.parse(row.entity_type),
    entityId: row.entity_id,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function fromShareLink(link: Partial<ShareLink>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (link.token !== undefined) row.token = link.token
  if (link.entityType !== undefined) row.entity_type = link.entityType
  if (link.entityId !== undefined) row.entity_id = link.entityId
  if (link.createdBy !== undefined) row.created_by = link.createdBy
  if (link.isActive !== undefined) row.is_active = link.isActive
  return row
}

// ---------------------------------------------------------------------------
// EventItem
// ---------------------------------------------------------------------------

export function toEventItem(row: EventItemRow): EventItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessionTemplateId: row.session_template_id ?? undefined,
    workoutLogId: row.workout_log_id ?? undefined,
    userId: row.user_id,
    name: row.name,
    category: row.category ?? undefined,
    quantity: row.quantity,
    isPacked: row.is_packed,
    sortOrder: row.sort_order,
    notes: row.notes ?? undefined,
  }
}

export function fromEventItem(
  item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
  parentId: string,
  parentType: 'template' | 'log',
): Partial<EventItemRow> {
  return {
    session_template_id: parentType === 'template' ? parentId : null,
    workout_log_id: parentType === 'log' ? parentId : null,
    user_id: item.userId,
    name: item.name,
    category: item.category ?? null,
    quantity: item.quantity,
    is_packed: item.isPacked,
    sort_order: item.sortOrder,
    notes: item.notes ?? null,
  }
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export function toConversation(
  row: ConversationRow,
  participantUserIds: string[] = [],
): Conversation {
  try {
    return conversationSchema.parse({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      type: row.type,
      title: row.title ?? undefined,
      groupId: row.group_id ?? undefined,
      participantUserIds,
    })
  } catch (err) {
    throw new Error(
      `Failed to map conversation (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromConversation(
  conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'participantUserIds'>,
): Partial<ConversationRow> {
  return {
    type: conversation.type,
    title: conversation.title ?? null,
    group_id: conversation.groupId ?? null,
  }
}

// ---------------------------------------------------------------------------
// ConversationParticipant
// ---------------------------------------------------------------------------

export function toConversationParticipant(
  row: ConversationParticipantRow,
): ConversationParticipant {
  try {
    return conversationParticipantSchema.parse({
      id: row.id,
      createdAt: row.joined_at,
      updatedAt: row.last_read_at ?? row.joined_at,
      conversationId: row.conversation_id,
      userId: row.user_id,
      lastReadAt: row.last_read_at ?? undefined,
      isArchived: row.is_archived,
      joinedAt: row.joined_at,
      leftAt: row.left_at ?? undefined,
    })
  } catch (err) {
    throw new Error(
      `Failed to map conversation participant (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromConversationParticipant(
  participant: Omit<ConversationParticipant, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<ConversationParticipantRow> {
  return {
    conversation_id: participant.conversationId,
    user_id: participant.userId,
    last_read_at: participant.lastReadAt ?? null,
    is_archived: participant.isArchived,
    joined_at: participant.joinedAt,
    left_at: participant.leftAt ?? null,
  }
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export function toMessage(row: MessageRow): Message {
  try {
    return messageSchema.parse({
      id: row.id,
      createdAt: row.created_at,
      conversationId: row.conversation_id,
      senderId: row.sender_id ?? undefined,
      messageType: row.message_type,
      content: row.content ?? undefined,
      syncStatus: row.sync_status ?? undefined,
    })
  } catch (err) {
    throw new Error(
      `Failed to map message (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromMessage(message: Omit<Message, 'id' | 'createdAt'>): Partial<MessageRow> {
  return {
    conversation_id: message.conversationId,
    sender_id: message.senderId ?? null,
    message_type: message.messageType,
    content: message.content ?? null,
    sync_status: message.syncStatus ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// MediaAttachment
// ---------------------------------------------------------------------------

export function toMediaAttachment(row: MediaAttachmentRow): MediaAttachment {
  try {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageId: row.message_id,
      provider: mediaProviderSchema.parse(row.provider),
      providerAssetId: row.provider_asset_id ?? undefined,
      mediaType: mediaTypeSchema.parse(row.media_type),
      originalFilename: row.original_filename ?? undefined,
      mimeType: row.mime_type ?? undefined,
      thumbnailUrl: row.thumbnail_url ?? undefined,
      playbackUrl: row.playback_url ?? undefined,
      durationSeconds: row.duration_seconds ?? undefined,
      fileSizeBytes: row.file_size_bytes ?? undefined,
      status: mediaStatusSchema.parse(row.status),
    }
  } catch (err) {
    throw new Error(
      `Failed to map media attachment (${row.id}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export function fromMediaAttachment(
  attachment: Omit<MediaAttachment, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<MediaAttachmentRow> {
  return {
    message_id: attachment.messageId,
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
  }
}
