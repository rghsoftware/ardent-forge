import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// localStorage mock (node environment has no built-in localStorage)
// ---------------------------------------------------------------------------

const store = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() {
    return store.size
  },
  key: (_index: number) => null,
} satisfies Storage

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Import AFTER localStorage is available so the module can reference it
import { useOnboardingStore } from '../onboarding-store'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useOnboardingStore.getState()
}

function resetStore() {
  useOnboardingStore.setState({
    currentUserId: '',
    welcomeDismissed: false,
    hintsSeenKeys: [],
    visitedRoutes: [],
    firstWorkoutCompleted: false,
  })
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore()
  store.clear()
})

// ===========================================================================
// initialize
// ===========================================================================

describe('initialize', () => {
  it('creates default state for a new userId', () => {
    getState().initialize('user-1')

    expect(getState().currentUserId).toBe('user-1')
    expect(getState().welcomeDismissed).toBe(false)
    expect(getState().hintsSeenKeys).toEqual([])
    expect(getState().visitedRoutes).toEqual([])
    expect(getState().firstWorkoutCompleted).toBe(false)
  })

  it('loads existing state from localStorage', () => {
    const stored = {
      welcomeDismissed: true,
      hintsSeenKeys: ['hint-a'],
      visitedRoutes: ['/library'],
      firstWorkoutCompleted: true,
    }
    localStorage.setItem('onboarding-state-user-2', JSON.stringify(stored))

    getState().initialize('user-2')

    expect(getState().welcomeDismissed).toBe(true)
    expect(getState().hintsSeenKeys).toEqual(['hint-a'])
    expect(getState().visitedRoutes).toEqual(['/library'])
    expect(getState().firstWorkoutCompleted).toBe(true)
  })

  it('skips re-initialization for the same userId', () => {
    getState().initialize('user-1')
    getState().dismissWelcome()

    // Re-initialize with same userId should be a no-op
    getState().initialize('user-1')

    expect(getState().welcomeDismissed).toBe(true)
  })

  it('rejects empty userId', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getState().initialize('')

    expect(getState().currentUserId).toBe('')
    expect(warnSpy).toHaveBeenCalledWith(
      '[onboarding-store] initialize called with empty userId, ignoring',
    )

    warnSpy.mockRestore()
  })

  it('falls back to defaults on corrupted localStorage', () => {
    localStorage.setItem('onboarding-state-user-3', '{"welcomeDismissed": "not-a-boolean"}')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getState().initialize('user-3')

    expect(getState().welcomeDismissed).toBe(false)
    expect(getState().hintsSeenKeys).toEqual([])
    expect(getState().visitedRoutes).toEqual([])
    expect(getState().firstWorkoutCompleted).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      '[onboarding-store] Stored JSON failed shape validation, falling back to defaults',
    )

    warnSpy.mockRestore()
  })

  it('falls back to defaults on invalid JSON in localStorage', () => {
    localStorage.setItem('onboarding-state-user-4', '{not valid json')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getState().initialize('user-4')

    expect(getState().welcomeDismissed).toBe(false)
    expect(getState().currentUserId).toBe('user-4')
    expect(errorSpy).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})

// ===========================================================================
// dismissWelcome
// ===========================================================================

describe('dismissWelcome', () => {
  it('sets welcomeDismissed and persists to localStorage', () => {
    getState().initialize('user-1')
    getState().dismissWelcome()

    expect(getState().welcomeDismissed).toBe(true)

    const stored = JSON.parse(localStorage.getItem('onboarding-state-user-1')!)
    expect(stored.welcomeDismissed).toBe(true)
  })
})

// ===========================================================================
// markHintSeen
// ===========================================================================

describe('markHintSeen', () => {
  it('adds key to hintsSeenKeys and persists', () => {
    getState().initialize('user-1')
    getState().markHintSeen('tip-navigation')

    expect(getState().hintsSeenKeys).toEqual(['tip-navigation'])

    const stored = JSON.parse(localStorage.getItem('onboarding-state-user-1')!)
    expect(stored.hintsSeenKeys).toEqual(['tip-navigation'])
  })

  it('does not add duplicate keys', () => {
    getState().initialize('user-1')
    getState().markHintSeen('tip-navigation')
    getState().markHintSeen('tip-navigation')

    expect(getState().hintsSeenKeys).toEqual(['tip-navigation'])
  })

  it('accumulates multiple keys', () => {
    getState().initialize('user-1')
    getState().markHintSeen('tip-a')
    getState().markHintSeen('tip-b')

    expect(getState().hintsSeenKeys).toEqual(['tip-a', 'tip-b'])
  })
})

// ===========================================================================
// markRouteVisited
// ===========================================================================

describe('markRouteVisited', () => {
  it('adds route to visitedRoutes and persists', () => {
    getState().initialize('user-1')
    getState().markRouteVisited('/library')

    expect(getState().visitedRoutes).toEqual(['/library'])

    const stored = JSON.parse(localStorage.getItem('onboarding-state-user-1')!)
    expect(stored.visitedRoutes).toEqual(['/library'])
  })

  it('does not add duplicate routes', () => {
    getState().initialize('user-1')
    getState().markRouteVisited('/library')
    getState().markRouteVisited('/library')

    expect(getState().visitedRoutes).toEqual(['/library'])
  })
})

// ===========================================================================
// markFirstWorkoutCompleted
// ===========================================================================

describe('markFirstWorkoutCompleted', () => {
  it('sets firstWorkoutCompleted flag and persists', () => {
    getState().initialize('user-1')
    getState().markFirstWorkoutCompleted()

    expect(getState().firstWorkoutCompleted).toBe(true)

    const stored = JSON.parse(localStorage.getItem('onboarding-state-user-1')!)
    expect(stored.firstWorkoutCompleted).toBe(true)
  })
})

// ===========================================================================
// resetOnboarding
// ===========================================================================

describe('resetOnboarding', () => {
  it('clears all state back to defaults and persists', () => {
    getState().initialize('user-1')
    getState().dismissWelcome()
    getState().markHintSeen('tip-a')
    getState().markRouteVisited('/library')
    getState().markFirstWorkoutCompleted()

    getState().resetOnboarding()

    expect(getState().welcomeDismissed).toBe(false)
    expect(getState().hintsSeenKeys).toEqual([])
    expect(getState().visitedRoutes).toEqual([])
    expect(getState().firstWorkoutCompleted).toBe(false)

    const stored = JSON.parse(localStorage.getItem('onboarding-state-user-1')!)
    expect(stored.welcomeDismissed).toBe(false)
    expect(stored.hintsSeenKeys).toEqual([])
  })
})
