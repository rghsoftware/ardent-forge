import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ardent-forge:blocked-users'

function loadBlockedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed))
      return new Set(parsed.filter((v): v is string => typeof v === 'string'))
    return new Set()
  } catch {
    return new Set()
  }
}

function persistBlockedIds(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export function useBlockedUsers() {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(loadBlockedIds)

  const blockUser = useCallback((id: string) => {
    setBlockedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      persistBlockedIds(next)
      return next
    })
  }, [])

  const unblockUser = useCallback((id: string) => {
    setBlockedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      persistBlockedIds(next)
      return next
    })
  }, [])

  const isBlocked = useCallback((id: string) => blockedIds.has(id), [blockedIds])

  return { blockedIds, blockUser, unblockUser, isBlocked }
}
