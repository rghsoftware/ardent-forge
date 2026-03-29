import { vi, beforeEach } from 'vitest'
import { useSyncStore } from '../sync-store'
import { mapRustStateToUi } from '@/lib/sync-bridge'
import type { SyncStateChanged, SyncStateType } from '@/lib/sync-bridge'

beforeEach(() => {
  useSyncStore.setState({
    syncState: 'offline',
    errorMessage: null,
    lastSyncedAt: null,
  })
})

// ===========================================================================
// Initial state
// ===========================================================================

describe('initial state', () => {
  it('starts with syncState "offline"', () => {
    expect(useSyncStore.getState().syncState).toBe('offline')
  })

  it('starts with errorMessage null', () => {
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })

  it('starts with lastSyncedAt null', () => {
    expect(useSyncStore.getState().lastSyncedAt).toBeNull()
  })
})

// ===========================================================================
// setSyncState transitions
// ===========================================================================

describe('setSyncState', () => {
  it('transitions to syncing', () => {
    useSyncStore.getState().setSyncState('syncing')
    expect(useSyncStore.getState().syncState).toBe('syncing')
  })

  it('transitions to synced and updates lastSyncedAt to recent ISO string', () => {
    const before = Date.now()
    useSyncStore.getState().setSyncState('synced')
    const { syncState, lastSyncedAt } = useSyncStore.getState()
    expect(syncState).toBe('synced')
    expect(lastSyncedAt).not.toBeNull()
    const ts = new Date(lastSyncedAt!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
  })

  it('transitions to error with a custom message', () => {
    useSyncStore.getState().setSyncState('error', 'network failure')
    const { syncState, errorMessage } = useSyncStore.getState()
    expect(syncState).toBe('error')
    expect(errorMessage).toBe('network failure')
  })

  it('transitions to error without message defaults to "Unknown sync error"', () => {
    useSyncStore.getState().setSyncState('error')
    expect(useSyncStore.getState().errorMessage).toBe('Unknown sync error')
  })

  it('transitions to offline', () => {
    useSyncStore.getState().setSyncState('synced')
    useSyncStore.getState().setSyncState('offline')
    expect(useSyncStore.getState().syncState).toBe('offline')
  })

  it('clears errorMessage when transitioning from error to synced', () => {
    useSyncStore.getState().setSyncState('error', 'oops')
    expect(useSyncStore.getState().errorMessage).toBe('oops')
    useSyncStore.getState().setSyncState('synced')
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })

  it('clears errorMessage when transitioning from error to syncing', () => {
    useSyncStore.getState().setSyncState('error', 'failed')
    useSyncStore.getState().setSyncState('syncing')
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })

  it('clears errorMessage when transitioning from error to offline', () => {
    useSyncStore.getState().setSyncState('error', 'timeout')
    useSyncStore.getState().setSyncState('offline')
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })

  it('preserves lastSyncedAt when transitioning to error', () => {
    useSyncStore.setState({ lastSyncedAt: '2024-01-01T00:00:00.000Z' })
    useSyncStore.getState().setSyncState('error', 'network failure')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('preserves lastSyncedAt when transitioning to syncing', () => {
    useSyncStore.setState({ lastSyncedAt: '2024-06-15T12:00:00.000Z' })
    useSyncStore.getState().setSyncState('syncing')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2024-06-15T12:00:00.000Z')
  })

  it('preserves lastSyncedAt when transitioning to offline', () => {
    useSyncStore.setState({ lastSyncedAt: '2024-06-15T12:00:00.000Z' })
    useSyncStore.getState().setSyncState('offline')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2024-06-15T12:00:00.000Z')
  })

  it('updates lastSyncedAt on successive synced transitions', () => {
    useSyncStore.getState().setSyncState('synced')
    const first = useSyncStore.getState().lastSyncedAt

    // Small delay to ensure different timestamp
    vi.useFakeTimers()
    vi.advanceTimersByTime(1000)
    useSyncStore.getState().setSyncState('syncing')
    useSyncStore.getState().setSyncState('synced')
    const second = useSyncStore.getState().lastSyncedAt

    expect(second).not.toBeNull()
    expect(second).not.toBe(first)
    vi.useRealTimers()
  })
})

// ===========================================================================
// setLastSyncedAt
// ===========================================================================

describe('setLastSyncedAt', () => {
  it('sets lastSyncedAt to the provided value', () => {
    useSyncStore.getState().setLastSyncedAt('2025-03-28T10:00:00.000Z')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2025-03-28T10:00:00.000Z')
  })

  it('overwrites a previous lastSyncedAt', () => {
    useSyncStore.getState().setLastSyncedAt('2024-01-01T00:00:00.000Z')
    useSyncStore.getState().setLastSyncedAt('2025-12-31T23:59:59.000Z')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2025-12-31T23:59:59.000Z')
  })
})

// ===========================================================================
// Selectors (getState access)
// ===========================================================================

describe('selectors', () => {
  it('exposes all expected keys on the store', () => {
    const state = useSyncStore.getState()
    expect(state).toHaveProperty('syncState')
    expect(state).toHaveProperty('errorMessage')
    expect(state).toHaveProperty('lastSyncedAt')
    expect(state).toHaveProperty('setSyncState')
    expect(state).toHaveProperty('setLastSyncedAt')
  })

  it('setSyncState and setLastSyncedAt are functions', () => {
    const state = useSyncStore.getState()
    expect(typeof state.setSyncState).toBe('function')
    expect(typeof state.setLastSyncedAt).toBe('function')
  })
})

// ===========================================================================
// Integration: sync-bridge mapRustStateToUi -> sync-store setSyncState
// ===========================================================================

describe('sync-bridge + sync-store integration', () => {
  const rustStatesAndExpected: Array<[SyncStateChanged, SyncStateType]> = [
    [{ type: 'Pushing' }, 'syncing'],
    [{ type: 'Pulling' }, 'syncing'],
    [{ type: 'Idle' }, 'synced'],
    [{ type: 'Error', message: 'test error' }, 'error'],
    [{ type: 'Offline' }, 'offline'],
  ]

  it.each(rustStatesAndExpected)(
    'mapRustStateToUi(%o) -> setSyncState produces correct store state',
    (rustState, expectedUiState) => {
      const uiState = mapRustStateToUi(rustState)
      const errorMsg = rustState.type === 'Error' ? rustState.message : undefined
      useSyncStore.getState().setSyncState(uiState, errorMsg)

      expect(useSyncStore.getState().syncState).toBe(expectedUiState)

      if (expectedUiState === 'error') {
        expect(useSyncStore.getState().errorMessage).toBe('test error')
      } else {
        expect(useSyncStore.getState().errorMessage).toBeNull()
      }
    },
  )

  it('full lifecycle: offline -> syncing -> synced -> syncing -> error -> synced', () => {
    const lifecycle: SyncStateChanged[] = [
      { type: 'Offline' },
      { type: 'Pushing' },
      { type: 'Idle' },
      { type: 'Pulling' },
      { type: 'Error', message: 'temporary glitch' },
      { type: 'Idle' },
    ]

    for (const rustState of lifecycle) {
      const uiState = mapRustStateToUi(rustState)
      const errorMsg = rustState.type === 'Error' ? rustState.message : undefined
      useSyncStore.getState().setSyncState(uiState, errorMsg)
    }

    // After full lifecycle: should be synced with no error
    expect(useSyncStore.getState().syncState).toBe('synced')
    expect(useSyncStore.getState().errorMessage).toBeNull()
    expect(useSyncStore.getState().lastSyncedAt).not.toBeNull()
  })
})
