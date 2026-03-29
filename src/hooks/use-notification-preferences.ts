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
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: ['notification-preferences'] })
      const previous = queryClient.getQueryData<NotificationPreferences>([
        'notification-preferences',
      ])
      queryClient.setQueryData(['notification-preferences'], newPrefs)
      return { previous }
    },
    onError: (err, _vars, context) => {
      console.error('[notification-preferences] Failed to update preferences:', err)
      if (context?.previous) {
        queryClient.setQueryData(['notification-preferences'], context.previous)
      }
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
