import type { ReactNode } from 'react'
import type { DisplayMode } from './types'

interface DisplayModeTransitionProps {
  mode: DisplayMode
  previousMode: DisplayMode | null
  children: ReactNode
}

function getTransitionClasses(mode: DisplayMode, previousMode: DisplayMode | null): string {
  // board <-> focused uses zoom + fade at 400ms
  if (
    (mode === 'focused' && previousMode === 'board') ||
    (mode === 'board' && previousMode === 'focused')
  ) {
    return 'animate-in zoom-in-95 fade-in-0 duration-[400ms]'
  }

  // idle <-> board uses fade at 300ms (default for all other transitions)
  return 'animate-in fade-in-0 duration-300'
}

export function DisplayModeTransition({
  mode,
  previousMode,
  children,
}: DisplayModeTransitionProps) {
  return (
    <div key={mode} className={getTransitionClasses(mode, previousMode)}>
      {children}
    </div>
  )
}
