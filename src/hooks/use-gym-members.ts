import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'

// ---------------------------------------------------------------------------
// Gym membership query + mutation hooks (F018 -- Gym-Scoped Displays)
//
// Thin TanStack Query wrapper around the `DataAdapter` gym membership
// methods. Consumed by the profile gym-management section (leave / kick
// controls, member-count badges) and the browse-all-gyms subview.
//
// Query keys follow the `[domain, action, params]` convention from
// `.claude/rules/react-typescript.md`:
//
//   ['gym-members']                   -- broad invalidation target
//   ['gym-members', 'list', gymId]    -- members of a specific gym
//
// Mutations also invalidate the parent `['gyms']` subtree so the picker's
// member-count badges and the user's gym-list both stay current after
// joining, leaving, or kicking.
//
// Owner-only operations (kick) are enforced server-side via RLS; these
// hooks simply call the adapter and surface any error via `isError`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Lists every member of the given gym.
 * Disabled when `gymId` is null/undefined.
 */
export function useGymMembers(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym-members', 'list', gymId],
    queryFn: () => getAdapter().listGymMembers(gymId!),
    enabled: !!gymId,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Joins the current authenticated user to the given gym.
 * Invalidates the gym-members list for that gym plus the broad `['gyms']`
 * subtree so the picker and user-membership list refetch.
 */
export function useJoinGym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (gymId: string) => getAdapter().joinGym(gymId),
    onError: (err) => {
      console.error('[gym-members] Failed to join gym:', err)
    },
    onSettled: (_data, _err, gymId) => {
      queryClient.invalidateQueries({ queryKey: ['gym-members', 'list', gymId] })
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
    },
  })
}

/**
 * Removes the current authenticated user's membership from the given gym.
 * Invalidates the gym-members list for that gym plus the broad `['gyms']`
 * subtree.
 */
export function useLeaveGym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (gymId: string) => getAdapter().leaveGym(gymId),
    onError: (err) => {
      console.error('[gym-members] Failed to leave gym:', err)
    },
    onSettled: (_data, _err, gymId) => {
      queryClient.invalidateQueries({ queryKey: ['gym-members', 'list', gymId] })
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
    },
  })
}

/**
 * Removes another user's membership from the given gym.
 * Owner-only; enforced server-side via RLS -- any authorization error
 * surfaces via the standard mutation `isError` state.
 */
export function useKickGymMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gymId, userId }: { gymId: string; userId: string }) =>
      getAdapter().kickGymMember(gymId, userId),
    onError: (err) => {
      console.error('[gym-members] Failed to kick member:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gym-members', 'list', variables.gymId] })
      queryClient.invalidateQueries({ queryKey: ['gyms'] })
    },
  })
}
