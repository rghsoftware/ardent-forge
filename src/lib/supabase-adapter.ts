import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DataAdapter,
  ExerciseFilters,
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
  ShareLinkRow,
  EventItemRow,
  ConversationRow,
  ConversationParticipantRow,
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
  fromProgram,
  toBlock,
  fromBlock,
  toBlockWeek,
  fromBlockWeek,
  toScheduledSession,
  fromScheduledSession,
  toProgramActivation,
  toShareLink,
  fromShareLink,
  toEventItem,
  fromEventItem,
  toConversation,
  fromConversation,
  toConversationParticipant,
  toMessage,
  fromMessage,
  toMediaAttachment,
  fromMediaAttachment,
} from './data-mapper'
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
  // Exercise operations
  // ---------------------------------------------------------------------------

  async getExercises(filters?: ExerciseFilters): Promise<Exercise[]> {
    // When a search query is provided, use the search_exercises Postgres function
    // which searches both name and aliases. Additional filters are applied client-side
    // since the RPC returns full exercise rows.
    if (filters?.searchQuery) {
      const { data, error } = await this.client.rpc('search_exercises', {
        query_text: filters.searchQuery,
      })
      if (error) throw error

      let exercises = (data as ExerciseRow[]).map(toExercise)

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

    // No search query -- use standard table query with column filters
    let query = this.client.from('exercises').select('*')

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.movementPattern) {
      query = query.eq('movement_pattern', filters.movementPattern)
    }
    if (filters?.muscleGroup) {
      query = query.contains('muscle_groups', { primary: [filters.muscleGroup] })
    }
    if (filters?.isCustom !== undefined) {
      query = query.eq('is_custom', filters.isCustom)
    }

    const { data, error } = await query.order('name')
    if (error) throw error
    return (data as ExerciseRow[]).map(toExercise)
  }

  async getExercise(id: string): Promise<Exercise | null> {
    const { data, error } = await this.client
      .from('exercises')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toExercise(data as ExerciseRow) : null
  }

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Exercise> {
    const userId = await this.getCurrentUserId()
    // RLS policy blocks non-custom inserts from client; force is_custom: true as defense-in-depth
    const row = {
      ...fromExercise(exercise),
      is_custom: true,
      user_id: userId,
    }

    const { data, error } = await this.client.from('exercises').insert(row).select().single()
    if (error) throw error
    return toExercise(data as ExerciseRow)
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
    return (data as WorkoutLogRow[]).map(toWorkoutLog)
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
        log: toWorkoutLog(row as unknown as WorkoutLogRow),
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
    return data ? toWorkoutLog(data as WorkoutLogRow) : null
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
    const groups = (groupData as LoggedActivityGroupRow[]).map(toLoggedActivityGroup)
    const groupIds = groups.map((g) => g.id)

    if (groupIds.length === 0) {
      return { log: toWorkoutLog(logData as WorkoutLogRow), groups, activities: [], sets: [] }
    }

    const { data: actData, error: actError } = await this.client
      .from('logged_activities')
      .select('*')
      .in('logged_group_id', groupIds)
      .order('ordinal')
    if (actError) throw actError
    const activities = (actData as LoggedActivityRow[]).map(toLoggedActivity)
    const activityIds = activities.map((a) => a.id)

    if (activityIds.length === 0) {
      return { log: toWorkoutLog(logData as WorkoutLogRow), groups, activities, sets: [] }
    }

    const { data: setData, error: setError } = await this.client
      .from('logged_sets')
      .select('*')
      .in('logged_activity_id', activityIds)
      .order('set_number')
    if (setError) throw setError
    const sets = (setData as LoggedSetRow[]).map(toLoggedSet)

    return {
      log: toWorkoutLog(logData as WorkoutLogRow),
      groups,
      activities,
      sets,
    }
  }

  async createWorkoutLog(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkoutLog> {
    const row = fromWorkoutLog(log)

    const { data, error } = await this.client.from('workout_logs').insert(row).select().single()
    if (error) throw error
    return toWorkoutLog(data as WorkoutLogRow)
  }

  async updateWorkoutLog(log: WorkoutLog): Promise<WorkoutLog> {
    const row = fromWorkoutLog(log)

    const { data, error } = await this.client
      .from('workout_logs')
      .update(row)
      .eq('id', log.id)
      .select()
      .single()
    if (error) throw error
    return toWorkoutLog(data as WorkoutLogRow)
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
    const row = fromLoggedActivityGroup(group, userId)

    const { data, error } = await this.client
      .from('logged_activity_groups')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toLoggedActivityGroup(data as LoggedActivityGroupRow)
  }

  // ---------------------------------------------------------------------------
  // LoggedActivity
  // ---------------------------------------------------------------------------

  async createLoggedActivity(
    activity: Omit<LoggedActivity, 'id'>,
    userId: string,
  ): Promise<LoggedActivity> {
    const row = fromLoggedActivity(activity, userId)

    const { data, error } = await this.client
      .from('logged_activities')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toLoggedActivity(data as LoggedActivityRow)
  }

  // ---------------------------------------------------------------------------
  // LoggedSet
  // ---------------------------------------------------------------------------

  async createLoggedSet(set: Omit<LoggedSet, 'id'>, userId: string): Promise<LoggedSet> {
    const row = fromLoggedSet(set, userId)

    const { data, error } = await this.client.from('logged_sets').insert(row).select().single()
    if (error) throw error
    return toLoggedSet(data as LoggedSetRow)
  }

  async updateLoggedSet(set: LoggedSet, userId: string): Promise<LoggedSet> {
    const row = fromLoggedSet(set, userId)

    const { data, error } = await this.client
      .from('logged_sets')
      .update(row)
      .eq('id', set.id)
      .select()
      .single()
    if (error) throw error
    return toLoggedSet(data as LoggedSetRow)
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
    return data ? toUserProfile(data as UserProfileRow) : null
  }

  async updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
    const row = fromUserProfile(profile)

    const { data, error } = await this.client
      .from('user_profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()
    if (error) throw error
    return toUserProfile(data as UserProfileRow)
  }

  async saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory> {
    const row = fromOneRepMaxHistory(entry)

    const { data, error } = await this.client
      .from('one_rep_max_history')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toOneRepMaxHistory(data as OneRepMaxHistoryRow)
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
    return (data as OneRepMaxHistoryRow[]).map(toOneRepMaxHistory)
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
        workout_logs: WorkoutLogRow
      }
      logged_sets: LoggedSetRow[]
    }
    const rows = data as unknown as ActivityWithJoins[]

    // Group by workout_log_id and map to domain types
    const grouped = new Map<string, { log: WorkoutLog; sets: LoggedSet[] }>()

    for (const row of rows) {
      const logId = row.logged_activity_groups.workout_log_id
      if (!grouped.has(logId)) {
        grouped.set(logId, {
          log: toWorkoutLog(row.logged_activity_groups.workout_logs),
          sets: [],
        })
      }
      const entry = grouped.get(logId)!
      for (const setRow of row.logged_sets) {
        entry.sets.push(toLoggedSet(setRow))
      }
    }

    return Array.from(grouped.values())
  }

  // ---------------------------------------------------------------------------
  // Session template operations
  // ---------------------------------------------------------------------------

  async getSessionTemplates(userId: string): Promise<SessionTemplate[]> {
    const { data, error } = await this.client
      .from('session_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as SessionTemplateRow[]).map(toSessionTemplate)
  }

  async getSessionTemplate(id: string): Promise<SessionTemplate | null> {
    const { data, error } = await this.client
      .from('session_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toSessionTemplate(data as SessionTemplateRow) : null
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
    const groups = (groupData as ActivityGroupRow[]).map(toActivityGroupFlat)
    const groupIds = groups.map((g) => g.id)

    const template = toSessionTemplate(templateData as SessionTemplateRow)

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
    const activities = (actData as ActivityRow[]).map(toActivity)

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
    const templateRow = fromSessionTemplate(template)

    const { data: tData, error: tError } = await this.client
      .from('session_templates')
      .insert(templateRow)
      .select()
      .single()
    if (tError) throw tError
    const createdTemplate = toSessionTemplate(tData as SessionTemplateRow)

    const allGroups: Array<Omit<ActivityGroup, 'activities'>> = []
    const allActivities: Activity[] = []

    for (const groupInput of groups) {
      const groupRow = fromActivityGroup(groupInput.group, createdTemplate.id)

      const { data: gData, error: gError } = await this.client
        .from('activity_groups')
        .insert(groupRow)
        .select()
        .single()
      if (gError) throw gError
      const createdGroup = toActivityGroupFlat(gData as ActivityGroupRow)
      allGroups.push(createdGroup)

      for (const actInput of groupInput.activities) {
        const actRow = fromActivity(actInput, createdGroup.id)

        const { data: aData, error: aError } = await this.client
          .from('activities')
          .insert(actRow)
          .select()
          .single()
        if (aError) throw aError
        allActivities.push(toActivity(aData as ActivityRow))
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
    const templateRow = fromSessionTemplate(template)

    const { data: tData, error: tError } = await this.client
      .from('session_templates')
      .update(templateRow)
      .eq('id', template.id)
      .select()
      .single()
    if (tError) throw tError
    const updatedTemplate = toSessionTemplate(tData as SessionTemplateRow)

    // Delete existing groups (cascade handles activities)
    const { error: delError } = await this.client
      .from('activity_groups')
      .delete()
      .eq('session_template_id', template.id)
    if (delError) throw delError

    const allGroups: Array<Omit<ActivityGroup, 'activities'>> = []
    const allActivities: Activity[] = []

    for (const groupInput of groups) {
      const groupRow = fromActivityGroup(groupInput.group, template.id)

      const { data: gData, error: gError } = await this.client
        .from('activity_groups')
        .insert(groupRow)
        .select()
        .single()
      if (gError) throw gError
      const createdGroup = toActivityGroupFlat(gData as ActivityGroupRow)
      allGroups.push(createdGroup)

      for (const actInput of groupInput.activities) {
        const actRow = fromActivity(actInput, createdGroup.id)

        const { data: aData, error: aError } = await this.client
          .from('activities')
          .insert(actRow)
          .select()
          .single()
        if (aError) throw aError
        allActivities.push(toActivity(aData as ActivityRow))
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
    return (data as EventItemRow[]).map(toEventItem)
  }

  async saveEventItem(
    item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>,
    parentId: string,
    parentType: 'template' | 'log',
  ): Promise<EventItem> {
    const row = fromEventItem(item, parentId, parentType)
    const { data, error } = await this.client.from('event_items').insert(row).select().single()
    if (error) throw error
    return toEventItem(data as EventItemRow)
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
    return toEventItem(data as EventItemRow)
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
    return toEventItem(data as EventItemRow)
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

  async getPrograms(userId: string): Promise<Program[]> {
    const { data, error } = await this.client
      .from('programs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as ProgramRow[]).map(toProgram)
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
    const blocks = (blockData as BlockRow[]).map(toBlock)
    const blockIds = blocks.map((b) => b.id)

    if (blockIds.length === 0) {
      return {
        program: toProgram(programData as ProgramRow),
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
    const blockWeeks = (weekData as BlockWeekRow[]).map(toBlockWeek)
    const weekIds = blockWeeks.map((w) => w.id)

    if (weekIds.length === 0) {
      return {
        program: toProgram(programData as ProgramRow),
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
    const scheduledSessions = (sessionData as ScheduledSessionRow[]).map(toScheduledSession)

    return {
      program: toProgram(programData as ProgramRow),
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
      ...fromProgram(program),
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
        ...fromBlock(blockEntry.block, programId),
      }

      const { error: bError } = await this.client.from('blocks').insert(blockRow).select().single()
      if (bError) throw bError

      for (const weekEntry of blockEntry.weeks) {
        const weekId = crypto.randomUUID()
        const weekRow = {
          id: weekId,
          ...fromBlockWeek(weekEntry.week, blockId),
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
            ...fromScheduledSession(sessionInput, weekId),
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
    const { user_id: _, ...updateFields } = fromProgram(program)
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
        ...fromBlock(blockEntry.block, program.id),
      }

      const { error: bError } = await this.client.from('blocks').insert(blockRow).select().single()
      if (bError) throw bError

      for (const weekEntry of blockEntry.weeks) {
        const weekId = weekEntry.week.id ?? crypto.randomUUID()
        const weekRow = {
          id: weekId,
          ...fromBlockWeek(weekEntry.week, blockId),
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
            ...fromScheduledSession(sessionInput, weekId),
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
    return toProgram(data)
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
    return data ? toProgramActivation(data as ProgramActivationRow) : null
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
    return toProgramActivation(data as ProgramActivationRow)
  }

  async updateActiveProgram(
    userId: string,
    updates: { currentBlockOrdinal?: number; currentWeekNumber?: number },
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

    const { data, error } = await this.client
      .from('program_activations')
      .update(row)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) throw error
    return toProgramActivation(data as ProgramActivationRow)
  }

  async clearActiveProgram(userId: string): Promise<void> {
    const { error } = await this.client.from('program_activations').delete().eq('user_id', userId)
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
    return (data as ShareLinkRow[]).map(toShareLink)
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
    return (data as ShareLinkRow[]).map(toShareLink)
  }

  async createShareLink(
    link: Omit<ShareLink, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<ShareLink> {
    const { data, error } = await this.client
      .from('share_links')
      .insert(fromShareLink(link))
      .select()
      .single()
    if (error) throw error
    return toShareLink(data as ShareLinkRow)
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
    const conversationRow = fromConversation({
      type,
      title,
      groupId,
    })
    const { data: convData, error: convError } = await this.client
      .from('conversations')
      .insert(conversationRow)
      .select()
      .single()
    if (convError) throw convError

    // 2. Insert participant rows -- include the current user plus all provided IDs
    const allParticipantIds = [...new Set([userId, ...participantIds])]
    for (const pid of allParticipantIds) {
      const { error: pError } = await this.client.from('conversation_participants').insert({
        conversation_id: (convData as ConversationRow).id,
        user_id: pid,
      })
      if (pError) throw pError
    }

    return toConversation(convData as ConversationRow, allParticipantIds)
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

    return (data as ConversationRow[]).map((row) =>
      toConversation(row, participantsByConv.get(row.id) ?? []),
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

    return toConversation(
      data as ConversationRow,
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

    const row = fromMessage({
      conversationId,
      senderId: userId,
      messageType,
      content,
    })
    // Remove sync_status -- it is SQLite-only and not a column in the Supabase table
    delete row.sync_status

    const { data, error } = await this.client.from('messages').insert(row).select().single()
    if (error) throw error
    return toMessage(data as MessageRow)
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
    return (data as MessageRow[]).map(toMessage).reverse()
  }

  async getMessagesSince(conversationId: string, since: string): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as MessageRow[]).map(toMessage)
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
    return toConversationParticipant(data as ConversationParticipantRow)
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
    const row = fromMediaAttachment({ ...attachment, messageId })
    const { data, error } = await this.client
      .from('media_attachments')
      .insert(row)
      .select()
      .single()
    if (error) throw error
    return toMediaAttachment(data as MediaAttachmentRow)
  }

  async getMediaAttachments(messageIds: string[]): Promise<MediaAttachment[]> {
    if (messageIds.length === 0) return []

    const { data, error } = await this.client
      .from('media_attachments')
      .select('*')
      .in('message_id', messageIds)
    if (error) throw error
    return (data as MediaAttachmentRow[]).map(toMediaAttachment)
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
    return toMediaAttachment(data as MediaAttachmentRow)
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
