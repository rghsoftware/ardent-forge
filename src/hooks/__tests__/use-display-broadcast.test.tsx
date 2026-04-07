// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { TestWrapper } from '@/test/render-helpers'

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockConfigureDisplayPublisher,
  mockInitDisplayPublisher,
  mockDestroyDisplayPublisher,
  mockSetHelloResponder,
  mockIsPublisherReady,
  mockGetSupabaseClient,
  mockUseUserProfile,
  mockUseExercises,
  mockUseActiveWorkoutStore,
  mockSetSnapshotContext,
} = vi.hoisted(() => {
  const mockConfigureDisplayPublisher = vi.fn()
  const mockInitDisplayPublisher = vi.fn()
  const mockDestroyDisplayPublisher = vi.fn()
  const mockSetHelloResponder = vi.fn()
  const mockIsPublisherReady = vi.fn().mockReturnValue(false)
  const mockGetSupabaseClient = vi.fn().mockReturnValue({})
  const mockUseUserProfile = vi
    .fn()
    .mockReturnValue({ data: { displayName: 'Test Athlete' }, error: null })
  const mockUseExercises = vi.fn().mockReturnValue({ data: [], error: null })
  const mockUseActiveWorkoutStore = vi.fn().mockReturnValue(null)
  const mockSetSnapshotContext = vi.fn()
  return {
    mockConfigureDisplayPublisher,
    mockInitDisplayPublisher,
    mockDestroyDisplayPublisher,
    mockSetHelloResponder,
    mockIsPublisherReady,
    mockGetSupabaseClient,
    mockUseUserProfile,
    mockUseExercises,
    mockUseActiveWorkoutStore,
    mockSetSnapshotContext,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}))

vi.mock('@/lib/display-publisher', () => ({
  initDisplayPublisher: mockInitDisplayPublisher,
  configureDisplayPublisher: mockConfigureDisplayPublisher,
  isPublisherReady: mockIsPublisherReady,
  publishFocusEvent: vi.fn(),
  publishUnfocusEvent: vi.fn(),
  destroyDisplayPublisher: mockDestroyDisplayPublisher,
  setHelloResponder: mockSetHelloResponder,
}))

vi.mock('@/stores/active-workout-store', () => ({
  setSnapshotContext: mockSetSnapshotContext,
  useActiveWorkoutStore: (selector: (s: unknown) => unknown) =>
    selector({ workoutLog: mockUseActiveWorkoutStore() }),
  republishCurrentState: vi.fn(),
}))

vi.mock('@/hooks/use-user-profile', () => ({
  useUserProfile: mockUseUserProfile,
}))

vi.mock('@/hooks/use-exercises', () => ({
  useExercises: mockUseExercises,
}))

// Import after mocks are registered
import { useDisplayBroadcast } from '../use-display-broadcast'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const USER_ID = 'user-123'
const GYM_A = '11111111-1111-4111-8111-111111111111'
const GYM_B = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSupabaseClient.mockReturnValue({})
  mockUseUserProfile.mockReturnValue({
    data: { displayName: 'Test Athlete' },
    error: null,
  })
  mockUseExercises.mockReturnValue({ data: [], error: null })
  mockUseActiveWorkoutStore.mockReturnValue(null)
})

describe('useDisplayBroadcast', () => {
  it('configures the publisher with the supplied gym ID', () => {
    renderHook(() => useDisplayBroadcast(USER_ID, GYM_A), { wrapper: TestWrapper })

    expect(mockConfigureDisplayPublisher).toHaveBeenCalledWith({
      gymId: GYM_A,
      intent: 'broadcasting',
    })
  })

  it('does NOT configure the publisher when gymId is null (P14-001/P14-002)', () => {
    // After F018 P14-001/P14-002, the hook intentionally does NOT call
    // configureDisplayPublisher when gymId is null. The start-workout
    // handler at index.tsx is responsible for setting Private intent before
    // navigating; on a tab refresh, the publisher stays 'unconfigured' so
    // silent drops trigger one-shot warnings.
    renderHook(() => useDisplayBroadcast(USER_ID, null), { wrapper: TestWrapper })

    expect(mockConfigureDisplayPublisher).not.toHaveBeenCalled()
  })

  it('re-configures the publisher when gymId changes between renders', () => {
    const { rerender } = renderHook(
      ({ gymId }: { gymId: string | null }) => useDisplayBroadcast(USER_ID, gymId),
      {
        wrapper: TestWrapper,
        initialProps: { gymId: GYM_A as string | null },
      },
    )

    expect(mockConfigureDisplayPublisher).toHaveBeenCalledWith({
      gymId: GYM_A,
      intent: 'broadcasting',
    })

    mockConfigureDisplayPublisher.mockClear()

    // Switch to a different gym
    rerender({ gymId: GYM_B })

    expect(mockConfigureDisplayPublisher).toHaveBeenCalledWith({
      gymId: GYM_B,
      intent: 'broadcasting',
    })
  })

  it('does not read displayVisible from the user profile', () => {
    // Guard against the cross-wave regression: the profile schema no longer
    // has `displayVisible`, so the hook must not reference it.
    mockUseUserProfile.mockReturnValue({
      data: { displayName: 'Test Athlete' },
      error: null,
    })

    renderHook(() => useDisplayBroadcast(USER_ID, GYM_A), { wrapper: TestWrapper })

    // configureDisplayPublisher is called with gymId + intent, never with displayVisible
    const callArgs = mockConfigureDisplayPublisher.mock.calls[0]?.[0]
    expect(callArgs).toEqual({ gymId: GYM_A, intent: 'broadcasting' })
    expect('displayVisible' in (callArgs ?? {})).toBe(false)
  })

  it('does not call configureDisplayPublisher when userId is empty', () => {
    renderHook(() => useDisplayBroadcast('', GYM_A), { wrapper: TestWrapper })

    // The hook guards on userId to avoid configuring for a logged-out user
    expect(mockConfigureDisplayPublisher).not.toHaveBeenCalled()
  })

  it('initializes the publisher when a Supabase client is available', () => {
    renderHook(() => useDisplayBroadcast(USER_ID, GYM_A), { wrapper: TestWrapper })

    expect(mockInitDisplayPublisher).toHaveBeenCalledTimes(1)
    expect(mockSetHelloResponder).toHaveBeenCalledTimes(1)
  })

  it('returns isBroadcasting = false when no workout is active', () => {
    mockUseActiveWorkoutStore.mockReturnValue(null)
    mockIsPublisherReady.mockReturnValue(true)

    const { result } = renderHook(() => useDisplayBroadcast(USER_ID, GYM_A), {
      wrapper: TestWrapper,
    })

    expect(result.current.isBroadcasting).toBe(false)
  })

  it('returns isBroadcasting = true when a workout is active and publisher is ready', () => {
    mockUseActiveWorkoutStore.mockReturnValue({ id: 'wl-1', userId: USER_ID })
    mockIsPublisherReady.mockReturnValue(true)

    const { result } = renderHook(() => useDisplayBroadcast(USER_ID, GYM_A), {
      wrapper: TestWrapper,
    })

    expect(result.current.isBroadcasting).toBe(true)
  })
})
