// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render-helpers'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { GymMember } from '@/domain/types'

// ---------------------------------------------------------------------------
// Adapter mock -- all hooks call getAdapter() to get the active adapter
// ---------------------------------------------------------------------------

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Import hooks after mock is set up
import { useGymMembers, useJoinGym, useLeaveGym, useKickGymMember } from '../use-gym-members'

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

// ---------------------------------------------------------------------------
// Minimal test fixtures (no existing buildGymMember factory)
// ---------------------------------------------------------------------------

function makeGymMember(overrides: Partial<GymMember> = {}): GymMember {
  return {
    gymId: 'gym-1',
    userId: 'user-1',
    joinedAt: '2026-04-06T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockAdapter = createMockAdapter()
})

// ===========================================================================
// useGymMembers -- list members of a gym
// ===========================================================================

describe('useGymMembers', () => {
  it('calls listGymMembers with the gymId and returns the list', async () => {
    const members = [
      makeGymMember({ gymId: 'gym-1', userId: 'user-1' }),
      makeGymMember({ gymId: 'gym-1', userId: 'user-2' }),
    ]
    vi.mocked(mockAdapter.listGymMembers).mockResolvedValue(members)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGymMembers('gym-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.listGymMembers).toHaveBeenCalledWith('gym-1')
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].userId).toBe('user-1')
    expect(result.current.data![1].userId).toBe('user-2')
  })

  it('does not fetch when gymId is null', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGymMembers(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listGymMembers).not.toHaveBeenCalled()
  })

  it('does not fetch when gymId is undefined', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGymMembers(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listGymMembers).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// useJoinGym -- join mutation
// ===========================================================================

describe('useJoinGym', () => {
  it('calls adapter.joinGym with the gymId', async () => {
    vi.mocked(mockAdapter.joinGym).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useJoinGym(), { wrapper })

    await result.current.mutateAsync('gym-1')

    expect(mockAdapter.joinGym).toHaveBeenCalledWith('gym-1')
  })

  it('invalidates gym-members list and the broad gyms key on success', async () => {
    vi.mocked(mockAdapter.joinGym).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useJoinGym(), { wrapper })
    await result.current.mutateAsync('gym-1')

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-members', 'list', 'gym-1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
  })

  it('surfaces isError when the adapter throws', async () => {
    vi.mocked(mockAdapter.joinGym).mockRejectedValue(new Error('offline'))

    const { wrapper } = buildWrapper()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useJoinGym(), { wrapper })

    await expect(result.current.mutateAsync('gym-1')).rejects.toThrow('offline')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    errSpy.mockRestore()
  })
})

// ===========================================================================
// useLeaveGym -- leave mutation
// ===========================================================================

describe('useLeaveGym', () => {
  it('calls adapter.leaveGym with the gymId', async () => {
    vi.mocked(mockAdapter.leaveGym).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useLeaveGym(), { wrapper })

    await result.current.mutateAsync('gym-1')

    expect(mockAdapter.leaveGym).toHaveBeenCalledWith('gym-1')
  })

  it('invalidates gym-members list and the broad gyms key on success', async () => {
    vi.mocked(mockAdapter.leaveGym).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useLeaveGym(), { wrapper })
    await result.current.mutateAsync('gym-1')

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-members', 'list', 'gym-1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
  })
})

// ===========================================================================
// useKickGymMember -- owner-only kick mutation (RLS-enforced)
// ===========================================================================

describe('useKickGymMember', () => {
  it('calls adapter.kickGymMember with the gymId and userId', async () => {
    vi.mocked(mockAdapter.kickGymMember).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useKickGymMember(), { wrapper })

    await result.current.mutateAsync({ gymId: 'gym-1', userId: 'user-2' })

    expect(mockAdapter.kickGymMember).toHaveBeenCalledWith('gym-1', 'user-2')
  })

  it('invalidates gym-members list and the broad gyms key on success', async () => {
    vi.mocked(mockAdapter.kickGymMember).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useKickGymMember(), { wrapper })
    await result.current.mutateAsync({ gymId: 'gym-1', userId: 'user-2' })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-members', 'list', 'gym-1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
  })

  it('surfaces isError when the adapter throws (e.g., RLS denies non-owner)', async () => {
    vi.mocked(mockAdapter.kickGymMember).mockRejectedValue(new Error('not authorized'))

    const { wrapper } = buildWrapper()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useKickGymMember(), { wrapper })

    await expect(result.current.mutateAsync({ gymId: 'gym-1', userId: 'user-2' })).rejects.toThrow(
      'not authorized',
    )

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    errSpy.mockRestore()
  })
})
