import { z } from 'zod'

// ---------------------------------------------------------------------------
// SyncableEntity -- base fields present on all persisted, syncable entities
// ---------------------------------------------------------------------------

export const syncableEntitySchema = z.object({
  id: z.string(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
})
export type SyncableEntity = z.infer<typeof syncableEntitySchema>

// ---------------------------------------------------------------------------
// Weight -- invariant U-1: value > 0, unit must be 'lb' | 'kg'
// ---------------------------------------------------------------------------

export const weightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(['lb', 'kg']),
})
export type Weight = z.infer<typeof weightSchema>

// ---------------------------------------------------------------------------
// Distance -- invariant U-2: value >= 0, unit must be 'mi' | 'km' | 'm' | 'yd'
// ---------------------------------------------------------------------------

export const distanceSchema = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(['mi', 'km', 'm', 'yd']),
})
export type Distance = z.infer<typeof distanceSchema>

// ---------------------------------------------------------------------------
// Duration -- invariant U-3: seconds must be a non-negative integer
// ---------------------------------------------------------------------------

export const durationSchema = z.object({
  seconds: z.number().int().nonnegative(),
})
export type Duration = z.infer<typeof durationSchema>

// ---------------------------------------------------------------------------
// Pace -- invariant U-4: minutesPerUnit > 0, unit must be 'mi' | 'km'
// ---------------------------------------------------------------------------

export const paceSchema = z.object({
  minutesPerUnit: z.number().positive(),
  unit: z.enum(['mi', 'km']),
})
export type Pace = z.infer<typeof paceSchema>

// ---------------------------------------------------------------------------
// NumberRange -- invariant SS-4: min <= max
// ---------------------------------------------------------------------------

export const numberRangeSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .refine((r) => r.min <= r.max, {
    message: 'min must be less than or equal to max',
    path: ['min'],
  })
export type NumberRange = z.infer<typeof numberRangeSchema>

// ---------------------------------------------------------------------------
// OneRepMax -- invariant PR-1: weight.value > 0 (enforced by weightSchema)
// ---------------------------------------------------------------------------

export const oneRepMaxSchema = z.object({
  weight: weightSchema,
  testedAt: z.string(), // ISO date string
  estimated: z.boolean(),
})
export type OneRepMax = z.infer<typeof oneRepMaxSchema>

// ---------------------------------------------------------------------------
// ProgramContext -- links a logged workout to its position in a program
// ---------------------------------------------------------------------------

export const programContextSchema = z.object({
  programId: z.string(),
  blockId: z.string(),
  weekNumber: z.number().int().min(1),
  dayLabel: z.string(),
})
export type ProgramContext = z.infer<typeof programContextSchema>
