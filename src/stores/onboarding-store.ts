/**
 * Onboarding state store -- tracks first-run welcome, contextual hint dismissals,
 * visited routes (for nav discovery dots), and first-workout completion.
 *
 * Persisted to localStorage with a per-user key (`onboarding-state-${userId}`).
 * See ADR-010 for the localStorage-over-persist-middleware rationale.
 */
import { create } from 'zustand'
import type { OnboardingHintKey, OnboardingRoute } from '@/domain/types'

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function storageKey(userId: string): string {
  return `onboarding-state-${userId}`
}

interface OnboardingState {
  welcomeDismissed: boolean
  hintsSeenKeys: OnboardingHintKey[]
  visitedRoutes: OnboardingRoute[]
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
  markHintSeen: (key: OnboardingHintKey) => void
  markRouteVisited: (route: OnboardingRoute) => void
  markFirstWorkoutCompleted: () => void
  resetOnboarding: () => void
}

function snapshotState(get: () => OnboardingStore): OnboardingState {
  const { welcomeDismissed, hintsSeenKeys, visitedRoutes, firstWorkoutCompleted } = get()
  return { welcomeDismissed, hintsSeenKeys, visitedRoutes, firstWorkoutCompleted }
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
    const { currentUserId } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] dismissWelcome called before initialize')
      return
    }
    const next = { ...snapshotState(get), welcomeDismissed: true }
    persistState(currentUserId, next)
    set({ welcomeDismissed: true })
  },

  markHintSeen: (key: OnboardingHintKey) => {
    const { currentUserId, hintsSeenKeys } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markHintSeen called before initialize')
      return
    }
    if (hintsSeenKeys.includes(key)) return
    const nextKeys = [...hintsSeenKeys, key]
    const next = { ...snapshotState(get), hintsSeenKeys: nextKeys }
    persistState(currentUserId, next)
    set({ hintsSeenKeys: nextKeys })
  },

  markRouteVisited: (route: OnboardingRoute) => {
    const { currentUserId, visitedRoutes } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markRouteVisited called before initialize')
      return
    }
    if (visitedRoutes.includes(route)) return
    const nextRoutes = [...visitedRoutes, route]
    const next = { ...snapshotState(get), visitedRoutes: nextRoutes }
    persistState(currentUserId, next)
    set({ visitedRoutes: nextRoutes })
  },

  markFirstWorkoutCompleted: () => {
    const { currentUserId } = get()
    if (!currentUserId) {
      console.warn('[onboarding-store] markFirstWorkoutCompleted called before initialize')
      return
    }
    const next = { ...snapshotState(get), firstWorkoutCompleted: true }
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
