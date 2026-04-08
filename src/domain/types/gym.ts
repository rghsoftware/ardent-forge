import { z } from 'zod'
import { entityId, isoDateTime, syncableEntitySchema } from './units'

// ---------------------------------------------------------------------------
// Gym -- a physical place where lifting happens (F018, Tech.md D1)
//
// Mirrors the `gyms` Postgres table:
//   id              uuid primary key
//   name            text not null check (char_length(name) between 1 and 60)
//   owner_user_id   uuid not null references auth.users on delete cascade
//   is_default      boolean not null default false
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
  // Tech.md D1: at most one default gym per instance (enforced by partial unique index)
  isDefault: z.boolean(),
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
