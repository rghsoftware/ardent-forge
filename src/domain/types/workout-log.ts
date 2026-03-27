import { z } from 'zod'
import {
  syncableEntitySchema,
  weightSchema,
  durationSchema,
  distanceSchema,
  paceSchema,
  programContextSchema,
} from './units'
import { groupTypeSchema } from './session'
import { loadSpecSchema } from './set-scheme'

// ---------------------------------------------------------------------------
// SetType -- classification of an individual logged set
// ---------------------------------------------------------------------------

export const setTypeSchema = z.enum(['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF'])
export type SetType = z.infer<typeof setTypeSchema>

// ---------------------------------------------------------------------------
// Prescription -- what was prescribed for a set (all fields optional because
// prescription depends on the SetScheme type)
// ---------------------------------------------------------------------------

export const prescriptionSchema = z.object({
  reps: z.number().int().positive().optional(),
  weight: weightSchema.optional(),
  duration: durationSchema.optional(),
  distance: distanceSchema.optional(),
  loadSpec: loadSpecSchema.optional(),
  notes: z.string().optional(),
})
export type Prescription = z.infer<typeof prescriptionSchema>

// ---------------------------------------------------------------------------
// WorkoutLog -- a completed or in-progress training session
// invariant L-1: startedAt is required (enforced by non-optional field)
// invariant L-2: completedAt must be after startedAt (enforced by .refine())
// invariant L-6: perceivedDifficulty must be 1-10
// ---------------------------------------------------------------------------

export const workoutLogSchema = syncableEntitySchema
  .extend({
    userId: z.string(),
    startedAt: z.string(), // L-1: required ISO 8601
    completedAt: z.string().optional(), // null means in-progress
    sessionTemplateId: z.string().optional(),
    programContext: programContextSchema.optional(),
    overallNotes: z.string().optional(),
    perceivedDifficulty: z.number().int().min(1).max(10).optional(), // L-6
    bodweightAtSession: weightSchema.optional(),
  })
  .refine((data) => !data.completedAt || data.completedAt >= data.startedAt, {
    message: 'completedAt must be after startedAt', // L-2
    path: ['completedAt'],
  })
export type WorkoutLog = z.infer<typeof workoutLogSchema>

// ---------------------------------------------------------------------------
// LoggedActivityGroup -- a group of logged activities within a workout
// ---------------------------------------------------------------------------

export const loggedActivityGroupSchema = z.object({
  id: z.string(),
  workoutLogId: z.string(),
  groupType: groupTypeSchema,
  ordinal: z.number().int().positive(),
  actualRoundsCompleted: z.number().int().positive().optional(),
  completionTime: durationSchema.optional(),
})
export type LoggedActivityGroup = z.infer<typeof loggedActivityGroupSchema>

// ---------------------------------------------------------------------------
// LoggedActivity -- a specific exercise logged within a group
// ---------------------------------------------------------------------------

export const loggedActivitySchema = z.object({
  id: z.string(),
  loggedGroupId: z.string(),
  exerciseId: z.string(),
  ordinal: z.number().int().positive(),
  notes: z.string().optional(),
})
export type LoggedActivity = z.infer<typeof loggedActivitySchema>

// ---------------------------------------------------------------------------
// LoggedSet -- a single set logged during a workout
// invariant L-3: setNumber >= 1
// invariant L-5: if completed, at least one actual measurement must be present
// invariant L-7: rpe must be 1-10
// ---------------------------------------------------------------------------

export const loggedSetSchema = z
  .object({
    id: z.string(),
    loggedActivityId: z.string(),
    setNumber: z.number().int().min(1), // L-3
    setType: setTypeSchema,
    prescribed: prescriptionSchema.optional(),
    actualReps: z.number().int().nonnegative().optional(),
    actualWeight: weightSchema.optional(),
    actualDuration: durationSchema.optional(),
    actualDistance: distanceSchema.optional(),
    actualPace: paceSchema.optional(),
    actualHeartRate: z.number().int().positive().optional(),
    rpe: z.number().min(1).max(10).optional(), // L-7
    completed: z.boolean(),
    notes: z.string().optional(),
    ruckLoad: weightSchema.optional(),
    elevationGain: distanceSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.completed) return true
      // L-5: a completed set must have at least one actual measurement
      return (
        data.actualReps !== undefined ||
        data.actualWeight !== undefined ||
        data.actualDuration !== undefined ||
        data.actualDistance !== undefined
      )
    },
    {
      message: 'A completed set must have at least one actual measurement', // L-5
      path: ['completed'],
    },
  )
export type LoggedSet = z.infer<typeof loggedSetSchema>
