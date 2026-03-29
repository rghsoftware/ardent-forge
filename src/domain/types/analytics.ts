import { z } from 'zod'

// ---------------------------------------------------------------------------
// PersonalRecordType -- classification of a personal record
// ---------------------------------------------------------------------------

export const PersonalRecordTypeSchema = z.enum([
  '1RM',
  '3RM',
  '5RM',
  'max-reps',
  'cardio-distance',
  'cardio-duration',
])
export type PersonalRecordType = z.infer<typeof PersonalRecordTypeSchema>

// ---------------------------------------------------------------------------
// PersonalRecord -- a detected personal record from a workout
// ---------------------------------------------------------------------------

export const PersonalRecordSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  type: PersonalRecordTypeSchema,
  value: z.number(),
  unit: z.string(),
  previousBest: z.number().nullable(),
  workoutLogId: z.string(),
})
export type PersonalRecord = z.infer<typeof PersonalRecordSchema>

// ---------------------------------------------------------------------------
// WeeklyVolumeEntry -- aggregated volume data for one week
// ---------------------------------------------------------------------------

export const WeeklyVolumeEntrySchema = z.object({
  weekLabel: z.string(),
  weekStart: z.string(),
  tonnage: z.number(),
  unit: z.enum(['lb', 'kg']),
})
export type WeeklyVolumeEntry = z.infer<typeof WeeklyVolumeEntrySchema>
