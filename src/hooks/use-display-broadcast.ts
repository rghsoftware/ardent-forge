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
} from '@/lib/display-publisher'
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

  // -----------------------------------------------------------------------
  // 3. Configure publisher when gymId changes
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return
    configureDisplayPublisher({ gymId })
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
