import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { toast } from 'sonner'
import type { ExerciseFilters } from '@/lib/data-adapter'
import type { Exercise } from '@/domain/types'

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
    enabled: !!id && id.length > 0,
  })
}

export function useCreateExercise() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (exercise: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'>) =>
      getAdapter().createExercise(exercise),
    onError: (err) => {
      console.error('[exercises] Failed to create exercise:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}

export function useRecentlyUsedExercises(userId: string | undefined) {
  return useQuery({
    queryKey: ['exercises', 'recently-used', userId],
    queryFn: async () => {
      const adapter = getAdapter()
      const ids = await adapter.getRecentlyUsedExerciseIds(userId!, 10)
      if (ids.length === 0) return []
      // Fetch all exercises and filter to just the recently used ones
      const exercises = await adapter.getExercises()
      return ids
        .map((id) => exercises.find((e) => e.id === id))
        .filter((e): e is Exercise => e !== undefined)
    },
    enabled: !!userId,
  })
}

export function useExerciseWorkoutHistory(
  userId: string | undefined,
  exerciseId: string | undefined,
  limit = 10,
) {
  return useQuery({
    queryKey: ['exercise-workout-history', userId, exerciseId, limit],
    queryFn: () => getAdapter().getExerciseWorkoutHistory(userId!, exerciseId!, limit),
    enabled: !!userId && !!exerciseId,
  })
}

export function usePublishExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (exerciseId: string) => getAdapter().publishExercise(exerciseId),
    onError: (err) => {
      console.error('[exercises] Failed to publish exercise:', err)
      toast('Failed to publish exercise. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}

export function useUnpublishExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (exerciseId: string) => getAdapter().unpublishExercise(exerciseId),
    onError: (err) => {
      console.error('[exercises] Failed to unpublish exercise:', err)
      toast('Failed to unpublish exercise. Please try again.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
    },
  })
}
