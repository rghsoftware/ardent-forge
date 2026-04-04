import { create } from 'zustand'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// Connection status for the Supabase Broadcast channel
// ---------------------------------------------------------------------------

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

// ---------------------------------------------------------------------------
// Display mode -- derived from session state
// ---------------------------------------------------------------------------

export type DisplayMode = 'idle' | 'focused' | 'board'

// ---------------------------------------------------------------------------
// DisplayState
// ---------------------------------------------------------------------------

interface DisplayState {
  sessions: Map<string, DisplaySnapshot>
  lastSeenAt: Map<string, number>
  focusedUserId: string | null
  connectionStatus: ConnectionStatus
  currentPage: number
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface DisplayActions {
  upsertSession(userId: string, snapshot: DisplaySnapshot): void
  removeSession(userId: string): void
  setFocusedUser(userId: string | null): void
  setConnectionStatus(status: ConnectionStatus): void
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
  lastSeenAt: new Map(),
  focusedUserId: null,
  connectionStatus: 'disconnected',
  currentPage: 0,
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
      const nextSessions = new Map(state.sessions)
      nextSessions.set(userId, snapshot)

      const nextLastSeen = new Map(state.lastSeenAt)
      nextLastSeen.set(userId, Date.now())

      return { sessions: nextSessions, lastSeenAt: nextLastSeen }
    })
  },

  removeSession(userId: string) {
    set((state) => {
      const nextSessions = new Map(state.sessions)
      nextSessions.delete(userId)

      const nextLastSeen = new Map(state.lastSeenAt)
      nextLastSeen.delete(userId)

      return {
        sessions: nextSessions,
        lastSeenAt: nextLastSeen,
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

  setConnectionStatus(status: ConnectionStatus) {
    set({ connectionStatus: status })
  },

  setCurrentPage(page: number) {
    set({ currentPage: page })
  },

  // --------------------------------------------------------------------
  // Bulk operations
  // --------------------------------------------------------------------

  clearAllSessions() {
    set({
      sessions: new Map(),
      lastSeenAt: new Map(),
      focusedUserId: null,
    })
  },

  pruneStale(maxAgeMs: number) {
    const state = get()
    const now = Date.now()
    const nextSessions = new Map(state.sessions)
    const nextLastSeen = new Map(state.lastSeenAt)
    let focusedCleared = false

    for (const [userId, seenAt] of state.lastSeenAt) {
      if (now - seenAt > maxAgeMs) {
        nextSessions.delete(userId)
        nextLastSeen.delete(userId)
        if (state.focusedUserId === userId) focusedCleared = true
      }
    }

    set({
      sessions: nextSessions,
      lastSeenAt: nextLastSeen,
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
  const all = Array.from(state.sessions.values())
  const start = state.currentPage * SESSIONS_PER_PAGE
  return all.slice(start, start + SESSIONS_PER_PAGE)
}

export const getTotalPages = (state: DisplayState): number => {
  if (state.sessions.size === 0) return 0
  return Math.ceil(state.sessions.size / SESSIONS_PER_PAGE)
}
