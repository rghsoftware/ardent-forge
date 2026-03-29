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
  deleteSessionTemplate(id: string): Promise<void>

  // Program operations
  getPrograms(userId: string): Promise<Program[]>
  getProgramFull(id: string): Promise<ProgramFull | null>
  createProgramFull(
    program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>,
    blocks: Array<{
      block: Omit<Block, 'id' | 'programId'>
      weeks: Array<{
        week: Omit<BlockWeek, 'id' | 'blockId'>
        sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
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

  // Analytics operations

  /** Returns weekly volume (tonnage) for an exercise over the last N weeks. */
  getWeeklyVolume(userId: string, exerciseId: string, weeks?: number): Promise<WeeklyVolumeEntry[]>

  /** Returns aggregate workout and volume stats for the vault summary card. */
  getVaultSummary(userId: string): Promise<VaultSummary>
}
