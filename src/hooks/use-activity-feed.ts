import { useInfiniteQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'

const FEED_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Infinite query hooks (cursor-based pagination)
// ---------------------------------------------------------------------------

export function useGroupActivityFeed(groupId: string) {
  return useInfiniteQuery({
    queryKey: ['activity-feed', 'group', groupId],
    queryFn: ({ pageParam }) =>
      getAdapter().getGroupActivityFeed(groupId, {
        before: pageParam as string | undefined,
        limit: FEED_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < FEED_PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.startedAt
    },
    enabled: !!groupId,
  })
}

export function useConnectionActivityFeed() {
  return useInfiniteQuery({
    queryKey: ['activity-feed', 'connections'],
    queryFn: ({ pageParam }) =>
      getAdapter().getConnectionActivityFeed({
        before: pageParam as string | undefined,
        limit: FEED_PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < FEED_PAGE_SIZE) return undefined
      return lastPage[lastPage.length - 1]?.startedAt
    },
  })
}
