import { useQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { useExercises } from '@/hooks/use-exercises'
import type { Exercise } from '@/domain/types'

const FREQUENT_LIMIT = 8
const FREQUENT_WINDOW_DAYS = 90
const STALE_TIME = 5 * 60 * 1000 // 5 minutes

export function useFrequentExercises(userId: string | undefined) {
  const { data: allExercises = [] } = useExercises()

  return useQuery({
    queryKey: ['exercises', 'frequent', userId],
    queryFn: async (): Promise<Exercise[]> => {
      if (!userId) return []
      const adapter = getAdapter()
      const ids = await adapter.getFrequentExerciseIds(userId, FREQUENT_LIMIT, FREQUENT_WINDOW_DAYS)
      const exerciseMap = new Map(allExercises.map((e) => [e.id, e]))
      return ids.flatMap((id) => {
        const ex = exerciseMap.get(id)
        return ex ? [ex] : []
      })
    },
    enabled: !!userId && allExercises.length > 0,
    staleTime: STALE_TIME,
  })
}
