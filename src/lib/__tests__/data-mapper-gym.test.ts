import { describe, it, expect } from 'vitest'
import {
  toGym,
  fromGym,
  toGymMember,
  fromGymMember,
  toGymInvitation,
  fromGymInvitation,
  toGymOwnershipTransfer,
  fromGymOwnershipTransfer,
  toGymMemberCount,
  toUserProfile,
  fromUserProfile,
} from '../data-mapper'
import type {
  GymRow,
  GymMemberRow,
  GymInvitationRow,
  GymOwnershipTransferRow,
  GymMemberCountRow,
  UserProfileRow,
} from '../database.types'

// ===========================================================================
// F018 (S008-T) -- data-mapper gym round-trips and displayVisible regression.
// F021 (S008-T) -- added coverage for GymInvitation, GymOwnershipTransfer,
// and GymMemberCount mappers. `is_default` / `isDefault` removed in F021.
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
  created_at: now,
  updated_at: later,
}

const gymRowSecondary: GymRow = {
  id: 'gym-002',
  name: 'Iron Pit',
  owner_user_id: 'user-002',
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

// ---------------------------------------------------------------------------
// F021 fixtures
// ---------------------------------------------------------------------------

const gymInvitationRow: GymInvitationRow = {
  id: 'inv-001',
  gym_id: 'gym-001',
  token: 'tok_abcdef123456',
  expires_at: later,
  max_uses: 10,
  uses_count: 3,
  created_by: 'user-001',
  created_at: now,
}

const gymOwnershipTransferRow: GymOwnershipTransferRow = {
  gym_id: 'gym-001',
  proposed_by: 'user-001',
  proposed_to: 'user-007',
  proposed_at: now,
}

const gymMemberCountRow: GymMemberCountRow = {
  gym_id: 'gym-001',
  member_count: 12,
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
    })
  })

  it('maps a secondary gym row correctly', () => {
    const result = toGym(gymRowSecondary)

    expect(result.id).toBe('gym-002')
    expect(result.name).toBe('Iron Pit')
    expect(result.ownerUserId).toBe('user-002')
  })

  it('does not surface any unexpected fields on the output Gym', () => {
    const result = toGym(gymRow)

    expect(Object.keys(result).sort()).toEqual(
      ['createdAt', 'id', 'name', 'ownerUserId', 'updatedAt'].sort(),
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
    })
  })

  it('omits unset fields from a partial fromGym write', () => {
    const row = fromGym({ name: 'New Name' })

    expect(row).toEqual({ name: 'New Name' })
    expect(row.id).toBeUndefined()
    expect(row.owner_user_id).toBeUndefined()
  })

  it('handles a creation-shaped Gym (name + ownerUserId, no id/timestamps)', () => {
    const row = fromGym({
      name: 'Garage',
      ownerUserId: 'user-001',
    })

    expect(row).toEqual({
      name: 'Garage',
      owner_user_id: 'user-001',
    })
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
// toGymInvitation / fromGymInvitation (F021)
// ===========================================================================

describe('toGymInvitation / fromGymInvitation', () => {
  it('maps a fully-populated gym_invitations row to a domain GymInvitation', () => {
    const result = toGymInvitation(gymInvitationRow)

    expect(result).toEqual({
      id: 'inv-001',
      gymId: 'gym-001',
      token: 'tok_abcdef123456',
      expiresAt: later,
      maxUses: 10,
      usesCount: 3,
      createdBy: 'user-001',
      createdAt: now,
    })
  })

  it('does not surface any unexpected fields on the output GymInvitation', () => {
    const result = toGymInvitation(gymInvitationRow)

    expect(Object.keys(result).sort()).toEqual(
      [
        'createdAt',
        'createdBy',
        'expiresAt',
        'gymId',
        'id',
        'maxUses',
        'token',
        'usesCount',
      ].sort(),
    )
  })

  it('round-trips a GymInvitation back to a row with all fields preserved', () => {
    const invitation = toGymInvitation(gymInvitationRow)
    const row = fromGymInvitation(invitation)

    expect(row).toEqual({
      id: 'inv-001',
      gym_id: 'gym-001',
      token: 'tok_abcdef123456',
      expires_at: later,
      max_uses: 10,
      uses_count: 3,
      created_by: 'user-001',
      created_at: now,
    })
  })

  it('omits unset fields from a partial fromGymInvitation write', () => {
    const row = fromGymInvitation({ gymId: 'gym-001', token: 'tok_new' })

    expect(row).toEqual({ gym_id: 'gym-001', token: 'tok_new' })
    expect(row.id).toBeUndefined()
    expect(row.max_uses).toBeUndefined()
    expect(row.uses_count).toBeUndefined()
  })
})

// ===========================================================================
// toGymOwnershipTransfer / fromGymOwnershipTransfer (F021)
// ===========================================================================

describe('toGymOwnershipTransfer / fromGymOwnershipTransfer', () => {
  it('maps a fully-populated gym_ownership_transfers row to domain', () => {
    const result = toGymOwnershipTransfer(gymOwnershipTransferRow)

    expect(result).toEqual({
      gymId: 'gym-001',
      proposedBy: 'user-001',
      proposedTo: 'user-007',
      proposedAt: now,
    })
  })

  it('does not surface any unexpected fields on the output transfer', () => {
    const result = toGymOwnershipTransfer(gymOwnershipTransferRow)

    expect(Object.keys(result).sort()).toEqual(
      ['gymId', 'proposedAt', 'proposedBy', 'proposedTo'].sort(),
    )
  })

  it('round-trips a GymOwnershipTransfer back to a row with all fields preserved', () => {
    const transfer = toGymOwnershipTransfer(gymOwnershipTransferRow)
    const row = fromGymOwnershipTransfer(transfer)

    expect(row).toEqual({
      gym_id: 'gym-001',
      proposed_by: 'user-001',
      proposed_to: 'user-007',
      proposed_at: now,
    })
  })

  it('omits unset fields from a partial fromGymOwnershipTransfer write', () => {
    const row = fromGymOwnershipTransfer({ gymId: 'gym-001', proposedTo: 'user-007' })

    expect(row).toEqual({ gym_id: 'gym-001', proposed_to: 'user-007' })
    expect(row.proposed_by).toBeUndefined()
    expect(row.proposed_at).toBeUndefined()
  })
})

// ===========================================================================
// toGymMemberCount (F021) -- one-way (view, no fromX)
// ===========================================================================

describe('toGymMemberCount', () => {
  it('maps a fully-populated gym_member_counts view row to domain', () => {
    const result = toGymMemberCount(gymMemberCountRow)

    expect(result).toEqual({
      gymId: 'gym-001',
      memberCount: 12,
    })
  })

  it('does not surface any unexpected fields on the output count', () => {
    const result = toGymMemberCount(gymMemberCountRow)

    expect(Object.keys(result).sort()).toEqual(['gymId', 'memberCount'].sort())
  })

  it('coerces a null member_count to 0 (safety-net path)', () => {
    // The view is declared nullable by generated types. A coerced 0 is the
    // expected safety-net behaviour per data-mapper.ts comments.
    const row = { gym_id: 'gym-001', member_count: null } as unknown as GymMemberCountRow
    const result = toGymMemberCount(row)
    expect(result.memberCount).toBe(0)
  })
})

// ===========================================================================
// toUserProfile / fromUserProfile -- F018 (M10) display_visible regression
// ===========================================================================

describe('toUserProfile / fromUserProfile -- displayVisible removal regression', () => {
  it('toUserProfile does not surface a `displayVisible` field even when display_visible is present on the row', () => {
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
