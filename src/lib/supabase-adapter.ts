import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataAdapter, ExerciseFilters, WorkoutLogSummary } from './data-adapter'
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
    // Find logged activities for this exercise, joined with their workout logs and sets
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
}
