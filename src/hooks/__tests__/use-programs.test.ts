// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import {
  buildProgram,
  buildBlock,
  buildBlockWeek,
  buildScheduledSession,
  buildProgramActivation,
  resetFactoryCounters,
} from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import {
  usePrograms,
  useProgramFull,
  useActiveProgram,
  useCreateProgram,
  useUpdateProgram,
  useDeleteProgram,
  useSetActiveProgram,
  useClearActiveProgram,
} from '../use-programs'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
})

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe('usePrograms', () => {
  it('returns programs for a user', async () => {
    const programs = [buildProgram({ name: 'Program A' }), buildProgram({ name: 'Program B' })]
    vi.mocked(mockAdapter.getPrograms).mockResolvedValue(programs)

    const { result } = renderHook(() => usePrograms('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Program A')
    expect(mockAdapter.getPrograms).toHaveBeenCalledWith('user-1')
  })

  it('does not fetch when userId is undefined', async () => {
    const { result } = renderHook(() => usePrograms(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getPrograms).not.toHaveBeenCalled()
  })
})

describe('useProgramFull', () => {
  it('returns full program with blocks, weeks, and sessions', async () => {
    const full = {
      program: buildProgram({ id: 'prog-1' }),
      blocks: [buildBlock()],
      blockWeeks: [buildBlockWeek()],
      scheduledSessions: [buildScheduledSession()],
    }
    vi.mocked(mockAdapter.getProgramFull).mockResolvedValue(full)

    const { result } = renderHook(() => useProgramFull('prog-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.program.id).toBe('prog-1')
    expect(result.current.data?.blocks).toHaveLength(1)
    expect(result.current.data?.blockWeeks).toHaveLength(1)
    expect(result.current.data?.scheduledSessions).toHaveLength(1)
  })

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useProgramFull(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getProgramFull).not.toHaveBeenCalled()
  })
})

describe('useActiveProgram', () => {
  it('returns active program activation', async () => {
    const activation = buildProgramActivation({ programId: 'prog-1' })
    vi.mocked(mockAdapter.getActiveProgram).mockResolvedValue(activation)

    const { result } = renderHook(() => useActiveProgram('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.programId).toBe('prog-1')
    expect(mockAdapter.getActiveProgram).toHaveBeenCalledWith('user-1')
  })

  it('returns null when no active program', async () => {
    vi.mocked(mockAdapter.getActiveProgram).mockResolvedValue(null)

    const { result } = renderHook(() => useActiveProgram('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('does not fetch when userId is undefined', async () => {
    const { result } = renderHook(() => useActiveProgram(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe('useCreateProgram', () => {
  it('calls adapter.createProgramFull', async () => {
    const full = {
      program: buildProgram({ id: 'prog-new' }),
      blocks: [buildBlock()],
      blockWeeks: [buildBlockWeek()],
      scheduledSessions: [buildScheduledSession()],
    }
    vi.mocked(mockAdapter.createProgramFull).mockResolvedValue(full)

    const { result } = renderHook(() => useCreateProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      program: {
        userId: 'user-1',
        name: 'New Program',
        source: 'CUSTOM',
        isPublic: false,
        createdBy: 'user-1',
      },
      blocks: [
        {
          block: {
            name: 'Block 1',
            ordinal: 1,
            durationWeeks: 4,
            blockType: 'ACCUMULATION',
          },
          weeks: [
            {
              week: { weekNumber: 1 },
              sessions: [
                {
                  dayLabel: 'Day 1',
                  sessionType: 'STRENGTH',
                  sessionTemplateId: 'st-1',
                },
              ],
            },
          ],
        },
      ],
    })

    expect(mockAdapter.createProgramFull).toHaveBeenCalled()
  })
})

describe('useUpdateProgram', () => {
  it('calls adapter.updateProgramFull', async () => {
    const full = {
      program: buildProgram({ id: 'prog-1' }),
      blocks: [],
      blockWeeks: [],
      scheduledSessions: [],
    }
    vi.mocked(mockAdapter.updateProgramFull).mockResolvedValue(full)

    const { result } = renderHook(() => useUpdateProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      program: buildProgram({ id: 'prog-1' }),
      blocks: [],
    })

    expect(mockAdapter.updateProgramFull).toHaveBeenCalled()
  })
})

describe('useDeleteProgram', () => {
  it('calls adapter.deleteProgram', async () => {
    vi.mocked(mockAdapter.deleteProgram).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync('prog-1')

    expect(mockAdapter.deleteProgram).toHaveBeenCalledWith('prog-1')
  })
})

describe('useSetActiveProgram', () => {
  it('calls adapter.setActiveProgram with userId, programId, and startDate', async () => {
    const activation = buildProgramActivation()
    vi.mocked(mockAdapter.setActiveProgram).mockResolvedValue(activation)

    const { result } = renderHook(() => useSetActiveProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      userId: 'user-1',
      programId: 'prog-1',
      startDate: '2026-01-15',
    })

    expect(mockAdapter.setActiveProgram).toHaveBeenCalledWith('user-1', 'prog-1', '2026-01-15')
  })
})

describe('useClearActiveProgram', () => {
  it('calls adapter.clearActiveProgram', async () => {
    vi.mocked(mockAdapter.clearActiveProgram).mockResolvedValue(undefined)

    const { result } = renderHook(() => useClearActiveProgram(), { wrapper: TestWrapper })

    await result.current.mutateAsync('user-1')

    expect(mockAdapter.clearActiveProgram).toHaveBeenCalledWith('user-1')
  })
})
