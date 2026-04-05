import { z } from 'zod'
import {
  appendOnlyEntitySchema,
  entityId,
  isoDateTime,
  weightSchema,
  durationSchema,
  distanceSchema,
  paceSchema,
} from './units'
import { exerciseCategorySchema, movementPatternSchema } from './exercise'
import { setTypeSchema } from './workout-log'

// ---------------------------------------------------------------------------
// MessageType -- classification of a chat message
// ---------------------------------------------------------------------------

export const messageTypeSchema = z.enum(['text', 'workout', 'media', 'file', 'system'])
export type MessageType = z.infer<typeof messageTypeSchema>

// ---------------------------------------------------------------------------
// SyncStatus -- local-only field tracking offline message delivery state
// Only present in the Tauri (SQLite) adapter; omitted in Supabase responses.
// ---------------------------------------------------------------------------

export const syncStatusSchema = z.enum(['pending', 'synced', 'failed'])
export type SyncStatus = z.infer<typeof syncStatusSchema>

// ---------------------------------------------------------------------------
// SnapshotExercise -- lightweight exercise info embedded in a workout snapshot
// Contains only the fields needed to render the exercise in chat.
// ---------------------------------------------------------------------------

export const snapshotExerciseSchema = z.object({
  exerciseId: entityId,
  name: z.string().min(1),
  category: exerciseCategorySchema,
  movementPattern: movementPatternSchema,
})
export type SnapshotExercise = z.infer<typeof snapshotExerciseSchema>

// ---------------------------------------------------------------------------
// SnapshotSet -- a single logged set captured in a workout snapshot
// Mirrors the actual-measurement fields from LoggedSet without the FK refs.
// ---------------------------------------------------------------------------

export const snapshotSetSchema = z.object({
  setNumber: z.number().int().min(1),
  setType: setTypeSchema,
  actualReps: z.number().int().nonnegative().optional(),
  actualWeight: weightSchema.optional(),
  actualDuration: durationSchema.optional(),
  actualDistance: distanceSchema.optional(),
  actualPace: paceSchema.optional(),
  rpe: z.number().min(1).max(10).multipleOf(0.5).optional(),
  completed: z.boolean(),
})
export type SnapshotSet = z.infer<typeof snapshotSetSchema>

// ---------------------------------------------------------------------------
// SnapshotActivity -- an exercise with its logged sets within a snapshot
// ---------------------------------------------------------------------------

export const snapshotActivitySchema = z.object({
  exercise: snapshotExerciseSchema,
  sets: z.array(snapshotSetSchema),
  notes: z.string().optional(),
})
export type SnapshotActivity = z.infer<typeof snapshotActivitySchema>

// ---------------------------------------------------------------------------
// WorkoutSnapshot -- frozen, self-contained representation of a workout log
// Serialized as JSON into messages.content for workout-type messages (CH-4).
// Does not reference live data; recipients see the snapshot as it was shared.
// ---------------------------------------------------------------------------

export const workoutSnapshotSchema = z.object({
  workoutLogId: entityId,
  title: z.string().optional(),
  startedAt: isoDateTime,
  completedAt: isoDateTime.optional(),
  perceivedDifficulty: z.number().int().min(1).max(10).optional(),
  overallNotes: z.string().optional(),
  activities: z.array(snapshotActivitySchema),
})
export type WorkoutSnapshot = z.infer<typeof workoutSnapshotSchema>

// ---------------------------------------------------------------------------
// Message -- a single message in a conversation (append-only per CH-7)
// Uses appendOnlyEntitySchema because messages are immutable: no UPDATE/DELETE.
// ---------------------------------------------------------------------------

export const messageSchema = appendOnlyEntitySchema
  .extend({
    conversationId: entityId,
    senderId: entityId.optional(),
    messageType: messageTypeSchema,
    content: z.string().optional(),
    syncStatus: syncStatusSchema.optional(),
  })
  .refine((m) => m.messageType !== 'system' || m.senderId === undefined, {
    message: 'System messages cannot have a senderId',
    path: ['senderId'],
  })
export type Message = z.infer<typeof messageSchema>
