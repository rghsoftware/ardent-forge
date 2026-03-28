import type {
  Exercise,
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  UserProfile,
  OneRepMaxHistory,
} from '@/domain/types'
import type { ExerciseCategory, MovementPattern, MuscleGroup } from '@/domain/types'

export type WorkoutWithSets = { log: WorkoutLog; sets: LoggedSet[] }

export type WorkoutLogSummary = {
  log: WorkoutLog
  exerciseNames: string[]
  setCount: number
  exerciseCount: number
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
 * Current scope (Steps 3-5): exercises, workout logs, user profiles, and 1RM history.
 * Program, session template, and sharing operations will be added in later steps.
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
}
