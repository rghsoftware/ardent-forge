import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { RedeemInviteError } from '@/domain/types'

// ---------------------------------------------------------------------------
// Gym invite query + mutation hooks (F021 -- Gym Membership Explicit)
//
// Thin TanStack Query wrapper around the gym-invite adapter methods.
// Consumed by the owner invite-management surface and the redeem flow.
//
// Query keys:
//   ['gym-invites', gymId]   -- active invites for a specific gym
//
// Mutation invalidation:
//   - createGymInvite: invalidates ['gym-invites', gymId]
//   - redeemGymInvite: invalidates ['gyms'] and ['gym-members'] on ok:true
//
// Error handling:
//   Every mutation attaches an onError handler with a `[gym-invites]` prefix.
//   redeemGymInvite NEVER logs the raw token -- the adapter already scrubs it,
//   and the hook only logs the structured error.
// ---------------------------------------------------------------------------

export type RedeemGymInviteResult =
  | { ok: true; gymId: string }
  | { ok: false; error: RedeemInviteError }

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Lists active invites for the given gym. Owner-only via RLS -- non-owners
 * receive an empty list. Disabled when `gymId` is null/undefined.
 */
export function useListGymInvites(gymId: string | null | undefined) {
  return useQuery({
    queryKey: ['gym-invites', gymId],
    queryFn: () => getAdapter().listGymInvites(gymId!),
    enabled: !!gymId,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export interface CreateGymInviteInput {
  gymId: string
  expiresAt?: string
  maxUses?: number
}

/**
 * Creates a new invite token for the given gym. Owner-only (RLS enforced).
 * Invalidates ['gym-invites', gymId] on success so the owner UI picks up
 * the new row.
 */
export function useCreateGymInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ gymId, expiresAt, maxUses }: CreateGymInviteInput) =>
      getAdapter().createGymInvite(gymId, { expiresAt, maxUses }),
    onError: (err, variables) => {
      console.error('[gym-invites] createGymInvite failed:', {
        gymId: variables.gymId,
        err,
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gym-invites', variables.gymId] })
    },
  })
}

/**
 * Redeems an invite token. Returns the discriminated result verbatim so
 * callers branch on `result.ok`. Invalidates gym and gym-members caches
 * on a successful join so the user's gym list picks up the new membership.
 *
 * NEVER log the raw token. On thrown errors (network / unexpected) we log
 * only the error; on ok:false results we log the invite id if the adapter
 * surfaces it (currently not -- the result is error-kind only).
 */
export function useRedeemGymInvite() {
  const queryClient = useQueryClient()

  return useMutation<RedeemGymInviteResult, Error, string>({
    mutationFn: (token: string) => getAdapter().redeemGymInvite(token),
    onError: (err) => {
      console.error('[gym-invites] redeemGymInvite failed:', { err })
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ['gyms'] })
        queryClient.invalidateQueries({ queryKey: ['gym-members'] })
      }
    },
  })
}
