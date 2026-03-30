import type {
  AccountabilityGroup,
  GroupMember,
  GroupInvite,
  DirectConnection,
} from '@/domain/types/sharing'
import type {
  AccountabilityGroupRow,
  GroupMemberRow,
  GroupInviteRow,
  DirectConnectionRow,
} from './database.types'

/**
 * Bidirectional mappers for sharing domain entities.
 *
 * Follows the same conventions as data-mapper.ts:
 * - `toXxx()` converts a database row to a domain type (DB -> Domain)
 * - `fromXxx()` converts a domain type to a partial database row (Domain -> DB)
 * - DB null -> Domain undefined; Domain undefined -> DB null
 * - Timestamps remain ISO 8601 strings (not Date objects)
 */

// ---------------------------------------------------------------------------
// AccountabilityGroup
// ---------------------------------------------------------------------------

export function toAccountabilityGroup(row: AccountabilityGroupRow): AccountabilityGroup {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    name: row.name,
    description: row.description ?? undefined,
    createdBy: row.created_by,
    dataRetentionDays: row.data_retention_days,
  }
}

export function fromAccountabilityGroup(
  group: Omit<AccountabilityGroup, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
): Partial<AccountabilityGroupRow> {
  return {
    user_id: userId,
    name: group.name,
    description: group.description ?? null,
    created_by: group.createdBy,
    data_retention_days: group.dataRetentionDays,
  }
}

// ---------------------------------------------------------------------------
// GroupMember
// ---------------------------------------------------------------------------

export function toGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    shareHistoryBeforeJoin: row.share_history_before_join,
    joinedAt: row.joined_at,
  }
}

export function fromGroupMember(member: Omit<GroupMember, 'id'>): Partial<GroupMemberRow> {
  return {
    group_id: member.groupId,
    user_id: member.userId,
    role: member.role,
    share_history_before_join: member.shareHistoryBeforeJoin,
    joined_at: member.joinedAt,
  }
}

// ---------------------------------------------------------------------------
// GroupInvite
// ---------------------------------------------------------------------------

export function toGroupInvite(row: GroupInviteRow): GroupInvite {
  return {
    id: row.id,
    groupId: row.group_id,
    code: row.code,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  }
}

export function fromGroupInvite(invite: Omit<GroupInvite, 'id'>): Partial<GroupInviteRow> {
  return {
    group_id: invite.groupId,
    code: invite.code,
    created_by: invite.createdBy,
    expires_at: invite.expiresAt,
    is_active: invite.isActive,
  }
}

// ---------------------------------------------------------------------------
// DirectConnection
// ---------------------------------------------------------------------------

export function toDirectConnection(row: DirectConnectionRow): DirectConnection {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterId: row.requester_id,
    recipientId: row.recipient_id,
    status: row.status,
    requesterGrantsWrite: row.requester_grants_write,
    recipientGrantsWrite: row.recipient_grants_write,
    acceptedAt: row.accepted_at ?? undefined,
  }
}

export function fromDirectConnection(
  connection: Omit<DirectConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Partial<DirectConnectionRow> {
  return {
    requester_id: connection.requesterId,
    recipient_id: connection.recipientId,
    status: connection.status,
    requester_grants_write: connection.requesterGrantsWrite,
    recipient_grants_write: connection.recipientGrantsWrite,
    accepted_at: connection.acceptedAt ?? null,
  }
}
