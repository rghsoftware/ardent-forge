import { useEffect, type ReactElement } from 'react'
import { useGyms } from '@/hooks/use-gyms'
import { getActiveGymId } from '@/lib/display-realtime'

// ---------------------------------------------------------------------------
// ActiveWorkoutGymLabel -- workout header gym label (F018, Tech.md D12)
//
// Renders an ALL-CAPS `OPERATOR · <GYM NAME>` tertiary-row label next to
// the active workout header session-type metadata (per Spec.md S2), but
// ONLY when the user belongs to two or more gyms (Spec.md M23 -- single-gym
// users have nothing to disambiguate so the label would be chrome).
//
// Data sources:
//   - `useGyms(userId)` for the user's memberships
//   - `getActiveGymId()` from `display-publisher` for the workout's active
//     gym. This is a synchronous module-state read, not a subscription --
//     the component will NOT re-render when the publisher gym changes.
//     For v1 this is fine because the gym is LOCKED at workout start and
//     mid-workout switching is deferred (Spec.md W5 / Tech.md RD-12).
//
// Defensive nulls:
//   - fewer than 2 memberships → null (M23)
//   - no active gym (Private mode) → null
//   - active gym id not in memberships (e.g. gym deleted mid-workout) → null
// ---------------------------------------------------------------------------

interface ActiveWorkoutGymLabelProps {
  /** The authenticated user whose gym memberships should be inspected. */
  userId: string
}

export function ActiveWorkoutGymLabel({ userId }: ActiveWorkoutGymLabelProps): ReactElement | null {
  const { data: gyms, isError, error } = useGyms(userId)

  // Surface fetch failures to logs so the silent label-hide is traceable when
  // debugging "why did the gym name disappear?" reports. The component still
  // returns null on isError because there is no useful fallback to render --
  // an error state in a tertiary header label is more noise than signal.
  useEffect(() => {
    if (isError) {
      console.warn('[active-workout-gym-label] Failed to load gyms; label hidden:', error)
    }
  }, [isError, error])

  // Single-gym hide: the label disambiguates; nothing to disambiguate.
  if (!gyms || gyms.length < 2) return null

  // Synchronous module-state read. See component docblock -- the label
  // does not re-render if the publisher gym changes mid-workout. That is
  // intentional for v1 because RD-12 locks the gym at workout start.
  const activeGymId = getActiveGymId()
  if (activeGymId === null) return null

  const activeGym = gyms.find((g) => g.id === activeGymId)
  if (!activeGym) return null

  return (
    <span
      data-testid="active-workout-gym-label"
      className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash"
    >
      OPERATOR · {activeGym.name.toUpperCase()}
    </span>
  )
}
