import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'

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

export function useBlockedUsers() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => loadBlockedIds(currentUserId))

  const blockUser = useCallback(
    (id: string) => {
      setBlockedIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        persistBlockedIds(currentUserId, next)
        return next
      })
    },
    [currentUserId],
  )

  const unblockUser = useCallback(
    (id: string) => {
      setBlockedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        persistBlockedIds(currentUserId, next)
        return next
      })
    },
    [currentUserId],
  )

  const isBlocked = useCallback((id: string) => blockedIds.has(id), [blockedIds])

  return { blockedIds, blockUser, unblockUser, isBlocked }
}
