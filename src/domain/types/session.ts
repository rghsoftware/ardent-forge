import { z } from 'zod'
import { entityId, syncableEntitySchema, durationSchema } from './units'
import { setSchemeSchema } from './set-scheme'

// ---------------------------------------------------------------------------
// GroupType -- how activities within a group are structured
// Spec aligned to implementation: STRAIGHT_SETS, SUPERSET, CIRCUIT, COMPLEX, EMOM, AMRAP, COUPLET
// ---------------------------------------------------------------------------

export const groupTypeSchema = z.enum([
  'STRAIGHT_SETS',
  'SUPERSET',
  'CIRCUIT',
  'COMPLEX',
  'EMOM',
  'AMRAP',
  'COUPLET',
])
export type GroupType = z.infer<typeof groupTypeSchema>

// ---------------------------------------------------------------------------
// ScoringType -- how a session's performance is scored
// Combined spec + implementation values: NONE, FOR_TIME, TIME, FOR_REPS, ROUNDS_PLUS_REPS, FOR_DISTANCE, LOAD
// ---------------------------------------------------------------------------

export const scoringTypeSchema = z.enum([
  'NONE',
  'FOR_TIME',
  'TIME',
  'FOR_REPS',
  'ROUNDS_PLUS_REPS',
  'FOR_DISTANCE',
  'LOAD',
])
export type ScoringType = z.infer<typeof scoringTypeSchema>

// ---------------------------------------------------------------------------
// SessionType -- the category of training for a session
// Also consumed by program.ts (re-exported from there)
// ---------------------------------------------------------------------------

export const sessionTypeSchema = z.enum(['STRENGTH', 'CONDITIONING', 'SE', 'MIXED'])
export type SessionType = z.infer<typeof sessionTypeSchema>

// ---------------------------------------------------------------------------
// SessionTemplate -- a reusable session definition
// ---------------------------------------------------------------------------

export const sessionTemplateSchema = syncableEntitySchema.extend({
  userId: entityId,
  name: z.string().min(1),
  description: z.string().optional(),
  category: sessionTypeSchema,
  restBetweenGroups: durationSchema.optional(),
  timeCap: durationSchema.optional(),
  scoring: scoringTypeSchema,
})
export type SessionTemplate = z.infer<typeof sessionTemplateSchema>

// ---------------------------------------------------------------------------
// Activity -- a single prescribed exercise within an activity group
// invariant P-5: ordinal must be a positive integer
// ---------------------------------------------------------------------------

export const activitySchema = z.object({
  id: entityId,
  activityGroupId: entityId,
  exerciseId: entityId,
  setScheme: setSchemeSchema,
  ordinal: z.number().int().positive(), // P-5
  notes: z.string().optional(),
})
export type Activity = z.infer<typeof activitySchema>

// ---------------------------------------------------------------------------
// ActivityGroup -- a collection of activities within a session template
// invariant P-4: activities must have at least one entry
// invariant P-6: rounds must be null or >= 1
// ---------------------------------------------------------------------------

export const activityGroupSchema = z.object({
  id: entityId,
  sessionTemplateId: entityId,
  groupType: groupTypeSchema,
  ordinal: z.number().int().positive(),
  rounds: z.number().int().min(1).optional(), // P-6: null or >= 1
  restBetweenRounds: durationSchema.optional(),
  restBetweenActivities: durationSchema.optional(),
  activities: z.array(activitySchema).min(1), // P-4
})
export type ActivityGroup = z.infer<typeof activityGroupSchema>
