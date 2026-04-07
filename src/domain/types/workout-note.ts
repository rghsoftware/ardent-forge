import { z } from 'zod'

// ---------------------------------------------------------------------------
// WorkoutNote -- structured note content attached to sessions, activities,
// and individual logged sets. Supports freeform text plus a bounded set of
// uppercase tags for filtering and analytics.
// ---------------------------------------------------------------------------

/**
 * Curated starter tags surfaced in the UI as quick-add chips. Users may
 * author additional tags freely; these are not an enum.
 */
export const STARTER_NOTE_TAGS: readonly string[] = [
  'FORM BREAKDOWN',
  'FELT HEAVY',
  'FELT LIGHT',
  'PR ATTEMPT',
  'SCALED',
  'SUBSTITUTION',
  'PAUSED',
  'GRINDY',
  'FAST',
  'LOW ENERGY',
] as const

/**
 * Normalize a raw tag string:
 *  - trim surrounding whitespace
 *  - collapse internal whitespace runs to a single space
 *  - uppercase
 */
export function normalizeTag(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toUpperCase()
}

// Dual export per ADR-008: object schema (composable) + refined/transformed schema.
// noteTagSchema uses .transform() which produces a ZodEffects, so a plain
// z.string() base is exposed for callers that need the pre-transform type.
export const noteTagBaseSchema = z.string().min(1).max(32)
export const noteTagSchema = noteTagBaseSchema.transform(normalizeTag)
export type NoteTag = z.infer<typeof noteTagSchema>

export const noteContentObjectSchema = z.object({
  text: z.string().default(''),
  tags: z.array(noteTagSchema).max(16).default([]),
})
export const noteContentSchema = noteContentObjectSchema
export type NoteContent = z.infer<typeof noteContentSchema>
