import { z } from 'zod'
import {
  distanceSchema,
  durationSchema,
  entityId,
  isoDateTime,
  paceSchema,
  programContextSchema,
  syncableEntitySchema,
  weightSchema,
} from './units'
import { groupTypeSchema } from './session'
import { loadSpecSchema } from './set-scheme'
import { eventMetadataSchema } from './event'

// ---------------------------------------------------------------------------
// SetType -- classification of an individual logged set
// ---------------------------------------------------------------------------

export const setTypeSchema = z.enum(['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF'])
export type SetType = z.infer<typeof setTypeSchema>

// ---------------------------------------------------------------------------
// Prescription -- what was prescribed for a set (all fields optional because
// prescription depends on the SetScheme type)
// ---------------------------------------------------------------------------

export const prescriptionSchema = z
  .object({
    reps: z.number().int().positive().optional(),
    weight: weightSchema.optional(),
    duration: durationSchema.optional(),
    distance: distanceSchema.optional(),
    loadSpec: loadSpecSchema.optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      data.reps !== undefined ||
      data.weight !== undefined ||
      data.duration !== undefined ||
      data.distance !== undefined ||
      data.loadSpec !== undefined ||
      data.notes !== undefined,
    { message: 'A prescription must specify at least one prescribed value' },
  )
export type Prescription = z.infer<typeof prescriptionSchema>

// ---------------------------------------------------------------------------
// WorkoutLog -- a completed or in-progress training session
// invariant L-1: startedAt is required (enforced by non-optional field)
// invariant L-2: completedAt must be after startedAt (enforced by .refine())
// invariant L-6: perceivedDifficulty must be 1-10
// Deferred: L-8 (one active workout per user) enforced at DB constraint level
// ---------------------------------------------------------------------------

export const workoutLogSchema = syncableEntitySchema
  .extend({
    userId: entityId,
    title: z.string().optional(),
    startedAt: isoDateTime, // L-1: required ISO 8601
    completedAt: isoDateTime.optional(), // null means in-progress
    sessionTemplateId: entityId.optional(),
    programContext: programContextSchema.optional(),
    overallNotes: z.string().optional(),
    perceivedDifficulty: z.number().int().min(1).max(10).optional(), // L-6
    bodyweightAtSession: weightSchema.optional(),
    eventMetadata: eventMetadataSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.completedAt) return true
      return new Date(data.completedAt).getTime() > new Date(data.startedAt).getTime()
    },
    { message: 'completedAt must be after startedAt', path: ['completedAt'] },
  )
export type WorkoutLog = z.infer<typeof workoutLogSchema>

// ---------------------------------------------------------------------------
// LoggedActivityGroup -- a group of logged activities within a workout
// ---------------------------------------------------------------------------

export const loggedActivityGroupSchema = z.object({
  id: entityId,
  workoutLogId: entityId,
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
  id: entityId,
  loggedGroupId: entityId,
  exerciseId: entityId,
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
    id: entityId,
    loggedActivityId: entityId,
    setNumber: z.number().int().min(1), // L-3
    setType: setTypeSchema,
    prescribed: prescriptionSchema.optional(),
    actualReps: z.number().int().nonnegative().optional(),
    actualWeight: weightSchema.optional(),
    actualDuration: durationSchema.optional(),
    actualDistance: distanceSchema.optional(),
    actualPace: paceSchema.optional(),
    actualHeartRate: z.number().int().positive().optional(),
    // L-7: RPE 1-10, half-values allowed (e.g. 7.5) per standard RPE scale
    rpe: z.number().min(1).max(10).multipleOf(0.5).optional(),
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
        data.actualDistance !== undefined ||
        data.actualHeartRate !== undefined
      )
    },
    {
      message: 'A completed set must have at least one actual measurement', // L-5
      path: ['completed'],
    },
  )
export type LoggedSet = z.infer<typeof loggedSetSchema>
