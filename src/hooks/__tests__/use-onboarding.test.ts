// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { OnboardingHintKey, OnboardingRoute } from '@/domain/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = { id: 'user-123' }
let authUser: { id: string } | null = mockUser

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authUser }),
}))

const mockInitialize = vi.fn()
const mockDismissWelcome = vi.fn()
const mockMarkHintSeen = vi.fn()
const mockMarkRouteVisited = vi.fn()
const mockMarkFirstWorkoutCompleted = vi.fn()
const mockResetOnboarding = vi.fn()

let storeState = {
  welcomeDismissed: false,
  hintsSeenKeys: [] as OnboardingHintKey[],
  visitedRoutes: [] as OnboardingRoute[],
}

vi.mock('@/stores/onboarding-store', () => ({
  useOnboardingStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      initialize: mockInitialize,
      welcomeDismissed: storeState.welcomeDismissed,
      hintsSeenKeys: storeState.hintsSeenKeys,
      visitedRoutes: storeState.visitedRoutes,
      dismissWelcome: mockDismissWelcome,
      markHintSeen: mockMarkHintSeen,
      markRouteVisited: mockMarkRouteVisited,
      markFirstWorkoutCompleted: mockMarkFirstWorkoutCompleted,
      resetOnboarding: mockResetOnboarding,
    }
    return selector(state)
  },
}))

import { useOnboarding } from '../use-onboarding'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  authUser = mockUser
  storeState = {
    welcomeDismissed: false,
    hintsSeenKeys: [],
    visitedRoutes: [],
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOnboarding', () => {
  // ---- Initialize behavior ------------------------------------------------

  describe('initialize', () => {
    it('calls initialize with user ID when userId is available', () => {
      renderHook(() => useOnboarding())

      expect(mockInitialize).toHaveBeenCalledWith('user-123')
      expect(mockInitialize).toHaveBeenCalledTimes(1)
    })

    it('does not call initialize when user is null', () => {
      authUser = null

      renderHook(() => useOnboarding())

      expect(mockInitialize).not.toHaveBeenCalled()
    })

    it('does not re-initialize when re-rendered with the same user', () => {
      const { rerender } = renderHook(() => useOnboarding())

      expect(mockInitialize).toHaveBeenCalledTimes(1)

      rerender()
      rerender()

      expect(mockInitialize).toHaveBeenCalledTimes(1)
    })
  })

  // ---- isFirstRun ---------------------------------------------------------

  describe('isFirstRun', () => {
    it('returns true when welcomeDismissed is false', () => {
      storeState.welcomeDismissed = false

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isFirstRun).toBe(true)
    })

    it('returns false when welcomeDismissed is true', () => {
      storeState.welcomeDismissed = true

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isFirstRun).toBe(false)
    })
  })

  // ---- shouldShowHint -----------------------------------------------------

  describe('shouldShowHint', () => {
    it('returns true for a hint that has not been seen', () => {
      storeState.hintsSeenKeys = []

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.shouldShowHint('library-intro')).toBe(true)
    })

    it('returns false for a hint that has been seen', () => {
      storeState.hintsSeenKeys = ['library-intro', 'vault-intro']

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.shouldShowHint('library-intro')).toBe(false)
      expect(result.current.shouldShowHint('vault-intro')).toBe(false)
    })

    it('correctly distinguishes seen from unseen hints', () => {
      storeState.hintsSeenKeys = ['library-intro']

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.shouldShowHint('library-intro')).toBe(false)
      expect(result.current.shouldShowHint('vault-intro')).toBe(true)
      expect(result.current.shouldShowHint('builder-intro')).toBe(true)
    })
  })

  // ---- hasVisited ---------------------------------------------------------

  describe('hasVisited', () => {
    it('returns false for a route that has not been visited', () => {
      storeState.visitedRoutes = []

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.hasVisited('/library')).toBe(false)
    })

    it('returns true for a route that has been visited', () => {
      storeState.visitedRoutes = ['/library', '/vault']

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.hasVisited('/library')).toBe(true)
      expect(result.current.hasVisited('/vault')).toBe(true)
    })

    it('correctly distinguishes visited from unvisited routes', () => {
      storeState.visitedRoutes = ['/library']

      const { result } = renderHook(() => useOnboarding())

      expect(result.current.hasVisited('/library')).toBe(true)
      expect(result.current.hasVisited('/vault')).toBe(false)
      expect(result.current.hasVisited('/builder')).toBe(false)
    })
  })

  // ---- No auth (user is null) ---------------------------------------------

  describe('when user is null', () => {
    beforeEach(() => {
      authUser = null
    })

    it('does not call initialize', () => {
      renderHook(() => useOnboarding())

      expect(mockInitialize).not.toHaveBeenCalled()
    })

    it('still returns derived state and action functions', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.isFirstRun).toBe(true)
      expect(typeof result.current.shouldShowHint).toBe('function')
      expect(typeof result.current.hasVisited).toBe('function')
      expect(typeof result.current.dismissWelcome).toBe('function')
      expect(typeof result.current.markHintSeen).toBe('function')
      expect(typeof result.current.markRouteVisited).toBe('function')
      expect(typeof result.current.markFirstWorkoutCompleted).toBe('function')
      expect(typeof result.current.resetOnboarding).toBe('function')
    })
  })

  // ---- Passthrough actions ------------------------------------------------

  describe('passthrough actions', () => {
    it('exposes dismissWelcome from the store', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.dismissWelcome).toBe(mockDismissWelcome)
    })

    it('exposes markHintSeen from the store', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.markHintSeen).toBe(mockMarkHintSeen)
    })

    it('exposes markRouteVisited from the store', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.markRouteVisited).toBe(mockMarkRouteVisited)
    })

    it('exposes markFirstWorkoutCompleted from the store', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.markFirstWorkoutCompleted).toBe(mockMarkFirstWorkoutCompleted)
    })

    it('exposes resetOnboarding from the store', () => {
      const { result } = renderHook(() => useOnboarding())

      expect(result.current.resetOnboarding).toBe(mockResetOnboarding)
    })
  })
})
