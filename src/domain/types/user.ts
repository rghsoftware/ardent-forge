import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  syncableEntitySchema,
  appendOnlyEntitySchema,
  weightSchema,
  durationSchema,
  oneRepMaxSchema,
} from './units'

// ---------------------------------------------------------------------------
// PreferredUnits -- user's preferred measurement system
// ---------------------------------------------------------------------------

export const preferredUnitsSchema = z.enum(['IMPERIAL', 'METRIC'])
export type PreferredUnits = z.infer<typeof preferredUnitsSchema>

// ---------------------------------------------------------------------------
// UserProfile -- user settings and training data
// ---------------------------------------------------------------------------

// F018 (M10/Tech.md D14): The legacy `displayVisible` global opt-in flag has
// been removed. The decision is now per-workout via the gym picker (gym vs.
// Private). The Postgres `user_profiles.display_visible` column was dropped
// in the F018 migration.
export const userProfileSchema = syncableEntitySchema.extend({
  displayName: z.string().optional(),
  // Map from exerciseId to OneRepMax -- PR-1 enforced by oneRepMaxSchema
  exerciseMaxes: z.record(entityId, oneRepMaxSchema),
  bodyweight: weightSchema.optional(),
  // Map from exerciseId to max reps count
  maxReps: z.record(entityId, z.number().int().positive()),
  preferredUnits: preferredUnitsSchema,
  trainingAge: durationSchema.optional(),
})
export type UserProfile = z.infer<typeof userProfileSchema>

// ---------------------------------------------------------------------------
// OneRepMaxHistory -- historical record of 1RM entries (insert-only per PR-2)
// Uses appendOnlyEntitySchema because this entity has no updated_at column
// and is immutable once inserted (enforced by DB trigger).
// invariant PR-1: weight.value > 0 enforced by weightSchema
// ---------------------------------------------------------------------------

export const oneRepMaxHistorySchema = appendOnlyEntitySchema.extend({
  userId: entityId,
  exerciseId: entityId,
  weight: weightSchema, // PR-1: weight.value > 0 enforced by weightSchema positive()
  estimated: z.boolean(),
  recordedAt: isoDateTime,
})
export type OneRepMaxHistory = z.infer<typeof oneRepMaxHistorySchema>
