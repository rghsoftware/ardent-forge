import { useSyncStore } from '../sync-store'

beforeEach(() => {
  useSyncStore.setState({
    syncState: 'offline',
    errorMessage: null,
    lastSyncedAt: null,
  })
})

describe('useSyncStore', () => {
  it('setSyncState("synced") updates lastSyncedAt to recent ISO string', () => {
    const before = Date.now()
    useSyncStore.getState().setSyncState('synced')
    const { lastSyncedAt } = useSyncStore.getState()
    expect(lastSyncedAt).not.toBeNull()
    const ts = new Date(lastSyncedAt!).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
  })

  it('setSyncState("error") preserves existing lastSyncedAt', () => {
    useSyncStore.setState({ lastSyncedAt: '2024-01-01T00:00:00.000Z' })
    useSyncStore.getState().setSyncState('error', 'network failure')
    expect(useSyncStore.getState().lastSyncedAt).toBe('2024-01-01T00:00:00.000Z')
  })

  it('setSyncState("error") without message defaults to "Unknown sync error"', () => {
    useSyncStore.getState().setSyncState('error')
    expect(useSyncStore.getState().errorMessage).toBe('Unknown sync error')
  })

  it('setSyncState("synced") clears errorMessage', () => {
    useSyncStore.setState({ errorMessage: 'previous error' })
    useSyncStore.getState().setSyncState('synced')
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })

  it('setSyncState("error", msg) then setSyncState("synced") clears errorMessage', () => {
    useSyncStore.getState().setSyncState('error', 'oops')
    expect(useSyncStore.getState().errorMessage).toBe('oops')
    useSyncStore.getState().setSyncState('synced')
    expect(useSyncStore.getState().errorMessage).toBeNull()
  })
})
