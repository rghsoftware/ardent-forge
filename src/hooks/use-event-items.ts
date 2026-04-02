import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { EventItem } from '@/domain/types'

export function useEventItems(parentId: string | undefined, parentType: 'template' | 'log') {
  return useQuery({
    queryKey: ['event-items', parentId],
    queryFn: () => getAdapter().getEventItems(parentId!, parentType),
    enabled: !!parentId,
  })
}

export function useCreateEventItem(parentId: string, parentType: 'template' | 'log') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'>) =>
      getAdapter().saveEventItem(item, parentId, parentType),
    onError: (err) => {
      console.error('[event-items] Failed to create item:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-items', parentId] })
    },
  })
}

export function useUpdateEventItem(parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (item: EventItem) => getAdapter().updateEventItem(item),
    onError: (err) => {
      console.error('[event-items] Failed to update item:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-items', parentId] })
    },
  })
}

export function useDeleteEventItem(parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => getAdapter().deleteEventItem(itemId),
    onError: (err) => {
      console.error('[event-items] Failed to delete item:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-items', parentId] })
    },
  })
}

export function useToggleEventItemPacked(parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, isPacked }: { itemId: string; isPacked: boolean }) =>
      getAdapter().toggleEventItemPacked(itemId, isPacked),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['event-items', parentId] })
      const previous = queryClient.getQueryData<EventItem[]>(['event-items', parentId])
      if (previous) {
        queryClient.setQueryData<EventItem[]>(
          ['event-items', parentId],
          previous.map((item) =>
            item.id === itemId ? { ...item, isPacked: !item.isPacked } : item,
          ),
        )
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['event-items', parentId], context.previous)
      }
      console.error('[event-items] Failed to toggle packed:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-items', parentId] })
    },
  })
}

export function useReorderEventItems(parentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: Array<{ id: string; sortOrder: number }>) =>
      getAdapter().reorderEventItems(items),
    onMutate: async (reorderedItems) => {
      await queryClient.cancelQueries({ queryKey: ['event-items', parentId] })
      const previous = queryClient.getQueryData<EventItem[]>(['event-items', parentId])
      if (previous) {
        const orderMap = new Map(reorderedItems.map((r) => [r.id, r.sortOrder]))
        queryClient.setQueryData<EventItem[]>(
          ['event-items', parentId],
          previous
            .map((item) => {
              const newOrder = orderMap.get(item.id)
              return newOrder !== undefined ? { ...item, sortOrder: newOrder } : item
            })
            .sort((a, b) => {
              const catCmp = (a.category ?? '').localeCompare(b.category ?? '')
              return catCmp !== 0 ? catCmp : a.sortOrder - b.sortOrder
            }),
        )
      }
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['event-items', parentId], context.previous)
      }
      console.error('[event-items] Failed to reorder:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-items', parentId] })
    },
  })
}

export function useNextUpcomingEvent(userId: string | undefined) {
  return useQuery({
    queryKey: ['next-event', userId],
    queryFn: async () => {
      const adapter = getAdapter()
      // The adapter interface does not support category filtering, so we fetch
      // all templates and filter client-side. A future optimization could add
      // a category parameter to getSessionTemplates or a dedicated query.
      const templates = await adapter.getSessionTemplates(userId!)
      const now = new Date()
      const events = templates
        .filter((t) => t.category === 'EVENT' && t.eventMetadata?.eventDate)
        .map((t) => {
          const diff = new Date(t.eventMetadata!.eventDate!).getTime() - now.getTime()
          const daysUntil = Math.ceil(diff / (1000 * 60 * 60 * 24))
          return { template: t, daysUntil }
        })
        // Include events happening today (daysUntil = 0) and up to 30 days out
        .filter((e) => e.daysUntil >= 0 && e.daysUntil <= 30)
        .sort((a, b) => a.daysUntil - b.daysUntil)
      return events[0] ?? null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
