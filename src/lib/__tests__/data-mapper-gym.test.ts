import { describe, it, expect } from 'vitest'
import {
  toGym,
  fromGym,
  toGymMember,
  fromGymMember,
  toUserProfile,
  fromUserProfile,
} from '../data-mapper'
import type { GymRow, GymMemberRow, UserProfileRow } from '../database.types'

// ===========================================================================
// F018 (S008-T) -- data-mapper gym round-trips and displayVisible regression
//
// These tests assert:
//   1. The Gym mapper round-trips through GymRow without losing data.
//   2. The GymMember mapper round-trips through GymMemberRow without losing data.
//   3. The legacy `display_visible` field is no longer surfaced by toUserProfile
//      even when present on the input row (defensive against stale fixtures).
//   4. The legacy `displayVisible` field is no longer written by fromUserProfile.
// ===========================================================================

const now = '2026-04-06T10:00:00Z'
const later = '2026-04-06T11:30:00Z'

// ---------------------------------------------------------------------------
// Gym fixtures
// ---------------------------------------------------------------------------

const gymRow: GymRow = {
  id: 'gym-001',
  name: 'Home Garage',
  owner_user_id: 'user-001',
  is_default: true,
  created_at: now,
  updated_at: later,
}

const gymRowSecondary: GymRow = {
  id: 'gym-002',
  name: 'Iron Pit',
  owner_user_id: 'user-002',
  is_default: false,
  created_at: now,
  updated_at: now,
}

// ---------------------------------------------------------------------------
// GymMember fixtures
// ---------------------------------------------------------------------------

const gymMemberRow: GymMemberRow = {
  gym_id: 'gym-001',
  user_id: 'user-007',
  joined_at: now,
}

// ===========================================================================
// toGym / fromGym
// ===========================================================================

describe('toGym / fromGym', () => {
  it('maps a fully-populated gym row to a domain Gym', () => {
    const result = toGym(gymRow)

    expect(result).toEqual({
      id: 'gym-001',
      createdAt: now,
      updatedAt: later,
      name: 'Home Garage',
      ownerUserId: 'user-001',
      isDefault: true,
    })
  })

  it('maps a non-default gym row correctly', () => {
    const result = toGym(gymRowSecondary)

    expect(result.id).toBe('gym-002')
    expect(result.name).toBe('Iron Pit')
    expect(result.ownerUserId).toBe('user-002')
    expect(result.isDefault).toBe(false)
  })

  it('does not surface any unexpected fields on the output Gym', () => {
    const result = toGym(gymRow)

    expect(Object.keys(result).sort()).toEqual(
      ['createdAt', 'id', 'isDefault', 'name', 'ownerUserId', 'updatedAt'].sort(),
    )
  })

  it('round-trips a Gym back to a partial row with all fields preserved', () => {
    const gym = toGym(gymRow)
    const row = fromGym(gym)

    expect(row).toEqual({
      id: 'gym-001',
      created_at: now,
      updated_at: later,
      name: 'Home Garage',
      owner_user_id: 'user-001',
      is_default: true,
    })
  })

  it('omits unset fields from a partial fromGym write', () => {
    const row = fromGym({ name: 'New Name' })

    expect(row).toEqual({ name: 'New Name' })
    expect(row.id).toBeUndefined()
    expect(row.owner_user_id).toBeUndefined()
    expect(row.is_default).toBeUndefined()
  })

  it('handles a creation-shaped Gym (name + ownerUserId + isDefault, no id/timestamps)', () => {
    const row = fromGym({
      name: 'Garage',
      ownerUserId: 'user-001',
      isDefault: false,
    })

    expect(row).toEqual({
      name: 'Garage',
      owner_user_id: 'user-001',
      is_default: false,
    })
  })

  it('preserves explicit boolean false on isDefault (not treated as undefined)', () => {
    const row = fromGym({ isDefault: false })
    expect(row).toEqual({ is_default: false })
  })
})

// ===========================================================================
// toGymMember / fromGymMember
// ===========================================================================

describe('toGymMember / fromGymMember', () => {
  it('maps a fully-populated gym_members row to a domain GymMember', () => {
    const result = toGymMember(gymMemberRow)

    expect(result).toEqual({
      gymId: 'gym-001',
      userId: 'user-007',
      joinedAt: now,
    })
  })

  it('does not surface any unexpected fields on the output GymMember', () => {
    const result = toGymMember(gymMemberRow)

    expect(Object.keys(result).sort()).toEqual(['gymId', 'joinedAt', 'userId'].sort())
  })

  it('round-trips a GymMember back to a partial row with all fields preserved', () => {
    const member = toGymMember(gymMemberRow)
    const row = fromGymMember(member)

    expect(row).toEqual({
      gym_id: 'gym-001',
      user_id: 'user-007',
      joined_at: now,
    })
  })

  it('omits unset fields from a partial fromGymMember write', () => {
    const row = fromGymMember({ gymId: 'gym-001', userId: 'user-007' })

    expect(row).toEqual({ gym_id: 'gym-001', user_id: 'user-007' })
    expect(row.joined_at).toBeUndefined()
  })
})

// ===========================================================================
// toUserProfile / fromUserProfile -- F018 (M10) display_visible regression
// ===========================================================================

describe('toUserProfile / fromUserProfile -- displayVisible removal regression', () => {
  it('toUserProfile does not surface a `displayVisible` field even when display_visible is present on the row', () => {
    // Cast to a relaxed shape so the test can simulate a stale row that still
    // has the legacy column on disk (e.g. local cache, old fixture, etc.).
    // The mapper output must NOT carry the field forward.
    const staleRow = {
      id: 'user-001',
      display_name: 'Coach Hamilton',
      display_visible: true,
      preferred_units: 'IMPERIAL',
      bodyweight: null,
      training_age: null,
      exercise_maxes: null,
      max_reps: null,
      created_at: now,
      updated_at: now,
    } as unknown as UserProfileRow

    const result = toUserProfile(staleRow) as Record<string, unknown>

    expect(result.displayVisible).toBeUndefined()
    expect('displayVisible' in result).toBe(false)
  })

  it('fromUserProfile does not write display_visible even if a legacy field is supplied via cast', () => {
    // Cast away the type system to simulate a caller that still tries to
    // pass `displayVisible`. The mapper must drop it on the floor.
    const legacyInput = {
      id: 'user-001',
      displayName: 'Coach Hamilton',
      displayVisible: true,
    } as unknown as Parameters<typeof fromUserProfile>[0]

    const row = fromUserProfile(legacyInput) as Record<string, unknown>

    expect(row.display_visible).toBeUndefined()
    expect('display_visible' in row).toBe(false)
  })

  it('toUserProfile still maps a clean row (no display_visible) correctly', () => {
    const cleanRow: UserProfileRow = {
      id: 'user-001',
      display_name: 'Coach Hamilton',
      preferred_units: 'IMPERIAL',
      bodyweight: null,
      training_age: null,
      exercise_maxes: null,
      max_reps: null,
      created_at: now,
      updated_at: now,
    }

    const result = toUserProfile(cleanRow)

    expect(result.id).toBe('user-001')
    expect(result.displayName).toBe('Coach Hamilton')
    expect(result.preferredUnits).toBe('IMPERIAL')
  })
})
