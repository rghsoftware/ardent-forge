import { create } from 'zustand'
import type {
  DisplaySnapshot,
  DisplayConnectionStatus,
  IdleSnapshot,
} from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// Display mode -- derived from session state
// ---------------------------------------------------------------------------

export type DisplayMode = 'idle' | 'focused' | 'board'

// ---------------------------------------------------------------------------
// Session entry -- snapshot + staleness timestamp in a single record
// ---------------------------------------------------------------------------

interface SessionEntry {
  snapshot: DisplaySnapshot
  lastSeenAt: number
}

// ---------------------------------------------------------------------------
// DisplayState
// ---------------------------------------------------------------------------

interface DisplayState {
  sessions: Map<string, SessionEntry>
  focusedUserId: string | null
  connectionStatus: DisplayConnectionStatus
  currentPage: number
  idleSnapshot: IdleSnapshot | null
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface DisplayActions {
  upsertSession(userId: string, snapshot: DisplaySnapshot): void
  removeSession(userId: string): void
  setFocusedUser(userId: string | null): void
  setConnectionStatus(status: DisplayConnectionStatus): void
  setIdleSnapshot(snapshot: IdleSnapshot): void
  setCurrentPage(page: number): void
  clearAllSessions(): void
  pruneStale(maxAgeMs: number): void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSIONS_PER_PAGE = 4

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: DisplayState = {
  sessions: new Map(),
  focusedUserId: null,
  connectionStatus: 'disconnected',
  currentPage: 0,
  idleSnapshot: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDisplayStore = create<DisplayState & DisplayActions>()((set, get) => ({
  ...initialState,

  // --------------------------------------------------------------------
  // Session management
  // --------------------------------------------------------------------

  upsertSession(userId: string, snapshot: DisplaySnapshot) {
    set((state) => {
      const next = new Map(state.sessions)
      next.set(userId, { snapshot, lastSeenAt: Date.now() })
      return { sessions: next }
    })
  },

  removeSession(userId: string) {
    set((state) => {
      const next = new Map(state.sessions)
      next.delete(userId)
      return {
        sessions: next,
        focusedUserId: state.focusedUserId === userId ? null : state.focusedUserId,
      }
    })
  },

  // --------------------------------------------------------------------
  // Focus and connection
  // --------------------------------------------------------------------

  setFocusedUser(userId: string | null) {
    set({ focusedUserId: userId })
  },

  setConnectionStatus(status: DisplayConnectionStatus) {
    set({ connectionStatus: status })
  },

  setIdleSnapshot(snapshot: IdleSnapshot) {
    set({ idleSnapshot: snapshot })
  },

  setCurrentPage(page: number) {
    const totalPages = getTotalPages(get())
    const clamped = totalPages === 0 ? 0 : Math.max(0, Math.min(page, totalPages - 1))
    set({ currentPage: clamped })
  },

  // --------------------------------------------------------------------
  // Bulk operations
  // --------------------------------------------------------------------

  clearAllSessions() {
    set({
      sessions: new Map(),
      focusedUserId: null,
      currentPage: 0,
    })
  },

  pruneStale(maxAgeMs: number) {
    const state = get()
    const now = Date.now()

    const staleIds = Array.from(state.sessions.entries())
      .filter(([, entry]) => now - entry.lastSeenAt > maxAgeMs)
      .map(([userId]) => userId)

    if (staleIds.length === 0) return

    const next = new Map(state.sessions)
    let focusedCleared = false

    for (const userId of staleIds) {
      next.delete(userId)
      if (state.focusedUserId === userId) focusedCleared = true
    }

    set({
      sessions: next,
      focusedUserId: focusedCleared ? null : state.focusedUserId,
    })
  },
}))

// ---------------------------------------------------------------------------
// Selectors (derived computed values, not stored in state)
// ---------------------------------------------------------------------------

export const getDisplayMode = (state: DisplayState): DisplayMode => {
  if (state.sessions.size === 0) return 'idle'
  if (state.focusedUserId !== null && state.sessions.has(state.focusedUserId)) return 'focused'
  return 'board'
}

export const getPageSessions = (state: DisplayState): DisplaySnapshot[] => {
  const all = Array.from(state.sessions.values()).map((e) => e.snapshot)
  const start = state.currentPage * SESSIONS_PER_PAGE
  return all.slice(start, start + SESSIONS_PER_PAGE)
}

export const getTotalPages = (state: DisplayState): number => {
  if (state.sessions.size === 0) return 0
  return Math.ceil(state.sessions.size / SESSIONS_PER_PAGE)
}

// ---------------------------------------------------------------------------
// Convenience accessor for getting a snapshot by user ID
// ---------------------------------------------------------------------------

export const getSnapshot = (state: DisplayState, userId: string): DisplaySnapshot | undefined =>
  state.sessions.get(userId)?.snapshot

export const getSessionCount = (state: DisplayState): number => state.sessions.size
