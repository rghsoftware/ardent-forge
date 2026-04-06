import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { WeekStatus, WeekStatusValue } from '@/domain/types'

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

const weekStatusesKey = (activationId: string | undefined) => ['week-statuses', activationId]

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

export function useWeekStatuses(activationId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: weekStatusesKey(activationId),
    queryFn: () => getAdapter().getWeekStatuses(activationId!),
    enabled: !!activationId,
  })

  const upsertMutation = useMutation({
    mutationFn: (
      statuses: Array<{
        blockOrdinal: number
        weekNumber: number
        status: WeekStatusValue
      }>,
    ) => getAdapter().upsertWeekStatuses(activationId!, statuses),
    // Optimistic update: merge incoming statuses into the cached list by
    // matching on (blockOrdinal, weekNumber). New entries get synthetic IDs
    // that are replaced when the server response arrives via onSettled.
    onMutate: async (incoming) => {
      await queryClient.cancelQueries({
        queryKey: weekStatusesKey(activationId),
      })

      const previous = queryClient.getQueryData<WeekStatus[]>(weekStatusesKey(activationId))

      if (previous) {
        queryClient.setQueryData<WeekStatus[]>(weekStatusesKey(activationId), (old = []) => {
          const updated = [...old]
          for (const s of incoming) {
            const idx = updated.findIndex(
              (ws) => ws.blockOrdinal === s.blockOrdinal && ws.weekNumber === s.weekNumber,
            )
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], status: s.status }
            } else {
              updated.push({
                id: `optimistic-${s.blockOrdinal}-${s.weekNumber}`,
                activationId: activationId!,
                blockOrdinal: s.blockOrdinal,
                weekNumber: s.weekNumber,
                status: s.status,
                createdAt: new Date().toISOString(),
              })
            }
          }
          return updated
        })
      }

      return { previous }
    },
    onError: (err, _variables, context) => {
      console.error('[week-statuses] Failed to upsert week statuses:', err)
      if (context?.previous) {
        queryClient.setQueryData(weekStatusesKey(activationId), context.previous)
      } else {
        console.warn('[week-statuses] No previous data to rollback to')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: weekStatusesKey(activationId),
      })
    },
  })

  return {
    statuses: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    upsertStatuses: upsertMutation.mutate,
    upsertStatusesAsync: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  }
}
