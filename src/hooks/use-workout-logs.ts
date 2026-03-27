import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { WorkoutLog, LoggedActivityGroup, LoggedActivity, LoggedSet } from '@/domain/types'

export function useWorkoutLogs(userId: string, limit?: number) {
  return useQuery({
    queryKey: ['workouts', userId, limit],
    queryFn: () => getAdapter().getWorkoutLogs(userId, limit),
    enabled: !!userId,
  })
}

export function useWorkoutLog(id: string) {
  return useQuery({
    queryKey: ['workout', id],
    queryFn: () => getAdapter().getWorkoutLog(id),
    enabled: !!id,
  })
}

export function useWorkoutLogFull(id: string) {
  return useQuery({
    queryKey: ['workout-full', id],
    queryFn: () => getAdapter().getWorkoutLogFull(id),
    enabled: !!id,
  })
}

export function useCreateWorkoutLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (log: Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'>) =>
      getAdapter().createWorkoutLog(log),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
    },
  })
}

export function useUpdateWorkoutLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (log: WorkoutLog) => getAdapter().updateWorkoutLog(log),
    onSettled: (_data, _err, log) => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['workout', log.id] })
      queryClient.invalidateQueries({ queryKey: ['workout-full', log.id] })
    },
  })
}

export function useDeleteWorkoutLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().deleteWorkoutLog(id),
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['workout', id] })
      queryClient.invalidateQueries({ queryKey: ['workout-full', id] })
    },
  })
}

export function useCreateLoggedActivityGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ group, userId }: { group: Omit<LoggedActivityGroup, 'id'>; userId: string }) =>
      getAdapter().createLoggedActivityGroup(group, userId),
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['workout-full', variables.group.workoutLogId],
      })
    },
  })
}

export function useCreateLoggedActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ activity, userId }: { activity: Omit<LoggedActivity, 'id'>; userId: string }) =>
      getAdapter().createLoggedActivity(activity, userId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-full'] })
    },
  })
}

type WorkoutLogFull = {
  log: WorkoutLog
  groups: LoggedActivityGroup[]
  activities: LoggedActivity[]
  sets: LoggedSet[]
}

export function useCreateLoggedSet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (set: Omit<LoggedSet, 'id'> & { workoutLogId: string; userId: string }) =>
      getAdapter().createLoggedSet(set, set.userId),
    onMutate: async (newSet) => {
      await queryClient.cancelQueries({ queryKey: ['workout-full', newSet.workoutLogId] })
      const previous = queryClient.getQueryData<WorkoutLogFull>([
        'workout-full',
        newSet.workoutLogId,
      ])
      queryClient.setQueryData<WorkoutLogFull>(['workout-full', newSet.workoutLogId], (old) => {
        if (!old) return old
        return { ...old, sets: [...old.sets, { ...newSet, id: 'temp-' + Date.now() }] }
      })
      return { previous }
    },
    onError: (err, newSet, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['workout-full', newSet.workoutLogId], context.previous)
      }
      console.error('[workout] Failed to save set, rolling back:', err)
    },
    onSettled: (_data, _err, newSet) => {
      queryClient.invalidateQueries({ queryKey: ['workout-full', newSet.workoutLogId] })
    },
  })
}

export function useUpdateLoggedSet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (set: LoggedSet & { workoutLogId: string; userId: string }) =>
      getAdapter().updateLoggedSet(set, set.userId),
    onMutate: async (updatedSet) => {
      await queryClient.cancelQueries({ queryKey: ['workout-full', updatedSet.workoutLogId] })
      const previous = queryClient.getQueryData<WorkoutLogFull>([
        'workout-full',
        updatedSet.workoutLogId,
      ])
      queryClient.setQueryData<WorkoutLogFull>(['workout-full', updatedSet.workoutLogId], (old) => {
        if (!old) return old
        return {
          ...old,
          sets: old.sets.map((s) => (s.id === updatedSet.id ? updatedSet : s)),
        }
      })
      return { previous }
    },
    onError: (err, updatedSet, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['workout-full', updatedSet.workoutLogId], context.previous)
      }
      console.error('[workout] Failed to save set, rolling back:', err)
    },
    onSettled: (_data, _err, updatedSet) => {
      queryClient.invalidateQueries({ queryKey: ['workout-full', updatedSet.workoutLogId] })
    },
  })
}
