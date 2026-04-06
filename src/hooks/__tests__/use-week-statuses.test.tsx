// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { TestWrapper, createTestQueryClient } from '@/test/render-helpers'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'
import type { WeekStatus } from '@/domain/types'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import { useWeekStatuses } from '../use-week-statuses'

beforeEach(() => {
  mockAdapter = createMockAdapter()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWeekStatus(overrides: Partial<WeekStatus> = {}): WeekStatus {
  return {
    id: 'ws-1',
    activationId: 'act-1',
    blockOrdinal: 1,
    weekNumber: 1,
    status: 'done',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Query behavior
// ---------------------------------------------------------------------------

describe('useWeekStatuses - query', () => {
  it('returns statuses from adapter', async () => {
    const statuses = [
      buildWeekStatus({ id: 'ws-1', blockOrdinal: 1, weekNumber: 1 }),
      buildWeekStatus({ id: 'ws-2', blockOrdinal: 1, weekNumber: 2, status: 'skipped' }),
    ]
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue(statuses)

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.statuses).toHaveLength(2)
    expect(result.current.statuses[0].status).toBe('done')
    expect(result.current.statuses[1].status).toBe('skipped')
    expect(mockAdapter.getWeekStatuses).toHaveBeenCalledWith('act-1')
  })

  it('returns empty array when no data', async () => {
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue([])

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.statuses).toEqual([])
  })

  it('handles loading state', () => {
    // Never resolves, so stays loading
    vi.mocked(mockAdapter.getWeekStatuses).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.statuses).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Disabled query
// ---------------------------------------------------------------------------

describe('useWeekStatuses - disabled when no activationId', () => {
  it('does not fire query when activationId is undefined', () => {
    const { result } = renderHook(() => useWeekStatuses(undefined), { wrapper: TestWrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.statuses).toEqual([])
    expect(mockAdapter.getWeekStatuses).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Optimistic cache updates
// ---------------------------------------------------------------------------

describe('useWeekStatuses - optimistic updates', () => {
  it('updates existing entry in cache by composite key', async () => {
    const existing = [
      buildWeekStatus({ id: 'ws-1', blockOrdinal: 1, weekNumber: 1, status: 'done' }),
      buildWeekStatus({ id: 'ws-2', blockOrdinal: 1, weekNumber: 2, status: 'done' }),
    ]
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue(existing)
    // Mutation never settles so we can inspect the optimistic state
    vi.mocked(mockAdapter.upsertWeekStatuses).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.statuses).toHaveLength(2)
    })

    act(() => {
      result.current.upsertStatuses([
        { blockOrdinal: 1, weekNumber: 2, status: 'skipped' },
      ])
    })

    await waitFor(() => {
      const updated = result.current.statuses.find(
        (s) => s.blockOrdinal === 1 && s.weekNumber === 2,
      )
      expect(updated?.status).toBe('skipped')
      // Original ID should be preserved
      expect(updated?.id).toBe('ws-2')
    })

    // The first entry should remain unchanged
    expect(result.current.statuses.find((s) => s.weekNumber === 1)?.status).toBe('done')
  })

  it('adds new entry with synthetic optimistic ID', async () => {
    const existing = [
      buildWeekStatus({ id: 'ws-1', blockOrdinal: 1, weekNumber: 1, status: 'done' }),
    ]
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue(existing)
    vi.mocked(mockAdapter.upsertWeekStatuses).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.statuses).toHaveLength(1)
    })

    act(() => {
      result.current.upsertStatuses([
        { blockOrdinal: 2, weekNumber: 3, status: 'skipped' },
      ])
    })

    await waitFor(() => {
      expect(result.current.statuses).toHaveLength(2)
    })

    const newEntry = result.current.statuses.find(
      (s) => s.blockOrdinal === 2 && s.weekNumber === 3,
    )
    expect(newEntry).toBeDefined()
    expect(newEntry!.id).toBe('optimistic-2-3')
    expect(newEntry!.status).toBe('skipped')
    expect(newEntry!.activationId).toBe('act-1')
  })
})

// ---------------------------------------------------------------------------
// Rollback on failure
// ---------------------------------------------------------------------------

describe('useWeekStatuses - rollback on error', () => {
  it('restores previous cache data when mutation fails', async () => {
    const existing = [
      buildWeekStatus({ id: 'ws-1', blockOrdinal: 1, weekNumber: 1, status: 'done' }),
    ]
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue(existing)
    vi.mocked(mockAdapter.upsertWeekStatuses).mockRejectedValue(new Error('network failure'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useWeekStatuses('act-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.statuses).toHaveLength(1)
    })

    act(() => {
      result.current.upsertStatuses([
        { blockOrdinal: 1, weekNumber: 1, status: 'skipped' },
      ])
    })

    // Wait for mutation to settle and rollback to occur
    await waitFor(() => {
      expect(result.current.isUpserting).toBe(false)
    })

    // After rollback, original status should be restored
    // (invalidation will refetch the original data)
    await waitFor(() => {
      expect(result.current.statuses[0].status).toBe('done')
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      '[week-statuses] Failed to upsert week statuses:',
      expect.any(Error),
    )

    consoleSpy.mockRestore()
  })

  it('logs warning when no previous data exists on rollback', async () => {
    // Use a custom wrapper with a QueryClient where we can control cache state
    const queryClient = createTestQueryClient()
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }

    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue([])
    vi.mocked(mockAdapter.upsertWeekStatuses).mockRejectedValue(new Error('server error'))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderHook(() => useWeekStatuses('act-1'), { wrapper: Wrapper })

    // To hit the warn path we need getQueryData to return undefined,
    // which happens when the query has never been fetched.
    // Use a fresh activationId that has no cache entry.
    const { result: result2 } = renderHook(() => useWeekStatuses('act-no-cache'), {
      wrapper: Wrapper,
    })

    // act-no-cache query is disabled (not a valid fetch since we didn't mock it)
    // but more importantly, no cache entry exists for it
    // We need to call the mutation -- but mutationFn uses activationId!
    // The hook uses activationId from the closure, so we need to mock upsert
    vi.mocked(mockAdapter.upsertWeekStatuses).mockRejectedValue(new Error('server error'))

    act(() => {
      result2.current.upsertStatuses([
        { blockOrdinal: 1, weekNumber: 1, status: 'done' },
      ])
    })

    await waitFor(() => {
      expect(result2.current.isUpserting).toBe(false)
    })

    expect(warnSpy).toHaveBeenCalledWith(
      '[week-statuses] No previous data to rollback to',
    )

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Mutation calls adapter
// ---------------------------------------------------------------------------

describe('useWeekStatuses - mutation calls adapter', () => {
  it('calls upsertWeekStatuses with correct activationId and statuses', async () => {
    const serverResponse = [
      buildWeekStatus({ id: 'ws-server-1', blockOrdinal: 1, weekNumber: 1, status: 'done' }),
    ]
    vi.mocked(mockAdapter.getWeekStatuses).mockResolvedValue([])
    vi.mocked(mockAdapter.upsertWeekStatuses).mockResolvedValue(serverResponse)

    const { result } = renderHook(() => useWeekStatuses('act-42'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const incoming = [
      { blockOrdinal: 1, weekNumber: 1, status: 'done' as const },
      { blockOrdinal: 2, weekNumber: 1, status: 'skipped' as const },
    ]

    await act(async () => {
      await result.current.upsertStatusesAsync(incoming)
    })

    expect(mockAdapter.upsertWeekStatuses).toHaveBeenCalledWith('act-42', incoming)
  })
})
