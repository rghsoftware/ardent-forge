import { describe, it, expect, beforeEach } from 'vitest'
import { SupabaseAdapter } from '../supabase-adapter'
import { createMockSupabaseClient, type MockSupabaseClient } from '@/test/mocks/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GymRow, GymMemberRow } from '../database.types'

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
  is_default: true,
  created_at: now,
  updated_at: now,
}

const gymRowSecondary: GymRow = {
  id: 'gym-002',
  name: 'Iron Pit',
  owner_user_id: 'user-002',
  is_default: false,
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
      expect(result[0].isDefault).toBe(true)
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
    expect(result!.isDefault).toBe(true)
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
      is_default: false,
    }
    mockClient.mockResponse('gyms', 'insert', [created])

    const result = await adapter.createGym({ name: 'Garage' })

    expect(mockClient.from).toHaveBeenCalledWith('gyms')
    expect(result.id).toBe('gym-new')
    expect(result.name).toBe('Garage')
    expect(result.ownerUserId).toBe('user-001')
    expect(result.isDefault).toBe(false)
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
