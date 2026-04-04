import { describe, it, expect, beforeEach } from 'vitest'
import { useDisplayStore, getDisplayMode, getPageSessions, getTotalPages } from '../display-store'
import type { DisplaySnapshot } from '@/domain/types/display-snapshot'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSnapshot = (userId: string): DisplaySnapshot => ({
  user_id: userId,
  display_name: `User ${userId}`,
  session_name: 'Test Session',
  workout_started_at: new Date().toISOString(),
  current_exercise: 'Bench Press',
  exercise_index: 0,
  total_exercises: 3,
  sets: [],
  rest_timer: { state: 'idle' },
  session_type: 'STRENGTH',
  is_visible: true,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getState() {
  return useDisplayStore.getState()
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  useDisplayStore.setState({
    sessions: new Map(),
    lastSeenAt: new Map(),
    focusedUserId: null,
    connectionStatus: 'disconnected',
    currentPage: 0,
  })
})

// ===========================================================================
// Initial state
// ===========================================================================

describe('initial state', () => {
  it('has empty sessions, null focus, disconnected status, and page 0', () => {
    const state = getState()
    expect(state.sessions.size).toBe(0)
    expect(state.focusedUserId).toBeNull()
    expect(state.connectionStatus).toBe('disconnected')
    expect(state.currentPage).toBe(0)
  })
})

// ===========================================================================
// upsertSession
// ===========================================================================

describe('upsertSession', () => {
  it('adds a new session', () => {
    const snap = mockSnapshot('u1')
    getState().upsertSession('u1', snap)

    expect(getState().sessions.size).toBe(1)
    expect(getState().sessions.get('u1')).toEqual(snap)
  })

  it('updates an existing session', () => {
    const snap1 = mockSnapshot('u1')
    getState().upsertSession('u1', snap1)

    const snap2 = mockSnapshot('u1')
    snap2.current_exercise = 'Squat'
    getState().upsertSession('u1', snap2)

    expect(getState().sessions.size).toBe(1)
    expect(getState().sessions.get('u1')!.current_exercise).toBe('Squat')
  })
})

// ===========================================================================
// removeSession
// ===========================================================================

describe('removeSession', () => {
  it('deletes a session', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().removeSession('u1')

    expect(getState().sessions.size).toBe(0)
  })

  it('clears focus if the focused user is removed', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().setFocusedUser('u1')

    getState().removeSession('u1')

    expect(getState().focusedUserId).toBeNull()
  })

  it('does NOT clear focus if a different user is removed', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().upsertSession('u2', mockSnapshot('u2'))
    getState().setFocusedUser('u1')

    getState().removeSession('u2')

    expect(getState().focusedUserId).toBe('u1')
  })
})

// ===========================================================================
// setFocusedUser
// ===========================================================================

describe('setFocusedUser', () => {
  it('sets focus', () => {
    getState().setFocusedUser('u1')
    expect(getState().focusedUserId).toBe('u1')
  })

  it('clears focus', () => {
    getState().setFocusedUser('u1')
    getState().setFocusedUser(null)
    expect(getState().focusedUserId).toBeNull()
  })
})

// ===========================================================================
// setConnectionStatus
// ===========================================================================

describe('setConnectionStatus', () => {
  it('updates connection status', () => {
    getState().setConnectionStatus('connected')
    expect(getState().connectionStatus).toBe('connected')

    getState().setConnectionStatus('reconnecting')
    expect(getState().connectionStatus).toBe('reconnecting')
  })
})

// ===========================================================================
// setCurrentPage
// ===========================================================================

describe('setCurrentPage', () => {
  it('updates page number', () => {
    getState().setCurrentPage(3)
    expect(getState().currentPage).toBe(3)
  })
})

// ===========================================================================
// clearAllSessions
// ===========================================================================

describe('clearAllSessions', () => {
  it('resets sessions and focus', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().setFocusedUser('u1')

    getState().clearAllSessions()

    expect(getState().sessions.size).toBe(0)
    expect(getState().focusedUserId).toBeNull()
  })
})

// ===========================================================================
// pruneStale
// ===========================================================================

describe('pruneStale', () => {
  it('removes sessions older than threshold', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))

    // Manually set lastSeenAt to a stale timestamp
    const staleTime = Date.now() - 60_000
    useDisplayStore.setState({
      lastSeenAt: new Map([['u1', staleTime]]),
    })

    getState().pruneStale(30_000) // 30s threshold

    expect(getState().sessions.size).toBe(0)
  })

  it('keeps recent sessions', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    // lastSeenAt was set by upsertSession to Date.now(), so it is recent

    getState().pruneStale(30_000)

    expect(getState().sessions.size).toBe(1)
  })

  it('clears focus if stale user was focused', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().setFocusedUser('u1')

    const staleTime = Date.now() - 60_000
    useDisplayStore.setState({
      lastSeenAt: new Map([['u1', staleTime]]),
    })

    getState().pruneStale(30_000)

    expect(getState().focusedUserId).toBeNull()
  })
})

// ===========================================================================
// getDisplayMode (selector)
// ===========================================================================

describe('getDisplayMode', () => {
  it('returns idle when sessions are empty', () => {
    expect(getDisplayMode(getState())).toBe('idle')
  })

  it('returns board when sessions exist but no focus', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    expect(getDisplayMode(getState())).toBe('board')
  })

  it('returns focused when focusedUserId is set and exists in sessions', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().setFocusedUser('u1')
    expect(getDisplayMode(getState())).toBe('focused')
  })

  it('returns board when focusedUserId is set but not in sessions', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    getState().setFocusedUser('u-nonexistent')
    expect(getDisplayMode(getState())).toBe('board')
  })
})

// ===========================================================================
// getPageSessions (selector)
// ===========================================================================

describe('getPageSessions', () => {
  it('returns correct slice for page 0', () => {
    for (let i = 1; i <= 6; i++) {
      getState().upsertSession(`u${i}`, mockSnapshot(`u${i}`))
    }

    const page0 = getPageSessions(getState())
    expect(page0).toHaveLength(4)
    expect(page0[0].user_id).toBe('u1')
    expect(page0[3].user_id).toBe('u4')
  })

  it('returns correct slice for page 1', () => {
    for (let i = 1; i <= 6; i++) {
      getState().upsertSession(`u${i}`, mockSnapshot(`u${i}`))
    }
    getState().setCurrentPage(1)

    const page1 = getPageSessions(getState())
    expect(page1).toHaveLength(2)
    expect(page1[0].user_id).toBe('u5')
    expect(page1[1].user_id).toBe('u6')
  })

  it('returns empty array when no sessions', () => {
    expect(getPageSessions(getState())).toEqual([])
  })
})

// ===========================================================================
// getTotalPages (selector)
// ===========================================================================

describe('getTotalPages', () => {
  it('returns 0 when empty', () => {
    expect(getTotalPages(getState())).toBe(0)
  })

  it('returns 1 for 1-4 sessions', () => {
    for (let i = 1; i <= 4; i++) {
      getState().upsertSession(`u${i}`, mockSnapshot(`u${i}`))
    }
    expect(getTotalPages(getState())).toBe(1)
  })

  it('returns 2 for 5-8 sessions', () => {
    for (let i = 1; i <= 8; i++) {
      getState().upsertSession(`u${i}`, mockSnapshot(`u${i}`))
    }
    expect(getTotalPages(getState())).toBe(2)
  })

  it('returns correct page count for 1 session', () => {
    getState().upsertSession('u1', mockSnapshot('u1'))
    expect(getTotalPages(getState())).toBe(1)
  })
})
