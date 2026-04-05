import { useState } from 'react'
import type { DisplaySnapshot, IdleSnapshot } from '@/domain/types'
import type { DisplayMode } from './types'

interface UseDisplayModeResult {
  mode: DisplayMode
  previousMode: DisplayMode | null
  focusedSnapshot: DisplaySnapshot | null
}

function deriveMode(
  sessionMap: Map<string, DisplaySnapshot>,
  focusedUserId: string | null,
): { mode: DisplayMode; focusedSnapshot: DisplaySnapshot | null } {
  if (sessionMap.size === 0) {
    return { mode: 'idle', focusedSnapshot: null }
  }
  if (focusedUserId && sessionMap.has(focusedUserId)) {
    return { mode: 'focused', focusedSnapshot: sessionMap.get(focusedUserId) ?? null }
  }
  return { mode: 'board', focusedSnapshot: null }
}

// _idleSnapshot reserved: future steps may colocate idle broadcast with live session logic
export function useDisplayMode(
  sessionMap: Map<string, DisplaySnapshot>,
  focusedUserId: string | null,
  _idleSnapshot: IdleSnapshot | null,
): UseDisplayModeResult {
  const { mode, focusedSnapshot } = deriveMode(sessionMap, focusedUserId)

  // React "storing info from previous renders" pattern:
  // calling setState conditionally during render triggers an immediate re-render
  // with updated state before paint, avoiding stale refs or cascading effects.
  const [previousMode, setPreviousMode] = useState<DisplayMode | null>(null)
  const [trackedMode, setTrackedMode] = useState<DisplayMode>(mode)

  if (trackedMode !== mode) {
    setPreviousMode(trackedMode)
    setTrackedMode(mode)
  }

  return { mode, previousMode, focusedSnapshot }
}
