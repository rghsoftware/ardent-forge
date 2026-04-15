import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DataAdapter,
  ExerciseFilters,
  ProgramFilters,
  SessionTemplateFilters,
  ProgramFull,
  SessionTemplateFull,
  VaultSummary,
  WorkoutLogSummary,
  ActivityFeedOptions,
  GroupActivityFeedEntry,
  ConnectionActivityFeedEntry,
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
  WeekStatus,
  WeekStatusValue,
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
  Gym,
  GymMember,
  GymInvitation,
  GymMemberCount,
  GymOwnershipTransfer,
  RedeemInviteError,
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
import type { WorkoutLogRow } from './database.types'
import { camelizeKeys, parseJsonOrValue } from './adapter-utils'
import {
  toAccountabilityGroup,
  toGroupMember,
  toGroupInvite,
  toDirectConnection,
} from './sharing-mappers'

export class SupabaseAdapter implements DataAdapter {
  private client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  private async getCurrentUserId(): Promise<string> {
    const {
      data: { user },
    } = await this.client.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    return user.id
  }

  // ---------------------------------------------------------------------------
  // Private read-path mappers (DB row -> domain type)
  // ---------------------------------------------------------------------------

  private mapExercise(raw: Record<string, unknown>): Exercise {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        name: r.name as string,
        aliases: z.array(z.string()).parse(r.aliases),
        category: exerciseCategorySchema.parse(r.category),
        movementPattern: movementPatternSchema.parse(r.movementPattern),
        muscleGroups: muscleGroupSpecSchema.parse(r.muscleGroups),
        isBilateral: r.isBilateral as boolean,
        supports1RM: raw['supports_1rm'] as boolean,
        equipmentRequired: z.array(equipmentSchema).parse(r.equipmentRequired),
        isCustom: r.isCustom as boolean,
        isPublic: r.isPublic as boolean,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map exercise:', err, raw)
      throw new Error(
        `Failed to map exercise (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapWorkoutLog(raw: Record<string, unknown>): WorkoutLog {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        userId: r.userId as string,
        title: (r.title ?? undefined) as string | undefined,
        startedAt: r.startedAt as string,
        completedAt: (r.completedAt ?? undefined) as string | undefined,
        sessionTemplateId: (r.sessionTemplateId ?? undefined) as string | undefined,
        programContext:
          r.programContext != null ? programContextSchema.parse(r.programContext) : undefined,
        perceivedDifficulty: (r.perceivedDifficulty ?? undefined) as number | undefined,
        bodyweightAtSession:
          r.bodyweightAtSession != null ? weightSchema.parse(r.bodyweightAtSession) : undefined,
        overallNotes: (r.overallNotes ?? undefined) as string | undefined,
        noteTags:
          Array.isArray(r.noteTags) && (r.noteTags as unknown[]).length > 0
            ? (r.noteTags as string[])
            : undefined,
        eventMetadata:
          r.eventMetadata != null ? eventMetadataSchema.parse(r.eventMetadata) : undefined,
        pausedAt: (r.pausedAt ?? undefined) as string | undefined,
        totalPausedMs: (r.totalPausedMs ?? 0) as number,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map workout_log:', err, raw)
      throw new Error(
        `Failed to map workout_log (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapLoggedActivityGroup(raw: Record<string, unknown>): LoggedActivityGroup {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        workoutLogId: r.workoutLogId as string,
        groupType: groupTypeSchema.parse(r.groupType),
        ordinal: r.ordinal as number,
        actualRoundsCompleted: (r.actualRoundsCompleted ?? undefined) as number | undefined,
        completionTime:
          r.completionTime != null ? durationSchema.parse(r.completionTime) : undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map logged_activity_group:', err, raw)
      throw new Error(
        `Failed to map logged_activity_group (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapLoggedActivity(raw: Record<string, unknown>): LoggedActivity {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        loggedGroupId: r.loggedGroupId as string,
        exerciseId: r.exerciseId as string,
        ordinal: r.ordinal as number,
        notes: (r.notes ?? undefined) as string | undefined,
        noteTags:
          Array.isArray(r.noteTags) && (r.noteTags as unknown[]).length > 0
            ? (r.noteTags as string[])
            : undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map logged_activity:', err, raw)
      throw new Error(
        `Failed to map logged_activity (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapLoggedSet(raw: Record<string, unknown>): LoggedSet {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        loggedActivityId: r.loggedActivityId as string,
        setNumber: r.setNumber as number,
        setType: setTypeSchema.parse(r.setType),
        prescribed: r.prescribed != null ? prescriptionSchema.parse(r.prescribed) : undefined,
        actualReps: (r.actualReps ?? undefined) as number | undefined,
        actualWeight: r.actualWeight != null ? weightSchema.parse(r.actualWeight) : undefined,
        actualDuration:
          r.actualDuration != null ? durationSchema.parse(r.actualDuration) : undefined,
        actualDistance:
          r.actualDistance != null ? distanceSchema.parse(r.actualDistance) : undefined,
        actualPace: r.actualPace != null ? paceSchema.parse(r.actualPace) : undefined,
        actualHeartRate: (r.actualHeartRate ?? undefined) as number | undefined,
        rpe: (r.rpe ?? undefined) as number | undefined,
        completed: r.completed as boolean,
        ruckLoad: r.ruckLoad != null ? weightSchema.parse(r.ruckLoad) : undefined,
        elevationGain: r.elevationGain != null ? distanceSchema.parse(r.elevationGain) : undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map logged_set:', err, raw)
      throw new Error(
        `Failed to map logged_set (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapUserProfile(raw: Record<string, unknown>): UserProfile {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        displayName: (r.displayName ?? undefined) as string | undefined,
        preferredUnits: preferredUnitsSchema.parse(r.preferredUnits),
        bodyweight: r.bodyweight != null ? weightSchema.parse(r.bodyweight) : undefined,
        trainingAge: r.trainingAge != null ? durationSchema.parse(r.trainingAge) : undefined,
        exerciseMaxes:
          r.exerciseMaxes != null ? z.record(entityId, oneRepMaxSchema).parse(r.exerciseMaxes) : {},
        maxReps:
          r.maxReps != null ? z.record(entityId, z.number().int().positive()).parse(r.maxReps) : {},
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map user_profile:', err, raw)
      throw new Error(
        `Failed to map user_profile (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapGym(raw: Record<string, unknown>): Gym {
    const r = camelizeKeys(raw)
    try {
      return gymSchema.parse({
        id: r.id,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        name: r.name,
        ownerUserId: r.ownerUserId,
      })
    } catch (err) {
      console.error('[supabase-adapter] Failed to map gym row:', err, raw)
      throw new Error(
        `Failed to map gym row (id=${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapGymMember(raw: Record<string, unknown>): GymMember {
    const r = camelizeKeys(raw)
    try {
      return gymMemberSchema.parse({
        gymId: r.gymId,
        userId: r.userId,
        joinedAt: r.joinedAt,
      })
    } catch (err) {
      console.error('[supabase-adapter] Failed to map gym_member row:', err, raw)
      throw new Error(
        `Failed to map gym_member row (gym=${r.gymId as string}, user=${r.userId as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapOneRepMaxHistory(raw: Record<string, unknown>): OneRepMaxHistory {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        userId: r.userId as string,
        exerciseId: r.exerciseId as string,
        weight: weightSchema.parse(r.weight),
        estimated: r.estimated as boolean,
        recordedAt: r.recordedAt as string,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map one_rep_max_history:', err, raw)
      throw new Error(
        `Failed to map one_rep_max_history (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapSessionTemplate(raw: Record<string, unknown>): SessionTemplate {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        userId: r.userId as string,
        name: r.name as string,
        description: (r.description ?? undefined) as string | undefined,
        category: sessionTypeSchema.parse(r.category),
        restBetweenGroups:
          r.restBetweenGroups != null
            ? durationSchema.parse(
                parseJsonOrValue(r.restBetweenGroups as string | object, 'restBetweenGroups'),
              )
            : undefined,
        timeCap:
          r.timeCap != null
            ? durationSchema.parse(parseJsonOrValue(r.timeCap as string | object, 'timeCap'))
            : undefined,
        scoring: scoringTypeSchema.parse(r.scoring),
        eventMetadata:
          r.eventMetadata != null
            ? eventMetadataSchema.parse(
                parseJsonOrValue(r.eventMetadata as string | object, 'eventMetadata'),
              )
            : undefined,
        lastAssignedAt: (r.lastAssignedAt ?? undefined) as string | undefined,
        isPublic: r.isPublic as boolean,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map session_template:', err, raw)
      throw new Error(
        `Failed to map session_template (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapActivityGroupFlat(raw: Record<string, unknown>): Omit<ActivityGroup, 'activities'> {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        sessionTemplateId: r.sessionTemplateId as string,
        groupType: groupTypeSchema.parse(r.groupType),
        ordinal: r.ordinal as number,
        rounds: (r.rounds ?? undefined) as number | undefined,
        restBetweenRounds:
          r.restBetweenRounds != null
            ? durationSchema.parse(
                parseJsonOrValue(r.restBetweenRounds as string | object, 'restBetweenRounds'),
              )
            : undefined,
        restBetweenActivities:
          r.restBetweenActivities != null
            ? durationSchema.parse(
                parseJsonOrValue(
                  r.restBetweenActivities as string | object,
                  'restBetweenActivities',
                ),
              )
            : undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map activity_group_flat:', err, raw)
      throw new Error(
        `Failed to map activity_group_flat (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapActivity(raw: Record<string, unknown>): Activity {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        activityGroupId: r.activityGroupId as string,
        exerciseId: r.exerciseId as string,
        ordinal: r.ordinal as number,
        setScheme: setSchemeSchema.parse(
          parseJsonOrValue(r.setScheme as string | object, 'setScheme'),
        ),
        notes: (r.notes ?? undefined) as string | undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map activity:', err, raw)
      throw new Error(
        `Failed to map activity (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapProgram(raw: Record<string, unknown>): Program {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        userId: r.userId as string,
        name: r.name as string,
        description: (r.description ?? undefined) as string | undefined,
        source: programSourceSchema.parse(r.source),
        durationWeeks: (r.durationWeeks ?? undefined) as number | undefined,
        isPublic: r.isPublic as boolean,
        createdBy: (r.createdBy ?? r.userId) as string,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map program:', err, raw)
      throw new Error(
        `Failed to map program "${r.name as string}" (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapBlock(raw: Record<string, unknown>): Block {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        programId: r.programId as string,
        name: r.name as string,
        ordinal: r.ordinal as number,
        durationWeeks: r.durationWeeks as number,
        blockType: blockTypeSchema.parse(r.blockType),
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map block:', err, raw)
      throw new Error(
        `Failed to map block "${r.name as string}" (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapBlockWeek(raw: Record<string, unknown>): BlockWeek {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        blockId: r.blockId as string,
        weekNumber: r.weekNumber as number,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map block_week:', err, raw)
      throw new Error(
        `Failed to map block_week (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapScheduledSession(raw: Record<string, unknown>): ScheduledSession {
    const r = camelizeKeys(raw)
    try {
      let overrides: ScheduledSession['overrides']
      if (r.overrides != null) {
        try {
          const parsed = parseJsonOrValue(r.overrides as string | object, 'overrides')
          overrides = sessionOverridesSchema.parse(parsed)
        } catch (err) {
          if (err instanceof z.ZodError) {
            console.error(
              `[supabase-adapter] overrides schema validation failed for session ${r.id as string}. Data integrity issue:`,
              err,
            )
          } else {
            console.warn(
              `[supabase-adapter] Failed to parse overrides JSON for session ${r.id as string}, falling back to undefined:`,
              err,
            )
          }
          overrides = undefined
        }
      }
      return {
        id: r.id as string,
        blockWeekId: r.blockWeekId as string,
        dayOfWeek: (r.dayOfWeek ?? undefined) as number | undefined,
        dayLabel: r.dayLabel as string,
        sessionType: sessionTypeSchema.parse(r.sessionType),
        sessionTemplateId: r.sessionTemplateId as string,
        notes: (r.notes ?? undefined) as string | undefined,
        overrides,
      }
    } catch (err) {
      throw new Error(`Failed to map scheduled session (${r.id as string})`, { cause: err })
    }
  }

  private mapProgramActivation(raw: Record<string, unknown>): ProgramActivation {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        userId: r.userId as string,
        programId: r.programId as string,
        currentBlockOrdinal: r.currentBlockOrdinal as number,
        currentWeekNumber: r.currentWeekNumber as number,
        startDate: r.startDate as string,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map program_activation:', err, raw)
      throw new Error(
        `Failed to map program_activation (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapWeekStatus(raw: Record<string, unknown>): WeekStatus {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        activationId: r.activationId as string,
        blockOrdinal: r.blockOrdinal as number,
        weekNumber: r.weekNumber as number,
        status: weekStatusValueSchema.parse(r.status),
        createdAt: r.createdAt as string,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map week_status:', err, raw)
      throw new Error(
        `Failed to map week_status (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapShareLink(raw: Record<string, unknown>): ShareLink {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        token: shareTokenSchema.parse(r.token),
        entityType: shareableEntityTypeSchema.parse(r.entityType),
        entityId: r.entityId as string,
        createdBy: r.createdBy as string,
        isActive: r.isActive as boolean,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map share_link:', err, raw)
      throw new Error(
        `Failed to map share_link (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapEventItem(raw: Record<string, unknown>): EventItem {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        sessionTemplateId: (r.sessionTemplateId ?? undefined) as string | undefined,
        workoutLogId: (r.workoutLogId ?? undefined) as string | undefined,
        userId: r.userId as string,
        name: r.name as string,
        category: (r.category ?? undefined) as string | undefined,
        quantity: r.quantity as number,
        isPacked: r.isPacked as boolean,
        sortOrder: r.sortOrder as number,
        notes: (r.notes ?? undefined) as string | undefined,
      }
    } catch (err) {
      console.error('[supabase-adapter] Failed to map event_item:', err, raw)
      throw new Error(
        `Failed to map event_item (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapConversation(
    raw: Record<string, unknown>,
    participantUserIds: string[] = [],
  ): Conversation {
    const r = camelizeKeys(raw)
    try {
      return conversationSchema.parse({
        id: r.id,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        type: r.type,
        title: r.title ?? undefined,
        groupId: r.groupId ?? undefined,
        participantUserIds,
      })
    } catch (err) {
      throw new Error(
        `Failed to map conversation (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapConversationParticipant(raw: Record<string, unknown>): ConversationParticipant {
    const r = camelizeKeys(raw)
    try {
      return conversationParticipantSchema.parse({
        id: r.id,
        createdAt: r.joinedAt,
        updatedAt: r.lastReadAt ?? r.joinedAt,
        conversationId: r.conversationId,
        userId: r.userId,
        lastReadAt: r.lastReadAt ?? undefined,
        isArchived: r.isArchived,
        joinedAt: r.joinedAt,
        leftAt: r.leftAt ?? undefined,
      })
    } catch (err) {
      throw new Error(
        `Failed to map conversation participant (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapMessage(raw: Record<string, unknown>): Message {
    const r = camelizeKeys(raw)
    try {
      return messageSchema.parse({
        id: r.id,
        createdAt: r.createdAt,
        conversationId: r.conversationId,
        senderId: r.senderId ?? undefined,
        messageType: r.messageType,
        content: r.content ?? undefined,
        syncStatus: r.syncStatus ?? undefined,
      })
    } catch (err) {
      throw new Error(
        `Failed to map message (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private mapMediaAttachment(raw: Record<string, unknown>): MediaAttachment {
    const r = camelizeKeys(raw)
    try {
      return {
        id: r.id as string,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        messageId: r.messageId as string,
        provider: mediaProviderSchema.parse(r.provider),
        providerAssetId: (r.providerAssetId ?? undefined) as string | undefined,
        mediaType: mediaTypeSchema.parse(r.mediaType),
        originalFilename: (r.originalFilename ?? undefined) as string | undefined,
        mimeType: (r.mimeType ?? undefined) as string | undefined,
        thumbnailUrl: (r.thumbnailUrl ?? undefined) as string | undefined,
        playbackUrl: (r.playbackUrl ?? undefined) as string | undefined,
        durationSeconds: (r.durationSeconds ?? undefined) as number | undefined,
        fileSizeBytes: (r.fileSizeBytes ?? undefined) as number | undefined,
        status: mediaStatusSchema.parse(r.status),
      }
    } catch (err) {
      throw new Error(
        `Failed to map media attachment (${r.id as string}): ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Exercise operations
  // ---------------------------------------------------------------------------

  async getExercises(filters?: ExerciseFilters): Promise<Exercise[]> {
    const isPublicScope = filters?.scope === 'public'

    // For public scope, use a direct query instead of the RPC since the RPC
    // may be scoped to the current user's exercises.
    if (filters?.searchQuery && !isPublicScope) {
      const { data, error } = await this.client.rpc('search_exercises', {
        query_text: filters.searchQuery,
      })
      if (error) throw error

      let exercises = (data as unknown as Record<string, unknown>[]).map((r) => this.mapExercise(r))

      if (filters.category) {
        exercises = exercises.filter((e) => e.category === filters.category)
      }
      if (filters.movementPattern) {
        exercises = exercises.filter((e) => e.movementPattern === filters.movementPattern)
      }
      if (filters.muscleGroup) {
        exercises = exercises.filter((e) => e.muscleGroups.primary.includes(filters.muscleGroup!))
      }
      if (filters.isCustom !== undefined) {
        exercises = exercises.filter((e) => e.isCustom === filters.isCustom)
      }

      return exercises.sort((a, b) => a.name.localeCompare(b.name))
    }

    // Direct table query with column filters
    let query = this.client.from('exercises').select('*')

    if (isPublicScope) {
      // Public scope: show public custom exercises from all users
      query = query.eq('is_public', true).eq('is_custom', true)
    }

    if (filters?.searchQuery) {
      query = query.ilike('name', `%${filters.searchQuery}%`)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.movementPattern) {
      query = query.eq('movement_pattern', filters.movementPattern)
    }
    if (filters?.muscleGroup) {
      query = query.contains('muscle_groups', { primary: [filters.muscleGroup] })
    }
    if (filters?.isCustom !== undefined && !isPublicScope) {
      query = query.eq('is_custom', filters.isCustom)
    }

    const { data, error } = await query.order('name')
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapExercise(r))
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const { data, error } = await this.client
      .from('exercises')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapExercise(data as unknown as Record<string, unknown>) : null
  }

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Exercise> {
    const userId = await this.getCurrentUserId()
    // RLS policy blocks non-custom inserts from client; force is_custom: true as defense-in-depth
    const row = {
      name: exercise.name,
      aliases: exercise.aliases,
      category: exercise.category,
      movement_pattern: exercise.movementPattern,
      muscle_groups: exercise.muscleGroups,
      is_bilateral: exercise.isBilateral,
      supports_1rm: exercise.supports1RM,
      equipment_required: exercise.equipmentRequired,
      is_custom: true,
      is_public: exercise.isPublic,
      user_id: userId,
    }

    const { data, error } = await this.client.from('exercises').insert(row).select().single()
    if (error) throw error
    return this.mapExercise(data as unknown as Record<string, unknown>)
  }

  // ---------------------------------------------------------------------------
  // Workout log operations
  // ---------------------------------------------------------------------------

  async getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]> {
    let query = this.client
      .from('workout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapWorkoutLog(r))
  }

  async getWorkoutLogsSummary(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkoutLogSummary[]> {
    let query = this.client
      .from('workout_logs')
      .select(
        '*, logged_activity_groups(logged_activities(exercises(name), logged_sets(id, completed)))',
      )
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
    }

    const { data, error } = await query
    if (error) throw error

    // Shape returned by the nested PostgREST select
    type NestedRow = WorkoutLogRow & {
      logged_activity_groups: Array<{
        logged_activities: Array<{
          exercises: { name: string } | null
          logged_sets: Array<{ id: string; completed: boolean }>
        }>
      }>
    }
    const rows = data as unknown as NestedRow[]

    return rows.map((row) => {
      const exerciseNameSet = new Set<string>()
      let setCount = 0

      for (const group of row.logged_activity_groups) {
        for (const activity of group.logged_activities) {
          if (activity.exercises?.name) {
            exerciseNameSet.add(activity.exercises.name)
          }
          for (const set of activity.logged_sets) {
            if (set.completed) {
              setCount++
            }
          }
        }
      }

      return {
        log: this.mapWorkoutLog(row as unknown as Record<string, unknown>),
        exerciseNames: Array.from(exerciseNameSet),
        setCount,
        exerciseCount: exerciseNameSet.size,
      }
    })
  }

  async getWorkoutLog(id: string): Promise<WorkoutLog | null> {
    const { data, error } = await this.client
      .from('workout_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapWorkoutLog(data as unknown as Record<string, unknown>) : null
  }

  async getWorkoutLogFull(id: string): Promise<{
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  } | null> {
    const { data: logData, error: logError } = await this.client
      .from('workout_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (logError) throw logError
    if (!logData) return null

    const { data: groupData, error: groupError } = await this.client
      .from('logged_activity_groups')
      .select('*')
      .eq('workout_log_id', id)
      .order('ordinal')
    if (groupError) throw groupError
    const groups = (groupData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapLoggedActivityGroup(r),
    )
    const groupIds = groups.map((g) => g.id)

    if (groupIds.length === 0) {
      return {
        log: this.mapWorkoutLog(logData as unknown as Record<string, unknown>),
        groups,
        activities: [],
        sets: [],
      }
    }

    const { data: actData, error: actError } = await this.client
      .from('logged_activities')
      .select('*')
      .in('logged_group_id', groupIds)
      .order('ordinal')
    if (actError) throw actError
    const activities = (actData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapLoggedActivity(r),
    )
    const activityIds = activities.map((a) => a.id)

    if (activityIds.length === 0) {
      return {
        log: this.mapWorkoutLog(logData as unknown as Record<string, unknown>),
        groups,
        activities,
        sets: [],
      }
    }

    const { data: setData, error: setError } = await this.client
      .from('logged_sets')
      .select('*')
      .in('logged_activity_id', activityIds)
      .order('set_number')
    if (setError) throw setError
    const sets = (setData as unknown as Record<string, unknown>[]).map((r) => this.mapLoggedSet(r))

    return {
      log: this.mapWorkoutLog(logData as unknown as Record<string, unknown>),
      groups,
      activities,
      sets,
    }
  }

  async createWorkoutLog(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkoutLog> {
    const row = {
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
      event_metadata: log.eventMetadata ?? null,
      paused_at: log.pausedAt ?? null,
      total_paused_ms: log.totalPausedMs ?? 0,
    }

    const { data, error } = await this.client.from('workout_logs').insert(row).select().single()
    if (error) throw error
    return this.mapWorkoutLog(data as unknown as Record<string, unknown>)
  }

  async updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog> {
    const row = {
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
      event_metadata: log.eventMetadata ?? null,
      paused_at: log.pausedAt ?? null,
      total_paused_ms: log.totalPausedMs ?? 0,
    }

    const { data, error } = await this.client
      .from('workout_logs')
      .update(row)
      .eq('id', log.id)
      .select()
      .single()
    if (error) throw error
    return this.mapWorkoutLog(data as unknown as Record<string, unknown>)
  }

  async deleteWorkoutLog(id: string): Promise<void> {
    const { error } = await this.client.from('workout_logs').delete().eq('id', id)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // LoggedActivityGroup
  // ---------------------------------------------------------------------------

  async createLoggedActivityGroup(
    group: Omit<LoggedActivityGroup, 'id'>,
    userId: string,
  ): Promise<LoggedActivityGroup> {
    const row = {
      workout_log_id: group.workoutLogId,
      user_id: userId,
      group_type: group.groupType,
      ordinal: group.ordinal,
      actual_rounds_completed: group.actualRoundsCompleted ?? null,
      completion_time: group.completionTime ?? null,
    }

    const { data, error } = await this.client
      .from('logged_activity_groups')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return this.mapLoggedActivityGroup(data as unknown as Record<string, unknown>)
  }

  // ---------------------------------------------------------------------------
  // LoggedActivity
  // ---------------------------------------------------------------------------

  async createLoggedActivity(
    activity: Omit<LoggedActivity, 'id'>,
    userId: string,
  ): Promise<LoggedActivity> {
    const row = {
      logged_group_id: activity.loggedGroupId,
      user_id: userId,
      exercise_id: activity.exerciseId,
      ordinal: activity.ordinal,
      notes: activity.notes ?? null,
      note_tags: activity.noteTags ?? [],
    }

    const { data, error } = await this.client
      .from('logged_activities')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return this.mapLoggedActivity(data as unknown as Record<string, unknown>)
  }

  // ---------------------------------------------------------------------------
  // LoggedSet
  // ---------------------------------------------------------------------------

  async createLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Promise<LoggedSet> {
    const row = {
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

    const { data, error } = await this.client.from('logged_sets').insert(row).select().single()
    if (error) throw error
    return this.mapLoggedSet(data as unknown as Record<string, unknown>)
  }

  async updateLoggedSet(set: LoggedSet, userId: string): Promise<LoggedSet> {
    const row = {
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

    const { data, error } = await this.client
      .from('logged_sets')
      .update(row)
      .eq('id', set.id)
      .select()
      .single()
    if (error) throw error
    return this.mapLoggedSet(data as unknown as Record<string, unknown>)
  }

  async deleteLoggedSet(id: string): Promise<void> {
    try {
      const { error } = await this.client.from('logged_sets').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] deleteLoggedSet failed:', { id, err })
      throw err
    }
  }

  async updateLoggedActivity(activity: LoggedActivity, userId: string): Promise<LoggedActivity> {
    const row = {
      logged_group_id: activity.loggedGroupId,
      user_id: userId,
      exercise_id: activity.exerciseId,
      ordinal: activity.ordinal,
      notes: activity.notes ?? null,
      note_tags: activity.noteTags ?? [],
    }

    const { data, error } = await this.client
      .from('logged_activities')
      .update(row)
      .eq('id', activity.id)
      .select()
      .single()
    if (error) throw error
    return this.mapLoggedActivity(data as unknown as Record<string, unknown>)
  }

  async deleteLoggedActivity(id: string): Promise<void> {
    try {
      const { error } = await this.client.from('logged_activities').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] deleteLoggedActivity failed:', { id, err })
      throw err
    }
  }

  async updateLoggedActivityGroup(
    group: LoggedActivityGroup,
    userId: string,
  ): Promise<LoggedActivityGroup> {
    const row = {
      workout_log_id: group.workoutLogId,
      user_id: userId,
      group_type: group.groupType,
      ordinal: group.ordinal,
      actual_rounds_completed: group.actualRoundsCompleted ?? null,
      completion_time: group.completionTime ?? null,
    }

    const { data, error } = await this.client
      .from('logged_activity_groups')
      .update(row)
      .eq('id', group.id)
      .select()
      .single()
    if (error) throw error
    return this.mapLoggedActivityGroup(data as unknown as Record<string, unknown>)
  }

  async deleteLoggedActivityGroup(id: string): Promise<void> {
    try {
      const { error } = await this.client.from('logged_activity_groups').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] deleteLoggedActivityGroup failed:', { id, err })
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // User profile operations
  // ---------------------------------------------------------------------------

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapUserProfile(data as unknown as Record<string, unknown>) : null
  }

  async updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    const row: Record<string, unknown> = { id: profile.id }
    if (profile.displayName !== undefined) row.display_name = profile.displayName ?? null
    if (profile.preferredUnits !== undefined) row.preferred_units = profile.preferredUnits
    if (profile.bodyweight !== undefined) row.bodyweight = profile.bodyweight ?? null
    if (profile.trainingAge !== undefined) row.training_age = profile.trainingAge ?? null
    if (profile.exerciseMaxes !== undefined) row.exercise_maxes = profile.exerciseMaxes
    if (profile.maxReps !== undefined) row.max_reps = profile.maxReps

    const { data, error } = await this.client
      .from('user_profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    return this.mapUserProfile(data as unknown as Record<string, unknown>)
  }

  async saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory> {
    const row = {
      user_id: entry.userId,
      exercise_id: entry.exerciseId,
      weight: entry.weight,
      estimated: entry.estimated,
      recorded_at: entry.recordedAt,
    }

    const { data, error } = await this.client
      .from('one_rep_max_history')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return this.mapOneRepMaxHistory(data as unknown as Record<string, unknown>)
  }

  // ---------------------------------------------------------------------------
  // Gym operations (F018 -- Gym-Scoped Displays)
  //
  // Backed by the `gyms` and `gym_members` tables created in F018 Wave 2.
  // RLS policies enforce ownership and membership; this layer just maps
  // results through toGym / toGymMember and surfaces errors verbatim.
  // ---------------------------------------------------------------------------

  async listUserGyms(userId: string): Promise<Gym[]> {
    // Join shape: pull rows from gym_members for the given user, embedding
    // the related gyms row via PostgREST resource embedding. With a foreign
    // key on gym_members.gym_id -> gyms.id, PostgREST returns the embed as a
    // single object (not an array). We flat-map and filter any null embeds
    // defensively (RLS shouldn't allow a member row whose parent gym is
    // unreadable, but defense in depth).
    //
    // Cast through `unknown` because PostgREST's generic infers the embed as
    // an array shape by default; the actual runtime payload for a to-one FK
    // is a single object.
    const { data, error } = await this.client
      .from('gym_members')
      .select('gyms(*)')
      .eq('user_id', userId)

    if (error) throw error

    const rows = (data ?? []) as unknown as Array<{ gyms: Record<string, unknown> | null }>
    return rows.flatMap((r) => (r.gyms ? [this.mapGym(r.gyms)] : []))
  }

  async listAllGyms(): Promise<Gym[]> {
    const { data, error } = await this.client
      .from('gyms')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []).map((row) => this.mapGym(row as unknown as Record<string, unknown>))
  }

  async getGym(gymId: string): Promise<Gym | null> {
    const { data, error } = await this.client.from('gyms').select('*').eq('id', gymId).maybeSingle()

    if (error) throw error
    return data ? this.mapGym(data as unknown as Record<string, unknown>) : null
  }

  async createGym(input: { name: string }): Promise<Gym> {
    const userId = await this.getCurrentUserId()

    // The RLS insert policy enforces owner_user_id = auth.uid(); we set it
    // explicitly here as defense in depth and to match the existing
    // createGroup convention.
    const row = {
      name: input.name,
      owner_user_id: userId,
    }

    const { data, error } = await this.client.from('gyms').insert(row).select().single()
    if (error) throw error
    return this.mapGym(data as unknown as Record<string, unknown>)
  }

  async updateGym(input: Partial<Gym> & { id: string }): Promise<Gym> {
    // Strip id from the update payload (Postgres enforces primary key) but
    // use it for the WHERE clause. Owner-only enforcement is RLS-side.
    const { id, ...rest } = input
    const patch: Record<string, unknown> = {}
    if (rest.name !== undefined) patch.name = rest.name
    if (rest.ownerUserId !== undefined) patch.owner_user_id = rest.ownerUserId

    const { data, error } = await this.client
      .from('gyms')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return this.mapGym(data as unknown as Record<string, unknown>)
  }

  async deleteGym(gymId: string): Promise<void> {
    const { error } = await this.client.from('gyms').delete().eq('id', gymId)
    if (error) throw error
  }

  async joinGym(gymId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    const { error } = await this.client
      .from('gym_members')
      .insert({ gym_id: gymId, user_id: userId })

    if (error) throw error
  }

  async leaveGym(gymId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    const { error } = await this.client
      .from('gym_members')
      .delete()
      .eq('gym_id', gymId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async kickGymMember(gymId: string, userId: string): Promise<void> {
    // RLS enforces that only the gym owner can delete a non-self membership.
    const { error } = await this.client
      .from('gym_members')
      .delete()
      .eq('gym_id', gymId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async listGymMembers(gymId: string): Promise<GymMember[]> {
    const { data, error } = await this.client
      .from('gym_members')
      .select('*')
      .eq('gym_id', gymId)
      .order('joined_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map((row) => this.mapGymMember(row as unknown as Record<string, unknown>))
  }

  // ---------------------------------------------------------------------------
  // Gym membership explicit (F021)
  //
  // Member counts via the `gym_member_counts` view (kills the N+1 over the
  // browse list); invite lifecycle (`create_gym_invite`, `redeem_gym_invite`)
  // and ownership transfers (`propose_gym_transfer`, `accept_gym_transfer`,
  // `cancel_or_decline_gym_transfer`) all routed through `security definer`
  // RPCs. See ADR-015-invite-token-redemption-via-rpc and Tech.md.
  // ---------------------------------------------------------------------------

  /**
   * Returns one (gymId, memberCount) row per gym visible to the caller, via
   * the `gym_member_counts` view (security_invoker = true so RLS on the
   * underlying `gyms` / `gym_members` tables carries through).
   */
  async listGymMemberCounts(): Promise<GymMemberCount[]> {
    const { data, error } = await this.client.from('gym_member_counts').select('*')

    if (error) {
      console.error('[supabase-adapter] listGymMemberCounts failed:', error)
      throw error
    }

    // The view exposes nullable columns because Postgres views are typed
    // optimistically; in practice these are always populated.
    const rows = (data ?? []) as unknown as Array<{
      gym_id: string | null
      member_count: number | null
    }>
    return rows.flatMap((r) =>
      r.gym_id == null || r.member_count == null
        ? []
        : [{ gymId: r.gym_id, memberCount: r.member_count }],
    )
  }

  /**
   * Owner-only. Creates an invite via the `create_gym_invite` RPC. The token
   * is generated server-side from `pgcrypto` -- never log it on this path.
   */
  async createGymInvite(
    gymId: string,
    options: { expiresAt?: string; maxUses?: number } = {},
  ): Promise<GymInvitation> {
    const { data, error } = await this.client.rpc('create_gym_invite', {
      p_gym_id: gymId,
      p_expires_at: options.expiresAt,
      p_max_uses: options.maxUses,
    })

    if (error) {
      console.error('[supabase-adapter] createGymInvite failed:', { gymId, err: error })
      throw error
    }

    const r = camelizeKeys(data as unknown as Record<string, unknown>)
    return {
      id: r.id as string,
      gymId: r.gymId as string,
      token: r.token as string,
      expiresAt: r.expiresAt as string,
      maxUses: r.maxUses as number,
      usesCount: r.usesCount as number,
      createdBy: r.createdBy as string,
      createdAt: r.createdAt as string,
    }
  }

  /**
   * Owner-only. Lists active invites for a gym (RLS hides them from
   * non-owners). Tokens are returned so the owner UI can render the share
   * link, but they MUST NOT be logged from this layer.
   */
  async listGymInvites(gymId: string): Promise<GymInvitation[]> {
    const { data, error } = await this.client
      .from('gym_invitations')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[supabase-adapter] listGymInvites failed:', { gymId, err: error })
      throw error
    }

    return (data ?? []).map((row) => {
      const r = camelizeKeys(row as unknown as Record<string, unknown>)
      return {
        id: r.id as string,
        gymId: r.gymId as string,
        token: r.token as string,
        expiresAt: r.expiresAt as string,
        maxUses: r.maxUses as number,
        usesCount: r.usesCount as number,
        createdBy: r.createdBy as string,
        createdAt: r.createdAt as string,
      }
    })
  }

  /**
   * Redeems an invite token via the `redeem_gym_invite` RPC. Returns a
   * discriminated result -- callers branch on `result.ok`. Distinct
   * validation failures (`invalid` / `expired` / `exhausted`) are surfaced
   * as a structured error so the UI can render targeted messaging without
   * substring matching. Network / unexpected errors bubble up so the
   * caller can render a generic "try again" state.
   *
   * NEVER log the raw token on any path. The thrown PostgrestError is
   * logged with the invite-related context only (no token).
   */
  async redeemGymInvite(
    token: string,
  ): Promise<{ ok: true; gymId: string } | { ok: false; error: RedeemInviteError }> {
    const { data, error } = await this.client.rpc('redeem_gym_invite', { p_token: token })

    if (error) {
      const message = error.message ?? ''
      if (message.startsWith('INVITE_INVALID')) {
        return { ok: false, error: { kind: 'invalid' } }
      }
      if (message.startsWith('INVITE_EXPIRED')) {
        return { ok: false, error: { kind: 'expired' } }
      }
      if (message.startsWith('INVITE_EXHAUSTED')) {
        return { ok: false, error: { kind: 'exhausted' } }
      }
      // Network / unexpected -- bubble up. Do NOT include the token in logs.
      console.error('[supabase-adapter] redeemGymInvite failed:', error)
      throw error
    }

    return { ok: true, gymId: data as string }
  }

  /**
   * Owner-only. Proposes ownership transfer to a current gym member. The
   * RPC enforces that the target is an existing `gym_members` row and is
   * not the caller; conflicts on the single-pending invariant supersede
   * the prior pending row inside the RPC.
   */
  async proposeGymTransfer(gymId: string, targetUserId: string): Promise<void> {
    const { error } = await this.client.rpc('propose_gym_transfer', {
      p_gym_id: gymId,
      p_target_user_id: targetUserId,
    })

    if (error) {
      console.error('[supabase-adapter] proposeGymTransfer failed:', {
        gymId,
        targetUserId,
        err: error,
      })
      throw error
    }
  }

  /**
   * Target-only. Accepts a pending ownership transfer; the RPC flips
   * `gyms.owner_user_id` and deletes the pending row in one transaction.
   */
  async acceptGymTransfer(gymId: string): Promise<void> {
    const { error } = await this.client.rpc('accept_gym_transfer', { p_gym_id: gymId })

    if (error) {
      console.error('[supabase-adapter] acceptGymTransfer failed:', { gymId, err: error })
      throw error
    }
  }

  /**
   * Owner OR target may call. Cancels (owner) or declines (target) the
   * pending transfer. The RPC asserts caller party-membership before
   * deleting the row.
   */
  async cancelOrDeclineGymTransfer(gymId: string): Promise<void> {
    const { error } = await this.client.rpc('cancel_or_decline_gym_transfer', {
      p_gym_id: gymId,
    })

    if (error) {
      console.error('[supabase-adapter] cancelOrDeclineGymTransfer failed:', {
        gymId,
        err: error,
      })
      throw error
    }
  }

  /**
   * Returns the pending ownership transfer for a gym, or null if none.
   * RLS scopes visibility to `proposed_by` and `proposed_to` only.
   */
  async getPendingTransfer(gymId: string): Promise<GymOwnershipTransfer | null> {
    const { data, error } = await this.client
      .from('gym_ownership_transfers')
      .select('*')
      .eq('gym_id', gymId)
      .maybeSingle()

    if (error) {
      console.error('[supabase-adapter] getPendingTransfer failed:', { gymId, err: error })
      throw error
    }

    if (!data) return null
    const r = camelizeKeys(data as unknown as Record<string, unknown>)
    return {
      gymId: r.gymId as string,
      proposedBy: r.proposedBy as string,
      proposedTo: r.proposedTo as string,
      proposedAt: r.proposedAt as string,
    }
  }

  // ---------------------------------------------------------------------------
  // Exercise history operations
  // ---------------------------------------------------------------------------

  async getOneRepMaxHistory(userId: string, exerciseId: string): Promise<OneRepMaxHistory[]> {
    const { data, error } = await this.client
      .from('one_rep_max_history')
      .select('*')
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId)
      .order('recorded_at', { ascending: true })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapOneRepMaxHistory(r))
  }

  async getRecentlyUsedExerciseIds(userId: string, limit = 10): Promise<string[]> {
    // Join path: logged_activities -> logged_activity_groups -> workout_logs
    // (there is no direct FK from logged_activities to workout_logs)
    const { data, error } = await this.client
      .from('logged_activities')
      .select('exercise_id, logged_activity_groups!inner(workout_logs!inner(user_id, started_at))')
      .eq('logged_activity_groups.workout_logs.user_id', userId)
      .order('started_at', {
        ascending: false,
        referencedTable: 'logged_activity_groups.workout_logs',
      })
      .limit(limit * 5) // fetch more to account for deduplication
    if (error) throw error

    // Deduplicate exercise_ids preserving most-recent-first order
    const seen = new Set<string>()
    const uniqueIds: string[] = []
    for (const row of data as Array<{ exercise_id: string }>) {
      if (!seen.has(row.exercise_id)) {
        seen.add(row.exercise_id)
        uniqueIds.push(row.exercise_id)
      }
      if (uniqueIds.length >= limit) break
    }

    return uniqueIds
  }

  async getExerciseWorkoutHistory(
    userId: string,
    exerciseId: string,
    limit = 10,
  ): Promise<{ log: WorkoutLog; sets: LoggedSet[] }[]> {
    // Same two-hop join as getRecentlyUsedExerciseIds: activities -> groups -> logs
    const { data, error } = await this.client
      .from('logged_activities')
      .select(
        'id, exercise_id, logged_group_id, logged_activity_groups!inner(workout_log_id, workout_logs!inner(*)), logged_sets(*)',
      )
      .eq('exercise_id', exerciseId)
      .eq('logged_activity_groups.workout_logs.user_id', userId)
      .order('started_at', {
        ascending: false,
        referencedTable: 'logged_activity_groups.workout_logs',
      })
      .limit(limit)
    if (error) throw error

    // Supabase returns !inner joins as a single object, but the inferred generic
    // types use an array.  Cast through unknown to the actual runtime shape.
    type ActivityWithJoins = {
      id: string
      exercise_id: string
      logged_group_id: string
      logged_activity_groups: {
        workout_log_id: string
        workout_logs: Record<string, unknown>
      }
      logged_sets: Record<string, unknown>[]
    }
    const rows = data as unknown as ActivityWithJoins[]

    // Group by workout_log_id and map to domain types
    const grouped = new Map<string, { log: WorkoutLog; sets: LoggedSet[] }>()

    for (const row of rows) {
      const logId = row.logged_activity_groups.workout_log_id
      if (!grouped.has(logId)) {
        grouped.set(logId, {
          log: this.mapWorkoutLog(row.logged_activity_groups.workout_logs),
          sets: [],
        })
      }
      const entry = grouped.get(logId)!
      for (const setRow of row.logged_sets) {
        entry.sets.push(this.mapLoggedSet(setRow))
      }
    }

    return Array.from(grouped.values())
  }

  // ---------------------------------------------------------------------------
  // Session template operations
  // ---------------------------------------------------------------------------

  async getSessionTemplates(
    userId: string,
    filters?: SessionTemplateFilters,
  ): Promise<SessionTemplate[]> {
    let query = this.client.from('session_templates').select('*')

    if (filters?.scope === 'public') {
      query = query.eq('is_public', true)
    } else {
      query = query.eq('user_id', userId)
    }

    if (filters?.searchQuery) {
      query = query.ilike('name', `%${filters.searchQuery}%`)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapSessionTemplate(r))
  }

  async getSessionTemplate(id: string): Promise<SessionTemplate | null> {
    const { data, error } = await this.client
      .from('session_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapSessionTemplate(data as unknown as Record<string, unknown>) : null
  }

  async getSessionTemplateFull(id: string): Promise<SessionTemplateFull | null> {
    const { data: templateData, error: templateError } = await this.client
      .from('session_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (templateError) throw templateError
    if (!templateData) return null

    const { data: groupData, error: groupError } = await this.client
      .from('activity_groups')
      .select('*')
      .eq('session_template_id', id)
      .order('ordinal')
    if (groupError) throw groupError
    const groups = (groupData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapActivityGroupFlat(r),
    )
    const groupIds = groups.map((g) => g.id)

    const template = this.mapSessionTemplate(templateData as unknown as Record<string, unknown>)

    if (groupIds.length === 0) {
      const eventItems =
        template.category === 'EVENT' ? await this.getEventItems(id, 'template') : []
      return {
        template,
        groups,
        activities: [],
        eventItems,
      }
    }

    const { data: actData, error: actError } = await this.client
      .from('activities')
      .select('*')
      .in('activity_group_id', groupIds)
      .order('ordinal')
    if (actError) throw actError
    const activities = (actData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapActivity(r),
    )

    const eventItems = template.category === 'EVENT' ? await this.getEventItems(id, 'template') : []

    return {
      template,
      groups,
      activities,
      eventItems,
    }
  }

  // TODO: These writes are non-atomic. Migrate to a Supabase RPC stored procedure to ensure consistency. See PR #11.
  async createSessionTemplateFull(
    template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    groups: Array<{
      group: Omit<ActivityGroup, 'id' | 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull> {
    const templateRow = {
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

    const { data: tData, error: tError } = await this.client
      .from('session_templates')
      .insert(templateRow)
      .select()
      .single()
    if (tError) throw tError
    const createdTemplate = this.mapSessionTemplate(tData as unknown as Record<string, unknown>)

    const allGroups: Array<Omit<ActivityGroup, 'activities'>> = []
    const allActivities: Activity[] = []

    for (const groupInput of groups) {
      const groupRow = {
        session_template_id: createdTemplate.id,
        group_type: groupInput.group.groupType,
        ordinal: groupInput.group.ordinal,
        rounds: groupInput.group.rounds ?? null,
        rest_between_rounds: groupInput.group.restBetweenRounds
          ? JSON.stringify(groupInput.group.restBetweenRounds)
          : null,
        rest_between_activities: groupInput.group.restBetweenActivities
          ? JSON.stringify(groupInput.group.restBetweenActivities)
          : null,
      }

      const { data: gData, error: gError } = await this.client
        .from('activity_groups')
        .insert(groupRow)
        .select()
        .single()
      if (gError) throw gError
      const createdGroup = this.mapActivityGroupFlat(gData as unknown as Record<string, unknown>)
      allGroups.push(createdGroup)

      for (const actInput of groupInput.activities) {
        const actRow = {
          activity_group_id: createdGroup.id,
          exercise_id: actInput.exerciseId,
          ordinal: actInput.ordinal,
          set_scheme: JSON.stringify(actInput.setScheme),
          notes: actInput.notes ?? null,
        }

        const { data: aData, error: aError } = await this.client
          .from('activities')
          .insert(actRow)
          .select()
          .single()
        if (aError) throw aError
        allActivities.push(this.mapActivity(aData as unknown as Record<string, unknown>))
      }
    }

    return {
      template: createdTemplate,
      groups: allGroups,
      activities: allActivities,
      eventItems: [],
    }
  }

  // TODO: These writes are non-atomic. Migrate to a Supabase RPC stored procedure to ensure consistency. See PR #11.
  async updateSessionTemplateFull(
    template: SessionTemplate,
    groups: Array<{
      group: Omit<ActivityGroup, 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull> {
    const templateRow = {
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

    const { data: tData, error: tError } = await this.client
      .from('session_templates')
      .update(templateRow)
      .eq('id', template.id)
      .select()
      .single()
    if (tError) throw tError
    const updatedTemplate = this.mapSessionTemplate(tData as unknown as Record<string, unknown>)

    // Delete existing groups (cascade handles activities)
    const { error: delError } = await this.client
      .from('activity_groups')
      .delete()
      .eq('session_template_id', template.id)
    if (delError) throw delError

    const allGroups: Array<Omit<ActivityGroup, 'activities'>> = []
    const allActivities: Activity[] = []

    for (const groupInput of groups) {
      const groupRow = {
        session_template_id: template.id,
        group_type: groupInput.group.groupType,
        ordinal: groupInput.group.ordinal,
        rounds: groupInput.group.rounds ?? null,
        rest_between_rounds: groupInput.group.restBetweenRounds
          ? JSON.stringify(groupInput.group.restBetweenRounds)
          : null,
        rest_between_activities: groupInput.group.restBetweenActivities
          ? JSON.stringify(groupInput.group.restBetweenActivities)
          : null,
      }

      const { data: gData, error: gError } = await this.client
        .from('activity_groups')
        .insert(groupRow)
        .select()
        .single()
      if (gError) throw gError
      const createdGroup = this.mapActivityGroupFlat(gData as unknown as Record<string, unknown>)
      allGroups.push(createdGroup)

      for (const actInput of groupInput.activities) {
        const actRow = {
          activity_group_id: createdGroup.id,
          exercise_id: actInput.exerciseId,
          ordinal: actInput.ordinal,
          set_scheme: JSON.stringify(actInput.setScheme),
          notes: actInput.notes ?? null,
        }

        const { data: aData, error: aError } = await this.client
          .from('activities')
          .insert(actRow)
          .select()
          .single()
        if (aError) throw aError
        allActivities.push(this.mapActivity(aData as unknown as Record<string, unknown>))
      }
    }

    const eventItems =
      updatedTemplate.category === 'EVENT' ? await this.getEventItems(template.id, 'template') : []

    return { template: updatedTemplate, groups: allGroups, activities: allActivities, eventItems }
  }

  async cloneSessionTemplate(id: string, _userId: string): Promise<SessionTemplateFull> {
    // 1. Fetch the full template
    const original = await this.getSessionTemplateFull(id)
    if (!original) throw new Error('Template not found')

    // 2. Clone template with activity groups
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...templateData } = original.template
    const clonedFull = await this.createSessionTemplateFull(
      { ...templateData, name: `${templateData.name} (Copy)` },
      original.groups.map((g) => ({
        group: { ...g, sessionTemplateId: '' },
        activities: original.activities
          .filter((a) => a.activityGroupId === g.id)
          .map(({ id: _aid, activityGroupId: _agid, ...actData }) => actData),
      })),
    )

    // 3. Clone event items with isPacked = false (EV-5 invariant)
    const clonedItems: EventItem[] = []
    for (const item of original.eventItems) {
      const clonedItem = await this.saveEventItem(
        {
          userId: item.userId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          isPacked: false, // EV-5: always reset
          sortOrder: item.sortOrder,
          notes: item.notes,
        },
        clonedFull.template.id,
        'template',
      )
      clonedItems.push(clonedItem)
    }

    return { ...clonedFull, eventItems: clonedItems }
  }

  async deleteSessionTemplate(id: string): Promise<void> {
    const { error } = await this.client.from('session_templates').delete().eq('id', id)
    if (error) throw error
  }

  async touchSessionTemplateLastAssigned(id: string): Promise<void> {
    const { error } = await this.client
      .from('session_templates')
      .update({ last_assigned_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Event item operations
  // ---------------------------------------------------------------------------

  async getEventItems(parentId: string, parentType: 'template' | 'log'): Promise<EventItem[]> {
    const column = parentType === 'template' ? 'session_template_id' : 'workout_log_id'
    const { data, error } = await this.client
      .from('event_items')
      .select('*')
      .eq(column, parentId)
      .order('category')
      .order('sort_order')
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapEventItem(r))
  }

  async saveEventItem(
    item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
    parentId: string,
    parentType: 'template' | 'log',
  ): Promise<EventItem> {
    const row = {
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
    const { data, error } = await this.client.from('event_items').insert(row).select().single()
    if (error) throw error
    return this.mapEventItem(data as unknown as Record<string, unknown>)
  }

  async updateEventItem(item: EventItem): Promise<EventItem> {
    const { data, error } = await this.client
      .from('event_items')
      .update({
        name: item.name,
        category: item.category ?? null,
        quantity: item.quantity,
        is_packed: item.isPacked,
        sort_order: item.sortOrder,
        notes: item.notes ?? null,
      })
      .eq('id', item.id)
      .select()
      .single()
    if (error) throw error
    return this.mapEventItem(data as unknown as Record<string, unknown>)
  }

  async deleteEventItem(itemId: string): Promise<void> {
    const { error } = await this.client.from('event_items').delete().eq('id', itemId)
    if (error) throw error
  }

  async toggleEventItemPacked(itemId: string, isPacked: boolean): Promise<EventItem> {
    const { data, error } = await this.client
      .from('event_items')
      .update({ is_packed: isPacked })
      .eq('id', itemId)
      .select()
      .single()
    if (error) throw error
    return this.mapEventItem(data as unknown as Record<string, unknown>)
  }

  async reorderEventItems(items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    const results = await Promise.all(
      items.map(({ id, sortOrder }) =>
        this.client.from('event_items').update({ sort_order: sortOrder }).eq('id', id),
      ),
    )
    const firstError = results.find((r) => r.error)?.error
    if (firstError) throw firstError
  }

  // ---------------------------------------------------------------------------
  // Program operations
  // ---------------------------------------------------------------------------

  async getPrograms(userId: string, filters?: ProgramFilters): Promise<Program[]> {
    let query = this.client.from('programs').select('*')

    if (filters?.scope === 'public') {
      query = query.eq('is_public', true)
    } else {
      query = query.eq('user_id', userId)
    }

    if (filters?.searchQuery) {
      query = query.ilike('name', `%${filters.searchQuery}%`)
    }
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((r) => this.mapProgram(r))
  }

  async getProgramFull(id: string): Promise<ProgramFull | null> {
    const { data: programData, error: programError } = await this.client
      .from('programs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (programError) throw programError
    if (!programData) return null

    const { data: blockData, error: blockError } = await this.client
      .from('blocks')
      .select('*')
      .eq('program_id', id)
      .order('ordinal', { ascending: true })
    if (blockError) throw blockError
    const blocks = (blockData as unknown as Record<string, unknown>[]).map((r) => this.mapBlock(r))
    const blockIds = blocks.map((b) => b.id)

    if (blockIds.length === 0) {
      return {
        program: this.mapProgram(programData as unknown as Record<string, unknown>),
        blocks: [],
        blockWeeks: [],
        scheduledSessions: [],
      }
    }

    const { data: weekData, error: weekError } = await this.client
      .from('block_weeks')
      .select('*')
      .in('block_id', blockIds)
      .order('week_number', { ascending: true })
    if (weekError) throw weekError
    const blockWeeks = (weekData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapBlockWeek(r),
    )
    const weekIds = blockWeeks.map((w) => w.id)

    if (weekIds.length === 0) {
      return {
        program: this.mapProgram(programData as unknown as Record<string, unknown>),
        blocks,
        blockWeeks: [],
        scheduledSessions: [],
      }
    }

    const { data: sessionData, error: sessionError } = await this.client
      .from('scheduled_sessions')
      .select('*')
      .in('block_week_id', weekIds)
    if (sessionError) throw sessionError
    const scheduledSessions = (sessionData as unknown as Record<string, unknown>[]).map((r) =>
      this.mapScheduledSession(r),
    )

    return {
      program: this.mapProgram(programData as unknown as Record<string, unknown>),
      blocks,
      blockWeeks,
      scheduledSessions,
    }
  }

  // TODO: These writes are non-atomic. Migrate to a Supabase RPC stored procedure to ensure consistency.
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
    const programId = crypto.randomUUID()
    const programRow = {
      id: programId,
      user_id: program.userId,
      name: program.name,
      description: program.description ?? null,
      source: program.source,
      duration_weeks: program.durationWeeks ?? null,
      is_public: program.isPublic,
      created_by: program.createdBy ?? null,
    }

    const { error: pError } = await this.client
      .from('programs')
      .insert(programRow)
      .select()
      .single()
    if (pError) throw pError

    for (const blockEntry of blocks) {
      const blockId = crypto.randomUUID()
      const blockRow = {
        id: blockId,
        program_id: programId,
        name: blockEntry.block.name,
        ordinal: blockEntry.block.ordinal,
        duration_weeks: blockEntry.block.durationWeeks,
        block_type: blockEntry.block.blockType,
      }

      const { error: bError } = await this.client.from('blocks').insert(blockRow).select().single()
      if (bError) throw bError

      for (const weekEntry of blockEntry.weeks) {
        const weekId = crypto.randomUUID()
        const weekRow = {
          id: weekId,
          block_id: blockId,
          week_number: weekEntry.week.weekNumber,
        }

        const { error: wError } = await this.client
          .from('block_weeks')
          .insert(weekRow)
          .select()
          .single()
        if (wError) throw wError

        for (const sessionInput of weekEntry.sessions) {
          const sessionId = crypto.randomUUID()
          const sessionRow = {
            id: sessionId,
            block_week_id: weekId,
            day_of_week: sessionInput.dayOfWeek ?? null,
            day_label: sessionInput.dayLabel,
            session_type: sessionInput.sessionType,
            session_template_id: sessionInput.sessionTemplateId,
            notes: sessionInput.notes ?? null,
            overrides: sessionInput.overrides ?? null,
          }

          const { error: sError } = await this.client
            .from('scheduled_sessions')
            .insert(sessionRow)
            .select()
            .single()
          if (sError) throw sError
        }
      }
    }

    const result = await this.getProgramFull(programId)
    if (!result) throw new Error('Failed to fetch newly created program')
    return result
  }

  // TODO: These writes are non-atomic. Migrate to a Supabase RPC stored procedure to ensure consistency.
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
    const updateFields = {
      name: program.name,
      description: program.description ?? null,
      source: program.source,
      duration_weeks: program.durationWeeks ?? null,
      is_public: program.isPublic,
      created_by: program.createdBy ?? null,
    }
    const { error: pError } = await this.client
      .from('programs')
      .update(updateFields)
      .eq('id', program.id)
    if (pError) throw pError

    // Delete existing blocks (cascade handles weeks and sessions)
    const { error: delError } = await this.client
      .from('blocks')
      .delete()
      .eq('program_id', program.id)
    if (delError) throw delError

    // Re-insert all blocks, weeks, and sessions
    for (const blockEntry of blocks) {
      const blockId = blockEntry.block.id ?? crypto.randomUUID()
      const blockRow = {
        id: blockId,
        program_id: program.id,
        name: blockEntry.block.name,
        ordinal: blockEntry.block.ordinal,
        duration_weeks: blockEntry.block.durationWeeks,
        block_type: blockEntry.block.blockType,
      }

      const { error: bError } = await this.client.from('blocks').insert(blockRow).select().single()
      if (bError) throw bError

      for (const weekEntry of blockEntry.weeks) {
        const weekId = weekEntry.week.id ?? crypto.randomUUID()
        const weekRow = {
          id: weekId,
          block_id: blockId,
          week_number: weekEntry.week.weekNumber,
        }

        const { error: wError } = await this.client
          .from('block_weeks')
          .insert(weekRow)
          .select()
          .single()
        if (wError) throw wError

        for (const sessionInput of weekEntry.sessions) {
          const sessionId = crypto.randomUUID()
          const sessionRow = {
            id: sessionId,
            block_week_id: weekId,
            day_of_week: sessionInput.dayOfWeek ?? null,
            day_label: sessionInput.dayLabel,
            session_type: sessionInput.sessionType,
            session_template_id: sessionInput.sessionTemplateId,
            notes: sessionInput.notes ?? null,
            overrides: sessionInput.overrides ?? null,
          }

          const { error: sError } = await this.client
            .from('scheduled_sessions')
            .insert(sessionRow)
            .select()
            .single()
          if (sError) throw sError
        }
      }
    }

    const result = await this.getProgramFull(program.id)
    if (!result) throw new Error('Failed to fetch updated program')
    return result
  }

  async deleteProgram(id: string): Promise<void> {
    const { error } = await this.client.from('programs').delete().eq('id', id)
    if (error) throw error
  }

  async assignProgramToMember(
    programId: string,
    memberId: string,
    groupId: string,
  ): Promise<Program> {
    const { data, error } = await this.client.rpc('assign_program_to_member', {
      p_program_id: programId,
      p_target_user_id: memberId,
      p_group_id: groupId,
    })
    if (error) throw error
    return this.mapProgram(data as unknown as Record<string, unknown>)
  }

  // ---------------------------------------------------------------------------
  // Public visibility operations
  // ---------------------------------------------------------------------------

  async publishProgram(programId: string): Promise<void> {
    try {
      const { error } = await this.client.rpc('publish_program', {
        p_program_id: programId,
      })
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to publish program:', err)
      throw err
    }
  }

  async publishSessionTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await this.client.rpc('publish_session_template', {
        p_template_id: templateId,
      })
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to publish session template:', err)
      throw err
    }
  }

  async publishExercise(exerciseId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('exercises')
        .update({ is_public: true })
        .eq('id', exerciseId)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to publish exercise:', err)
      throw err
    }
  }

  async unpublishProgram(programId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('programs')
        .update({ is_public: false })
        .eq('id', programId)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to unpublish program:', err)
      throw err
    }
  }

  async unpublishSessionTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('session_templates')
        .update({ is_public: false })
        .eq('id', templateId)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to unpublish session template:', err)
      throw err
    }
  }

  async unpublishExercise(exerciseId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('exercises')
        .update({ is_public: false })
        .eq('id', exerciseId)
      if (error) throw error
    } catch (err) {
      console.error('[supabase-adapter] Failed to unpublish exercise:', err)
      throw err
    }
  }

  async clonePublicSessionTemplate(templateId: string): Promise<string> {
    try {
      const { data, error } = await this.client.rpc('clone_session_template', {
        p_template_id: templateId,
      })
      if (error) throw error
      return data as string
    } catch (err) {
      console.error('[supabase-adapter] Failed to clone session template:', err)
      throw err
    }
  }

  // ---------------------------------------------------------------------------
  // Program activation operations
  // ---------------------------------------------------------------------------

  async getActiveProgram(userId: string): Promise<ProgramActivation | null> {
    const { data, error } = await this.client
      .from('program_activations')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapProgramActivation(data as unknown as Record<string, unknown>) : null
  }

  async setActiveProgram(
    userId: string,
    programId: string,
    startDate?: string,
  ): Promise<ProgramActivation> {
    const { data, error } = await this.client
      .from('program_activations')
      .upsert(
        {
          id: crypto.randomUUID(),
          user_id: userId,
          program_id: programId,
          current_block_ordinal: 1,
          current_week_number: 1,
          start_date: startDate ?? new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()
    if (error) throw error
    return this.mapProgramActivation(data as unknown as Record<string, unknown>)
  }

  async updateActiveProgram(
    userId: string,
    updates: { currentBlockOrdinal?: number; currentWeekNumber?: number; startDate?: string },
  ): Promise<ProgramActivation> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.currentBlockOrdinal !== undefined) {
      row.current_block_ordinal = updates.currentBlockOrdinal
    }
    if (updates.currentWeekNumber !== undefined) {
      row.current_week_number = updates.currentWeekNumber
    }
    if (updates.startDate !== undefined) {
      row.start_date = updates.startDate
    }

    const { data, error } = await this.client
      .from('program_activations')
      .update(row)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return this.mapProgramActivation(data as unknown as Record<string, unknown>)
  }

  async clearActiveProgram(userId: string): Promise<void> {
    const { error } = await this.client.from('program_activations').delete().eq('user_id', userId)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Week status operations (Program Time Travel)
  // ---------------------------------------------------------------------------

  async getWeekStatuses(activationId: string): Promise<WeekStatus[]> {
    const { data, error } = await this.client
      .from('program_week_statuses')
      .select('*')
      .eq('activation_id', activationId)
      .order('block_ordinal', { ascending: true })
      .order('week_number', { ascending: true })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((row) => this.mapWeekStatus(row))
  }

  async upsertWeekStatuses(
    activationId: string,
    statuses: Array<{ blockOrdinal: number; weekNumber: number; status: WeekStatusValue }>,
  ): Promise<WeekStatus[]> {
    const rows = statuses.map((s) => ({
      activation_id: activationId,
      block_ordinal: s.blockOrdinal,
      week_number: s.weekNumber,
      status: s.status,
    }))

    const { error } = await this.client
      .from('program_week_statuses')
      .upsert(rows, { onConflict: 'activation_id,block_ordinal,week_number' })
    if (error) throw error

    return this.getWeekStatuses(activationId)
  }

  async deleteWeekStatuses(
    activationId: string,
    keys: Array<{ blockOrdinal: number; weekNumber: number }>,
  ): Promise<void> {
    if (keys.length === 0) return

    // Supabase JS client doesn't support tuple IN clauses, so build an .or() filter
    const orFilter = keys
      .map((k) => `and(block_ordinal.eq.${k.blockOrdinal},week_number.eq.${k.weekNumber})`)
      .join(',')

    const { error } = await this.client
      .from('program_week_statuses')
      .delete()
      .eq('activation_id', activationId)
      .or(orFilter)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Share link operations
  // ---------------------------------------------------------------------------

  async getShareLinks(userId: string): Promise<ShareLink[]> {
    const { data, error } = await this.client
      .from('share_links')
      .select('*')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((row) => this.mapShareLink(row))
  }

  async getShareLinksForEntity(
    entityType: ShareableEntityType,
    entityId: string,
  ): Promise<ShareLink[]> {
    const { data, error } = await this.client
      .from('share_links')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((row) => this.mapShareLink(row))
  }

  async createShareLink(
    link: Omit<ShareLink, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<ShareLink> {
    const { data, error } = await this.client
      .from('share_links')
      .insert({
        token: link.token,
        entity_type: link.entityType,
        entity_id: link.entityId,
        created_by: link.createdBy,
      })
      .select()
      .single()
    if (error) throw error
    return this.mapShareLink(data as unknown as Record<string, unknown>)
  }

  async revokeShareLink(id: string): Promise<void> {
    const { error } = await this.client
      .from('share_links')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw error
  }

  async deleteShareLink(id: string): Promise<void> {
    const { error } = await this.client.from('share_links').delete().eq('id', id)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Analytics operations
  // ---------------------------------------------------------------------------

  async getWeeklyVolume(
    userId: string,
    exerciseId: string,
    weeks = 8,
  ): Promise<WeeklyVolumeEntry[]> {
    // Supabase JS client cannot express multi-table JOINs with aggregation via
    // the query builder. Instead, fetch the nested data and aggregate in TS.
    // This matches the offline-first data adapter pattern used elsewhere.
    const { data, error } = await this.client
      .from('logged_activities')
      .select(
        'id, exercise_id, logged_activity_groups!inner(workout_log_id, workout_logs!inner(started_at, completed_at, user_id)), logged_sets(actual_weight, actual_reps, completed)',
      )
      .eq('exercise_id', exerciseId)
      .eq('logged_activity_groups.workout_logs.user_id', userId)
      .not('logged_activity_groups.workout_logs.completed_at', 'is', null)

    if (error) throw error

    type VolumeRow = {
      id: string
      exercise_id: string
      logged_activity_groups: {
        workout_log_id: string
        workout_logs: {
          started_at: string
          completed_at: string | null
          user_id: string
        }
      }
      logged_sets: Array<{
        actual_weight: { value: number; unit: string } | null
        actual_reps: number | null
        completed: boolean
      }>
    }
    const rows = data as unknown as VolumeRow[]

    // Aggregate by ISO week
    const weekMap = new Map<string, { label: string; tonnage: number; unit: 'lb' | 'kg' }>()

    for (const row of rows) {
      const startedAt = new Date(row.logged_activity_groups.workout_logs.started_at)
      const weekStart = getMonday(startedAt)
      const weekKey = weekStart.toISOString().slice(0, 10)

      for (const set of row.logged_sets) {
        if (!set.completed || set.actual_weight == null || set.actual_reps == null) continue

        const tonnage = set.actual_weight.value * set.actual_reps
        const existing = weekMap.get(weekKey)
        if (existing) {
          existing.tonnage += tonnage
          // Use the unit from the first set seen in this week
        } else {
          const label = formatWeekLabel(weekStart)
          weekMap.set(weekKey, {
            label,
            tonnage,
            unit: set.actual_weight.unit as 'lb' | 'kg',
          })
        }
      }
    }

    // Sort descending by week and limit
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
    // Fetch all completed workout logs with nested sets for volume calculation
    const { data, error } = await this.client
      .from('workout_logs')
      .select(
        'id, started_at, logged_activity_groups(logged_activities(logged_sets(actual_weight, actual_reps, completed)))',
      )
      .eq('user_id', userId)
      .not('completed_at', 'is', null)

    if (error) throw error

    type SummaryRow = {
      id: string
      started_at: string
      logged_activity_groups: Array<{
        logged_activities: Array<{
          logged_sets: Array<{
            actual_weight: { value: number; unit: string } | null
            actual_reps: number | null
            completed: boolean
          }>
        }>
      }>
    }
    const rows = data as unknown as SummaryRow[]

    const monday = getMonday(new Date())

    let totalWorkouts = 0
    let totalVolumeLb = 0
    let thisWeekWorkouts = 0
    let thisWeekVolumeLb = 0

    for (const row of rows) {
      totalWorkouts++
      const isThisWeek = new Date(row.started_at) >= monday
      if (isThisWeek) thisWeekWorkouts++

      for (const group of row.logged_activity_groups) {
        for (const activity of group.logged_activities) {
          for (const set of activity.logged_sets) {
            if (!set.completed || set.actual_weight == null || set.actual_reps == null) continue

            let weightLb = set.actual_weight.value
            if (set.actual_weight.unit === 'kg') {
              weightLb = set.actual_weight.value * 2.20462
            }
            const volume = weightLb * set.actual_reps
            totalVolumeLb += volume
            if (isThisWeek) thisWeekVolumeLb += volume
          }
        }
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
    const userId = await this.getCurrentUserId()

    const { data, error } = await this.client
      .from('accountability_groups')
      .insert({
        name: group.name,
        description: group.description ?? null,
        data_retention_days: group.dataRetentionDays,
        user_id: userId,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw error

    // C2: Insert creator as COACH member so browser-mode flow matches Tauri behavior
    const { error: memberError } = await this.client.from('group_members').insert({
      group_id: data.id,
      user_id: userId,
      role: 'COACH',
      share_history_before_join: false,
    })
    if (memberError) throw memberError

    return toAccountabilityGroup(data)
  }

  async getGroups(): Promise<AccountabilityGroup[]> {
    const { data, error } = await this.client
      .from('accountability_groups')
      .select()
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(toAccountabilityGroup)
  }

  async getGroup(id: string): Promise<AccountabilityGroup | null> {
    const { data, error } = await this.client
      .from('accountability_groups')
      .select()
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? toAccountabilityGroup(data) : null
  }

  async updateGroup(
    id: string,
    updates: Partial<Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>>,
  ): Promise<AccountabilityGroup> {
    const patch: Record<string, unknown> = {}
    if (updates.name !== undefined) patch.name = updates.name
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.dataRetentionDays !== undefined)
      patch.data_retention_days = updates.dataRetentionDays

    const { data, error } = await this.client
      .from('accountability_groups')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return toAccountabilityGroup(data)
  }

  async deleteGroup(id: string): Promise<void> {
    const { error } = await this.client.from('accountability_groups').delete().eq('id', id)
    if (error) throw error
  }

  // ---------------------------------------------------------------------------
  // Group Member operations
  // ---------------------------------------------------------------------------

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const { data, error } = await this.client
      .from('group_members')
      .select()
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(toGroupMember)
  }

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<GroupMember> {
    const { data, error } = await this.client
      .from('group_members')
      .update({ role })
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return toGroupMember(data)
  }

  // ---------------------------------------------------------------------------
  // Group Invite operations
  // ---------------------------------------------------------------------------

  async createInvite(groupId: string): Promise<GroupInvite> {
    const userId = await this.getCurrentUserId()

    // expires_at = 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await this.client
      .from('group_invites')
      .insert({
        group_id: groupId,
        created_by: userId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return toGroupInvite(data)
  }

  async getGroupInvites(groupId: string): Promise<GroupInvite[]> {
    const { data, error } = await this.client
      .from('group_invites')
      .select()
      .eq('group_id', groupId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(toGroupInvite)
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await this.client
      .from('group_invites')
      .update({ is_active: false })
      .eq('id', inviteId)

    if (error) throw error
  }

  async joinGroupByCode(code: string): Promise<GroupMember> {
    const userId = await this.getCurrentUserId()

    // Find the invite
    const { data: invite, error: inviteError } = await this.client
      .from('group_invites')
      .select()
      .eq('code', code)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (inviteError) throw inviteError
    if (!invite) throw new Error('Invalid or expired invite code')

    // Check user group limit (max 5 groups)
    const { count, error: countError } = await this.client
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) throw countError
    if ((count ?? 0) >= 5) throw new Error('Maximum group limit (5) reached')

    // Add member (group size enforced by DB trigger)
    const { data, error } = await this.client
      .from('group_members')
      .insert({
        group_id: invite.group_id,
        user_id: userId,
        role: 'MEMBER',
      })
      .select()
      .single()

    if (error) throw error
    return toGroupMember(data)
  }

  // ---------------------------------------------------------------------------
  // Direct Connection operations
  // ---------------------------------------------------------------------------

  async requestConnection(recipientId: string): Promise<DirectConnection> {
    const userId = await this.getCurrentUserId()

    let resolvedId = recipientId
    if (recipientId.includes('@')) {
      const { data, error: lookupError } = await this.client.rpc('resolve_user_id_by_email', {
        lookup_email: recipientId,
      })
      if (lookupError) throw lookupError
      resolvedId = data as string
    }

    const { data, error } = await this.client
      .from('direct_connections')
      .insert({
        requester_id: userId,
        recipient_id: resolvedId,
      })
      .select()
      .single()

    if (error) throw error
    return toDirectConnection(data)
  }

  async getConnections(): Promise<DirectConnection[]> {
    const { data, error } = await this.client
      .from('direct_connections')
      .select()
      .eq('status', 'ACTIVE')
      .order('accepted_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(toDirectConnection)
  }

  async getPendingConnections(): Promise<DirectConnection[]> {
    const { data, error } = await this.client
      .from('direct_connections')
      .select()
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(toDirectConnection)
  }

  async acceptConnection(connectionId: string): Promise<DirectConnection> {
    const { data, error } = await this.client
      .from('direct_connections')
      .update({
        status: 'ACTIVE',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', connectionId)
      .select()
      .single()

    if (error) throw error
    return toDirectConnection(data)
  }

  async declineConnection(connectionId: string): Promise<DirectConnection> {
    const { data, error } = await this.client
      .from('direct_connections')
      .update({ status: 'DECLINED' })
      .eq('id', connectionId)
      .select()
      .single()

    if (error) throw error
    return toDirectConnection(data)
  }

  async removeConnection(connectionId: string): Promise<void> {
    const { error } = await this.client.from('direct_connections').delete().eq('id', connectionId)
    if (error) throw error
  }

  async updateConnectionWriteAccess(
    connectionId: string,
    grantsWrite: boolean,
  ): Promise<DirectConnection> {
    const userId = await this.getCurrentUserId()

    // Fetch the connection to determine if user is requester or recipient
    const { data: existing, error: fetchError } = await this.client
      .from('direct_connections')
      .select()
      .eq('id', connectionId)
      .single()

    if (fetchError) throw fetchError

    const patch =
      existing.requester_id === userId
        ? { requester_grants_write: grantsWrite }
        : { recipient_grants_write: grantsWrite }

    const { data, error } = await this.client
      .from('direct_connections')
      .update(patch)
      .eq('id', connectionId)
      .select()
      .single()

    if (error) throw error
    return toDirectConnection(data)
  }

  // ---------------------------------------------------------------------------
  // Activity Feed operations
  // ---------------------------------------------------------------------------

  async getGroupActivityFeed(
    groupId: string,
    options: ActivityFeedOptions = {},
  ): Promise<GroupActivityFeedEntry[]> {
    const { before, limit = 20 } = options
    const userId = await this.getCurrentUserId()

    // Fetch all group members (excluding self) with their history-sharing settings.
    // SH-9: share_history_before_join is controlled by the DATA OWNER, not the viewer.
    // Each member's own flag determines whether their pre-join history is visible to others.
    const { data: members, error: membersError } = await this.client
      .from('group_members')
      .select('user_id, role, share_history_before_join, joined_at')
      .eq('group_id', groupId)
      .neq('user_id', userId)

    if (membersError) throw membersError
    if (!members?.length) return []

    const memberIds = members.map((m) => m.user_id)
    const memberRoleMap = Object.fromEntries(members.map((m) => [m.user_id, m.role]))
    // Map: userId -> earliest visible started_at (null = no restriction)
    const memberHistoryFrom = Object.fromEntries(
      members.map((m) => [m.user_id, m.share_history_before_join ? null : m.joined_at]),
    )

    // Build workout_logs query -- deliberately exclude private fields (SH-7)
    let query = this.client
      .from('workout_logs')
      .select('id, user_id, title, started_at, completed_at')
      .in('user_id', memberIds)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('started_at', before)

    const { data: rawLogs, error: logsError } = await query
    if (logsError) throw logsError

    // SH-9: Filter out pre-join logs for members who have not opted in to sharing history.
    // RLS enforces this at the DB level; this adapter filter is an extra safety layer.
    const logs = (rawLogs ?? []).filter((log) => {
      const historyFrom = memberHistoryFrom[log.user_id]
      return historyFrom === null || log.started_at >= historyFrom
    })

    // Get exercise counts per workout
    const logIds = logs.map((l) => l.id)

    let exerciseCounts: Record<string, number> = {}
    if (logIds.length > 0) {
      const { data: activityGroups, error: countError } = await this.client
        .from('logged_activity_groups')
        .select('workout_log_id')
        .in('workout_log_id', logIds)

      if (countError) throw countError

      exerciseCounts = {}
      for (const ag of activityGroups ?? []) {
        exerciseCounts[ag.workout_log_id] = (exerciseCounts[ag.workout_log_id] ?? 0) + 1
      }
    }

    return (logs ?? []).map((log) => {
      let durationSeconds: number | null = null
      if (log.completed_at && log.started_at) {
        durationSeconds = Math.floor(
          (new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000,
        )
      }

      return {
        id: log.id,
        userId: log.user_id,
        title: log.title,
        startedAt: log.started_at,
        completedAt: log.completed_at,
        durationSeconds,
        exerciseCount: exerciseCounts[log.id] ?? 0,
        groupId,
        memberRole: memberRoleMap[log.user_id] ?? 'MEMBER',
      }
    })
  }

  async getConnectionActivityFeed(
    options: ActivityFeedOptions = {},
  ): Promise<ConnectionActivityFeedEntry[]> {
    const { before, limit = 20 } = options
    const userId = await this.getCurrentUserId()

    // Get active connections
    const { data: connections, error: connError } = await this.client
      .from('direct_connections')
      .select('id, requester_id, recipient_id')
      .eq('status', 'ACTIVE')

    if (connError) throw connError
    if (!connections?.length) return []

    const connectionMap: Record<string, string> = {}
    const peerIds: string[] = []
    for (const conn of connections) {
      const peerId = conn.requester_id === userId ? conn.recipient_id : conn.requester_id
      peerIds.push(peerId)
      connectionMap[peerId] = conn.id
    }

    // Fetch peer logs -- exclude private fields
    let query = this.client
      .from('workout_logs')
      .select('id, user_id, title, started_at, completed_at')
      .in('user_id', peerIds)
      .not('completed_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (before) query = query.lt('started_at', before)

    const { data: logs, error: logsError } = await query
    if (logsError) throw logsError

    const logIds = (logs ?? []).map((l) => l.id)

    let exerciseCounts: Record<string, number> = {}
    if (logIds.length > 0) {
      const { data: activityGroups, error: countError } = await this.client
        .from('logged_activity_groups')
        .select('workout_log_id')
        .in('workout_log_id', logIds)

      if (countError) throw countError

      exerciseCounts = {}
      for (const ag of activityGroups ?? []) {
        exerciseCounts[ag.workout_log_id] = (exerciseCounts[ag.workout_log_id] ?? 0) + 1
      }
    }

    return (logs ?? [])
      .filter((log) => connectionMap[log.user_id] !== undefined)
      .map((log) => {
        let durationSeconds: number | null = null
        if (log.completed_at && log.started_at) {
          durationSeconds = Math.floor(
            (new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000,
          )
        }

        return {
          id: log.id,
          userId: log.user_id,
          title: log.title,
          startedAt: log.started_at,
          completedAt: log.completed_at,
          durationSeconds,
          exerciseCount: exerciseCounts[log.id] ?? 0,
          connectionId: connectionMap[log.user_id],
        }
      })
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
    const userId = await this.getCurrentUserId()

    // 1. Insert the conversation row
    const { data: convData, error: convError } = await this.client
      .from('conversations')
      .insert({
        type,
        title: title ?? null,
        group_id: groupId ?? null,
      })
      .select()
      .single()
    if (convError) throw convError

    // 2. Insert participant rows -- include the current user plus all provided IDs
    const allParticipantIds = [...new Set([userId, ...participantIds])]
    for (const pid of allParticipantIds) {
      const { error: pError } = await this.client.from('conversation_participants').insert({
        conversation_id: (convData as { id: string }).id,
        user_id: pid,
      })
      if (pError) throw pError
    }

    return this.mapConversation(convData as unknown as Record<string, unknown>, allParticipantIds)
  }

  async getConversations(): Promise<Conversation[]> {
    const userId = await this.getCurrentUserId()

    // Select conversations where the current user is an active participant
    const { data: participantRows, error: pError } = await this.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
      .is('left_at', null)
    if (pError) throw pError

    const conversationIds = (participantRows ?? []).map((r) => r.conversation_id)
    if (conversationIds.length === 0) return []

    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })
    if (error) throw error

    // Fetch all active participants for these conversations
    const { data: allParticipants, error: apError } = await this.client
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
      .is('left_at', null)
    if (apError) throw apError

    const participantsByConv = new Map<string, string[]>()
    for (const p of allParticipants ?? []) {
      const list = participantsByConv.get(p.conversation_id) ?? []
      list.push(p.user_id)
      participantsByConv.set(p.conversation_id, list)
    }

    return (data as unknown as Record<string, unknown>[]).map((row) =>
      this.mapConversation(row, participantsByConv.get(row.id as string) ?? []),
    )
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const { data, error } = await this.client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    const { data: participants, error: pError } = await this.client
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', id)
      .is('left_at', null)
    if (pError) throw pError

    return this.mapConversation(
      data as unknown as Record<string, unknown>,
      (participants ?? []).map((p) => p.user_id),
    )
  }

  async findDirectConversation(otherUserId: string): Promise<Conversation | null> {
    const userId = await this.getCurrentUserId()

    // Find direct conversations where both the current user and the other user
    // are active participants. We query the current user's active direct
    // conversations first, then check for the other user's membership.
    const { data: myParticipations, error: myError } = await this.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)
      .is('left_at', null)
    if (myError) throw myError

    const myConversationIds = (myParticipations ?? []).map((r) => r.conversation_id)
    if (myConversationIds.length === 0) return null

    // Filter to direct conversations only
    const { data: directConvs, error: convError } = await this.client
      .from('conversations')
      .select('id')
      .in('id', myConversationIds)
      .eq('type', 'direct')
    if (convError) throw convError

    const directIds = (directConvs ?? []).map((r) => r.id)
    if (directIds.length === 0) return null

    // Find one where the other user is also an active participant
    const { data: otherParticipation, error: otherError } = await this.client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', directIds)
      .is('left_at', null)
      .limit(1)
      .maybeSingle()
    if (otherError) throw otherError
    if (!otherParticipation) return null

    return this.getConversation(otherParticipation.conversation_id)
  }

  async sendMessage(
    conversationId: string,
    messageType: MessageType,
    content?: string,
  ): Promise<Message> {
    const userId = await this.getCurrentUserId()

    // sync_status is SQLite-only and not a column in the Supabase table
    const { data, error } = await this.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        message_type: messageType,
        content: content ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return this.mapMessage(data as unknown as Record<string, unknown>)
  }

  async getMessages(
    conversationId: string,
    options: { before?: string; limit: number },
  ): Promise<Message[]> {
    let query = this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(options.limit)

    if (options.before) {
      query = query.lt('created_at', options.before)
    }

    const { data, error } = await query
    if (error) throw error
    return (data as unknown as Record<string, unknown>[])
      .map((row) => this.mapMessage(row))
      .reverse()
  }

  async getMessagesSince(conversationId: string, since: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((row) => this.mapMessage(row))
  }

  async updateLastRead(conversationId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    const { error } = await this.client
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async getUnreadCounts(): Promise<Map<string, number>> {
    const userId = await this.getCurrentUserId()

    // Get all active participations with their last_read_at
    const { data: participations, error: pError } = await this.client
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
      .is('left_at', null)
    if (pError) throw pError

    const counts = new Map<string, number>()
    if (!participations?.length) return counts

    // Fire all COUNT queries concurrently to minimize wall-clock latency
    // (N queries execute in parallel instead of sequentially)
    // Exclude the user's own messages (consistent with Tauri adapter behavior)
    const results = await Promise.allSettled(
      participations.map(async (p) => {
        let query = this.client
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', userId)

        if (p.last_read_at) {
          query = query.gt('created_at', p.last_read_at)
        }
        // If last_read_at is null, all messages are unread -- no filter needed

        const { count, error } = await query
        if (error) throw Object.assign(error, { conversationId: p.conversation_id })
        return { conversationId: p.conversation_id, count: count ?? 0 }
      }),
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        counts.set(result.value.conversationId, result.value.count)
      } else {
        console.warn(
          '[supabase-adapter] getUnreadCounts query failed for conversation:',
          result.reason?.conversationId ?? 'unknown',
          result.reason,
        )
      }
    }

    return counts
  }

  async addParticipant(conversationId: string, userId: string): Promise<ConversationParticipant> {
    const { data, error } = await this.client
      .from('conversation_participants')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
      })
      .select()
      .single()
    if (error) throw error
    return this.mapConversationParticipant(data as unknown as Record<string, unknown>)
  }

  async leaveConversation(conversationId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    const { error } = await this.client
      .from('conversation_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async toggleArchive(conversationId: string): Promise<void> {
    const userId = await this.getCurrentUserId()

    // Read current is_archived value
    const { data: current, error: fetchError } = await this.client
      .from('conversation_participants')
      .select('is_archived')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single()
    if (fetchError) throw fetchError

    // Toggle to the opposite
    const { error } = await this.client
      .from('conversation_participants')
      .update({ is_archived: !current.is_archived })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
    if (error) throw error
  }

  async saveMediaAttachment(
    messageId: string,
    attachment: Omit<MediaAttachment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MediaAttachment> {
    const { data, error } = await this.client
      .from('media_attachments')
      .insert({
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
      })
      .select()
      .single()
    if (error) throw error
    return this.mapMediaAttachment(data as unknown as Record<string, unknown>)
  }

  async getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]> {
    if (messageIds.length === 0) return []

    const { data, error } = await this.client
      .from('media_attachments')
      .select('*')
      .in('message_id', messageIds)
    if (error) throw error
    return (data as unknown as Record<string, unknown>[]).map((row) => this.mapMediaAttachment(row))
  }

  async updateMediaAttachment(
    attachmentId: string,
    updates: Partial<
      Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>
    >,
  ): Promise<MediaAttachment> {
    const patch: Record<string, unknown> = {}
    if (updates.status !== undefined) patch.status = updates.status
    if (updates.thumbnailUrl !== undefined) patch.thumbnail_url = updates.thumbnailUrl
    if (updates.playbackUrl !== undefined) patch.playback_url = updates.playbackUrl
    if (updates.providerAssetId !== undefined) patch.provider_asset_id = updates.providerAssetId

    const { data, error } = await this.client
      .from('media_attachments')
      .update(patch)
      .eq('id', attachmentId)
      .select()
      .single()
    if (error) throw error
    return this.mapMediaAttachment(data as unknown as Record<string, unknown>)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the Monday at 00:00 UTC of the week containing the given date. */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  // Sunday = 0, Monday = 1, ..., Saturday = 6
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
