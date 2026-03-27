import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { UserProfile, OneRepMaxHistory } from '@/domain/types'

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getAdapter().getUserProfile(userId),
    enabled: !!userId && userId.length > 0,
  })
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (profile: Partial<UserProfile> & { id: string }) =>
      getAdapter().updateUserProfile(profile),
    onError: (err) => {
      console.error('[profile] Failed to update profile:', err)
    },
    onSettled: (_data, _err, profile) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] })
    },
  })
}

export function useSaveOneRepMax() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entry: Omit<OneRepMaxHistory, 'id' | 'createdAt' | 'updatedAt'>) =>
      getAdapter().saveOneRepMax(entry),
    onError: (err) => {
      console.error('[profile] Failed to save 1RM:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['one-rep-max-history'] })
    },
  })
}

export function useOneRepMaxHistory(userId: string | undefined, exerciseId: string | undefined) {
  return useQuery({
    queryKey: ['one-rep-max-history', userId, exerciseId],
    queryFn: () => getAdapter().getOneRepMaxHistory(userId!, exerciseId!),
    enabled: !!userId && !!exerciseId,
  })
}
