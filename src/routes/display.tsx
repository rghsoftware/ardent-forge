import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { resolveConfig } from '@/lib/config-store'
import {
  initDisplaySubscriber,
  subscribeToDisplay,
  destroyDisplaySubscriber,
  type DisplayEventHandlers,
} from '@/lib/display-subscriber'
import { useDisplayStore, getDisplayMode } from '@/stores/display-store'
import { IdlePlaceholder } from '@/components/display/idle-placeholder'
import { BoardView } from '@/components/display/board-view'
import { ConnectionFooter } from '@/components/display/connection-footer'
import { FocusedView } from '@/components/display/focused-view'

export const Route = createFileRoute('/display')({
  component: DisplayPage,
})

// ---------------------------------------------------------------------------
// DisplayPage -- full-viewport wrapper with portrait detection
// ---------------------------------------------------------------------------

function DisplayPage() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-surface-anvil">
      {/* Portrait orientation overlay */}
      <div className="fixed inset-0 z-50 hidden items-center justify-center bg-surface-anvil portrait:flex">
        <div className="text-center">
          <span className="material-symbols-outlined text-[4rem] text-warm-ash">
            screen_rotation
          </span>
          <p className="mt-4 font-display text-2xl tracking-wider text-bone-white">
            ROTATE TO LANDSCAPE
          </p>
        </div>
      </div>

      {/* Landscape content */}
      <DisplayShell />
    </div>
  )
}

// ---------------------------------------------------------------------------
// DisplayShell -- lifecycle management and mode-based rendering
// ---------------------------------------------------------------------------

function DisplayShell() {
  const [configMissing, setConfigMissing] = useState(false)
  const clientRef = useRef<SupabaseClient | null>(null)
  const pruneRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const config = await resolveConfig()

      if (cancelled) return

      if (!config) {
        setConfigMissing(true)
        return
      }

      // Create a dedicated Supabase client for the display channel
      const client = createClient(config.supabaseUrl, config.supabaseKey)
      clientRef.current = client

      initDisplaySubscriber(client)

      const handlers: DisplayEventHandlers = {
        onSnapshot: (snapshot) =>
          useDisplayStore.getState().upsertSession(snapshot.user_id, snapshot),
        onSessionEnded: ({ user_id }) => useDisplayStore.getState().removeSession(user_id),
        onFocus: ({ user_id }) => useDisplayStore.getState().setFocusedUser(user_id),
        onUnfocus: () => useDisplayStore.getState().setFocusedUser(null),
        onStatusChange: (status) => useDisplayStore.getState().setConnectionStatus(status),
      }

      subscribeToDisplay(handlers)

      // Prune stale sessions every 60s (30-minute staleness threshold)
      pruneRef.current = setInterval(
        () => useDisplayStore.getState().pruneStale(30 * 60 * 1_000),
        60_000,
      )
    }

    boot()

    return () => {
      cancelled = true
      destroyDisplaySubscriber()

      if (pruneRef.current) {
        clearInterval(pruneRef.current)
        pruneRef.current = null
      }

      useDisplayStore.getState().clearAllSessions()
      clientRef.current = null
    }
  }, [])

  if (configMissing) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-lg text-warm-ash">
          No backend configured. Visit <span className="text-ember">/setup</span> first.
        </p>
      </div>
    )
  }

  return <DisplayModeRenderer />
}

// ---------------------------------------------------------------------------
// DisplayModeRenderer -- cross-fade between idle / board / focused views
// ---------------------------------------------------------------------------

function DisplayModeRenderer() {
  const displayMode = useDisplayStore(getDisplayMode)

  return (
    <div className="relative h-full w-full">
      {/* Idle view */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          displayMode === 'idle' ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <IdlePlaceholder />
      </div>

      {/* Board view */}
      <div
        className={cn(
          'absolute inset-0 bottom-12 transition-opacity duration-300',
          displayMode === 'board' ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <BoardView />
      </div>

      {/* Focused view */}
      <div
        className={cn(
          'absolute inset-0 bottom-12 transition-opacity duration-300',
          displayMode === 'focused' ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <FocusedView />
      </div>

      {/* Footer is always visible */}
      <ConnectionFooter />
    </div>
  )
}
