import { z } from 'zod'
import { entityId, isoDateTime, syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// EventRequirement -- freeform key-value pair for event prerequisites
// (e.g. { key: "Minimum Ruck Weight", value: "30", unit: "lb" })
// ---------------------------------------------------------------------------

export const eventRequirementSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
})
export type EventRequirement = z.infer<typeof eventRequirementSchema>

// ---------------------------------------------------------------------------
// EventMetadata -- value object stored as JSON column on session_templates
// and workout_logs when category = 'EVENT'
// ---------------------------------------------------------------------------

export const eventMetadataSchema = z.object({
  eventDate: isoDateTime.optional(),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  eventUrl: z
    .url()
    .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
      message: 'URL must use http or https protocol',
    })
    .optional(),
  requirements: z.array(eventRequirementSchema).default([]),
})
export type EventMetadata = z.infer<typeof eventMetadataSchema>

// ---------------------------------------------------------------------------
// EventItem -- a single item in an event's packing list
// Stored in the event_items table, synced via standard sync engine.
// EV-3: quantity defaults to 1
// EV-4: sortOrder for drag-and-drop reordering
// ---------------------------------------------------------------------------

export const eventItemSchema = syncableEntitySchema.extend({
  sessionTemplateId: entityId.optional(),
  workoutLogId: entityId.optional(),
  userId: entityId,
  name: z.string().min(1),
  category: z.string().optional(),
  quantity: z.number().int().min(1).default(1), // EV-3
  isPacked: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative(), // EV-4
  notes: z.string().optional(),
})
export type EventItem = z.infer<typeof eventItemSchema>
