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

// Distinct boot failure modes -- each one needs a different recovery story.
// `config-load` means the user's local config is corrupted (revisit /setup).
// `client-create` means the configured URL/key is malformed (revisit /setup).
// `subscribe-failed` is usually a transient network issue (Retry button).
type BootError =
  | { kind: 'config-load'; err: unknown }
  | { kind: 'client-create'; err: unknown }
  | { kind: 'subscribe-failed'; err: unknown }

function DisplayShell({ gymId }: { gymId: string }) {
  const { clock } = Route.useSearch()
  const [configMissing, setConfigMissing] = useState(false)
  const [bootError, setBootError] = useState<BootError | null>(null)
  const clientRef = useRef<SupabaseClient | null>(null)
  const pruneRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      // Phase 1: load config from local storage. Failure here means the
      // user's local config is corrupted or unreadable.
      let config: Awaited<ReturnType<typeof resolveConfig>>
      try {
        config = await resolveConfig()
      } catch (err) {
        if (cancelled) return
        console.error('[display] Config load failed:', err)
        setBootError({ kind: 'config-load', err })
        return
      }

      if (cancelled) return

      if (!config) {
        // Diagnostic breadcrumb for remote console captures: the only signal
        // we'd otherwise have that this branch fired is the user reporting it.
        console.warn('[display] No backend configured; prompting user to visit /setup')
        setConfigMissing(true)
        return
      }

      // Phase 2: create the Supabase client. Failure here is a malformed
      // URL or invalid key -- still a config problem from the user's POV.
      let client: SupabaseClient
      try {
        client = createClient(config.supabaseUrl, config.supabaseKey)
      } catch (err) {
        if (cancelled) return
        console.error('[display] Supabase client creation failed:', err)
        setBootError({ kind: 'client-create', err })
        return
      }
      clientRef.current = client

      // Phase 3: subscribe to the realtime channel. Failure here is usually
      // transient (network blip) and a Retry button is the right affordance.
      try {
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
      } catch (err) {
        if (cancelled) return
        console.error('[display] Subscribe failed:', err)
        setBootError({ kind: 'subscribe-failed', err })
        useDisplayStore.getState().setConnectionStatus('disconnected')
        return
      }

      // P14-012: removed the best-effort gym-name fetch. The success branch
      // only logged to console and the failure branch was indistinguishable
      // from a real RLS/network problem. Without a UI surface for the gym
      // name, the fetch was net-zero value but added an extra failure mode
      // (rotated publishable key, tightened RLS policy on the anon role).
      // When we add a visible gym-name header to the display chrome, the
      // fetch should come back -- but the data should drive a render, not
      // just a log line. Tracked as part of S5 (operator reassurance UX).

      // Phase 5: prune stale sessions every 60s (30-minute staleness threshold)
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

  if (bootError) {
    const message =
      bootError.kind === 'config-load'
        ? 'Failed to load the saved Supabase configuration. Visit /setup to configure or repair the connection.'
        : bootError.kind === 'client-create'
          ? 'Failed to create the Supabase client. Verify the configured URL and publishable key in /setup.'
          : 'Failed to subscribe to the gym channel. Check your connection and try again.'

    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="max-w-xl px-6 text-center">
          <p className="font-display text-2xl tracking-widest text-warning-flare">DISPLAY ERROR</p>
          <p className="mt-4 text-sm text-warm-ash">{message}</p>
          {bootError.kind === 'subscribe-failed' && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 min-h-[48px] rounded-none border border-surface-steel bg-surface-iron px-6 py-3 font-sans text-xs font-medium uppercase tracking-widest text-bone-white hover:bg-surface-gunmetal"
            >
              Retry
            </button>
          )}
        </div>
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
