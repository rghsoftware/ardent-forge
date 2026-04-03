import { create } from 'zustand'

function storageKey(userId: string): string {
  return `ardent-forge:blocked-users:${userId}`
}

function loadBlockedIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.warn('[blocked-users] Expected array in localStorage, got:', typeof parsed)
      return new Set()
    }
    return new Set(parsed.filter((v): v is string => typeof v === 'string'))
  } catch (err) {
    console.error('[blocked-users] Failed to load blocked user IDs:', err)
    return new Set()
  }
}

function persistBlockedIds(userId: string, ids: Set<string>): void {
  localStorage.setItem(storageKey(userId), JSON.stringify([...ids]))
}

interface BlockedUsersStore {
  blockedIds: Set<string>
  currentUserId: string
  initialize: (userId: string) => void
  blockUser: (id: string) => void
  unblockUser: (id: string) => void
  isBlocked: (id: string) => boolean
}

export const useBlockedUsersStore = create<BlockedUsersStore>((set, get) => ({
  blockedIds: new Set<string>(),
  currentUserId: '',

  initialize: (userId: string) => {
    const { currentUserId } = get()
    if (currentUserId === userId) return
    set({
      currentUserId: userId,
      blockedIds: loadBlockedIds(userId),
    })
  },

  blockUser: (id: string) => {
    const { blockedIds, currentUserId } = get()
    const next = new Set(blockedIds)
    next.add(id)
    persistBlockedIds(currentUserId, next)
    set({ blockedIds: next })
  },

  unblockUser: (id: string) => {
    const { blockedIds, currentUserId } = get()
    const next = new Set(blockedIds)
    next.delete(id)
    persistBlockedIds(currentUserId, next)
    set({ blockedIds: next })
  },

  isBlocked: (id: string) => get().blockedIds.has(id),
}))
