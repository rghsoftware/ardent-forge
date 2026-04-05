import { create } from 'zustand'

interface PendingConnectState {
  pending: { url: string; key: string } | null
  setPending: (url: string, key: string) => void
  clear: () => void
}

export const usePendingConnect = create<PendingConnectState>((set) => ({
  pending: null,
  setPending: (url, key) => {
    if (!url.startsWith('https://') || !key) return
    set({ pending: { url, key } })
  },
  clear: () => set({ pending: null }),
}))
