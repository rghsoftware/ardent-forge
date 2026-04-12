// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'
import {
  buildSessionTemplate,
  buildActivityGroup,
  buildActivity,
  buildFixedSetsScheme,
  resetFactoryCounters,
} from '@/test/factories'
import { createMockAdapter } from '@/test/mocks/data-adapter'
import type { DataAdapter } from '@/lib/data-adapter'

let mockAdapter: DataAdapter

vi.mock('@/lib/adapter', () => ({
  getAdapter: () => mockAdapter,
}))

import {
  useSessionTemplates,
  useSessionTemplate,
  useSessionTemplateFull,
  useCreateSessionTemplate,
  useUpdateSessionTemplate,
  useDeleteSessionTemplate,
  useCloneSessionTemplate,
} from '../use-session-templates'

beforeEach(() => {
  resetFactoryCounters()
  mockAdapter = createMockAdapter()
})

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

describe('useSessionTemplates', () => {
  it('returns session templates for a user', async () => {
    const templates = [
      buildSessionTemplate({ name: 'Upper Body' }),
      buildSessionTemplate({ name: 'Lower Body' }),
    ]
    vi.mocked(mockAdapter.getSessionTemplates).mockResolvedValue(templates)

    const { result } = renderHook(() => useSessionTemplates('user-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Upper Body')
    expect(mockAdapter.getSessionTemplates).toHaveBeenCalledWith('user-1', undefined)
  })

  it('does not fetch when userId is undefined', async () => {
    const { result } = renderHook(() => useSessionTemplates(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getSessionTemplates).not.toHaveBeenCalled()
  })
})

describe('useSessionTemplate', () => {
  it('returns a single session template', async () => {
    const template = buildSessionTemplate({ id: 'st-1', name: 'Heavy Day' })
    vi.mocked(mockAdapter.getSessionTemplate).mockResolvedValue(template)

    const { result } = renderHook(() => useSessionTemplate('st-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.name).toBe('Heavy Day')
    expect(mockAdapter.getSessionTemplate).toHaveBeenCalledWith('st-1')
  })

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useSessionTemplate(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getSessionTemplate).not.toHaveBeenCalled()
  })
})

describe('useSessionTemplateFull', () => {
  it('returns full session template with groups and activities', async () => {
    const group = buildActivityGroup()
    const { activities: _, ...groupFlat } = group
    const activity = buildActivity()
    const full = {
      template: buildSessionTemplate({ id: 'st-1' }),
      groups: [groupFlat],
      activities: [activity],
      eventItems: [],
    }
    vi.mocked(mockAdapter.getSessionTemplateFull).mockResolvedValue(full)

    const { result } = renderHook(() => useSessionTemplateFull('st-1'), { wrapper: TestWrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.template.id).toBe('st-1')
    expect(result.current.data?.groups).toHaveLength(1)
    expect(result.current.data?.activities).toHaveLength(1)
  })

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useSessionTemplateFull(undefined), { wrapper: TestWrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockAdapter.getSessionTemplateFull).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

describe('useCreateSessionTemplate', () => {
  it('calls adapter.createSessionTemplateFull', async () => {
    const group = buildActivityGroup()
    const { activities: _, ...groupFlat } = group
    const activity = buildActivity()
    const full = {
      template: buildSessionTemplate({ id: 'st-new' }),
      groups: [groupFlat],
      activities: [activity],
      eventItems: [],
    }
    vi.mocked(mockAdapter.createSessionTemplateFull).mockResolvedValue(full)

    const { result } = renderHook(() => useCreateSessionTemplate(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      template: {
        userId: 'user-1',
        name: 'New Template',
        category: 'STRENGTH',
        scoring: 'NONE',
        isPublic: false,
      },
      groups: [
        {
          group: {
            sessionTemplateId: 'st-new',
            groupType: 'STRAIGHT_SETS',
            ordinal: 1,
          },
          activities: [
            {
              exerciseId: 'ex-1',
              ordinal: 1,
              setScheme: buildFixedSetsScheme(),
            },
          ],
        },
      ],
    })

    expect(mockAdapter.createSessionTemplateFull).toHaveBeenCalled()
  })
})

describe('useUpdateSessionTemplate', () => {
  it('calls adapter.updateSessionTemplateFull', async () => {
    const group = buildActivityGroup()
    const { activities: _, ...groupFlat } = group
    const full = {
      template: buildSessionTemplate({ id: 'st-1' }),
      groups: [groupFlat],
      activities: [],
      eventItems: [],
    }
    vi.mocked(mockAdapter.updateSessionTemplateFull).mockResolvedValue(full)

    const { result } = renderHook(() => useUpdateSessionTemplate(), { wrapper: TestWrapper })

    await result.current.mutateAsync({
      template: buildSessionTemplate({ id: 'st-1', name: 'Updated' }),
      groups: [
        {
          group: {
            id: 'ag-1',
            sessionTemplateId: 'st-1',
            groupType: 'STRAIGHT_SETS',
            ordinal: 1,
          },
          activities: [],
        },
      ],
    })

    expect(mockAdapter.updateSessionTemplateFull).toHaveBeenCalled()
  })
})

describe('useDeleteSessionTemplate', () => {
  it('calls adapter.deleteSessionTemplate', async () => {
    vi.mocked(mockAdapter.deleteSessionTemplate).mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeleteSessionTemplate(), { wrapper: TestWrapper })

    await result.current.mutateAsync('st-1')

    expect(mockAdapter.deleteSessionTemplate).toHaveBeenCalledWith('st-1')
  })
})

describe('useCloneSessionTemplate', () => {
  it('calls adapter.cloneSessionTemplate and invalidates queries', async () => {
    const group = buildActivityGroup()
    const { activities: _, ...groupFlat } = group
    const activity = buildActivity()
    const full = {
      template: buildSessionTemplate({ id: 'st-cloned', name: 'Original (Copy)' }),
      groups: [groupFlat],
      activities: [activity],
      eventItems: [],
    }
    vi.mocked(mockAdapter.cloneSessionTemplate).mockResolvedValue(full)

    const { result } = renderHook(() => useCloneSessionTemplate(), { wrapper: TestWrapper })

    await result.current.mutateAsync({ id: 'st-1', userId: 'user-1' })

    expect(mockAdapter.cloneSessionTemplate).toHaveBeenCalledWith('st-1', 'user-1')
  })
})
