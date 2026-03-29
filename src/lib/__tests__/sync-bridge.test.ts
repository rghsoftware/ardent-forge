import { vi, beforeEach } from 'vitest'
import { mapRustStateToUi } from '../sync-bridge'
import type { SyncStateChanged, SyncStateType } from '../sync-bridge'

// ===========================================================================
// mapRustStateToUi
// ===========================================================================

describe('mapRustStateToUi', () => {
  it('maps Pushing to syncing', () => {
    const input: SyncStateChanged = { type: 'Pushing' }
    expect(mapRustStateToUi(input)).toBe('syncing')
  })

  it('maps Pulling to syncing', () => {
    const input: SyncStateChanged = { type: 'Pulling' }
    expect(mapRustStateToUi(input)).toBe('syncing')
  })

  it('maps Idle to synced', () => {
    const input: SyncStateChanged = { type: 'Idle' }
    expect(mapRustStateToUi(input)).toBe('synced')
  })

  it('maps Error to error', () => {
    const input: SyncStateChanged = { type: 'Error', message: 'boom' }
    expect(mapRustStateToUi(input)).toBe('error')
  })

  it('maps Offline to offline', () => {
    const input: SyncStateChanged = { type: 'Offline' }
    expect(mapRustStateToUi(input)).toBe('offline')
  })

  it('maps Error with empty message to error', () => {
    const input: SyncStateChanged = { type: 'Error', message: '' }
    expect(mapRustStateToUi(input)).toBe('error')
  })

  it('maps Error with long message to error', () => {
    const input: SyncStateChanged = {
      type: 'Error',
      message: 'Connection timeout after 30s: ECONNREFUSED 127.0.0.1:5432',
    }
    expect(mapRustStateToUi(input)).toBe('error')
  })

  it('returns consistent type for all valid Rust states', () => {
    const validUiStates: SyncStateType[] = ['syncing', 'synced', 'error', 'offline']

    const allInputs: SyncStateChanged[] = [
      { type: 'Pushing' },
      { type: 'Pulling' },
      { type: 'Idle' },
      { type: 'Error', message: 'test' },
      { type: 'Offline' },
    ]

    for (const input of allInputs) {
      const result = mapRustStateToUi(input)
      expect(validUiStates).toContain(result)
    }
  })

  it('maps both sync directions (Pushing/Pulling) to the same UI state', () => {
    expect(mapRustStateToUi({ type: 'Pushing' })).toBe(mapRustStateToUi({ type: 'Pulling' }))
  })
})

// ===========================================================================
// Tauri-gated functions (initSync, stopSync, forcePush, forcePull, etc.)
// ===========================================================================

// Mock all Tauri modules before importing the functions
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Re-import after mocks
const syncBridge = await import('../sync-bridge')
const { isTauri, invoke } = await import('@tauri-apps/api/core')
const { listen } = await import('@tauri-apps/api/event')

describe('initSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await syncBridge.initSync('token', 'url', 'key')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('invokes sync_set_auth when in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await syncBridge.initSync('tok', 'http://supa.co', 'anon-key')
    expect(invoke).toHaveBeenCalledWith('sync_set_auth', {
      accessToken: 'tok',
      supabaseUrl: 'http://supa.co',
      supabaseKey: 'anon-key',
    })
  })
})

describe('stopSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await syncBridge.stopSync()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('invokes sync_clear_auth when in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await syncBridge.stopSync()
    expect(invoke).toHaveBeenCalledWith('sync_clear_auth')
  })
})

describe('forcePush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await syncBridge.forcePush()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('invokes sync_force_push when in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await syncBridge.forcePush()
    expect(invoke).toHaveBeenCalledWith('sync_force_push')
  })
})

describe('forcePull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await syncBridge.forcePull()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('invokes sync_force_pull when in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    await syncBridge.forcePull()
    expect(invoke).toHaveBeenCalledWith('sync_force_pull')
  })
})

describe('getSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const result = await syncBridge.getSyncStatus()
    expect(result).toBeNull()
  })

  it('returns parsed SyncStateChanged when in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({ type: 'Idle' }))
    const result = await syncBridge.getSyncStatus()
    expect(result).toEqual({ type: 'Idle' })
  })

  it('returns Error state with message from Tauri', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({ type: 'Error', message: 'db locked' }))
    const result = await syncBridge.getSyncStatus()
    expect(result).toEqual({ type: 'Error', message: 'db locked' })
  })
})

describe('onSyncStateChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a no-op unlisten function when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const unlisten = await syncBridge.onSyncStateChanged(vi.fn())
    expect(typeof unlisten).toBe('function')
    // Should not throw
    unlisten()
    expect(listen).not.toHaveBeenCalled()
  })

  it('subscribes to sync:state_changed event in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const unlistenFn = vi.fn()
    vi.mocked(listen).mockResolvedValue(unlistenFn)
    const cb = vi.fn()

    const unlisten = await syncBridge.onSyncStateChanged(cb)
    expect(listen).toHaveBeenCalledWith('sync:state_changed', expect.any(Function))
    expect(unlisten).toBe(unlistenFn)
  })
})

describe('onDataChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a no-op unlisten function when not in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const unlisten = await syncBridge.onDataChanged(vi.fn())
    expect(typeof unlisten).toBe('function')
    unlisten()
    expect(listen).not.toHaveBeenCalled()
  })

  it('subscribes to sync:data_changed event in Tauri mode', async () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const unlistenFn = vi.fn()
    vi.mocked(listen).mockResolvedValue(unlistenFn)
    const cb = vi.fn()

    const unlisten = await syncBridge.onDataChanged(cb)
    expect(listen).toHaveBeenCalledWith('sync:data_changed', expect.any(Function))
    expect(unlisten).toBe(unlistenFn)
  })
})
