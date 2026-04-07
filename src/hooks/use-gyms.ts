import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// Gym query + mutation hooks (F018 -- Gym-Scoped Displays)
//
// Thin TanStack Query wrapper around the `DataAdapter` gym CRUD methods.
// Consumed by the workout-start picker, the active workout header label,
// and the profile gym-management section.
//
// Query keys follow the `[domain, action, params]` convention from
// `.claude/rules/react-typescript.md`. The tagged-action segment avoids
// collisions between a user-membership list (`['gyms', 'list', userId]`)
// and a single-gym detail (`['gyms', 'detail', gymId]`) where `userId`
// and `gymId` would otherwise occupy the same cache slot:
//
//   ['gyms']                          -- broad invalidation target
//   ['gyms', 'list', userId]          -- gyms a specific user is a member of
//   ['gyms', 'list-all']              -- every gym on the instance (browse)
//   ['gyms', 'detail', gymId]         -- a single gym by id
//
// Per Tech.md D14, gyms are an online-only concept. The Tauri adapter's
// gym methods return empty collections (for reads) or throw (for writes),
// so these hooks need no Tauri-aware branching -- error paths surface via
// the standard `isError` state.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Lists every gym the given user is a member of.
 * Disabled when `userId` is null/undefined so callers can safely pass the
 * pre-auth sentinel without triggering a fetch.
 */
export function useGyms(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['gyms', 'list', userId],
    queryFn: () => getAdapter().listUserGyms(userId!),
    enabled: !!userId,
  })
}

/**
 * Lists every gym on the instance (the "browse all" picker view).
 * Always enabled -- this is an authenticated list of instance-wide gyms.
 */
export function useAllGyms() {
  return useQuery({
    queryKey: ['gyms', 'list-all'],
    queryFn: () => getAdapter().listAllGyms(),
  })
}

/**
 * Returns a single gym by id, or null if it does not exist.
 * Disabled when `gymId` is null/undefined.
 */
export function useGym(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gyms', 'detail', gymId],
    queryFn: () => getAdapter().getGym(gymId!),
    enabled: !!gymId,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Creates a new gym owned by the current authenticated user.
 * Invalidates every gym list on success so the picker and browse view
 * immediately pick up the new row.
 */
export function useCreateGym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string }) => getAdapter().createGym(input),
    onError: (err) => {
      console.error('[gyms] Failed to create gym:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
    },
  })
}

/**
 * Updates an existing gym (owner-only; enforced server-side via RLS).
 * Invalidates the broad `['gyms']` subtree so the specific-id detail query,
 * the user's membership list, and the "all gyms" list all refetch.
 */
export function useUpdateGym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Partial<Gym> & { id: string }) => getAdapter().updateGym(input),
    onError: (err) => {
      console.error('[gyms] Failed to update gym:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
      queryClient.invalidateQueries({ queryKey: ['gyms', 'detail', variables.id] })
    },
  })
}

/**
 * Deletes a gym (owner-only; enforced server-side via RLS).
 * Removes the cached detail entry and invalidates every gym list so the
 * browse view and the user's membership list drop the row.
 */
export function useDeleteGym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (gymId: string) => getAdapter().deleteGym(gymId),
    onError: (err) => {
      console.error('[gyms] Failed to delete gym:', err)
    },
    onSettled: (_data, _err, gymId) => {
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
      queryClient.removeQueries({ queryKey: ['gyms', 'detail', gymId] })
    },
  })
}
