import { describe, it, expect } from 'vitest'
import { gymSchema, gymMemberSchema } from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseGym = {
  id: 'gym-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Home Garage Iron Works Limited', // 30 chars
  ownerUserId: 'user-1',
  isDefault: false,
}

const baseGymMember = {
  gymId: 'gym-1',
  userId: 'user-1',
  joinedAt: '2026-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// gymSchema -- happy path
// ---------------------------------------------------------------------------

describe('gymSchema', () => {
  it('parses a valid gym row with name length 30', () => {
    expect(baseGym.name.length).toBe(30)
    const result = gymSchema.parse(baseGym)
    expect(result.id).toBe('gym-1')
    expect(result.name).toBe('Home Garage Iron Works Limited')
    expect(result.ownerUserId).toBe('user-1')
    expect(result.isDefault).toBe(false)
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(result.updatedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('accepts isDefault = true', () => {
    const result = gymSchema.parse({ ...baseGym, isDefault: true })
    expect(result.isDefault).toBe(true)
  })

  // -------------------------------------------------------------------------
  // M1: name length boundaries (1..60 chars, mirrors SQL char_length check)
  // -------------------------------------------------------------------------

  it('rejects an empty name (0 chars)', () => {
    const result = gymSchema.safeParse({ ...baseGym, name: '' })
    expect(result.success).toBe(false)
  })

  it('accepts a 60-character name', () => {
    const name60 = 'a'.repeat(60)
    expect(name60.length).toBe(60)
    const result = gymSchema.safeParse({ ...baseGym, name: name60 })
    expect(result.success).toBe(true)
  })

  it('rejects a 61-character name', () => {
    const name61 = 'a'.repeat(61)
    expect(name61.length).toBe(61)
    const result = gymSchema.safeParse({ ...baseGym, name: name61 })
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Required fields
  // -------------------------------------------------------------------------

  it('rejects a row missing name', () => {
    const { name: _name, ...withoutName } = baseGym
    const result = gymSchema.safeParse(withoutName)
    expect(result.success).toBe(false)
  })

  // RD-15: ownerUserId is the canonical ownership column
  it('rejects a row missing ownerUserId', () => {
    const { ownerUserId: _ownerUserId, ...withoutOwner } = baseGym
    const result = gymSchema.safeParse(withoutOwner)
    expect(result.success).toBe(false)
  })

  it('rejects a row missing isDefault', () => {
    const { isDefault: _isDefault, ...withoutDefault } = baseGym
    const result = gymSchema.safeParse(withoutDefault)
    expect(result.success).toBe(false)
  })

  it('rejects a row missing id (inherited from syncableEntitySchema)', () => {
    const { id: _id, ...withoutId } = baseGym
    const result = gymSchema.safeParse(withoutId)
    expect(result.success).toBe(false)
  })

  it('rejects a row with a non-ISO updatedAt timestamp', () => {
    const result = gymSchema.safeParse({ ...baseGym, updatedAt: 'not-a-date' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// gymMemberSchema -- happy path
// ---------------------------------------------------------------------------

describe('gymMemberSchema', () => {
  it('parses a valid gym member row', () => {
    const result = gymMemberSchema.parse(baseGymMember)
    expect(result.gymId).toBe('gym-1')
    expect(result.userId).toBe('user-1')
    expect(result.joinedAt).toBe('2026-01-01T00:00:00Z')
  })

  // -------------------------------------------------------------------------
  // Required fields (composite PK is gym_id + user_id, joined_at NOT NULL)
  // -------------------------------------------------------------------------

  it('rejects a row missing gymId', () => {
    const { gymId: _gymId, ...withoutGymId } = baseGymMember
    const result = gymMemberSchema.safeParse(withoutGymId)
    expect(result.success).toBe(false)
  })

  it('rejects a row missing userId', () => {
    const { userId: _userId, ...withoutUserId } = baseGymMember
    const result = gymMemberSchema.safeParse(withoutUserId)
    expect(result.success).toBe(false)
  })

  it('rejects a row missing joinedAt', () => {
    const { joinedAt: _joinedAt, ...withoutJoinedAt } = baseGymMember
    const result = gymMemberSchema.safeParse(withoutJoinedAt)
    expect(result.success).toBe(false)
  })

  it('rejects a row with a non-ISO joinedAt timestamp', () => {
    const result = gymMemberSchema.safeParse({ ...baseGymMember, joinedAt: 'yesterday' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty gymId (entityId requires min length 1)', () => {
    const result = gymMemberSchema.safeParse({ ...baseGymMember, gymId: '' })
    expect(result.success).toBe(false)
  })
})
