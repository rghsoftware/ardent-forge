// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import { shareTokenSchema } from '@/domain/types'
import type { ShareLink, ShareToken } from '@/domain/types'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

const mockRpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
}))

import {
  useShareLinks,
  useShareLinksForEntity,
  useCreateShareLink,
  useRevokeShareLink,
  useDeleteShareLink,
  useResolveShareLink,
  useSharedProgram,
  useSharedWorkout,
  useCloneProgram,
} from '../use-share-links'

beforeEach(() => {
  mockAdapter = createMockAdapter()
  mockRpc.mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_TOKEN = shareTokenSchema.parse('abc123def456')

function buildShareLink(overrides?: Partial<ShareLink>): ShareLink {
  return {
    id: 'sl-1',
    token: TEST_TOKEN,
    entityType: 'PROGRAM',
    entityId: 'prog-1',
    createdBy: 'user-1',
    isActive: true,
    createdAt: '2026-03-29T00:00:00Z',
    updatedAt: '2026-03-29T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe('useShareLinks', () => {
  it('returns share links for a user', async () => {
    const links = [
      buildShareLink(),
      buildShareLink({ id: 'sl-2', token: shareTokenSchema.parse('xyz789uvw012') }),
    ]
    vi.mocked(mockAdapter.getShareLinks).mockResolvedValue(links)

    const { result } = renderHook(() => useShareLinks('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(mockAdapter.getShareLinks).toHaveBeenCalledWith('user-1')
  })

  it('does not fetch when userId is undefined', () => {
    const { result } = renderHook(() => useShareLinks(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getShareLinks).not.toHaveBeenCalled()
  })
})

describe('useShareLinksForEntity', () => {
  it('returns share links for a specific entity', async () => {
    const links = [buildShareLink()]
    vi.mocked(mockAdapter.getShareLinksForEntity).mockResolvedValue(links)

    const { result } = renderHook(() => useShareLinksForEntity('PROGRAM', 'prog-1'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(1)
    expect(mockAdapter.getShareLinksForEntity).toHaveBeenCalledWith('PROGRAM', 'prog-1')
  })

  it('does not fetch when entityId is undefined', () => {
    const { result } = renderHook(() => useShareLinksForEntity('PROGRAM', undefined), {
      wrapper: TestWrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getShareLinksForEntity).not.toHaveBeenCalled()
  })
})

describe('useResolveShareLink', () => {
  it('calls resolve_share_link RPC with the token', async () => {
    const resolved = {
      id: 'sl-1',
      token: 'abc123def456',
      entity_type: 'PROGRAM',
      entity_id: 'prog-1',
      is_active: true,
      created_at: '2026-03-29T00:00:00Z',
    }
    mockRpc.mockResolvedValue({ data: [resolved], error: null })

    const { result } = renderHook(() => useResolveShareLink('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(resolved)
    expect(mockRpc).toHaveBeenCalledWith('resolve_share_link', { lookup_token: 'abc123def456' })
  })

  it('does not fetch when token is empty', () => {
    const { result } = renderHook(() => useResolveShareLink(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('transitions to isError when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('not found') })

    const { result } = renderHook(() => useResolveShareLink('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.data).toBeUndefined()
  })

  it('returns null when RPC returns an empty array (revoked/inactive link)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useResolveShareLink('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })
})

describe('useSharedProgram', () => {
  it('calls get_shared_program RPC with the token', async () => {
    const programData = { program: { id: 'prog-1', name: 'Test Program' } }
    mockRpc.mockResolvedValue({ data: programData, error: null })

    const { result } = renderHook(() => useSharedProgram('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(programData)
    expect(mockRpc).toHaveBeenCalledWith('get_shared_program', { lookup_token: 'abc123def456' })
  })

  it('does not fetch when token is empty', () => {
    const { result } = renderHook(() => useSharedProgram(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('transitions to isError when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('server error') })

    const { result } = renderHook(() => useSharedProgram('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

describe('useSharedWorkout', () => {
  it('calls get_shared_workout RPC with the token', async () => {
    const workoutData = { log: { id: 'wl-1', date: '2026-03-29' } }
    mockRpc.mockResolvedValue({ data: workoutData, error: null })

    const { result } = renderHook(() => useSharedWorkout('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(workoutData)
    expect(mockRpc).toHaveBeenCalledWith('get_shared_workout', { lookup_token: 'abc123def456' })
  })

  it('does not fetch when token is empty', () => {
    const { result } = renderHook(() => useSharedWorkout(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('transitions to isError when RPC returns an error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('server error') })

    const { result } = renderHook(() => useSharedWorkout('abc123def456'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe('useCreateShareLink', () => {
  it('calls adapter.createShareLink', async () => {
    const created = buildShareLink()
    vi.mocked(mockAdapter.createShareLink).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateShareLink(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      token: TEST_TOKEN,
      entityType: 'PROGRAM',
      entityId: 'prog-1',
      createdBy: 'user-1',
    })

    expect(mockAdapter.createShareLink).toHaveBeenCalledWith({
      token: TEST_TOKEN,
      entityType: 'PROGRAM',
      entityId: 'prog-1',
      createdBy: 'user-1',
    })
  })

  it('sets isError when adapter.createShareLink rejects', async () => {
    vi.mocked(mockAdapter.createShareLink).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useCreateShareLink(), { wrapper: TestWrapper })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          token: 'abc123def456' as ShareToken,
          entityType: 'PROGRAM',
          entityId: 'prog-1',
          createdBy: 'user-1',
        })
      } catch {
        // expected to throw
      }
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })
})

describe('useRevokeShareLink', () => {
  it('calls adapter.revokeShareLink', async () => {
    vi.mocked(mockAdapter.revokeShareLink).mockResolvedValue(undefined)

    const { result } = renderHook(() => useRevokeShareLink(), { wrapper: TestWrapper })

    await result.current.mutateAsync('sl-1')

    expect(mockAdapter.revokeShareLink).toHaveBeenCalledWith('sl-1')
  })
})

describe('useDeleteShareLink', () => {
  it('calls adapter.deleteShareLink', async () => {
    vi.mocked(mockAdapter.deleteShareLink).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteShareLink(), { wrapper: TestWrapper })

    await result.current.mutateAsync('sl-1')

    expect(mockAdapter.deleteShareLink).toHaveBeenCalledWith('sl-1')
  })
})

describe('useCloneProgram', () => {
  it('calls adapter.createProgramFull with stripped IDs and SHARED source', async () => {
    const programFull = {
      program: {
        id: 'prog-1',
        userId: 'original-user',
        name: 'TB Operator',
        description: 'Tactical Barbell Operator program',
        source: 'CUSTOM' as const,
        durationWeeks: 12,
        isPublic: false,
        createdBy: 'original-user',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      blocks: [
        {
          id: 'block-1',
          programId: 'prog-1',
          name: 'Base Building',
          ordinal: 1,
          durationWeeks: 4,
          blockType: 'ACCUMULATION' as const,
        },
      ],
      blockWeeks: [
        { id: 'bw-1', blockId: 'block-1', weekNumber: 1 },
        { id: 'bw-2', blockId: 'block-1', weekNumber: 2 },
      ],
      scheduledSessions: [
        {
          id: 'ss-1',
          blockWeekId: 'bw-1',
          dayLabel: 'Day 1',
          sessionType: 'STRENGTH' as const,
          sessionTemplateId: 'st-1',
        },
        {
          id: 'ss-2',
          blockWeekId: 'bw-2',
          dayLabel: 'Day 1',
          sessionType: 'STRENGTH' as const,
          sessionTemplateId: 'st-1',
        },
      ],
    }

    const created = {
      program: { ...programFull.program, id: 'prog-new', userId: 'clone-user' },
      blocks: programFull.blocks,
      blockWeeks: programFull.blockWeeks,
      scheduledSessions: programFull.scheduledSessions,
    }
    vi.mocked(mockAdapter.createProgramFull).mockResolvedValue(created)

    const { result } = renderHook(() => useCloneProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync({ program: programFull, userId: 'clone-user' })

    expect(mockAdapter.createProgramFull).toHaveBeenCalledWith(
      {
        userId: 'clone-user',
        name: 'TB Operator',
        description: 'Tactical Barbell Operator program',
        source: 'SHARED',
        durationWeeks: 12,
        isPublic: false,
        createdBy: 'clone-user',
      },
      [
        {
          block: {
            name: 'Base Building',
            ordinal: 1,
            durationWeeks: 4,
            blockType: 'ACCUMULATION',
          },
          weeks: [
            {
              week: { weekNumber: 1 },
              sessions: [
                {
                  dayOfWeek: undefined,
                  dayLabel: 'Day 1',
                  sessionType: 'STRENGTH',
                  notes: undefined,
                },
              ],
            },
            {
              week: { weekNumber: 2 },
              sessions: [
                {
                  dayOfWeek: undefined,
                  dayLabel: 'Day 1',
                  sessionType: 'STRENGTH',
                  notes: undefined,
                },
              ],
            },
          ],
        },
      ],
    )
  })
})
