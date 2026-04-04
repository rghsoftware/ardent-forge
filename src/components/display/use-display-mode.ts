import { useRef, useMemo } from 'react'
import type { DisplaySnapshot, IdleSnapshot } from '@/domain/types'

type DisplayMode = 'idle' | 'board' | 'focused'

interface UseDisplayModeResult {
  mode: DisplayMode
  previousMode: DisplayMode | null
  focusedSnapshot: DisplaySnapshot | null
}

export function useDisplayMode(
  sessionMap: Map<string, DisplaySnapshot>,
  focusedUserId: string | null,
  idleSnapshot: IdleSnapshot | null,
): UseDisplayModeResult {
  const previousModeRef = useRef<DisplayMode | null>(null)
  const currentModeRef = useRef<DisplayMode>('idle')

  const result = useMemo(() => {
    let mode: DisplayMode
    let focusedSnapshot: DisplaySnapshot | null = null

    if (sessionMap.size === 0) {
      mode = 'idle'
    } else if (focusedUserId && sessionMap.has(focusedUserId)) {
      mode = 'focused'
      focusedSnapshot = sessionMap.get(focusedUserId)!
    } else {
      mode = 'board'
    }

    if (currentModeRef.current !== mode) {
      previousModeRef.current = currentModeRef.current
      currentModeRef.current = mode
    }

    return {
      mode,
      previousMode: previousModeRef.current,
      focusedSnapshot,
    }
  }, [sessionMap, focusedUserId, idleSnapshot])

  return result
}
