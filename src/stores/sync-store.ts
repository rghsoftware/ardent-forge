import { create } from 'zustand'

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error'

interface SyncStore {
  syncState: SyncStatus
  errorMessage: string | null
  lastSyncedAt: string | null
  setSyncState: (state: SyncStatus, errorMessage?: string | null) => void
  setLastSyncedAt: (at: string) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncState: 'offline',
  errorMessage: null,
  lastSyncedAt: null,
  setSyncState: (syncState, errorMessage = null) => {
    set({ syncState, errorMessage })
    if (syncState === 'synced') {
      set({ lastSyncedAt: new Date().toISOString() })
    }
  },
  setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
}))
