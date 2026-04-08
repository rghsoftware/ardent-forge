import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// dispatcher-state.ts -- pure state machine for /display (F019 D7)
//
// Turns raw `useAuth()` + `useGyms()` outputs into a discriminated-union
// dispatcher state. Split into its own module so it can be unit-tested
// without mounting any React tree.
//
// Precedence rules (enforced by the ladder in computeDispatcherState --
// the numbers in this header match the body comments 1:1):
//   1. auth loading                          → loading
//   2. not authenticated                     → unauthenticated
//   3. gyms query error AND no cached data   → error (P15-028)
//   4. gyms query loading OR gyms undefined  → loading (cache miss)
//   5. gyms.length === 0                     → zero
//   6. gyms.length === 1                     → single(gymId)
//   7. gyms.length >= 2                      → many(gyms)
//
// P15-028: A transient `isError` with stale cached `gyms` falls through
// to the `'many'` / `'single'` / `'zero'` branch rather than blowing away
// the chooser entirely. The dispatcher component logs the underlying
// error via useEffect so operators still see the signal.
// ---------------------------------------------------------------------------

export type DispatcherState =
  | { kind: 'unauthenticated' }
  | { kind: 'loading' }
  | { kind: 'error'; retry: () => void }
  | { kind: 'zero' }
  | { kind: 'single'; gymId: string }
  | { kind: 'many'; gyms: Gym[] }

export interface DispatcherInputs {
  authLoading: boolean
  user: { id: string } | null
  gymsLoading: boolean
  gymsError: boolean
  gyms: Gym[] | undefined
  refetch: () => void
}

export function computeDispatcherState(inputs: DispatcherInputs): DispatcherState {
  // 1. Auth-loading beats everything. Without a resolved auth state we
  //    cannot know whether to branch into the legacy page or the dispatcher
  //    flow, so we render a skeleton rather than flashing either surface.
  if (inputs.authLoading) return { kind: 'loading' }

  // 2. Unauthenticated: render the preserved legacy "DISPLAY NOT
  //    CONFIGURED" page. This branch exists strictly for dumb-TV boots and
  //    operators with expired sessions.
  if (inputs.user === null) return { kind: 'unauthenticated' }

  // 3. Gyms query error with no cached data — render the error state.
  //    If stale data IS cached (refetch failure), fall through to the
  //    normal many/single/zero branches instead of painting the whole list
  //    as "could not load" (P15-028).
  if (inputs.gymsError && inputs.gyms === undefined) {
    return { kind: 'error', retry: inputs.refetch }
  }

  // 4. Gyms still loading (or undefined because the cache is cold).
  if (inputs.gymsLoading || inputs.gyms === undefined) return { kind: 'loading' }

  // 5. Zero-gym orphan state — render the setup panel.
  if (inputs.gyms.length === 0) return { kind: 'zero' }

  // 6. Single-gym members get auto-routed straight to their TV.
  if (inputs.gyms.length === 1) {
    const only = inputs.gyms[0]!
    return { kind: 'single', gymId: only.id }
  }

  // 7. 2+ gyms → full-page chooser.
  return { kind: 'many', gyms: inputs.gyms }
}
