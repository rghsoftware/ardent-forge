import { create } from 'zustand'
import type { SyncStateType } from '@/lib/sync-bridge'

interface SyncStore {
  syncState: SyncStateType
  errorMessage: string | null
  lastSyncedAt: string | null
  setSyncState: (state: SyncStateType, errorMessage?: string | null) => void
  setLastSyncedAt: (at: string) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncState: 'offline',
  errorMessage: null,
  lastSyncedAt: null,
  setSyncState: (syncState, errorMessage = null) => {
    set({
      syncState,
      errorMessage: syncState === 'error' ? (errorMessage ?? 'Unknown sync error') : null,
    })
    if (syncState === 'synced') {
      set({ lastSyncedAt: new Date().toISOString() })
    }
  },
  setLastSyncedAt: (at) => set({ lastSyncedAt: at }),
}))
