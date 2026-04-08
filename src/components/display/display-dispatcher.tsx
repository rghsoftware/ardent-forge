import { useEffect, useRef, type ReactElement } from 'react'
import { Navigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useGyms } from '@/hooks/use-gyms'
import { computeDispatcherState } from './dispatcher-state'
import { DisplaySetupPanel } from './display-setup-panel'
import { DisplayChooser } from './display-chooser'

// ---------------------------------------------------------------------------
// DisplayDispatcher -- /display smart entry point (F019 D14, M6-M9, M20)
//
// Reads useAuth() and useGyms() and dispatches to one of:
//   - LegacyNotConfiguredPage    (unauthenticated — preserved F018 copy)
//   - DispatcherLoadingState     (auth or gyms loading — light skeleton per O2)
//   - DispatcherErrorState       (gyms query error)
//   - DisplaySetupPanel          (zero gyms)
//   - <Navigate replace />        (single gym — declarative redirect)
//   - DisplayChooser             (2+ gyms)
//
// State transitions are owned by the pure `computeDispatcherState`
// function so this component stays a thin renderer.
// ---------------------------------------------------------------------------

export function DisplayDispatcher(): ReactElement {
  const auth = useAuth()
  const userId = auth.user?.id
  const gymsQuery = useGyms(userId)

  // P15-003: Log the actual gymsQuery error so operators can distinguish RLS
  // denial, schema drift, expired publishable keys, and transient network
  // blips. Without this the DispatcherErrorState renders a generic "could not
  // load" banner with zero production trace.
  useEffect(() => {
    if (gymsQuery.isError) {
      console.error('[display-dispatcher] gyms query failed', gymsQuery.error)
    }
  }, [gymsQuery.isError, gymsQuery.error])

  // P15-009: One-shot breadcrumb so operators can distinguish "auth state
  // momentarily null during refresh" from "genuinely signed out" when a user
  // reports seeing the legacy DISPLAY NOT CONFIGURED page.
  const loggedUnauthRef = useRef(false)
  useEffect(() => {
    if (!auth.loading && auth.user === null && !loggedUnauthRef.current) {
      console.info('[display-dispatcher] Unauthenticated user hit /display — showing legacy page')
      loggedUnauthRef.current = true
    }
  }, [auth.loading, auth.user])

  const state = computeDispatcherState({
    authLoading: auth.loading,
    user: auth.user ? { id: auth.user.id } : null,
    gymsLoading: gymsQuery.isLoading,
    gymsError: gymsQuery.isError,
    gyms: gymsQuery.data,
    refetch: gymsQuery.refetch,
  })

  switch (state.kind) {
    case 'unauthenticated':
      return <LegacyNotConfiguredPage />
    case 'loading':
      return <DispatcherLoadingState />
    case 'error':
      return <DispatcherErrorState retry={state.retry} />
    case 'zero':
      return <DisplaySetupPanel userId={auth.user!.id} />
    case 'single':
      return <Navigate to="/display/gym/$gymId" params={{ gymId: state.gymId }} replace />
    case 'many':
      return <DisplayChooser gyms={state.gyms} userId={auth.user!.id} />
    default: {
      // P15-016: Exhaustiveness guard — if a new DispatcherState variant is
      // added, this line fails the build instead of silently rendering nothing.
      const _exhaustive: never = state
      throw new Error(`[display-dispatcher] Unknown state kind: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

/**
 * Preserved F018 "DISPLAY NOT CONFIGURED" page. Inlined here so the
 * dispatcher can render it without a separate component file. The exact
 * copy must match the F018-shipped page (Spec.md M20).
 */
function LegacyNotConfiguredPage(): ReactElement {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-surface-anvil">
      <div className="max-w-xl px-6 text-center">
        <p className="font-display text-3xl tracking-widest text-ember">DISPLAY NOT CONFIGURED</p>
        <p className="mt-6 text-sm uppercase tracking-wider text-warm-ash">
          Ask the gym owner for the display URL.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-warm-ash/70">
          Expected format: /display/gym/&lt;gym-id&gt;
        </p>
      </div>
    </div>
  )
}

/**
 * Lightweight skeleton (per O2 — visually lighter than the TV route's
 * boot skeleton so the two surfaces are distinguishable at a glance).
 */
function DispatcherLoadingState(): ReactElement {
  return (
    <div
      data-testid="display-dispatcher-loading"
      className="flex h-dvh w-full items-center justify-center bg-surface-anvil"
    >
      <p className="text-xs uppercase tracking-widest text-warm-ash">Loading display...</p>
    </div>
  )
}

interface DispatcherErrorStateProps {
  retry: () => void
}

function DispatcherErrorState({ retry }: DispatcherErrorStateProps): ReactElement {
  return (
    <div
      data-testid="display-dispatcher-error"
      className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-surface-anvil"
    >
      <p className="text-sm uppercase tracking-widest text-warning-flare">
        Could not load your gyms
      </p>
      <p className="text-xs text-warm-ash">Check your connection and try again.</p>
      <Button
        type="button"
        onClick={retry}
        data-testid="display-dispatcher-retry"
        className="min-h-[48px] bg-surface-gunmetal text-bone-white hover:bg-surface-gunmetal/80"
      >
        Retry
      </Button>
    </div>
  )
}
