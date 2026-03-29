// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import { buildUserProfile, buildOneRepMaxHistory, resetFactoryCounters } from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import {
  useUserProfile,
  useUpdateUserProfile,
  useSaveOneRepMax,
  useOneRepMaxHistory,
} from '../use-user-profile'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
})

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe('useUserProfile', () => {
  it('returns user profile', async () => {
    const profile = buildUserProfile({
      id: 'user-1',
      displayName: 'Coach Hamilton',
      preferredUnits: 'IMPERIAL',
    })
    vi.mocked(mockAdapter.getUserProfile).mockResolvedValue(profile)

    const { result } = renderHook(() => useUserProfile('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.displayName).toBe('Coach Hamilton')
    expect(result.current.data?.preferredUnits).toBe('IMPERIAL')
    expect(mockAdapter.getUserProfile).toHaveBeenCalledWith('user-1')
  })

  it('returns null when profile not found', async () => {
    vi.mocked(mockAdapter.getUserProfile).mockResolvedValue(null)

    const { result } = renderHook(() => useUserProfile('user-999'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('does not fetch when userId is empty', async () => {
    const { result } = renderHook(() => useUserProfile(''), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getUserProfile).not.toHaveBeenCalled()
  })
})

describe('useOneRepMaxHistory', () => {
  it('returns 1RM history for user and exercise', async () => {
    const history = [
      buildOneRepMaxHistory({ weight: { value: 315, unit: 'lb' } }),
      buildOneRepMaxHistory({ weight: { value: 325, unit: 'lb' } }),
    ]
    vi.mocked(mockAdapter.getOneRepMaxHistory).mockResolvedValue(history)

    const { result } = renderHook(() => useOneRepMaxHistory('user-1', 'ex-1'), {
      wrapper: TestWrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(mockAdapter.getOneRepMaxHistory).toHaveBeenCalledWith('user-1', 'ex-1')
  })

  it('does not fetch when userId is undefined', async () => {
    const { result } = renderHook(() => useOneRepMaxHistory(undefined, 'ex-1'), {
      wrapper: TestWrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getOneRepMaxHistory).not.toHaveBeenCalled()
  })

  it('does not fetch when exerciseId is undefined', async () => {
    const { result } = renderHook(() => useOneRepMaxHistory('user-1', undefined), {
      wrapper: TestWrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getOneRepMaxHistory).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe('useUpdateUserProfile', () => {
  it('calls adapter.updateUserProfile', async () => {
    const updated = buildUserProfile({ id: 'user-1', displayName: 'Updated Name' })
    vi.mocked(mockAdapter.updateUserProfile).mockResolvedValue(updated)

    const { result } = renderHook(() => useUpdateUserProfile(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      id: 'user-1',
      displayName: 'Updated Name',
    })

    expect(mockAdapter.updateUserProfile).toHaveBeenCalledWith({
      id: 'user-1',
      displayName: 'Updated Name',
    })
  })
})

describe('useSaveOneRepMax', () => {
  it('calls adapter.saveOneRepMax', async () => {
    const saved = buildOneRepMaxHistory()
    vi.mocked(mockAdapter.saveOneRepMax).mockResolvedValue(saved)

    const { result } = renderHook(() => useSaveOneRepMax(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      userId: 'user-1',
      exerciseId: 'ex-1',
      weight: { value: 405, unit: 'lb' },
      estimated: false,
      recordedAt: '2026-01-15T10:00:00.000Z',
    })

    expect(mockAdapter.saveOneRepMax).toHaveBeenCalled()
  })
})
