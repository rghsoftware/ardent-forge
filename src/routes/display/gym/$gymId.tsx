import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { resolveConfig } from '@/lib/config-store'
import {
  initDisplaySubscriber,
  subscribeToDisplay,
  destroyDisplaySubscriber,
  type DisplayEventHandlers,
} from '@/lib/display-subscriber'
import { useDisplayStore, getDisplayMode } from '@/stores/display-store'
import { IdleView } from '@/components/display/idle-view'
import { BoardView } from '@/components/display/board-view'
import { ConnectionFooter } from '@/components/display/connection-footer'
import { FocusedView } from '@/components/display/focused-view'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/display/gym/$gymId')({
  validateSearch: z.object({
    clock: z.enum(['12h', '24h']).optional().default('24h'),
  }),
  component: DisplayGymPage,
})

// ---------------------------------------------------------------------------
// DisplayGymPage -- full-viewport wrapper with portrait detection
// ---------------------------------------------------------------------------

function DisplayGymPage() {
  const { gymId } = Route.useParams()

  // Validate the path param is a UUID. We do this here rather than in
  // validateSearch because $gymId is a path param, not a search param.
  const isUuid = z.string().uuid().safeParse(gymId).success

  if (!isUuid) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-surface-anvil">
        <div className="max-w-xl px-6 text-center">
          <p className="font-display text-2xl tracking-widest text-ember">INVALID GYM ID</p>
          <p className="mt-4 text-sm uppercase tracking-wider text-warm-ash">
            The URL is missing or malformed. Ask the gym owner for the correct display URL.
          </p>
        </div>
      </div>
    )
  }

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
      <DisplayShell gymId={gymId} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// DisplayShell -- lifecycle management and mode-based rendering
// ---------------------------------------------------------------------------

function DisplayShell({ gymId }: { gymId: string }) {
  const { clock } = Route.useSearch()
  const [configMissing, setConfigMissing] = useState(false)
  const clientRef = useRef<SupabaseClient | null>(null)
  const pruneRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const config = await resolveConfig()

        if (cancelled) return

        if (!config) {
          setConfigMissing(true)
          return
        }

        const client = createClient(config.supabaseUrl, config.supabaseKey)
        clientRef.current = client

        initDisplaySubscriber(client)

        const handlers: DisplayEventHandlers = {
          onSnapshot: (snapshot) =>
            useDisplayStore.getState().upsertSession(snapshot.user_id, snapshot),
          onSessionEnded: ({ user_id }) => useDisplayStore.getState().removeSession(user_id),
          onFocus: ({ user_id }) => useDisplayStore.getState().setFocusedUser(user_id),
          onUnfocus: () => useDisplayStore.getState().setFocusedUser(null),
          onIdleSnapshot: (snapshot) => useDisplayStore.getState().setIdleSnapshot(snapshot),
          onStatusChange: (status) => useDisplayStore.getState().setConnectionStatus(status),
        }

        subscribeToDisplay({ gymId, handlers })

        // Optional S5: fetch gym name for operator reassurance. The anon
        // publishable key has column-level SELECT on (id, name) via M21.
        // This is best-effort -- we log but never fail the boot on error.
        client
          .from('gyms')
          .select('id, name')
          .eq('id', gymId)
          .single()
          .then(({ data, error }) => {
            if (cancelled) return
            if (error) {
              console.warn('[display] Failed to resolve gym name:', error.message)
              return
            }
            if (data?.name) {
              console.info(`[display] Subscribed to gym "${data.name}" (${data.id})`)
            }
          })

        // Prune stale sessions every 60s (30-minute staleness threshold)
        pruneRef.current = setInterval(
          () => useDisplayStore.getState().pruneStale(30 * 60 * 1_000),
          60_000,
        )
      } catch (err) {
        console.error('[display] Boot failed:', err)
        if (!cancelled) {
          useDisplayStore.getState().setConnectionStatus('disconnected')
        }
      }
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
  }, [gymId])

  if (configMissing) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-lg text-warm-ash">
          No backend configured. Visit <span className="text-ember">/setup</span> first.
        </p>
      </div>
    )
  }

  return <DisplayModeRenderer clockFormat={clock} />
}

// ---------------------------------------------------------------------------
// DisplayModeRenderer -- cross-fade between idle / board / focused views
// ---------------------------------------------------------------------------

function DisplayModeRenderer({ clockFormat }: { clockFormat: '12h' | '24h' }) {
  const displayMode = useDisplayStore(getDisplayMode)
  const idleSnapshot = useDisplayStore((s) => s.idleSnapshot)
  const connectionStatus = useDisplayStore((s) => s.connectionStatus)

  return (
    <div className="relative h-full w-full">
      {/* Idle view */}
      <div
        className={cn(
          'absolute inset-0 transition-opacity duration-300',
          displayMode === 'idle' ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <IdleView
          idleSnapshot={idleSnapshot}
          clockFormat={clockFormat}
          connectionStatus={connectionStatus === 'connected' ? 'connected' : 'reconnecting'}
        />
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
