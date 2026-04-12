import { describe, it, expect, beforeEach } from 'vitest'
import { SupabaseAdapter } from '../supabase-adapter'
import { createMockSupabaseClient, type MockSupabaseClient } from '@/test/mocks/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GymRow,
  GymMemberRow,
  GymInvitationRow,
  GymOwnershipTransferRow,
  GymMemberCountRow,
} from '../database.types'

// ===========================================================================
// F018 (S010-T) -- Supabase adapter gym CRUD tests.
//
// Each test asserts (a) the right table was queried and (b) the response
// shape was mapped correctly. Negative-path coverage is intentionally light
// at this layer; the data-mapper has its own round-trip suite.
// ===========================================================================

const now = '2026-04-06T10:00:00Z'

const gymRow: GymRow = {
  id: 'gym-001',
  name: 'Home Garage',
  owner_user_id: 'user-001',
  created_at: now,
  updated_at: now,
}

const gymRowSecondary: GymRow = {
  id: 'gym-002',
  name: 'Iron Pit',
  owner_user_id: 'user-002',
  created_at: now,
  updated_at: now,
}

const gymMemberRow: GymMemberRow = {
  gym_id: 'gym-001',
  user_id: 'user-001',
  joined_at: now,
}

const gymMemberRow2: GymMemberRow = {
  gym_id: 'gym-001',
  user_id: 'user-007',
  joined_at: now,
}

let mockClient: MockSupabaseClient
let adapter: SupabaseAdapter

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-001' } },
    error: null,
  })
  adapter = new SupabaseAdapter(mockClient as unknown as SupabaseClient)
})

// ---------------------------------------------------------------------------
// listUserGyms -- joins gym_members to gyms
// ---------------------------------------------------------------------------

describe('listUserGyms', () => {
  it('returns mapped gyms via the gym_members embed shape', () => {
    // PostgREST returns embedded resources as nested objects keyed by the
    // related table name. The adapter flat-maps `{ gyms: GymRow }[]` to Gym[].
    mockClient.mockResponse('gym_members', 'select', [{ gyms: gymRow }, { gyms: gymRowSecondary }])

    return adapter.listUserGyms('user-001').then((result) => {
      expect(mockClient.from).toHaveBeenCalledWith('gym_members')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('gym-001')
      expect(result[0].name).toBe('Home Garage')
      expect(result[0].ownerUserId).toBe('user-001')
      expect(result[1].id).toBe('gym-002')
      expect(result[1].name).toBe('Iron Pit')
    })
  })

  it('returns empty array when the user has no memberships', () => {
    mockClient.mockResponse('gym_members', 'select', [])

    return adapter.listUserGyms('user-001').then((result) => {
      expect(result).toEqual([])
    })
  })

  it('filters out null embeds defensively', () => {
    // RLS shouldn't allow this in practice, but defense in depth.
    mockClient.mockResponse('gym_members', 'select', [{ gyms: null }, { gyms: gymRow }])

    return adapter.listUserGyms('user-001').then((result) => {
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('gym-001')
    })
  })

  it('throws on Supabase error', async () => {
    mockClient.mockResponse('gym_members', 'select', null, { message: 'RLS denied' })

    await expect(adapter.listUserGyms('user-001')).rejects.toEqual({ message: 'RLS denied' })
  })
})

// ---------------------------------------------------------------------------
// listAllGyms
// ---------------------------------------------------------------------------

describe('listAllGyms', () => {
  it('returns mapped gyms from the gyms table', async () => {
    mockClient.mockResponse('gyms', 'select', [gymRow, gymRowSecondary])

    const result = await adapter.listAllGyms()

    expect(mockClient.from).toHaveBeenCalledWith('gyms')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('gym-001')
    expect(result[1].id).toBe('gym-002')
  })

  it('returns empty array when no gyms exist', async () => {
    mockClient.mockResponse('gyms', 'select', [])

    const result = await adapter.listAllGyms()

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getGym
// ---------------------------------------------------------------------------

describe('getGym', () => {
  it('returns mapped gym when found', async () => {
    mockClient.mockResponse('gyms', 'select', [gymRow])

    const result = await adapter.getGym('gym-001')

    expect(mockClient.from).toHaveBeenCalledWith('gyms')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('gym-001')
    expect(result!.name).toBe('Home Garage')
  })

  it('returns null when not found', async () => {
    mockClient.mockResponse('gyms', 'select', [])

    const result = await adapter.getGym('gym-missing')

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// createGym
// ---------------------------------------------------------------------------

describe('createGym', () => {
  it('inserts a gym with the current user as owner and returns mapped result', async () => {
    const created: GymRow = {
      ...gymRow,
      id: 'gym-new',
      name: 'Garage',
    }
    mockClient.mockResponse('gyms', 'insert', [created])

    const result = await adapter.createGym({ name: 'Garage' })

    expect(mockClient.from).toHaveBeenCalledWith('gyms')
    expect(result.id).toBe('gym-new')
    expect(result.name).toBe('Garage')
    expect(result.ownerUserId).toBe('user-001')
  })

  it('throws when not authenticated', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(adapter.createGym({ name: 'Garage' })).rejects.toThrow('Not authenticated')
  })
})

// ---------------------------------------------------------------------------
// updateGym
// ---------------------------------------------------------------------------

describe('updateGym', () => {
  it('updates a gym and returns mapped result', async () => {
    const updated: GymRow = { ...gymRow, name: 'Renamed Gym' }
    mockClient.mockResponse('gyms', 'update', [updated])

    const result = await adapter.updateGym({ id: 'gym-001', name: 'Renamed Gym' })

    expect(mockClient.from).toHaveBeenCalledWith('gyms')
    expect(result.id).toBe('gym-001')
    expect(result.name).toBe('Renamed Gym')
  })
})

// ---------------------------------------------------------------------------
// deleteGym
// ---------------------------------------------------------------------------

describe('deleteGym', () => {
  it('deletes the gym by id without returning a value', async () => {
    mockClient.mockResponse('gyms', 'delete', [])

    await expect(adapter.deleteGym('gym-001')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('gyms')
  })

  it('throws on Supabase error', async () => {
    mockClient.mockResponse('gyms', 'delete', null, { message: 'RLS denied' })

    await expect(adapter.deleteGym('gym-001')).rejects.toEqual({ message: 'RLS denied' })
  })
})

// ---------------------------------------------------------------------------
// joinGym
// ---------------------------------------------------------------------------

describe('joinGym', () => {
  it('inserts a gym_members row for the current user', async () => {
    mockClient.mockResponse('gym_members', 'insert', [gymMemberRow])

    await expect(adapter.joinGym('gym-001')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('gym_members')
  })

  it('throws when not authenticated', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(adapter.joinGym('gym-001')).rejects.toThrow('Not authenticated')
  })
})

// ---------------------------------------------------------------------------
// leaveGym
// ---------------------------------------------------------------------------

describe('leaveGym', () => {
  it('deletes the current user gym_members row', async () => {
    mockClient.mockResponse('gym_members', 'delete', [])

    await expect(adapter.leaveGym('gym-001')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('gym_members')
  })

  it('throws when not authenticated', async () => {
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(adapter.leaveGym('gym-001')).rejects.toThrow('Not authenticated')
  })
})

// ---------------------------------------------------------------------------
// kickGymMember
// ---------------------------------------------------------------------------

describe('kickGymMember', () => {
  it('deletes another user gym_members row (RLS enforces owner check)', async () => {
    mockClient.mockResponse('gym_members', 'delete', [])

    await expect(adapter.kickGymMember('gym-001', 'user-007')).resolves.toBeUndefined()
    expect(mockClient.from).toHaveBeenCalledWith('gym_members')
  })

  it('throws on Supabase error (e.g. caller is not the owner)', async () => {
    mockClient.mockResponse('gym_members', 'delete', null, { message: 'RLS denied' })

    await expect(adapter.kickGymMember('gym-001', 'user-007')).rejects.toEqual({
      message: 'RLS denied',
    })
  })
})

// ---------------------------------------------------------------------------
// listGymMembers
// ---------------------------------------------------------------------------

describe('listGymMembers', () => {
  it('returns mapped members for the given gym', async () => {
    mockClient.mockResponse('gym_members', 'select', [gymMemberRow, gymMemberRow2])

    const result = await adapter.listGymMembers('gym-001')

    expect(mockClient.from).toHaveBeenCalledWith('gym_members')
    expect(result).toHaveLength(2)
    expect(result[0].gymId).toBe('gym-001')
    expect(result[0].userId).toBe('user-001')
    expect(result[1].userId).toBe('user-007')
  })

  it('returns empty array when the gym has no members', async () => {
    mockClient.mockResponse('gym_members', 'select', [])

    const result = await adapter.listGymMembers('gym-empty')

    expect(result).toEqual([])
  })
})

// ===========================================================================
// F021 -- gym membership explicit: member counts, invites, transfers.
// ===========================================================================

// ---------------------------------------------------------------------------
// listGymMemberCounts
// ---------------------------------------------------------------------------

describe('listGymMemberCounts', () => {
  it('returns mapped counts from the gym_member_counts view', async () => {
    const rows: GymMemberCountRow[] = [
      { gym_id: 'gym-001', member_count: 3 },
      { gym_id: 'gym-002', member_count: 0 },
    ]
    mockClient.mockResponse('gym_member_counts', 'select', rows)

    const result = await adapter.listGymMemberCounts()

    expect(mockClient.from).toHaveBeenCalledWith('gym_member_counts')
    expect(result).toEqual([
      { gymId: 'gym-001', memberCount: 3 },
      { gymId: 'gym-002', memberCount: 0 },
    ])
  })

  it('filters out rows with null gym_id or member_count defensively', async () => {
    // Rows may have null fields in practice (view columns are optimistically
    // typed as non-null); we cast via unknown to test defensive filtering.
    const rows = [
      { gym_id: 'gym-001', member_count: 2 },
      { gym_id: null, member_count: 5 },
      { gym_id: 'gym-003', member_count: null },
    ] as unknown as GymMemberCountRow[]
    mockClient.mockResponse('gym_member_counts', 'select', rows)

    const result = await adapter.listGymMemberCounts()

    expect(result).toEqual([{ gymId: 'gym-001', memberCount: 2 }])
  })

  it('throws on Supabase error', async () => {
    mockClient.mockResponse('gym_member_counts', 'select', null, { message: 'RLS denied' })

    await expect(adapter.listGymMemberCounts()).rejects.toEqual({ message: 'RLS denied' })
  })
})

// ---------------------------------------------------------------------------
// createGymInvite
// ---------------------------------------------------------------------------

describe('createGymInvite', () => {
  it('calls create_gym_invite RPC and maps the returned row', async () => {
    const row: GymInvitationRow = {
      id: 'inv-001',
      gym_id: 'gym-001',
      // Opaque placeholder -- do not use realistic tokens in fixtures.
      token: 'TOKEN_PLACEHOLDER',
      expires_at: '2026-04-15T10:00:00Z',
      max_uses: 10,
      uses_count: 0,
      created_by: 'user-001',
      created_at: now,
    }
    mockClient.rpc.mockResolvedValueOnce({ data: row, error: null })

    const result = await adapter.createGymInvite('gym-001', {
      expiresAt: '2026-04-15T10:00:00Z',
      maxUses: 10,
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('create_gym_invite', {
      p_gym_id: 'gym-001',
      p_expires_at: '2026-04-15T10:00:00Z',
      p_max_uses: 10,
    })
    expect(result).toEqual({
      id: 'inv-001',
      gymId: 'gym-001',
      token: 'TOKEN_PLACEHOLDER',
      expiresAt: '2026-04-15T10:00:00Z',
      maxUses: 10,
      usesCount: 0,
      createdBy: 'user-001',
      createdAt: now,
    })
  })

  it('throws on RPC error', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied' },
    })

    await expect(adapter.createGymInvite('gym-001')).rejects.toEqual({
      message: 'permission denied',
    })
  })
})

// ---------------------------------------------------------------------------
// listGymInvites
// ---------------------------------------------------------------------------

describe('listGymInvites', () => {
  it('returns mapped invite rows for a gym', async () => {
    const rows: GymInvitationRow[] = [
      {
        id: 'inv-001',
        gym_id: 'gym-001',
        token: 'TOKEN_A',
        expires_at: '2026-04-15T10:00:00Z',
        max_uses: 5,
        uses_count: 1,
        created_by: 'user-001',
        created_at: now,
      },
      {
        id: 'inv-002',
        gym_id: 'gym-001',
        token: 'TOKEN_B',
        expires_at: '2026-04-20T10:00:00Z',
        max_uses: 1,
        uses_count: 0,
        created_by: 'user-001',
        created_at: now,
      },
    ]
    mockClient.mockResponse('gym_invitations', 'select', rows)

    const result = await adapter.listGymInvites('gym-001')

    expect(mockClient.from).toHaveBeenCalledWith('gym_invitations')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('inv-001')
    expect(result[0].gymId).toBe('gym-001')
    expect(result[0].maxUses).toBe(5)
    expect(result[0].usesCount).toBe(1)
    expect(result[1].id).toBe('inv-002')
  })

  it('returns empty array when no invites exist', async () => {
    mockClient.mockResponse('gym_invitations', 'select', [])

    const result = await adapter.listGymInvites('gym-001')

    expect(result).toEqual([])
  })

  it('throws on Supabase error', async () => {
    mockClient.mockResponse('gym_invitations', 'select', null, { message: 'RLS denied' })

    await expect(adapter.listGymInvites('gym-001')).rejects.toEqual({ message: 'RLS denied' })
  })
})

// ---------------------------------------------------------------------------
// redeemGymInvite -- error taxonomy is the critical path here.
//
// The RPC raises distinct exception messages that the adapter maps into a
// discriminated RedeemInviteError union. These tests lock in the mapping so
// future refactors cannot accidentally collapse the three kinds together.
// Only opaque placeholder tokens are used; raw tokens are never logged.
// ---------------------------------------------------------------------------

describe('redeemGymInvite', () => {
  it('returns ok=true with the gymId on success', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: 'gym-001', error: null })

    const result = await adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')

    expect(mockClient.rpc).toHaveBeenCalledWith('redeem_gym_invite', {
      p_token: 'OPAQUE_PLACEHOLDER',
    })
    expect(result).toEqual({ ok: true, gymId: 'gym-001' })
  })

  it('returns kind=invalid when RPC raises INVITE_INVALID', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INVITE_INVALID: token not found' },
    })

    const result = await adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')

    expect(result).toEqual({ ok: false, error: { kind: 'invalid' } })
  })

  it('returns kind=expired when RPC raises INVITE_EXPIRED', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INVITE_EXPIRED: past expires_at' },
    })

    const result = await adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')

    expect(result).toEqual({ ok: false, error: { kind: 'expired' } })
  })

  it('returns kind=exhausted when RPC raises INVITE_EXHAUSTED', async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'INVITE_EXHAUSTED: uses_count >= max_uses' },
    })

    const result = await adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')

    expect(result).toEqual({ ok: false, error: { kind: 'exhausted' } })
  })

  it('bubbles up network / unexpected RPC errors via throw', async () => {
    const err = { message: 'network unreachable' }
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: err })

    await expect(adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')).rejects.toEqual(err)
  })

  it('bubbles up errors with no recognised prefix via throw', async () => {
    const err = { message: 'unexpected server crash' }
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: err })

    await expect(adapter.redeemGymInvite('OPAQUE_PLACEHOLDER')).rejects.toEqual(err)
  })
})

// ---------------------------------------------------------------------------
// proposeGymTransfer / acceptGymTransfer / cancelOrDeclineGymTransfer
// ---------------------------------------------------------------------------

describe('proposeGymTransfer', () => {
  it('calls propose_gym_transfer RPC with gym + target', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(adapter.proposeGymTransfer('gym-001', 'user-007')).resolves.toBeUndefined()
    expect(mockClient.rpc).toHaveBeenCalledWith('propose_gym_transfer', {
      p_gym_id: 'gym-001',
      p_target_user_id: 'user-007',
    })
  })

  it('throws on RPC error', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not a member' } })

    await expect(adapter.proposeGymTransfer('gym-001', 'user-007')).rejects.toEqual({
      message: 'not a member',
    })
  })
})

describe('acceptGymTransfer', () => {
  it('calls accept_gym_transfer RPC with gym id', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(adapter.acceptGymTransfer('gym-001')).resolves.toBeUndefined()
    expect(mockClient.rpc).toHaveBeenCalledWith('accept_gym_transfer', { p_gym_id: 'gym-001' })
  })

  it('throws on RPC error', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not target' } })

    await expect(adapter.acceptGymTransfer('gym-001')).rejects.toEqual({ message: 'not target' })
  })
})

describe('cancelOrDeclineGymTransfer', () => {
  it('calls cancel_or_decline_gym_transfer RPC with gym id', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null })

    await expect(adapter.cancelOrDeclineGymTransfer('gym-001')).resolves.toBeUndefined()
    expect(mockClient.rpc).toHaveBeenCalledWith('cancel_or_decline_gym_transfer', {
      p_gym_id: 'gym-001',
    })
  })

  it('throws on RPC error', async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'not a party' } })

    await expect(adapter.cancelOrDeclineGymTransfer('gym-001')).rejects.toEqual({
      message: 'not a party',
    })
  })
})

// ---------------------------------------------------------------------------
// getPendingTransfer
// ---------------------------------------------------------------------------

describe('getPendingTransfer', () => {
  it('returns mapped transfer when one exists', async () => {
    const row: GymOwnershipTransferRow = {
      gym_id: 'gym-001',
      proposed_by: 'user-001',
      proposed_to: 'user-007',
      proposed_at: now,
    }
    mockClient.mockResponse('gym_ownership_transfers', 'select', [row])

    const result = await adapter.getPendingTransfer('gym-001')

    expect(mockClient.from).toHaveBeenCalledWith('gym_ownership_transfers')
    expect(result).toEqual({
      gymId: 'gym-001',
      proposedBy: 'user-001',
      proposedTo: 'user-007',
      proposedAt: now,
    })
  })

  it('returns null when no pending transfer exists', async () => {
    mockClient.mockResponse('gym_ownership_transfers', 'select', [])

    const result = await adapter.getPendingTransfer('gym-001')

    expect(result).toBeNull()
  })

  it('throws on Supabase error', async () => {
    mockClient.mockResponse('gym_ownership_transfers', 'select', null, { message: 'RLS denied' })

    await expect(adapter.getPendingTransfer('gym-001')).rejects.toEqual({ message: 'RLS denied' })
  })
})
