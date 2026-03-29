import { z } from 'zod'
import { entityId, isoDateTime, syncableEntitySchema } from './units'

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
// ShareToken -- branded type for share link tokens (12-char alphanumeric)
// Prevents accidental substitution with other string IDs.
// ---------------------------------------------------------------------------

export const shareTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{12}$/, 'Share token must be exactly 12 alphanumeric characters')
  .brand<'ShareToken'>()
export type ShareToken = z.infer<typeof shareTokenSchema>

// ---------------------------------------------------------------------------
// AccountabilityGroup -- a group of users sharing training accountability
// invariant SH-4: size limits enforced at service layer, not schema
// ---------------------------------------------------------------------------

export const accountabilityGroupSchema = syncableEntitySchema.extend({
  name: z.string().min(1),
  description: z.string().optional(),
  createdBy: entityId,
  dataRetentionDays: z.number().int().positive(),
})
export type AccountabilityGroup = z.infer<typeof accountabilityGroupSchema>

// ---------------------------------------------------------------------------
// GroupMember -- a user's membership in an accountability group
// ---------------------------------------------------------------------------

export const groupMemberSchema = z.object({
  id: entityId,
  groupId: entityId,
  userId: entityId,
  role: groupRoleSchema,
  shareHistoryBeforeJoin: z.boolean(), // SH-9: history visibility opt-in
  joinedAt: isoDateTime,
})
export type GroupMember = z.infer<typeof groupMemberSchema>

// ---------------------------------------------------------------------------
// GroupInvite -- an invite code for joining a group
// invariant SH-5: code uniqueness enforced at DB level; expiration checked at service layer
// ---------------------------------------------------------------------------

export const groupInviteSchema = z.object({
  id: entityId,
  groupId: entityId,
  code: z.string().min(1),
  createdBy: entityId,
  expiresAt: isoDateTime,
  isActive: z.boolean(),
})
export type GroupInvite = z.infer<typeof groupInviteSchema>

// ---------------------------------------------------------------------------
// DirectConnection -- a peer-to-peer accountability link between two users
// invariant SH-6: mutual visibility when status is ACTIVE
// ---------------------------------------------------------------------------

export const directConnectionSchema = syncableEntitySchema
  .extend({
    requesterId: entityId,
    recipientId: entityId,
    status: connectionStatusSchema,
    requesterGrantsWrite: z.boolean(),
    recipientGrantsWrite: z.boolean(),
    acceptedAt: isoDateTime.optional(), // null until accepted
  })
  .refine(
    (data) => {
      if (data.status === 'ACTIVE' && data.acceptedAt === undefined) return false
      if (data.status === 'PENDING' && data.acceptedAt !== undefined) return false
      if (data.status === 'DECLINED' && data.acceptedAt !== undefined) return false
      return true
    },
    { message: 'ACTIVE requires acceptedAt; PENDING and DECLINED require no acceptedAt' },
  )
export type DirectConnection = z.infer<typeof directConnectionSchema>

// ---------------------------------------------------------------------------
// ShareLink -- a read-only share link for a program or workout log
// invariant SH-8: stateless, no ongoing relationship
// ---------------------------------------------------------------------------

export const shareLinkSchema = syncableEntitySchema.extend({
  token: shareTokenSchema,
  entityType: shareableEntityTypeSchema,
  entityId: entityId,
  createdBy: entityId,
  isActive: z.boolean(),
})
export type ShareLink = z.infer<typeof shareLinkSchema>
