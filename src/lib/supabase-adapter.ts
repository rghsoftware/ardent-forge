import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataAdapter, ExerciseFilters } from './data-adapter'
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
    let query = this.client.from('exercises').select('*')

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.movementPattern) {
      query = query.eq('movement_pattern', filters.movementPattern)
    }
    if (filters?.searchQuery) {
      query = query.ilike('name', `%${filters.searchQuery}%`)
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

  async createLoggedSet(set: Omit<LoggedSet, 'id'>): Promise<LoggedSet> {
    const userId = await this.getCurrentUserId()
    const row = fromLoggedSet(set, userId)

    const { data, error } = await this.client.from('logged_sets').insert(row).select().single()
    if (error) throw error
    return toLoggedSet(data as LoggedSetRow)
  }

  async updateLoggedSet(set: LoggedSet): Promise<LoggedSet> {
    const userId = await this.getCurrentUserId()
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
}
