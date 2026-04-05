import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function storageKey(userId: string): string {
  return `onboarding-state-${userId}`
}

interface OnboardingState {
  welcomeDismissed: boolean
  hintsSeenKeys: string[]
  visitedRoutes: string[]
  firstWorkoutCompleted: boolean
}

const DEFAULTS: OnboardingState = {
  welcomeDismissed: false,
  hintsSeenKeys: [],
  visitedRoutes: [],
  firstWorkoutCompleted: false,
}

function isValidState(value: unknown): value is OnboardingState {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.welcomeDismissed === 'boolean' &&
    Array.isArray(obj.hintsSeenKeys) &&
    obj.hintsSeenKeys.every((k: unknown) => typeof k === 'string') &&
    Array.isArray(obj.visitedRoutes) &&
    obj.visitedRoutes.every((r: unknown) => typeof r === 'string') &&
    typeof obj.firstWorkoutCompleted === 'boolean'
  )
}

function loadState(userId: string): OnboardingState {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!isValidState(parsed)) {
      console.warn(
        '[onboarding-store] Stored JSON failed shape validation, falling back to defaults',
      )
      return { ...DEFAULTS }
    }
    return parsed
  } catch (err) {
    console.error('[onboarding-store] Failed to load onboarding state:', err)
    return { ...DEFAULTS }
  }
}

function persistState(userId: string, state: OnboardingState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch (err) {
    console.error('[onboarding-store] Failed to persist onboarding state:', err)
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface OnboardingStore extends OnboardingState {
  currentUserId: string
  initialize: (userId: string) => void
  dismissWelcome: () => void
  markHintSeen: (key: string) => void
  markRouteVisited: (route: string) => void
  markFirstWorkoutCompleted: () => void
  resetOnboarding: () => void
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  ...DEFAULTS,
  currentUserId: '',

  initialize: (userId: string) => {
    if (!userId) {
      console.warn('[onboarding-store] initialize called with empty userId, ignoring')
      return
    }
    const { currentUserId } = get()
    if (currentUserId === userId) return
    const state = loadState(userId)
    set({
      currentUserId: userId,
      ...state,
    })
  },

  dismissWelcome: () => {
    const { currentUserId, hintsSeenKeys, visitedRoutes, firstWorkoutCompleted } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] dismissWelcome called before initialize')
      return
    }
    const next: OnboardingState = {
      welcomeDismissed: true,
      hintsSeenKeys,
      visitedRoutes,
      firstWorkoutCompleted,
    }
    persistState(currentUserId, next)
    set({ welcomeDismissed: true })
  },

  markHintSeen: (key: string) => {
    const { currentUserId, welcomeDismissed, hintsSeenKeys, visitedRoutes, firstWorkoutCompleted } =
      get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markHintSeen called before initialize')
      return
    }
    if (hintsSeenKeys.includes(key)) return
    const nextKeys = [...hintsSeenKeys, key]
    const next: OnboardingState = {
      welcomeDismissed,
      hintsSeenKeys: nextKeys,
      visitedRoutes,
      firstWorkoutCompleted,
    }
    persistState(currentUserId, next)
    set({ hintsSeenKeys: nextKeys })
  },

  markRouteVisited: (route: string) => {
    const { currentUserId, welcomeDismissed, hintsSeenKeys, visitedRoutes, firstWorkoutCompleted } =
      get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markRouteVisited called before initialize')
      return
    }
    if (visitedRoutes.includes(route)) return
    const nextRoutes = [...visitedRoutes, route]
    const next: OnboardingState = {
      welcomeDismissed,
      hintsSeenKeys,
      visitedRoutes: nextRoutes,
      firstWorkoutCompleted,
    }
    persistState(currentUserId, next)
    set({ visitedRoutes: nextRoutes })
  },

  markFirstWorkoutCompleted: () => {
    const { currentUserId, welcomeDismissed, hintsSeenKeys, visitedRoutes } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markFirstWorkoutCompleted called before initialize')
      return
    }
    const next: OnboardingState = {
      welcomeDismissed,
      hintsSeenKeys,
      visitedRoutes,
      firstWorkoutCompleted: true,
    }
    persistState(currentUserId, next)
    set({ firstWorkoutCompleted: true })
  },

  resetOnboarding: () => {
    const { currentUserId } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] resetOnboarding called before initialize')
      return
    }
    persistState(currentUserId, { ...DEFAULTS })
    set({ ...DEFAULTS })
  },
}))
