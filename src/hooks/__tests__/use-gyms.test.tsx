// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render-helpers'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Adapter mock -- all hooks call getAdapter() to get the active adapter
// ---------------------------------------------------------------------------

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Import hooks after mock is set up
import { useGyms, useAllGyms, useGym, useCreateGym, useUpdateGym, useDeleteGym } from '../use-gyms'

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
// Minimal test fixtures (no existing buildGym factory)
// ---------------------------------------------------------------------------

function makeGym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: 'gym-1',
    createdAt: '2026-04-06T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    name: 'Home Gym',
    ownerUserId: 'user-1',
    isDefault: false,
    ...overrides,
  }
}

beforeEach(() => {
  mockAdapter = createMockAdapter()
})

// ===========================================================================
// useGyms -- list user's gym memberships
// ===========================================================================

describe('useGyms', () => {
  it('calls listUserGyms with the given userId and returns the list', async () => {
    const gyms = [
      makeGym({ id: 'gym-1', name: 'Home Gym' }),
      makeGym({ id: 'gym-2', name: 'Garage' }),
    ]
    vi.mocked(mockAdapter.listUserGyms).mockResolvedValue(gyms)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGyms('user-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.listUserGyms).toHaveBeenCalledWith('user-1')
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Home Gym')
    expect(result.current.data![1].name).toBe('Garage')
  })

  it('does not fetch when userId is undefined', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGyms(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listUserGyms).not.toHaveBeenCalled()
  })

  it('does not fetch when userId is null', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGyms(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.listUserGyms).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// useAllGyms -- list every gym on the instance
// ===========================================================================

describe('useAllGyms', () => {
  it('calls listAllGyms and returns the list', async () => {
    const gyms = [
      makeGym({ id: 'gym-1', name: 'Home Gym' }),
      makeGym({ id: 'gym-2', name: 'Commercial' }),
      makeGym({ id: 'gym-3', name: 'Garage' }),
    ]
    vi.mocked(mockAdapter.listAllGyms).mockResolvedValue(gyms)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAllGyms(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.listAllGyms).toHaveBeenCalled()
    expect(result.current.data).toHaveLength(3)
  })
})

// ===========================================================================
// useGym -- single-gym detail lookup
// ===========================================================================

describe('useGym', () => {
  it('calls getGym with the gymId and returns the row', async () => {
    const gym = makeGym({ id: 'gym-1', name: 'Home Gym' })
    vi.mocked(mockAdapter.getGym).mockResolvedValue(gym)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGym('gym-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.getGym).toHaveBeenCalledWith('gym-1')
    expect(result.current.data?.id).toBe('gym-1')
    expect(result.current.data?.name).toBe('Home Gym')
  })

  it('returns null when the gym does not exist', async () => {
    vi.mocked(mockAdapter.getGym).mockResolvedValue(null)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGym('missing-gym'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('does not fetch when gymId is null', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useGym(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getGym).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// useCreateGym -- create mutation
// ===========================================================================

describe('useCreateGym', () => {
  it('calls adapter.createGym and returns the new row', async () => {
    const created = makeGym({ id: 'gym-new', name: 'Basement' })
    vi.mocked(mockAdapter.createGym).mockResolvedValue(created)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCreateGym(), { wrapper })

    const returned = await result.current.mutateAsync({ name: 'Basement' })

    expect(mockAdapter.createGym).toHaveBeenCalledWith({ name: 'Basement' })
    expect(returned.id).toBe('gym-new')
    expect(returned.name).toBe('Basement')
  })

  it('invalidates the gyms query key on success', async () => {
    vi.mocked(mockAdapter.createGym).mockResolvedValue(makeGym({ id: 'gym-new' }))

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateGym(), { wrapper })
    await result.current.mutateAsync({ name: 'Basement' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
  })

  it('surfaces isError when the adapter throws', async () => {
    vi.mocked(mockAdapter.createGym).mockRejectedValue(new Error('offline'))

    const { wrapper } = buildWrapper()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useCreateGym(), { wrapper })

    await expect(result.current.mutateAsync({ name: 'X' })).rejects.toThrow('offline')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    errSpy.mockRestore()
  })
})

// ===========================================================================
// useUpdateGym -- update mutation
// ===========================================================================

describe('useUpdateGym', () => {
  it('calls adapter.updateGym with the partial payload and returns the row', async () => {
    const updated = makeGym({ id: 'gym-1', name: 'Renamed Gym' })
    vi.mocked(mockAdapter.updateGym).mockResolvedValue(updated)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useUpdateGym(), { wrapper })

    const returned = await result.current.mutateAsync({ id: 'gym-1', name: 'Renamed Gym' })

    expect(mockAdapter.updateGym).toHaveBeenCalledWith({ id: 'gym-1', name: 'Renamed Gym' })
    expect(returned.name).toBe('Renamed Gym')
  })

  it('invalidates both the broad gyms key and the specific detail key', async () => {
    vi.mocked(mockAdapter.updateGym).mockResolvedValue(makeGym({ id: 'gym-1' }))

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateGym(), { wrapper })
    await result.current.mutateAsync({ id: 'gym-1', name: 'New Name' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gyms', 'detail', 'gym-1'],
    })
  })
})

// ===========================================================================
// useDeleteGym -- delete mutation
// ===========================================================================

describe('useDeleteGym', () => {
  it('calls adapter.deleteGym with the gymId', async () => {
    vi.mocked(mockAdapter.deleteGym).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useDeleteGym(), { wrapper })

    await result.current.mutateAsync('gym-1')

    expect(mockAdapter.deleteGym).toHaveBeenCalledWith('gym-1')
  })

  it('invalidates the gyms key and removes the cached detail entry', async () => {
    vi.mocked(mockAdapter.deleteGym).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const removeSpy = vi.spyOn(queryClient, 'removeQueries')

    const { result } = renderHook(() => useDeleteGym(), { wrapper })
    await result.current.mutateAsync('gym-1')

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['gyms'] })
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: ['gyms', 'detail', 'gym-1'] })
  })
})
