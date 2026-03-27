import { describe, it, expect } from 'vitest'
import {
  groupRoleSchema,
  connectionStatusSchema,
  shareableEntityTypeSchema,
  accountabilityGroupSchema,
  groupInviteSchema,
  shareLinkSchema,
  directConnectionSchema,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAccountabilityGroup = {
  id: 'grp-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  name: 'Morning Crew',
  createdBy: 'user-1',
  dataRetentionDays: 90,
}

const baseGroupInvite = {
  id: 'inv-1',
  groupId: 'grp-1',
  code: 'ABC123',
  createdBy: 'user-1',
  expiresAt: '2025-06-01T00:00:00Z',
  isActive: true,
}

const baseShareLink = {
  id: 'sl-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  token: 'tok_abc123def456',
  entityType: 'PROGRAM',
  entityId: 'prog-1',
  createdBy: 'user-1',
  isActive: true,
}

const baseDirectConnection = {
  id: 'dc-1',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  requesterId: 'user-1',
  recipientId: 'user-2',
  status: 'PENDING',
  requesterGrantsWrite: false,
  recipientGrantsWrite: false,
}

// ---------------------------------------------------------------------------
// GroupRole enum
// ---------------------------------------------------------------------------

describe('GroupRole enum', () => {
  it('accepts COACH', () => {
    expect(groupRoleSchema.safeParse('COACH').success).toBe(true)
  })

  it('accepts MEMBER', () => {
    expect(groupRoleSchema.safeParse('MEMBER').success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(groupRoleSchema.safeParse('ADMIN').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(groupRoleSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ConnectionStatus enum
// ---------------------------------------------------------------------------

describe('ConnectionStatus enum', () => {
  it('accepts PENDING', () => {
    expect(connectionStatusSchema.safeParse('PENDING').success).toBe(true)
  })

  it('accepts ACTIVE', () => {
    expect(connectionStatusSchema.safeParse('ACTIVE').success).toBe(true)
  })

  it('accepts DECLINED', () => {
    expect(connectionStatusSchema.safeParse('DECLINED').success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(connectionStatusSchema.safeParse('BLOCKED').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(connectionStatusSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ShareableEntityType enum
// ---------------------------------------------------------------------------

describe('ShareableEntityType enum', () => {
  it('accepts PROGRAM', () => {
    expect(shareableEntityTypeSchema.safeParse('PROGRAM').success).toBe(true)
  })

  it('accepts WORKOUT_LOG', () => {
    expect(shareableEntityTypeSchema.safeParse('WORKOUT_LOG').success).toBe(true)
  })

  it('rejects invalid value', () => {
    expect(shareableEntityTypeSchema.safeParse('EXERCISE').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(shareableEntityTypeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AccountabilityGroup schema
// ---------------------------------------------------------------------------

describe('AccountabilityGroup schema', () => {
  it('accepts valid accountability group', () => {
    expect(accountabilityGroupSchema.safeParse(baseAccountabilityGroup).success).toBe(true)
  })

  it('accepts with optional description', () => {
    const withDesc = { ...baseAccountabilityGroup, description: 'Early risers' }
    expect(accountabilityGroupSchema.safeParse(withDesc).success).toBe(true)
  })

  it('rejects empty name (min 1)', () => {
    const bad = { ...baseAccountabilityGroup, name: '' }
    expect(accountabilityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects zero dataRetentionDays (must be positive)', () => {
    const bad = { ...baseAccountabilityGroup, dataRetentionDays: 0 }
    expect(accountabilityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative dataRetentionDays', () => {
    const bad = { ...baseAccountabilityGroup, dataRetentionDays: -30 }
    expect(accountabilityGroupSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer dataRetentionDays', () => {
    const bad = { ...baseAccountabilityGroup, dataRetentionDays: 90.5 }
    expect(accountabilityGroupSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GroupInvite schema
// ---------------------------------------------------------------------------

describe('GroupInvite schema', () => {
  it('accepts valid group invite', () => {
    expect(groupInviteSchema.safeParse(baseGroupInvite).success).toBe(true)
  })

  it('rejects empty code (min 1)', () => {
    const bad = { ...baseGroupInvite, code: '' }
    expect(groupInviteSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing expiresAt', () => {
    const { expiresAt: _, ...noExpires } = baseGroupInvite as Record<string, unknown>
    expect(groupInviteSchema.safeParse(noExpires).success).toBe(false)
  })

  it('accepts isActive as true', () => {
    const active = { ...baseGroupInvite, isActive: true }
    expect(groupInviteSchema.safeParse(active).success).toBe(true)
  })

  it('accepts isActive as false', () => {
    const inactive = { ...baseGroupInvite, isActive: false }
    expect(groupInviteSchema.safeParse(inactive).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ShareLink schema
// ---------------------------------------------------------------------------

describe('ShareLink schema', () => {
  it('accepts valid share link', () => {
    expect(shareLinkSchema.safeParse(baseShareLink).success).toBe(true)
  })

  it('rejects empty token (min 1)', () => {
    const bad = { ...baseShareLink, token: '' }
    expect(shareLinkSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing entityId', () => {
    const { entityId: _, ...noEntityId } = baseShareLink as Record<string, unknown>
    expect(shareLinkSchema.safeParse(noEntityId).success).toBe(false)
  })

  it('rejects invalid entityType', () => {
    const bad = { ...baseShareLink, entityType: 'EXERCISE' }
    expect(shareLinkSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts isActive as true', () => {
    expect(shareLinkSchema.safeParse({ ...baseShareLink, isActive: true }).success).toBe(true)
  })

  it('accepts isActive as false', () => {
    expect(shareLinkSchema.safeParse({ ...baseShareLink, isActive: false }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DirectConnection schema -- S3 refine: status / acceptedAt relationship
// ACTIVE requires acceptedAt; PENDING requires no acceptedAt
// ---------------------------------------------------------------------------

describe('DirectConnection schema', () => {
  it('accepts PENDING status without acceptedAt', () => {
    expect(directConnectionSchema.safeParse(baseDirectConnection).success).toBe(true)
  })

  it('accepts ACTIVE status with acceptedAt', () => {
    const active = {
      ...baseDirectConnection,
      status: 'ACTIVE',
      acceptedAt: '2025-02-01T12:00:00Z',
    }
    expect(directConnectionSchema.safeParse(active).success).toBe(true)
  })

  it('rejects ACTIVE status without acceptedAt (S3 refine)', () => {
    const bad = { ...baseDirectConnection, status: 'ACTIVE' }
    expect(directConnectionSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects PENDING status with acceptedAt (S3 refine)', () => {
    const bad = {
      ...baseDirectConnection,
      status: 'PENDING',
      acceptedAt: '2025-02-01T12:00:00Z',
    }
    expect(directConnectionSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts DECLINED status without acceptedAt', () => {
    const declined = { ...baseDirectConnection, status: 'DECLINED' }
    expect(directConnectionSchema.safeParse(declined).success).toBe(true)
  })

  it('rejects DECLINED status with acceptedAt (S3 refine)', () => {
    const bad = {
      ...baseDirectConnection,
      status: 'DECLINED',
      acceptedAt: '2025-02-01T12:00:00Z',
    }
    expect(directConnectionSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts requesterGrantsWrite as true', () => {
    const grants = { ...baseDirectConnection, requesterGrantsWrite: true }
    expect(directConnectionSchema.safeParse(grants).success).toBe(true)
  })

  it('accepts recipientGrantsWrite as true', () => {
    const grants = { ...baseDirectConnection, recipientGrantsWrite: true }
    expect(directConnectionSchema.safeParse(grants).success).toBe(true)
  })

  it('rejects invalid status enum', () => {
    const bad = { ...baseDirectConnection, status: 'BLOCKED' }
    expect(directConnectionSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing requesterId', () => {
    const { requesterId: _, ...noReq } = baseDirectConnection as Record<string, unknown>
    expect(directConnectionSchema.safeParse(noReq).success).toBe(false)
  })

  it('rejects missing recipientId', () => {
    const { recipientId: _, ...noRec } = baseDirectConnection as Record<string, unknown>
    expect(directConnectionSchema.safeParse(noRec).success).toBe(false)
  })
})
