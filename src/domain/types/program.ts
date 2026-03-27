import { z } from 'zod'
import { syncableEntitySchema } from './units'
import { sessionTypeSchema } from './session'

// Re-export SessionType so consumers can import it from either program.ts or session.ts
export { sessionTypeSchema } from './session'
export type { SessionType } from './session'

// ---------------------------------------------------------------------------
// ProgramSource -- where a program originated
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
  name: z.string().min(1),
  description: z.string().optional(),
  source: programSourceSchema,
  durationWeeks: z.number().int().positive().optional(),
  isPublic: z.boolean(),
  createdBy: z.string(),
})
export type Program = z.infer<typeof programSchema>

// ---------------------------------------------------------------------------
// Block -- a phase within a program
// invariant P-1: ordinal must be a positive integer (sequential enforcement
// is a collection-level concern, not enforced at the schema level)
// ---------------------------------------------------------------------------

export const blockSchema = z.object({
  id: z.string(),
  programId: z.string(),
  name: z.string().min(1),
  ordinal: z.number().int().positive(), // P-1
  durationWeeks: z.number().int().positive(),
  blockType: blockTypeSchema,
})
export type Block = z.infer<typeof blockSchema>

// ---------------------------------------------------------------------------
// BlockWeek -- a specific week within a block
// ---------------------------------------------------------------------------

export const blockWeekSchema = z.object({
  id: z.string(),
  blockId: z.string(),
  weekNumber: z.number().int().positive(),
})
export type BlockWeek = z.infer<typeof blockWeekSchema>

// ---------------------------------------------------------------------------
// ScheduledSession -- a session assigned to a specific week/day in a program
// ---------------------------------------------------------------------------

export const scheduledSessionSchema = z.object({
  id: z.string(),
  blockWeekId: z.string(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayLabel: z.string(),
  sessionType: sessionTypeSchema,
  sessionTemplateId: z.string(), // P-3: must reference a valid SessionTemplate
  notes: z.string().optional(),
})
export type ScheduledSession = z.infer<typeof scheduledSessionSchema>
