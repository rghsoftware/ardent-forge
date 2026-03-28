import { mapRustStateToUi } from '../sync-bridge'
import type { SyncStateChanged } from '../sync-bridge'

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
})
