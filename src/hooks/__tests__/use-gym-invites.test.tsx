// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render-helpers'
import type { GymInvitation, RedeemInviteError } from '@/domain/types'

// ---------------------------------------------------------------------------
// Adapter mock -- the hook module casts getAdapter() to a narrow F021 shape
// (see use-gym-invites.ts `GymInviteAdapter`). We only need to stub those
// three methods here.
// ---------------------------------------------------------------------------

type InviteAdapter = {
  createGymInvite: ReturnType<typeof vi.fn>
  listGymInvites: ReturnType<typeof vi.fn>
  redeemGymInvite: ReturnType<typeof vi.fn>
}

let mockAdapter: InviteAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Import hooks after the mock is set up
import { useListGymInvites, useCreateGymInvite, useRedeemGymInvite } from '../use-gym-invites'

// ---------------------------------------------------------------------------
// Per-test QueryClient wrapper so we can spy on invalidateQueries
// ---------------------------------------------------------------------------

function buildWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement
  queryClient: QueryClient
} {
  const queryClient = createTestQueryClient()
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return { wrapper: Wrapper, queryClient }
}

function makeInvite(overrides: Partial<GymInvitation> = {}): GymInvitation {
  return {
    id: 'invite-1',
    gymId: 'gym-1',
    token: 'OPAQUE_TOKEN',
    expiresAt: '2026-05-01T10:00:00.000Z',
    maxUses: 10,
    usesCount: 0,
    createdBy: 'user-1',
    createdAt: '2026-04-08T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockAdapter = {
    createGymInvite: vi.fn(),
    listGymInvites: vi.fn(),
    redeemGymInvite: vi.fn(),
  }
})

// ===========================================================================
// useListGymInvites
// ===========================================================================

describe('useListGymInvites', () => {
  it('calls listGymInvites with the gymId and returns the list', async () => {
    const invites = [makeInvite({ id: 'invite-1' }), makeInvite({ id: 'invite-2' })]
    mockAdapter.listGymInvites.mockResolvedValue(invites)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useListGymInvites('gym-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.listGymInvites).toHaveBeenCalledWith('gym-1')
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when gymId is null', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useListGymInvites(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listGymInvites).not.toHaveBeenCalled()
  })

  it('does not fetch when gymId is undefined', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useListGymInvites(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listGymInvites).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// useCreateGymInvite
// ===========================================================================

describe('useCreateGymInvite', () => {
  it('calls createGymInvite with the gymId and options', async () => {
    mockAdapter.createGymInvite.mockResolvedValue(makeInvite({ id: 'invite-new' }))

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCreateGymInvite(), { wrapper })

    const returned = await result.current.mutateAsync({
      gymId: 'gym-1',
      expiresAt: '2026-05-01T10:00:00.000Z',
      maxUses: 5,
    })

    expect(mockAdapter.createGymInvite).toHaveBeenCalledWith('gym-1', {
      expiresAt: '2026-05-01T10:00:00.000Z',
      maxUses: 5,
    })
    expect(returned.id).toBe('invite-new')
  })

  it('invalidates the gym-invites query key on success', async () => {
    mockAdapter.createGymInvite.mockResolvedValue(makeInvite())

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateGymInvite(), { wrapper })
    await result.current.mutateAsync({ gymId: 'gym-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gym-invites', 'gym-1'] })
  })

  it('logs with [gym-invites] prefix and gymId on adapter throw', async () => {
    const err = new Error('network down')
    mockAdapter.createGymInvite.mockRejectedValue(err)

    const { wrapper } = buildWrapper()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useCreateGymInvite(), { wrapper })

    await expect(result.current.mutateAsync({ gymId: 'gym-1' })).rejects.toThrow('network down')

    expect(errSpy).toHaveBeenCalledWith(
      '[gym-invites] createGymInvite failed:',
      expect.objectContaining({ gymId: 'gym-1', err }),
    )

    errSpy.mockRestore()
  })
})

// ===========================================================================
// useRedeemGymInvite
// ===========================================================================

describe('useRedeemGymInvite', () => {
  it('returns ok:true and invalidates gyms + gym-members on successful redeem', async () => {
    mockAdapter.redeemGymInvite.mockResolvedValue({ ok: true, gymId: 'gym-42' })

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRedeemGymInvite(), { wrapper })
    const returned = await result.current.mutateAsync('OPAQUE_TOKEN')

    expect(mockAdapter.redeemGymInvite).toHaveBeenCalledWith('OPAQUE_TOKEN')
    expect(returned).toEqual({ ok: true, gymId: 'gym-42' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gym-members'] })
  })

  it.each<RedeemInviteError['kind']>(['invalid', 'expired', 'exhausted'])(
    'surfaces ok:false with kind=%s from the adapter result',
    async (kind) => {
      mockAdapter.redeemGymInvite.mockResolvedValue({ ok: false, error: { kind } })

      const { wrapper, queryClient } = buildWrapper()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useRedeemGymInvite(), { wrapper })
      const returned = await result.current.mutateAsync('OPAQUE_TOKEN')

      expect(returned).toEqual({ ok: false, error: { kind } })
      // A non-ok result must NOT invalidate -- no successful join occurred
      expect(invalidateSpy).not.toHaveBeenCalled()
    },
  )

  it('logs with [gym-invites] prefix (no token) on thrown adapter error', async () => {
    const err = new Error('network down')
    mockAdapter.redeemGymInvite.mockRejectedValue(err)

    const { wrapper } = buildWrapper()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useRedeemGymInvite(), { wrapper })
    await expect(result.current.mutateAsync('OPAQUE_TOKEN')).rejects.toThrow('network down')

    expect(errSpy).toHaveBeenCalledWith(
      '[gym-invites] redeemGymInvite failed:',
      expect.objectContaining({ err }),
    )
    // Assert the raw token is NEVER in any logged payload
    for (const call of errSpy.mock.calls) {
      const serialized = JSON.stringify(call)
      expect(serialized).not.toContain('OPAQUE_TOKEN')
    }

    errSpy.mockRestore()
  })
})
