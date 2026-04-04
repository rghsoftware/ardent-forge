import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { useCallback, useState } from 'react'
import { IdleView } from '@/components/display/idle-view'
import { DisplayModeTransition } from '@/components/display/display-mode-transition'
import { useDisplayMode } from '@/components/display/use-display-mode'
import { useIdleSnapshot } from '@/components/display/use-idle-snapshot'
import type { DisplaySnapshot } from '@/domain/types'

export const Route = createFileRoute('/display')({
  validateSearch: z.object({
    clock: z.enum(['12h', '24h']).optional().default('24h'),
  }),
  component: DisplayPage,
})

function DisplayPage() {
  const { clock } = Route.useSearch()

  const [sessionMap] = useState(() => new Map<string, DisplaySnapshot>())
  const [focusedUserId] = useState<string | null>(null)

  // Starts as 'reconnecting' until a channel confirms SUBSCRIBED
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting'>(
    'reconnecting',
  )
  const handleConnectionStatus = useCallback(
    (status: 'connected' | 'reconnecting') => setConnectionStatus(status),
    [],
  )

  const idleSnapshot = useIdleSnapshot(handleConnectionStatus)

  const { mode, previousMode } = useDisplayMode(sessionMap, focusedUserId, idleSnapshot)

  return (
    <div className="bg-[#131313] min-h-screen">
      <DisplayModeTransition mode={mode} previousMode={previousMode}>
        {mode === 'idle' && (
          <IdleView
            idleSnapshot={idleSnapshot}
            clockFormat={clock}
            connectionStatus={connectionStatus}
          />
        )}
        {mode === 'board' && (
          <div className="flex h-dvh items-center justify-center">
            <span className="font-display text-2xl text-foreground">Board View (Step 28)</span>
          </div>
        )}
        {mode === 'focused' && (
          <div className="flex h-dvh items-center justify-center">
            <span className="font-display text-2xl text-foreground">Focused View (Step 28)</span>
          </div>
        )}
      </DisplayModeTransition>
    </div>
  )
}
