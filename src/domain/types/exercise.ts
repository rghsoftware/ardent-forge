import { z } from 'zod'
import { syncableEntitySchema } from './units'
import type { SyncableEntity } from './units'

// Re-export SyncableEntity for downstream consumers that import from exercise.ts
export type { SyncableEntity }

// ---------------------------------------------------------------------------
// ExerciseCategory
// ---------------------------------------------------------------------------

export const exerciseCategorySchema = z.enum([
  'BARBELL',
  'DUMBBELL',
  'KETTLEBELL',
  'BODYWEIGHT',
  'MACHINE',
  'CABLE',
  'CARDIO',
  'PLYOMETRIC',
  'LOADED_CARRY',
])
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>

// ---------------------------------------------------------------------------
// MovementPattern
// Spec aligned to implementation: SQUAT, HINGE, PUSH, PULL, CARRY, ROTATE, GAIT, ISOMETRIC
// ---------------------------------------------------------------------------

export const movementPatternSchema = z.enum([
  'SQUAT',
  'HINGE',
  'PUSH',
  'PULL',
  'CARRY',
  'ROTATE',
  'GAIT',
  'ISOMETRIC',
])
export type MovementPattern = z.infer<typeof movementPatternSchema>

// ---------------------------------------------------------------------------
// MuscleGroup
// ---------------------------------------------------------------------------

export const muscleGroupSchema = z.enum([
  'CHEST',
  'BACK',
  'SHOULDERS',
  'BICEPS',
  'TRICEPS',
  'QUADS',
  'HAMSTRINGS',
  'GLUTES',
  'CALVES',
  'CORE',
  'FOREARMS',
  'TRAPS',
  'LATS',
  'FULL_BODY',
])
export type MuscleGroup = z.infer<typeof muscleGroupSchema>

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export const equipmentSchema = z.enum([
  'BARBELL',
  'DUMBBELL',
  'KETTLEBELL',
  'PULL_UP_BAR',
  'DIP_BARS',
  'BENCH',
  'SQUAT_RACK',
  'CABLE_MACHINE',
  'RESISTANCE_BAND',
  'TREADMILL',
  'ROWER',
  'BIKE',
  'RUCK_PLATE',
  'WEIGHT_VEST',
  'JUMP_ROPE',
  'NONE',
])
export type Equipment = z.infer<typeof equipmentSchema>

// ---------------------------------------------------------------------------
// MuscleGroupSpec -- primary and secondary muscle groups for an exercise
// ---------------------------------------------------------------------------

export const muscleGroupSpecSchema = z.object({
  primary: z.array(muscleGroupSchema).min(1),
  secondary: z.array(muscleGroupSchema),
})
export type MuscleGroupSpec = z.infer<typeof muscleGroupSpecSchema>

// ---------------------------------------------------------------------------
// Exercise -- invariant EX-1: name must be 1-100 chars
// Deferred: EX-2 (1RM support consistency) enforced at service layer
// Deferred: EX-3 (category-equipment consistency) enforced at service layer
// ---------------------------------------------------------------------------

export const exerciseSchema = syncableEntitySchema.extend({
  name: z.string().min(1).max(100), // EX-1
  aliases: z.array(z.string().min(1)),
  category: exerciseCategorySchema,
  movementPattern: movementPatternSchema,
  muscleGroups: muscleGroupSpecSchema,
  isBilateral: z.boolean(),
  supports1RM: z.boolean(),
  equipmentRequired: z.array(equipmentSchema),
  isCustom: z.boolean(),
})
export type Exercise = z.infer<typeof exerciseSchema>
