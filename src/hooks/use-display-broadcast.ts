import { useEffect, useMemo, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import {
  initDisplayPublisher,
  configureDisplayPublisher,
  isPublisherReady,
  publishFocusEvent,
  publishUnfocusEvent,
  destroyDisplayPublisher,
  setHelloResponder,
} from '@/lib/display-realtime'
import {
  setSnapshotContext,
  useActiveWorkoutStore,
  republishCurrentState,
} from '@/stores/active-workout-store'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import type { SessionType } from '@/domain/types/session'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

interface UseDisplayBroadcastReturn {
  publishFocus: () => void
  publishUnfocus: () => void
  isBroadcasting: boolean
}

// ---------------------------------------------------------------------------
// useDisplayBroadcast
// ---------------------------------------------------------------------------

/**
 * Manages the display broadcast lifecycle for a given user and gym.
 *
 * - Initializes the display publisher on mount (no-op when offline/Tauri with
 *   no Supabase client).
 * - Keeps the publisher configured with the gym ID the current workout is
 *   broadcasting to. Pass `null` for a Private workout -- the publisher will
 *   no-op on every send call.
 * - Maintains the snapshot context that the active-workout store needs to
 *   build and broadcast DisplaySnapshots on every state change.
 * - Tears down the publisher and clears context on unmount.
 *
 * F018: The `gymId` argument replaces the legacy `profile.displayVisible`
 * per-user flag. Gym selection happens at workout start via the picker; the
 * chosen value is threaded down to this hook from the route component.
 */
export function useDisplayBroadcast(
  userId: string,
  gymId: string | null,
): UseDisplayBroadcastReturn {
  // -----------------------------------------------------------------------
  // 1. Init publisher on mount, destroy on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) return

    initDisplayPublisher(client)
    setHelloResponder(() => {
      republishCurrentState()
    })

    return () => {
      setHelloResponder(null)
      setSnapshotContext(null)
      destroyDisplayPublisher()
    }
  }, [])

  // -----------------------------------------------------------------------
  // 2. Read user profile for display name (cached via TanStack Query)
  // -----------------------------------------------------------------------

  const { data: profile, error: profileError } = useUserProfile(userId)

  // Log fetch errors via effect (not render-phase) so the warn fires once per
  // error change rather than on every re-render while the error persists.
  useEffect(() => {
    if (profileError) {
      console.warn('[display-broadcast] Failed to load user profile, using defaults', profileError)
    }
  }, [profileError])

  // P14-009: when broadcast is active and the displayName fell back to the
  // generic 'Athlete' label, log a one-shot warning so operators know that
  // every snapshot for the rest of the workout is showing a placeholder
  // name on the gym TV. The actual snapshot still ships -- failing closed
  // here would block the user from broadcasting at all.

  // -----------------------------------------------------------------------
  // 3. Configure publisher when gymId changes
  //
  // Per F018 P14-001/P14-002: only re-affirm `broadcasting` mode here. The
  // start-workout handler at `_authenticated/index.tsx` is the canonical
  // place that sets explicit Private intent. After a tab refresh, the route
  // reads `getActiveGymId()` which returns null because module state was
  // wiped, so this hook receives `gymId=null` and intentionally does NOT
  // call `configureDisplayPublisher` -- the publisher stays in
  // 'unconfigured' mode and silent drops trigger one-shot warnings.
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return
    if (gymId !== null) {
      configureDisplayPublisher({ gymId, intent: 'broadcasting' })
    }
    // P14-036: when gymId flips back to null mid-session (e.g., the user
    // navigates between workouts and the new one is Private), the
    // start-workout handler at index.tsx is responsible for calling
    // configureDisplayPublisher with intent: 'private'. This effect cannot
    // safely do that itself because it can't distinguish "Private workout"
    // from "publisher state lost on tab refresh."
  }, [userId, gymId])

  // -----------------------------------------------------------------------
  // 4. Build exercise name map
  // -----------------------------------------------------------------------

  const { data: exercises, error: exercisesError } = useExercises()

  // Log fetch errors via effect (not render-phase) so the warn fires once per
  // error change rather than on every re-render while the error persists.
  useEffect(() => {
    if (exercisesError) {
      console.warn(
        '[display-broadcast] Failed to load exercises, exercise names will be unavailable',
        exercisesError,
      )
    }
  }, [exercisesError])

  const exerciseNameMap = useMemo<Record<string, string>>(() => {
    if (!exercises) return {}
    const map: Record<string, string> = {}
    for (const ex of exercises) {
      map[ex.id] = ex.name
    }
    return map
  }, [exercises])

  // -----------------------------------------------------------------------
  // 5 & 6. Set snapshot context when workout is active
  // -----------------------------------------------------------------------

  const workoutLog = useActiveWorkoutStore((s) => s.workoutLog)

  // TODO: derive from session template category once the template is resolved
  // from workoutLog.sessionTemplateId. For now, default to STRENGTH.
  const sessionType: SessionType = 'STRENGTH'

  const displayName = profile?.displayName ?? 'Athlete'
  const displayNameIsFallback = !profile?.displayName

  // P14-009: warn once per active broadcast when the display name is the
  // 'Athlete' fallback. Conditioned on `gymId !== null` so a Private workout
  // (where nothing publishes) does not log a misleading warning.
  useEffect(() => {
    if (workoutLog && gymId !== null && displayNameIsFallback) {
      console.warn(
        '[display-broadcast] Broadcasting with fallback display name "Athlete"; ' +
          'profile fetch failed or returned no displayName. The TV will show this label ' +
          'for every set in this workout.',
      )
    }
  }, [workoutLog, gymId, displayNameIsFallback])

  // P14-010: warn once per active broadcast when the exercise name map is
  // empty (exercises fetch failed). Without this, every snapshot would
  // broadcast blank exercise names on the gym TV with no console signal.
  useEffect(() => {
    if (workoutLog && gymId !== null && exercisesError) {
      console.warn(
        '[display-broadcast] Broadcasting with empty exercise map; exercises fetch failed. ' +
          'Snapshots will show blank exercise names on the gym TV until the fetch recovers.',
      )
    }
  }, [workoutLog, gymId, exercisesError])

  useEffect(() => {
    if (workoutLog) {
      setSnapshotContext({
        userId,
        displayName,
        exerciseNameMap,
        sessionType,
      })
    } else {
      setSnapshotContext(null)
    }
  }, [workoutLog, userId, displayName, exerciseNameMap, sessionType])

  // -----------------------------------------------------------------------
  // 8. Return value
  // -----------------------------------------------------------------------

  const publishFocus = useCallback(() => {
    publishFocusEvent(userId)
  }, [userId])

  const publishUnfocus = useCallback(() => {
    publishUnfocusEvent()
  }, [])

  const isBroadcasting = workoutLog !== null && isPublisherReady()

  return { publishFocus, publishUnfocus, isBroadcasting }
}
