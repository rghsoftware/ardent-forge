import { z } from 'zod'
import { entityId, syncableEntitySchema } from './units'
import { sessionTypeSchema } from './session'
import { setSchemeSchema } from './set-scheme'

// Re-export SessionType so consumers can import it from either program.ts or session.ts
export { sessionTypeSchema } from './session'
export type { SessionType } from './session'

// ---------------------------------------------------------------------------
// ProgramSource -- where a program originated
// Spec aligned to implementation: CUSTOM, IMPORTED, SHARED, MARKETPLACE, AI_GENERATED, COACH_ASSIGNED, TEMPLATE
// ---------------------------------------------------------------------------

export const programSourceSchema = z.enum([
  'CUSTOM',
  'IMPORTED',
  'SHARED',
  'MARKETPLACE',
  'AI_GENERATED',
  'COACH_ASSIGNED',
  'TEMPLATE',
])
export type ProgramSource = z.infer<typeof programSourceSchema>

// ---------------------------------------------------------------------------
// BlockType -- the training phase or purpose of a block
// Spec aligned to implementation: ACCUMULATION, INTENSIFICATION, REALIZATION, DELOAD, TEST
// ---------------------------------------------------------------------------

export const blockTypeSchema = z.enum([
  'ACCUMULATION',
  'INTENSIFICATION',
  'REALIZATION',
  'DELOAD',
  'TEST',
])
export type BlockType = z.infer<typeof blockTypeSchema>

// ---------------------------------------------------------------------------
// Program -- a structured training plan
// ---------------------------------------------------------------------------

export const programSchema = syncableEntitySchema.extend({
  // SH-1: userId is the owner; createdBy is the author (may differ for coach-created programs)
  userId: entityId,
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  source: programSourceSchema,
  durationWeeks: z.number().int().positive().optional(),
  isPublic: z.boolean(),
  createdBy: entityId,
})
export type Program = z.infer<typeof programSchema>

// ---------------------------------------------------------------------------
// Block -- a phase within a program
// invariant P-1: ordinal must be a positive integer (sequential enforcement
// is a collection-level concern, not enforced at the schema level)
// Deferred: P-2 (block has >= 1 week) enforced at collection level
// ---------------------------------------------------------------------------

export const blockSchema = z.object({
  id: entityId,
  programId: entityId,
  name: z.string().min(1).max(200),
  ordinal: z.number().int().positive(), // P-1
  durationWeeks: z.number().int().positive(),
  blockType: blockTypeSchema,
})
export type Block = z.infer<typeof blockSchema>

// ---------------------------------------------------------------------------
// BlockWeek -- a specific week within a block
// ---------------------------------------------------------------------------

export const blockWeekSchema = z.object({
  id: entityId,
  blockId: entityId,
  weekNumber: z.number().int().positive(),
})
export type BlockWeek = z.infer<typeof blockWeekSchema>

// ---------------------------------------------------------------------------
// ActivityOverride -- per-activity override for a scheduled session instance
// Only changed fields are stored; unchanged fields inherit from the template.
// Keyed by activity ID (UUID string), not ordinal position.
// ---------------------------------------------------------------------------

export const activityOverrideSchema = z.object({
  exerciseId: entityId.optional(), // replacement exercise UUID
  setScheme: setSchemeSchema.optional(), // full replacement set scheme
})
export type ActivityOverride = z.infer<typeof activityOverrideSchema>

// ---------------------------------------------------------------------------
// SessionOverrides -- wrapper for all per-instance overrides on a session
// Extensible: future fields (e.g., groupOverrides) can be added here.
// ---------------------------------------------------------------------------

export const sessionOverridesSchema = z.object({
  activityOverrides: z.record(z.string(), activityOverrideSchema).optional(),
})
export type SessionOverrides = z.infer<typeof sessionOverridesSchema>

// ---------------------------------------------------------------------------
// ScheduledSession -- a session assigned to a specific week/day in a program
// ---------------------------------------------------------------------------

export const scheduledSessionSchema = z.object({
  id: entityId,
  blockWeekId: entityId,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayLabel: z.string().min(1),
  sessionType: sessionTypeSchema,
  sessionTemplateId: entityId, // P-3: must reference a valid SessionTemplate
  notes: z.string().optional(),
  overrides: sessionOverridesSchema.optional().nullable(),
})
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>

// ---------------------------------------------------------------------------
// ProgramActivation -- tracks a user's active program and current position
// ---------------------------------------------------------------------------

export const programActivationSchema = syncableEntitySchema.extend({
  userId: entityId,
  programId: entityId,
  currentBlockOrdinal: z.number().int().positive(),
  currentWeekNumber: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
  // Deferred: P-4 currentBlockOrdinal and currentWeekNumber are not validated
  // against the actual program structure (collection-level concern, like P-2)
})
export type ProgramActivation = z.infer<typeof programActivationSchema>

// ---------------------------------------------------------------------------
// WeekStatus -- tracks completion/skip status for individual weeks
// Used by Program Time Travel to mark weeks as done or skipped when
// a user jumps to a different position within their active program.
// ---------------------------------------------------------------------------

export const weekStatusValueSchema = z.enum(['done', 'skipped'])
export type WeekStatusValue = z.infer<typeof weekStatusValueSchema>

export const weekStatusSchema = z.object({
  id: entityId,
  activationId: entityId,
  blockOrdinal: z.number().int().positive(),
  weekNumber: z.number().int().positive(),
  status: weekStatusValueSchema,
  createdAt: z.string(),
})
export type WeekStatus = z.infer<typeof weekStatusSchema>
