import type { Exercise, WorkoutLog, LoggedSet, UserProfile, OneRepMaxHistory } from '@/domain/types'
import type { ExerciseCategory, MovementPattern, MuscleGroup, Equipment } from '@/domain/types'

export interface ExerciseFilters {
  category?: ExerciseCategory
  movementPattern?: MovementPattern
  muscleGroup?: MuscleGroup
  equipment?: Equipment
  searchQuery?: string
  isCustom?: boolean
}

export interface DataAdapter {
  // Exercise operations
  getExercises(filters?: ExerciseFilters): Promise<Exercise[]>
  getExercise(id: string): Promise<Exercise>
  createExercise(exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>): Promise<Exercise>

  // Workout log operations
  getWorkoutLogs(userId: string, limit?: number): Promise<WorkoutLog[]>
  getWorkoutLog(id: string): Promise<WorkoutLog>
  saveWorkoutLog(
    log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'> | WorkoutLog,
  ): Promise<WorkoutLog>
  deleteWorkoutLog(id: string): Promise<void>
  saveLoggedSet(set: Omit<LoggedSet, 'id'> | LoggedSet): Promise<LoggedSet>

  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile>
  updateUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile>
  saveOneRepMax(
    entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OneRepMaxHistory>
}
