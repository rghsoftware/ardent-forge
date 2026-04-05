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

export const conversationSchema = syncableEntitySchema
  .extend({
    type: conversationTypeSchema,
    title: z.string().optional(),
    groupId: entityId.optional(),
    participantUserIds: z.array(entityId).default([]),
  })
  .refine((c) => c.type !== 'direct' || c.groupId === undefined, {
    message: 'Direct conversations cannot have a groupId',
    path: ['groupId'],
  })
export type Conversation = z.infer<typeof conversationSchema>

// ---------------------------------------------------------------------------
// ConversationParticipant -- a user's membership in a conversation
// ---------------------------------------------------------------------------

export const conversationParticipantSchema = syncableEntitySchema
  .extend({
    conversationId: entityId,
    userId: entityId,
    lastReadAt: isoDateTime.optional(),
    isArchived: z.boolean(),
    joinedAt: isoDateTime,
    leftAt: isoDateTime.optional(),
  })
  .refine((p) => !p.leftAt || new Date(p.leftAt) > new Date(p.joinedAt), {
    message: 'leftAt must be after joinedAt',
    path: ['leftAt'],
  })
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>
