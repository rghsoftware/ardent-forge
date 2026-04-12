import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'

// ---------------------------------------------------------------------------
// Gym ownership transfer hooks (F021 -- Gym Membership Explicit)
//
// Thin TanStack Query wrapper around the ownership-transfer methods on the
// `DataAdapter`. Transfers are a three-RPC dance (propose / accept /
// cancel-or-decline) plus a single-row read for the currently pending
// proposal. The single-pending-transfer-per-gym invariant is enforced
// server-side by the `gym_ownership_transfers` primary key, so there is no
// "list" variant here -- only a `getPendingTransfer(gymId)` lookup.
//
// Query key convention follows `[domain, action, params]` from
// `.claude/rules/react-typescript.md`:
//
//   ['gym-transfers', 'pending', gymId]   -- single pending transfer by gym
//
// Accepting a transfer flips `gyms.owner_user_id`, so `useAcceptGymTransfer`
// invalidates BOTH the pending-transfer cache entry AND the corresponding
// `['gyms', 'detail', gymId]` entry so any consumer displaying the owner
// refetches immediately.
// ---------------------------------------------------------------------------

/**
 * Returns the pending ownership transfer for a gym, or null if none.
 * Disabled when `gymId` is null/undefined. RLS scopes visibility to the
 * proposer and target only -- other viewers receive `null`.
 */
export function usePendingGymTransfer(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym-transfers', 'pending', gymId],
    queryFn: () => getAdapter().getPendingTransfer(gymId!),
    enabled: !!gymId,
  })
}

/**
 * Proposes a gym ownership transfer to another member. Owner-only; RLS
 * enforces the caller is the current owner. On success, invalidates the
 * pending-transfer cache entry so the UI reflects the newly created row.
 */
export function useProposeGymTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gymId, targetUserId }: { gymId: string; targetUserId: string }) =>
      getAdapter().proposeGymTransfer(gymId, targetUserId),
    onError: (err, variables) => {
      console.error('[gym-transfers] proposeGymTransfer failed:', {
        gymId: variables.gymId,
        targetUserId: variables.targetUserId,
        err,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['gym-transfers', 'pending', variables.gymId],
      })
    },
  })
}

/**
 * Accepts a pending ownership transfer. Target-only; the RPC flips
 * `gyms.owner_user_id` and deletes the pending row in one transaction. On
 * success, invalidates BOTH the pending-transfer cache entry and the
 * gym-detail cache entry so owner-dependent UI refetches.
 */
export function useAcceptGymTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gymId }: { gymId: string }) => getAdapter().acceptGymTransfer(gymId),
    onError: (err, variables) => {
      console.error('[gym-transfers] acceptGymTransfer failed:', {
        gymId: variables.gymId,
        err,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['gyms', 'detail', variables.gymId],
      })
      queryClient.invalidateQueries({
        queryKey: ['gym-transfers', 'pending', variables.gymId],
      })
    },
  })
}

/**
 * Cancels (owner) or declines (target) a pending ownership transfer. The
 * RPC asserts caller party-membership before deleting the row. On success,
 * invalidates the pending-transfer cache entry.
 */
export function useCancelOrDeclineGymTransfer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gymId }: { gymId: string }) => getAdapter().cancelOrDeclineGymTransfer(gymId),
    onError: (err, variables) => {
      console.error('[gym-transfers] cancelOrDeclineGymTransfer failed:', {
        gymId: variables.gymId,
        err,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['gym-transfers', 'pending', variables.gymId],
      })
    },
  })
}
