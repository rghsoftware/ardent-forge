// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '@/test/render-helpers'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { GymOwnershipTransfer } from '@/domain/types'

// ---------------------------------------------------------------------------
// Adapter mock
// ---------------------------------------------------------------------------

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

// Import hooks after mock is set up
import {
  usePendingGymTransfer,
  useProposeGymTransfer,
  useAcceptGymTransfer,
  useCancelOrDeclineGymTransfer,
} from '../use-gym-transfers'

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

function makeTransfer(overrides: Partial<GymOwnershipTransfer> = {}): GymOwnershipTransfer {
  return {
    gymId: 'gym-1',
    proposedBy: 'user-1',
    proposedTo: 'user-2',
    proposedAt: '2026-04-08T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockAdapter = createMockAdapter()
})

// ===========================================================================
// usePendingGymTransfer
// ===========================================================================

describe('usePendingGymTransfer', () => {
  it('calls getPendingTransfer with the gymId and returns the row', async () => {
    const transfer = makeTransfer()
    vi.mocked(mockAdapter.getPendingTransfer).mockResolvedValue(transfer)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => usePendingGymTransfer('gym-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockAdapter.getPendingTransfer).toHaveBeenCalledWith('gym-1')
    expect(result.current.data?.gymId).toBe('gym-1')
    expect(result.current.data?.proposedTo).toBe('user-2')
  })

  it('returns null when there is no pending transfer', async () => {
    vi.mocked(mockAdapter.getPendingTransfer).mockResolvedValue(null)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => usePendingGymTransfer('gym-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('does not fetch when gymId is null', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => usePendingGymTransfer(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getPendingTransfer).not.toHaveBeenCalled()
  })

  it('does not fetch when gymId is undefined', () => {
    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => usePendingGymTransfer(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getPendingTransfer).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// useProposeGymTransfer
// ===========================================================================

describe('useProposeGymTransfer', () => {
  it('calls adapter.proposeGymTransfer with gymId and targetUserId', async () => {
    vi.mocked(mockAdapter.proposeGymTransfer).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useProposeGymTransfer(), { wrapper })

    await result.current.mutateAsync({ gymId: 'gym-1', targetUserId: 'user-2' })

    expect(mockAdapter.proposeGymTransfer).toHaveBeenCalledWith('gym-1', 'user-2')
  })

  it('invalidates the pending-transfer query on success', async () => {
    vi.mocked(mockAdapter.proposeGymTransfer).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useProposeGymTransfer(), { wrapper })
    await result.current.mutateAsync({ gymId: 'gym-1', targetUserId: 'user-2' })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-transfers', 'pending', 'gym-1'],
    })
  })

  it('logs with [gym-transfers] prefix and surfaces isError on failure', async () => {
    vi.mocked(mockAdapter.proposeGymTransfer).mockRejectedValue(new Error('RLS denied'))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useProposeGymTransfer(), { wrapper })

    await expect(
      result.current.mutateAsync({ gymId: 'gym-1', targetUserId: 'user-2' }),
    ).rejects.toThrow('RLS denied')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(errSpy).toHaveBeenCalled()
    const firstArg = errSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[gym-transfers]')
    expect(firstArg).toContain('proposeGymTransfer failed')

    errSpy.mockRestore()
  })
})

// ===========================================================================
// useAcceptGymTransfer
// ===========================================================================

describe('useAcceptGymTransfer', () => {
  it('calls adapter.acceptGymTransfer with the gymId', async () => {
    vi.mocked(mockAdapter.acceptGymTransfer).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAcceptGymTransfer(), { wrapper })

    await result.current.mutateAsync({ gymId: 'gym-1' })

    expect(mockAdapter.acceptGymTransfer).toHaveBeenCalledWith('gym-1')
  })

  it('invalidates both the gyms detail key and the pending-transfer key on success', async () => {
    vi.mocked(mockAdapter.acceptGymTransfer).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAcceptGymTransfer(), { wrapper })
    await result.current.mutateAsync({ gymId: 'gym-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gyms', 'detail', 'gym-1'],
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-transfers', 'pending', 'gym-1'],
    })
  })

  it('logs with [gym-transfers] prefix on failure', async () => {
    vi.mocked(mockAdapter.acceptGymTransfer).mockRejectedValue(new Error('not target'))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useAcceptGymTransfer(), { wrapper })

    await expect(result.current.mutateAsync({ gymId: 'gym-1' })).rejects.toThrow('not target')

    expect(errSpy).toHaveBeenCalled()
    const firstArg = errSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[gym-transfers]')
    expect(firstArg).toContain('acceptGymTransfer failed')

    errSpy.mockRestore()
  })
})

// ===========================================================================
// useCancelOrDeclineGymTransfer
// ===========================================================================

describe('useCancelOrDeclineGymTransfer', () => {
  it('calls adapter.cancelOrDeclineGymTransfer with the gymId (cancel path)', async () => {
    vi.mocked(mockAdapter.cancelOrDeclineGymTransfer).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCancelOrDeclineGymTransfer(), { wrapper })

    await result.current.mutateAsync({ gymId: 'gym-1' })

    expect(mockAdapter.cancelOrDeclineGymTransfer).toHaveBeenCalledWith('gym-1')
  })

  it('calls adapter.cancelOrDeclineGymTransfer with the gymId (decline path)', async () => {
    vi.mocked(mockAdapter.cancelOrDeclineGymTransfer).mockResolvedValue(undefined)

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCancelOrDeclineGymTransfer(), { wrapper })

    await result.current.mutateAsync({ gymId: 'gym-2' })

    expect(mockAdapter.cancelOrDeclineGymTransfer).toHaveBeenCalledWith('gym-2')
  })

  it('invalidates the pending-transfer query on success', async () => {
    vi.mocked(mockAdapter.cancelOrDeclineGymTransfer).mockResolvedValue(undefined)

    const { wrapper, queryClient } = buildWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCancelOrDeclineGymTransfer(), { wrapper })
    await result.current.mutateAsync({ gymId: 'gym-1' })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gym-transfers', 'pending', 'gym-1'],
    })
  })

  it('logs with [gym-transfers] prefix on failure', async () => {
    vi.mocked(mockAdapter.cancelOrDeclineGymTransfer).mockRejectedValue(new Error('not a party'))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { wrapper } = buildWrapper()
    const { result } = renderHook(() => useCancelOrDeclineGymTransfer(), { wrapper })

    await expect(result.current.mutateAsync({ gymId: 'gym-1' })).rejects.toThrow('not a party')

    expect(errSpy).toHaveBeenCalled()
    const firstArg = errSpy.mock.calls[0][0] as string
    expect(firstArg).toContain('[gym-transfers]')
    expect(firstArg).toContain('cancelOrDeclineGymTransfer failed')

    errSpy.mockRestore()
  })
})
