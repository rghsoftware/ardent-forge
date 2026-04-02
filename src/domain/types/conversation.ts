import { z } from 'zod'
import { entityId, isoDateTime, syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// ConversationType -- direct (1:1) or group conversation
// ---------------------------------------------------------------------------

export const conversationTypeSchema = z.enum(['direct', 'group'])
export type ConversationType = z.infer<typeof conversationTypeSchema>

// ---------------------------------------------------------------------------
// Conversation -- a chat thread between two or more users
// ---------------------------------------------------------------------------

export const conversationSchema = syncableEntitySchema.extend({
  type: conversationTypeSchema,
  title: z.string().optional(),
  groupId: entityId.optional(),
})
export type Conversation = z.infer<typeof conversationSchema>

// ---------------------------------------------------------------------------
// ConversationParticipant -- a user's membership in a conversation
// ---------------------------------------------------------------------------

export const conversationParticipantSchema = syncableEntitySchema.extend({
  conversationId: entityId,
  userId: entityId,
  lastReadAt: isoDateTime.optional(),
  isArchived: z.boolean(),
  joinedAt: isoDateTime,
  leftAt: isoDateTime.optional(),
})
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>
