import { useQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'

/**
 * Fetch a full session template (template, groups, activities, event items).
 * Shared by WorkoutPreviewSheet and SessionTemplatePreview so they hit the
 * same query cache.
 */
export function useSessionTemplateFull(id: string | null) {
  return useQuery({
    queryKey: ['session-template-full', id],
    queryFn: () => {
      if (!id) return Promise.resolve(null)
      return getAdapter().getSessionTemplateFull(id)
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
