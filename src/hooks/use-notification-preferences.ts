import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotificationPreferences, setNotificationPreferences } from '@/lib/notification-service'
import type { NotificationPreferences } from '@/domain/types/notification'

export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  })

  const mutation = useMutation({
    mutationFn: (prefs: NotificationPreferences) => setNotificationPreferences(prefs),
    onError: (err) => {
      console.error('[notification-preferences] Failed to update preferences:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updatePreferences: mutation,
  }
}
