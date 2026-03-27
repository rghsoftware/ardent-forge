import { z } from 'zod'
import {
  weightSchema,
  durationSchema,
  distanceSchema,
  paceSchema,
  numberRangeSchema,
} from './units'

// ---------------------------------------------------------------------------
// CardioModality -- invariant SS-5: required for all cardio set schemes
// ---------------------------------------------------------------------------

export const cardioModalitySchema = z.enum([
  'RUNNING',
  'CYCLING',
  'SWIMMING',
  'ROWING',
  'RUCKING',
  'JUMP_ROPE',
  'STAIR_CLIMBER',
  'ELLIPTICAL',
])
export type CardioModality = z.infer<typeof cardioModalitySchema>

// SS-2: all percentage values must be between 0.01 and 1.0
const percentageSchema = z.number().min(0.01).max(1.0)

// ---------------------------------------------------------------------------
// LoadSpec -- 7-variant discriminated union on 'type'
// invariant SS-2: all percentage values must be between 0.01 and 1.0
// ---------------------------------------------------------------------------

export const loadSpecSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('absolute'),
    weight: weightSchema,
  }),
  z.object({
    type: z.literal('percentageOf1RM'),
    percentage: percentageSchema, // SS-2
  }),
  z.object({
    type: z.literal('rpe'),
    target: z.number().min(1).max(10),
  }),
  z.object({
    type: z.literal('percentMaxReps'),
    percentage: percentageSchema, // SS-2
  }),
  z.object({
    type: z.literal('bodyweight'),
  }),
  z.object({
    type: z.literal('bodyweightPlus'),
    additionalWeight: weightSchema,
  }),
  z.object({
    type: z.literal('unspecified'),
  }),
])
export type LoadSpec = z.infer<typeof loadSpecSchema>

// ---------------------------------------------------------------------------
// SetScheme variants -- defined individually so refine() can be applied
// before assembly into the final union.
//
// z.union() is used instead of z.discriminatedUnion() because Zod does not support .refine() on discriminated union members
// ---------------------------------------------------------------------------

// 1. FixedSets -- sets/reps can be a plain number or a NumberRange
const fixedSetsSchema = z.object({
  type: z.literal('fixedSets'),
  sets: z.union([z.number().int().positive(), numberRangeSchema]),
  reps: z.union([z.number().int().positive(), numberRangeSchema]),
  load: loadSpecSchema,
  restBetweenSets: durationSchema.optional(),
  lastSetAMRAP: z.boolean().optional(),
})

// 2. PercentageSets -- invariant SS-2: percentageOf1RM must be 0.01..1.0
const percentageSetsSchema = z.object({
  type: z.literal('percentageSets'),
  sets: z.number().int().positive(),
  reps: z.number().int().positive(),
  percentageOf1RM: percentageSchema, // SS-2
  lastSetAMRAP: z.boolean().optional(),
  restBetweenSets: durationSchema.optional(),
})

// 3. WorkToMax
const workToMaxSchema = z.object({
  type: z.literal('workToMax'),
  targetRepRange: numberRangeSchema,
  warmupScheme: z.string().optional(),
})

// 4. TimedHold
const timedHoldSchema = z.object({
  type: z.literal('timedHold'),
  duration: durationSchema,
  sets: z.number().int().positive(),
  restBetweenSets: durationSchema.optional(),
})

// 5. ForReps
const forRepsSchema = z.object({
  type: z.literal('forReps'),
  targetReps: z.number().int().positive(),
  load: loadSpecSchema.optional(),
})

// 6. CardioSteadyState -- invariant SS-1: at least one of duration/distance
//                         invariant SS-5: modality required
const cardioSteadyStateSchema = z
  .object({
    type: z.literal('cardioSteadyState'),
    duration: durationSchema.optional(),
    distance: distanceSchema.optional(),
    modality: cardioModalitySchema, // SS-5
    intensityNotes: z.string().optional(),
  })
  .refine((data) => data.duration !== undefined || data.distance !== undefined, {
    message: 'CardioSteadyState requires at least one of duration or distance',
  })

// 7. CardioInterval -- invariant SS-1: at least one of workDuration/workDistance
//                      invariant SS-5: modality required
const cardioIntervalSchema = z
  .object({
    type: z.literal('cardioInterval'),
    workDuration: durationSchema.optional(),
    workDistance: distanceSchema.optional(),
    rest: durationSchema,
    rounds: z.number().int().positive(),
    modality: cardioModalitySchema, // SS-5
    intensityNotes: z.string().optional(),
  })
  .refine((data) => data.workDuration !== undefined || data.workDistance !== undefined, {
    message: 'CardioInterval requires at least one of workDuration or workDistance',
  })

// 8. RuckMarch -- invariant SS-1: at least one of duration/distance
//                invariant SS-5: modality required
// modality is typically RUCKING but left flexible for ruck-while-hiking or ruck-march variants
const ruckMarchSchema = z
  .object({
    type: z.literal('ruckMarch'),
    loadWeight: weightSchema,
    duration: durationSchema.optional(),
    distance: distanceSchema.optional(),
    paceTarget: paceSchema.optional(),
    modality: cardioModalitySchema, // SS-5
  })
  .refine((data) => data.duration !== undefined || data.distance !== undefined, {
    message: 'RuckMarch requires at least one of duration or distance',
  })

// 9. EMOM
const emomSchema = z.object({
  type: z.literal('emom'),
  repsPerMinute: z.number().int().positive(),
  totalMinutes: z.number().int().positive(),
  load: loadSpecSchema.optional(),
})

// 10. AMRAPTimed
const amrapTimedSchema = z.object({
  type: z.literal('amrapTimed'),
  timeCap: durationSchema,
})

// 11. DescendingReps -- invariant SS-3: repLadder must be strictly decreasing,
//                       length >= 2
const descendingRepsSchema = z
  .object({
    type: z.literal('descendingReps'),
    repLadder: z.array(z.number().int().positive()).min(2), // SS-3: length >= 2
    load: loadSpecSchema.optional(),
  })
  .refine(
    (data) => {
      const ladder = data.repLadder
      for (let i = 1; i < ladder.length; i++) {
        if (ladder[i] >= ladder[i - 1]) return false
      }
      return true
    },
    {
      message: 'repLadder must be strictly decreasing', // SS-3
    },
  )

// 12. PercentageOfMaxReps -- invariant SS-2: percentage must be 0.01..1.0
const percentageOfMaxRepsSchema = z.object({
  type: z.literal('percentageOfMaxReps'),
  percentage: percentageSchema, // SS-2
  sets: z.number().int().positive().optional(),
})

// ---------------------------------------------------------------------------
// SetScheme -- union of all 12 variants
// z.union() is used instead of z.discriminatedUnion() because Zod does not support .refine() on discriminated union members
// ---------------------------------------------------------------------------

export const setSchemeSchema = z.union([
  fixedSetsSchema,
  percentageSetsSchema,
  workToMaxSchema,
  timedHoldSchema,
  forRepsSchema,
  cardioSteadyStateSchema,
  cardioIntervalSchema,
  ruckMarchSchema,
  emomSchema,
  amrapTimedSchema,
  descendingRepsSchema,
  percentageOfMaxRepsSchema,
])
export type SetScheme = z.infer<typeof setSchemeSchema>

// ---------------------------------------------------------------------------
// parseSetScheme -- two-stage parser with better error messages than z.union()
// ---------------------------------------------------------------------------

const setSchemeTypeNames = [
  'fixedSets',
  'percentageSets',
  'workToMax',
  'timedHold',
  'forReps',
  'cardioSteadyState',
  'cardioInterval',
  'ruckMarch',
  'emom',
  'amrapTimed',
  'descendingReps',
  'percentageOfMaxReps',
] as const
type SetSchemeTypeName = (typeof setSchemeTypeNames)[number]

const setSchemeVariants: Record<SetSchemeTypeName, z.ZodTypeAny> = {
  fixedSets: fixedSetsSchema,
  percentageSets: percentageSetsSchema,
  workToMax: workToMaxSchema,
  timedHold: timedHoldSchema,
  forReps: forRepsSchema,
  cardioSteadyState: cardioSteadyStateSchema,
  cardioInterval: cardioIntervalSchema,
  ruckMarch: ruckMarchSchema,
  emom: emomSchema,
  amrapTimed: amrapTimedSchema,
  descendingReps: descendingRepsSchema,
  percentageOfMaxReps: percentageOfMaxRepsSchema,
}

/**
 * Two-stage SetScheme parser with better error messages than z.union().
 * 1. Extracts the `type` discriminator field
 * 2. Looks up the matching variant schema
 * 3. Validates against only that one schema
 *
 * Use this instead of setSchemeSchema.safeParse() when you need
 * actionable error messages for end users.
 */
export function parseSetScheme(data: unknown) {
  const typeResult = z.object({ type: z.string() }).safeParse(data)
  if (!typeResult.success) {
    return { success: false as const, error: 'Missing or invalid "type" field' }
  }
  const variant = setSchemeVariants[typeResult.data.type as SetSchemeTypeName]
  if (!variant) {
    return {
      success: false as const,
      error: `Unknown SetScheme type: "${typeResult.data.type}". Valid types: ${setSchemeTypeNames.join(', ')}`,
    }
  }
  return variant.safeParse(data)
}
