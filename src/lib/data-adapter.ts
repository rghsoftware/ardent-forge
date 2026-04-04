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
  AccountabilityGroup,
  GroupMember,
  GroupInvite,
  DirectConnection,
  GroupRole,
  ShareLink,
  ShareableEntityType,
  EventItem,
  Conversation,
  ConversationType,
  ConversationParticipant,
  Message,
  MessageType,
  MediaAttachment,
} from '@/domain/types'
import type { ExerciseCategory, MovementPattern, MuscleGroup } from '@/domain/types'
import type { WeeklyVolumeEntry } from '@/domain/types'

export type WorkoutWithSets = { log: WorkoutLog; sets: LoggedSet[] }

export type WorkoutLogSummary = {
  log: WorkoutLog
  exerciseNames: string[]
  setCount: number
  exerciseCount: number
}

export type SessionTemplateFull = {
  template: SessionTemplate
  groups: Array<Omit<ActivityGroup, 'activities'>>
  activities: Activity[]
  eventItems: EventItem[]
}

export type ProgramFull = {
  program: Program
  blocks: Block[]
  blockWeeks: BlockWeek[]
  scheduledSessions: ScheduledSession[]
}

export type VaultSummary = {
  totalWorkouts: number
  totalVolumeLb: number
  thisWeekWorkouts: number
  thisWeekVolumeLb: number
}

// ---------------------------------------------------------------------------
// Activity Feed types
// ---------------------------------------------------------------------------

export interface ActivityFeedOptions {
  /** ISO 8601 datetime cursor for keyset pagination */
  before?: string
  /** Maximum entries to return (default 20) */
  limit?: number
}

export interface ActivityFeedWorkoutSummary {
  id: string
  userId: string
  /** Reserved for future user profile integration */
  userDisplayName?: string
  title: string | null
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  exerciseCount: number
}

export interface GroupActivityFeedEntry extends ActivityFeedWorkoutSummary {
  groupId: string
  memberRole: GroupRole
}

export interface ConnectionActivityFeedEntry extends ActivityFeedWorkoutSummary {
  connectionId: string
}

export interface MessagePaginationOptions {
  /** ISO 8601 datetime cursor -- returns messages before this timestamp */
  before?: string
  /** Maximum messages to return */
  limit: number
}

export interface ExerciseFilters {
  category?: ExerciseCategory
  movementPattern?: MovementPattern
  muscleGroup?: MuscleGroup
  searchQuery?: string
  isCustom?: boolean
}

/**
 * DataAdapter -- abstraction layer for persistence operations.
 *
 * Error behavior:
 * - Single-entity lookups return `null` when the entity is not found.
 * - List operations return an empty array when no matches exist.
 * - Infrastructure errors (network, DB) should throw and are handled by callers.
 *
 * Scope grows with each implementation step; see interface methods below for current operations.
 */
export interface DataAdapter {
  // Exercise operations
  getExercises(filters?: ExerciseFilters): Promise<Exercise[]>
  getExercise(id: string): Promise<Exercise | null>
  createExercise(exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exercise>

  // Workout log operations
  getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]>
  getWorkoutLogsSummary(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<WorkoutLogSummary[]>
  getWorkoutLog(id: string): Promise<WorkoutLog | null>
  getWorkoutLogFull(id: string): Promise<{
    log: WorkoutLog
    groups: LoggedActivityGroup[]
    activities: LoggedActivity[]
    sets: LoggedSet[]
  } | null>
  createWorkoutLog(log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkoutLog>
  updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog>
  deleteWorkoutLog(id: string): Promise<void>
  createLoggedActivityGroup(
    group: Omit<LoggedActivityGroup, 'id'>,
    userId: string,
  ): Promise<LoggedActivityGroup>
  createLoggedActivity(
    activity: Omit<LoggedActivity, 'id'>,
    userId: string,
  ): Promise<LoggedActivity>
  createLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Promise<LoggedSet>
  updateLoggedSet(set: LoggedSet, userId: string): Promise<LoggedSet>

  // Exercise history operations

  /** Returns all 1RM entries for an exercise ordered by recordedAt ascending (chronological for chart). */
  getOneRepMaxHistory(userId: string, exerciseId: string): Promise<OneRepMaxHistory[]>

  /** Returns recently used exercise IDs ordered by most recent usage. */
  getRecentlyUsedExerciseIds(userId: string, limit?: number): Promise<string[]>

  /** Returns past workouts containing a specific exercise with their sets. */
  getExerciseWorkoutHistory(
    userId: string,
    exerciseId: string,
    limit?: number,
  ): Promise<WorkoutWithSets[]>

  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | null>
  updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile>
  saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory>

  // Session template operations
  getSessionTemplates(userId: string): Promise<SessionTemplate[]>
  getSessionTemplate(id: string): Promise<SessionTemplate | null>
  getSessionTemplateFull(id: string): Promise<SessionTemplateFull | null>
  createSessionTemplateFull(
    template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    groups: Array<{
      group: Omit<ActivityGroup, 'id' | 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull>
  updateSessionTemplateFull(
    template: SessionTemplate,
    groups: Array<{
      group: Omit<ActivityGroup, 'activities'>
      activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
    }>,
  ): Promise<SessionTemplateFull>
  cloneSessionTemplate(id: string, userId: string): Promise<SessionTemplateFull>
  deleteSessionTemplate(id: string): Promise<void>

  // Event item operations
  getEventItems(parentId: string, parentType: 'template' | 'log'): Promise<EventItem[]>
  saveEventItem(
    item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
    parentId: string,
    parentType: 'template' | 'log',
  ): Promise<EventItem>
  updateEventItem(item: EventItem): Promise<EventItem>
  deleteEventItem(itemId: string): Promise<void>
  toggleEventItemPacked(itemId: string, isPacked: boolean): Promise<EventItem>
  reorderEventItems(items: Array<{ id: string; sortOrder: number }>): Promise<void>

  // Program operations
  getPrograms(userId: string): Promise<Program[]>
  getProgramFull(id: string): Promise<ProgramFull | null>
  createProgramFull(
    program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>,
    blocks: Array<{
      block: Omit<Block, 'id' | 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'id' | 'blockId'>
        sessions: Array<
          Omit<ScheduledSession, 'id' | 'blockWeekId' | 'sessionTemplateId'> & {
            sessionTemplateId?: string
          }
        >
      }>
    }>,
  ): Promise<ProgramFull>
  updateProgramFull(
    program: Program,
    blocks: Array<{
      block: Omit<Block, 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'blockId'>
        sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
      }>
    }>,
  ): Promise<ProgramFull>
  deleteProgram(id: string): Promise<void>
  assignProgramToMember(programId: string, memberId: string, groupId: string): Promise<Program>

  // Program activation operations
  getActiveProgram(userId: string): Promise<ProgramActivation | null>
  setActiveProgram(
    userId: string,
    programId: string,
    startDate?: string,
  ): Promise<ProgramActivation>
  updateActiveProgram(
    userId: string,
    updates: { currentBlockOrdinal?: number; currentWeekNumber?: number },
  ): Promise<ProgramActivation>
  clearActiveProgram(userId: string): Promise<void>

  // Share link operations
  getShareLinks(userId: string): Promise<ShareLink[]>
  getShareLinksForEntity(entityType: ShareableEntityType, entityId: string): Promise<ShareLink[]>
  createShareLink(
    link: Omit<ShareLink, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<ShareLink>
  revokeShareLink(id: string): Promise<void>
  deleteShareLink(id: string): Promise<void>

  // Analytics operations

  /** Returns weekly volume (tonnage) for an exercise over the last N weeks. */
  getWeeklyVolume(userId: string, exerciseId: string, weeks?: number): Promise<WeeklyVolumeEntry[]>

  /** Returns aggregate workout and volume stats for the vault summary card. */
  getVaultSummary(userId: string): Promise<VaultSummary>

  // ============================================================
  // Accountability Groups
  // ============================================================
  createGroup(
    group: Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>,
  ): Promise<AccountabilityGroup>
  getGroups(): Promise<AccountabilityGroup[]>
  getGroup(id: string): Promise<AccountabilityGroup | null>
  updateGroup(
    id: string,
    updates: Partial<Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>>,
  ): Promise<AccountabilityGroup>
  deleteGroup(id: string): Promise<void>

  // ============================================================
  // Group Members
  // ============================================================
  getGroupMembers(groupId: string): Promise<GroupMember[]>
  removeGroupMember(groupId: string, userId: string): Promise<void>
  updateMemberRole(groupId: string, userId: string, role: GroupRole): Promise<GroupMember>

  // ============================================================
  // Group Invites
  // ============================================================
  createInvite(groupId: string): Promise<GroupInvite>
  getGroupInvites(groupId: string): Promise<GroupInvite[]>
  revokeInvite(inviteId: string): Promise<void>
  joinGroupByCode(code: string): Promise<GroupMember>

  // ============================================================
  // Direct Connections
  // ============================================================
  requestConnection(recipientId: string): Promise<DirectConnection>
  getConnections(): Promise<DirectConnection[]>
  getPendingConnections(): Promise<DirectConnection[]>
  acceptConnection(connectionId: string): Promise<DirectConnection>
  declineConnection(connectionId: string): Promise<DirectConnection>
  removeConnection(connectionId: string): Promise<void>
  updateConnectionWriteAccess(connectionId: string, grantsWrite: boolean): Promise<DirectConnection>

  // ============================================================
  // Activity Feed
  // ============================================================
  getGroupActivityFeed(
    groupId: string,
    options?: ActivityFeedOptions,
  ): Promise<GroupActivityFeedEntry[]>
  getConnectionActivityFeed(options?: ActivityFeedOptions): Promise<ConnectionActivityFeedEntry[]>

  // ============================================================
  // Chat
  // ============================================================
  createConversation(
    type: ConversationType,
    participantIds: string[],
    title?: string,
    groupId?: string,
  ): Promise<Conversation>
  getConversations(): Promise<Conversation[]>
  getConversation(id: string): Promise<Conversation | null>
  findDirectConversation(otherUserId: string): Promise<Conversation | null>
  sendMessage(conversationId: string, messageType: MessageType, content?: string): Promise<Message>
  getMessages(conversationId: string, options: MessagePaginationOptions): Promise<Message[]>
  getMessagesSince(conversationId: string, since: string): Promise<Message[]>
  updateLastRead(conversationId: string): Promise<void>
  getUnreadCounts(): Promise<Map<string, number>>
  addParticipant(conversationId: string, userId: string): Promise<ConversationParticipant>
  leaveConversation(conversationId: string): Promise<void>
  toggleArchive(conversationId: string): Promise<void>
  saveMediaAttachment(
    messageId: string,
    attachment: Omit<MediaAttachment, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MediaAttachment>
  getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]>
  updateMediaAttachment(
    attachmentId: string,
    updates: Partial<
      Pick<MediaAttachment, 'status' | 'thumbnailUrl' | 'playbackUrl' | 'providerAssetId'>
    >,
  ): Promise<MediaAttachment>
}
