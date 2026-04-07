// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import {
  buildWorkoutLog,
  buildLoggedActivityGroup,
  buildLoggedActivity,
  buildLoggedSet,
  resetFactoryCounters,
} from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import {
  useWorkoutLogs,
  useWorkoutLog,
  useWorkoutLogsSummary,
  useWorkoutLogFull,
  useCreateWorkoutLog,
  useUpdateWorkoutLog,
  useDeleteWorkoutLog,
  useCreateLoggedActivityGroup,
  useCreateLoggedActivity,
  useCreateLoggedSet,
  useUpdateLoggedSet,
  useDeleteLoggedSet,
  useUpdateLoggedActivity,
  useDeleteLoggedActivity,
  useUpdateLoggedActivityGroup,
  useDeleteLoggedActivityGroup,
} from '../use-workout-logs'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
})

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe('useWorkoutLogs', () => {
  it('returns workout logs for a user', async () => {
    const logs = [buildWorkoutLog({ userId: 'user-1' }), buildWorkoutLog({ userId: 'user-1' })]
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue(logs)

    const { result } = renderHook(() => useWorkoutLogs('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(mockAdapter.getWorkoutLogs).toHaveBeenCalledWith('user-1', undefined)
  })

  it('passes limit to adapter', async () => {
    vi.mocked(mockAdapter.getWorkoutLogs).mockResolvedValue([])

    renderHook(() => useWorkoutLogs('user-1', 5), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(mockAdapter.getWorkoutLogs).toHaveBeenCalledWith('user-1', 5)
    })
  })

  it('does not fetch when userId is empty', async () => {
    const { result } = renderHook(() => useWorkoutLogs(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getWorkoutLogs).not.toHaveBeenCalled()
  })
})

describe('useWorkoutLog', () => {
  it('returns a single workout log', async () => {
    const log = buildWorkoutLog({ id: 'wl-1', title: 'Leg Day' })
    vi.mocked(mockAdapter.getWorkoutLog).mockResolvedValue(log)

    const { result } = renderHook(() => useWorkoutLog('wl-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.title).toBe('Leg Day')
    expect(mockAdapter.getWorkoutLog).toHaveBeenCalledWith('wl-1')
  })

  it('does not fetch when id is empty', async () => {
    const { result } = renderHook(() => useWorkoutLog(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useWorkoutLogsSummary', () => {
  it('returns workout log summaries', async () => {
    const summary = [
      {
        log: buildWorkoutLog(),
        exerciseNames: ['Squat', 'Bench'],
        setCount: 15,
        exerciseCount: 2,
      },
    ]
    vi.mocked(mockAdapter.getWorkoutLogsSummary).mockResolvedValue(summary)

    const { result } = renderHook(() => useWorkoutLogsSummary('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].exerciseNames).toEqual(['Squat', 'Bench'])
    expect(result.current.data![0].setCount).toBe(15)
  })
})

describe('useWorkoutLogFull', () => {
  it('returns full workout log with nested data', async () => {
    const full = {
      log: buildWorkoutLog({ id: 'wl-1' }),
      groups: [buildLoggedActivityGroup()],
      activities: [buildLoggedActivity()],
      sets: [buildLoggedSet()],
    }
    vi.mocked(mockAdapter.getWorkoutLogFull).mockResolvedValue(full)

    const { result } = renderHook(() => useWorkoutLogFull('wl-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.log.id).toBe('wl-1')
    expect(result.current.data?.groups).toHaveLength(1)
    expect(result.current.data?.activities).toHaveLength(1)
    expect(result.current.data?.sets).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe('useCreateWorkoutLog', () => {
  it('calls adapter.createWorkoutLog', async () => {
    const created = buildWorkoutLog({ id: 'wl-new' })
    vi.mocked(mockAdapter.createWorkoutLog).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateWorkoutLog(), { wrapper: TestWrapper })

    const log = await result.current.mutateAsync({
      userId: 'user-1',
      startedAt: '2026-01-15T10:00:00.000Z',
      totalPausedMs: 0,
    })

    expect(mockAdapter.createWorkoutLog).toHaveBeenCalled()
    expect(log.id).toBe('wl-new')
  })
})

describe('useUpdateWorkoutLog', () => {
  it('calls adapter.updateWorkoutLog', async () => {
    const updated = buildWorkoutLog({ id: 'wl-1', title: 'Updated' })
    vi.mocked(mockAdapter.updateWorkoutLog).mockResolvedValue(updated)

    const { result } = renderHook(() => useUpdateWorkoutLog(), { wrapper: TestWrapper })

    await result.current.mutateAsync(updated)

    expect(mockAdapter.updateWorkoutLog).toHaveBeenCalledWith(updated)
  })
})

describe('useDeleteWorkoutLog', () => {
  it('calls adapter.deleteWorkoutLog', async () => {
    vi.mocked(mockAdapter.deleteWorkoutLog).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteWorkoutLog(), { wrapper: TestWrapper })

    await result.current.mutateAsync('wl-1')

    expect(mockAdapter.deleteWorkoutLog).toHaveBeenCalledWith('wl-1')
  })
})

describe('useCreateLoggedActivityGroup', () => {
  it('calls adapter.createLoggedActivityGroup', async () => {
    const created = buildLoggedActivityGroup({ id: 'lag-new' })
    vi.mocked(mockAdapter.createLoggedActivityGroup).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateLoggedActivityGroup(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      group: { workoutLogId: 'wl-1', groupType: 'STRAIGHT_SETS', ordinal: 1 },
      userId: 'user-1',
    })

    expect(mockAdapter.createLoggedActivityGroup).toHaveBeenCalled()
  })
})

describe('useCreateLoggedActivity', () => {
  it('calls adapter.createLoggedActivity', async () => {
    const created = buildLoggedActivity({ id: 'la-new' })
    vi.mocked(mockAdapter.createLoggedActivity).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateLoggedActivity(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      activity: { loggedGroupId: 'lag-1', exerciseId: 'ex-1', ordinal: 1 },
      userId: 'user-1',
    })

    expect(mockAdapter.createLoggedActivity).toHaveBeenCalled()
  })
})

describe('useCreateLoggedSet', () => {
  it('calls adapter.createLoggedSet with userId', async () => {
    const created = buildLoggedSet({ id: 'ls-new' })
    vi.mocked(mockAdapter.createLoggedSet).mockResolvedValue(created)

    const { result } = renderHook(() => useCreateLoggedSet(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      loggedActivityId: 'la-1',
      setNumber: 1,
      setType: 'WORKING',
      completed: true,
      workoutLogId: 'wl-1',
      userId: 'user-1',
    })

    expect(mockAdapter.createLoggedSet).toHaveBeenCalled()
  })
})

describe('useUpdateLoggedSet', () => {
  it('calls adapter.updateLoggedSet', async () => {
    const updated = buildLoggedSet({ id: 'ls-1', completed: true, rpe: 9 })
    vi.mocked(mockAdapter.updateLoggedSet).mockResolvedValue(updated)

    const { result } = renderHook(() => useUpdateLoggedSet(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      ...updated,
      workoutLogId: 'wl-1',
      userId: 'user-1',
    })

    expect(mockAdapter.updateLoggedSet).toHaveBeenCalled()
  })
})

describe('useDeleteLoggedSet', () => {
  it('calls adapter.deleteLoggedSet', async () => {
    vi.mocked(mockAdapter.deleteLoggedSet).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteLoggedSet(), { wrapper: TestWrapper })
    await result.current.mutateAsync({ id: 'ls-1', workoutLogId: 'wl-1' })
    expect(mockAdapter.deleteLoggedSet).toHaveBeenCalledWith('ls-1')
  })
})

describe('useUpdateLoggedActivity', () => {
  it('calls adapter.updateLoggedActivity', async () => {
    const updated = buildLoggedActivity({ id: 'la-1' })
    vi.mocked(mockAdapter.updateLoggedActivity).mockResolvedValue(updated)
    const { result } = renderHook(() => useUpdateLoggedActivity(), { wrapper: TestWrapper })
    await result.current.mutateAsync({ activity: updated, userId: 'user-1', workoutLogId: 'wl-1' })
    expect(mockAdapter.updateLoggedActivity).toHaveBeenCalledWith(updated, 'user-1')
  })
})

describe('useDeleteLoggedActivity', () => {
  it('calls adapter.deleteLoggedActivity', async () => {
    vi.mocked(mockAdapter.deleteLoggedActivity).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteLoggedActivity(), { wrapper: TestWrapper })
    await result.current.mutateAsync({ id: 'la-1', workoutLogId: 'wl-1' })
    expect(mockAdapter.deleteLoggedActivity).toHaveBeenCalledWith('la-1')
  })
})

describe('useUpdateLoggedActivityGroup', () => {
  it('calls adapter.updateLoggedActivityGroup', async () => {
    const updated = buildLoggedActivityGroup({ id: 'lag-1' })
    vi.mocked(mockAdapter.updateLoggedActivityGroup).mockResolvedValue(updated)
    const { result } = renderHook(() => useUpdateLoggedActivityGroup(), { wrapper: TestWrapper })
    await result.current.mutateAsync({ group: updated, userId: 'user-1', workoutLogId: 'wl-1' })
    expect(mockAdapter.updateLoggedActivityGroup).toHaveBeenCalledWith(updated, 'user-1')
  })
})

describe('useDeleteLoggedActivityGroup', () => {
  it('calls adapter.deleteLoggedActivityGroup', async () => {
    vi.mocked(mockAdapter.deleteLoggedActivityGroup).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteLoggedActivityGroup(), { wrapper: TestWrapper })
    await result.current.mutateAsync({ id: 'lag-1', workoutLogId: 'wl-1' })
    expect(mockAdapter.deleteLoggedActivityGroup).toHaveBeenCalledWith('lag-1')
  })
})
