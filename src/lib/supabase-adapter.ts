import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DataAdapter,
  ExerciseFilters,
  ProgramFull,
  SessionTemplateFull,
  VaultSummary,
  WorkoutLogSummary,
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
  WeeklyVolumeEntry,
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
} from './data-mapper'

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

    if (groupIds.length === 0) {
      return {
        template: toSessionTemplate(templateData as SessionTemplateRow),
        groups,
        activities: [],
      }
    }

    const { data: actData, error: actError } = await this.client
      .from('activities')
      .select('*')
      .in('activity_group_id', groupIds)
      .order('ordinal')
    if (actError) throw actError
    const activities = (actData as ActivityRow[]).map(toActivity)

    return {
      template: toSessionTemplate(templateData as SessionTemplateRow),
      groups,
      activities,
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

    return { template: createdTemplate, groups: allGroups, activities: allActivities }
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

    return { template: updatedTemplate, groups: allGroups, activities: allActivities }
  }

  async deleteSessionTemplate(id: string): Promise<void> {
    const { error } = await this.client.from('session_templates').delete().eq('id', id)
    if (error) throw error
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
