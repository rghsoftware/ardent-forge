import { useQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { ExerciseFilters } from '@/lib/data-adapter'

export function useExercises(filters?: ExerciseFilters) {
  return useQuery({
    queryKey: ['exercises', filters],
    queryFn: () => getAdapter().getExercises(filters),
  })
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: ['exercise', id],
    queryFn: () => getAdapter().getExercise(id),
    enabled: !!id,
  })
}
