import { z } from 'zod'
import { entityId, isoDateTime } from '@/domain/types/units'
import { messageTypeSchema } from '@/domain/types/message'

// ---------------------------------------------------------------------------
// MessageBroadcastPayload -- inbound Realtime Broadcast for new messages
// Fields use snake_case to match the Supabase wire format.
// ---------------------------------------------------------------------------

export const messageBroadcastPayloadSchema = z.object({
  message_id: entityId,
  conversation_id: entityId,
  sender_id: entityId,
  message_type: messageTypeSchema,
  preview: z.string().max(100),
  created_at: isoDateTime,
})

export type MessageBroadcastPayload = z.infer<typeof messageBroadcastPayloadSchema>

// ---------------------------------------------------------------------------
// TypingBroadcastPayload -- inbound Realtime Broadcast for typing indicators
// ---------------------------------------------------------------------------

export const typingBroadcastPayloadSchema = z.object({
  user_id: entityId,
  user_name: z.string(),
})

export type TypingBroadcastPayload = z.infer<typeof typingBroadcastPayloadSchema>
