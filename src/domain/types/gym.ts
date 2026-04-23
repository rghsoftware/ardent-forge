import { z } from 'zod'
import { entityId, isoDateTime, syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// Gym -- a physical place where lifting happens (F018, Tech.md D1)
//
// Mirrors the `gyms` Postgres table:
//   id              uuid primary key
//   name            text not null check (char_length(name) between 1 and 60)
//   owner_user_id   uuid not null references auth.users on delete cascade
//   created_at      timestamptz not null default now()
//   updated_at      timestamptz not null default now()
//
// SQL columns are snake_case; the TS field names are camelCase per project
// convention. The data-mapper layer (a later wave) handles the conversion.
// ---------------------------------------------------------------------------

/**
 * Maximum allowed length of `gyms.name` in characters.
 *
 * Matches the SQL `check (char_length(name) between 1 and 60)` constraint
 * and the Zod `z.string().min(1).max(60)` validator below. Exported so
 * consumers (display-setup name derivation, UI forms) share a single
 * source of truth instead of hardcoding `60` in multiple places (P15-034).
 */
export const GYM_NAME_MAX = 60

export const gymSchema = syncableEntitySchema.extend({
  // M1 / RD-15: name length 1..GYM_NAME_MAX mirrors the SQL char_length check
  name: z.string().min(1).max(GYM_NAME_MAX),
  // RD-15: ownership column is `owner_user_id`, not `created_by`
  ownerUserId: entityId,
})
export type Gym = z.infer<typeof gymSchema>

// ---------------------------------------------------------------------------
// GymMember -- M:N join row between a user and a gym (F018, Tech.md D1)
//
// Mirrors the `gym_members` Postgres table:
//   gym_id     uuid not null references gyms on delete cascade
//   user_id    uuid not null references auth.users on delete cascade
//   joined_at  timestamptz not null default now()
//   primary key (gym_id, user_id)
//
// No `id` column -- the composite (gym_id, user_id) is the primary key, so
// this entity does NOT extend syncableEntitySchema.
// ---------------------------------------------------------------------------

/**
 * Gym membership join row. NOTE: there is intentionally no `role` field on
 * this schema. F018 v1 has only two roles -- owner and member -- and
 * ownership is computed from `gym.ownerUserId === user.id` rather than
 * stored on the join row. Future readers (or AI agents) should not expect
 * an enum here; if v2 introduces additional roles (coach, admin, guest),
 * THIS is the schema to extend (P14-043).
 */
export const gymMemberSchema = z.object({
  gymId: entityId,
  userId: entityId,
  joinedAt: isoDateTime,
})
export type GymMember = z.infer<typeof gymMemberSchema>

// ---------------------------------------------------------------------------
// GymInvitation -- redeemable invite token (F021, Tech.md gym_invitations)
//
// Mirrors the `gym_invitations` Postgres table. Snake_case <-> camelCase
// conversion is handled in data-mapper, not here.
// ---------------------------------------------------------------------------

export const gymInvitationSchema = z
  .object({
    id: entityId,
    gymId: entityId,
    token: z.string().min(24),
    expiresAt: isoDateTime,
    maxUses: z.number().int().positive(),
    usesCount: z.number().int().nonnegative(),
    createdBy: entityId,
    createdAt: isoDateTime,
  })
  .refine((v) => v.usesCount <= v.maxUses, {
    message: 'usesCount must not exceed maxUses',
    path: ['usesCount'],
  })
  .refine((v) => v.expiresAt > v.createdAt, {
    message: 'expiresAt must be after createdAt',
    path: ['expiresAt'],
  })
export type GymInvitation = z.infer<typeof gymInvitationSchema>

// ---------------------------------------------------------------------------
// GymOwnershipTransfer -- pending transfer proposal (F021)
//
// Mirrors the `gym_ownership_transfers` Postgres table. `gym_id` is the
// primary key, enforcing the single-pending-transfer-per-gym invariant.
// ---------------------------------------------------------------------------

export const gymOwnershipTransferSchema = z
  .object({
    gymId: entityId,
    proposedBy: entityId,
    proposedTo: entityId,
    proposedAt: isoDateTime,
  })
  .refine((v) => v.proposedBy !== v.proposedTo, {
    message: 'proposedBy and proposedTo must be different users',
    path: ['proposedTo'],
  })
export type GymOwnershipTransfer = z.infer<typeof gymOwnershipTransferSchema>

// ---------------------------------------------------------------------------
// GymMemberCount -- live member-count read model (F021)
//
// Mirrors the `gym_member_counts` view. Used by the browse list to avoid
// the per-gym N+1 count query.
// ---------------------------------------------------------------------------

export const gymMemberCountSchema = z.object({
  gymId: entityId,
  memberCount: z.number().int().nonnegative(),
})
export type GymMemberCount = z.infer<typeof gymMemberCountSchema>

// ---------------------------------------------------------------------------
// RedeemInviteError -- discriminated union for redeem_gym_invite RPC failures
//
// The Postgres RPC raises distinct exception messages (INVITE_INVALID,
// INVITE_EXPIRED, INVITE_EXHAUSTED) which the adapter maps to one of these
// kinds. See Tech.md Decision 4 and .claude/rules/error-handling.md.
// ---------------------------------------------------------------------------

export const redeemInviteErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invalid') }),
  z.object({ kind: z.literal('expired') }),
  z.object({ kind: z.literal('exhausted') }),
])
export type RedeemInviteError = z.infer<typeof redeemInviteErrorSchema>
