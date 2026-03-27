import { z } from 'zod'
import { syncableEntitySchema, weightSchema, durationSchema, oneRepMaxSchema } from './units'

// ---------------------------------------------------------------------------
// PreferredUnits -- user's preferred measurement system
// ---------------------------------------------------------------------------

export const preferredUnitsSchema = z.enum(['IMPERIAL', 'METRIC'])
export type PreferredUnits = z.infer<typeof preferredUnitsSchema>

// ---------------------------------------------------------------------------
// UserProfile -- user settings and training data
// ---------------------------------------------------------------------------

export const userProfileSchema = syncableEntitySchema.extend({
  // Map from exerciseId to OneRepMax -- PR-1 enforced by oneRepMaxSchema
  exerciseMaxes: z.record(z.string(), oneRepMaxSchema),
  bodyweight: weightSchema.optional(),
  // Map from exerciseId to max reps count
  maxReps: z.record(z.string(), z.number().int().positive()),
  preferredUnits: preferredUnitsSchema,
  trainingAge: durationSchema.optional(),
})
export type UserProfile = z.infer<typeof userProfileSchema>

// ---------------------------------------------------------------------------
// OneRepMaxHistory -- historical record of 1RM entries (insert-only per PR-2)
// invariant PR-1: weight.value > 0 enforced by weightSchema
// ---------------------------------------------------------------------------

export const oneRepMaxHistorySchema = syncableEntitySchema.extend({
  userId: z.string(),
  exerciseId: z.string(),
  weight: weightSchema, // PR-1: weight.value > 0 enforced by weightSchema positive()
  estimated: z.boolean(),
  recordedAt: z.string(), // ISO 8601
})
export type OneRepMaxHistory = z.infer<typeof oneRepMaxHistorySchema>
