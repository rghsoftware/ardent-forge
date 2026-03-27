import { z } from 'zod'
import { syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// GroupRole -- roles within an accountability group
// ---------------------------------------------------------------------------

export const groupRoleSchema = z.enum(['COACH', 'MEMBER'])
export type GroupRole = z.infer<typeof groupRoleSchema>

// ---------------------------------------------------------------------------
// ConnectionStatus -- lifecycle of a direct connection
// ---------------------------------------------------------------------------

export const connectionStatusSchema = z.enum(['PENDING', 'ACTIVE', 'DECLINED'])
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>

// ---------------------------------------------------------------------------
// ShareableEntityType -- the types of entities that can be shared via link
// ---------------------------------------------------------------------------

export const shareableEntityTypeSchema = z.enum(['PROGRAM', 'WORKOUT_LOG'])
export type ShareableEntityType = z.infer<typeof shareableEntityTypeSchema>

// ---------------------------------------------------------------------------
// AccountabilityGroup -- a group of users sharing training accountability
// invariant SH-4: size limits enforced at service layer, not schema
// ---------------------------------------------------------------------------

export const accountabilityGroupSchema = syncableEntitySchema.extend({
  name: z.string().min(1),
  description: z.string().optional(),
  createdBy: z.string(),
  dataRetentionDays: z.number().int().positive(),
})
export type AccountabilityGroup = z.infer<typeof accountabilityGroupSchema>

// ---------------------------------------------------------------------------
// GroupMember -- a user's membership in an accountability group
// ---------------------------------------------------------------------------

export const groupMemberSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  userId: z.string(),
  role: groupRoleSchema,
  shareHistoryBeforeJoin: z.boolean(), // SH-9: history visibility opt-in
  joinedAt: z.string(), // ISO 8601
})
export type GroupMember = z.infer<typeof groupMemberSchema>

// ---------------------------------------------------------------------------
// GroupInvite -- an invite code for joining a group
// invariant SH-5: code uniqueness enforced at DB level; expiration checked at service layer
// ---------------------------------------------------------------------------

export const groupInviteSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  code: z.string().min(1),
  createdBy: z.string(),
  expiresAt: z.string(), // ISO 8601
  isActive: z.boolean(),
})
export type GroupInvite = z.infer<typeof groupInviteSchema>

// ---------------------------------------------------------------------------
// DirectConnection -- a peer-to-peer accountability link between two users
// invariant SH-6: mutual visibility when status is ACTIVE
// ---------------------------------------------------------------------------

export const directConnectionSchema = syncableEntitySchema.extend({
  requesterId: z.string(),
  recipientId: z.string(),
  status: connectionStatusSchema,
  requesterGrantsWrite: z.boolean(),
  recipientGrantsWrite: z.boolean(),
  acceptedAt: z.string().optional(), // ISO 8601; null until accepted
})
export type DirectConnection = z.infer<typeof directConnectionSchema>

// ---------------------------------------------------------------------------
// ShareLink -- a read-only share link for a program or workout log
// invariant SH-8: stateless, no ongoing relationship
// ---------------------------------------------------------------------------

export const shareLinkSchema = syncableEntitySchema.extend({
  token: z.string().min(1),
  entityType: shareableEntityTypeSchema,
  entityId: z.string(),
  createdBy: z.string(),
  isActive: z.boolean(),
})
export type ShareLink = z.infer<typeof shareLinkSchema>
