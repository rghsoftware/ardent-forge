import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { SessionTemplate, ActivityGroup, Activity } from '@/domain/types'

export function useSessionTemplates(userId: string | undefined) {
  return useQuery({
    queryKey: ['session-templates', userId],
    queryFn: () => getAdapter().getSessionTemplates(userId!),
    enabled: !!userId,
  })
}

export function useSessionTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['session-template', id],
    queryFn: () => getAdapter().getSessionTemplate(id!),
    enabled: !!id,
  })
}

export function useSessionTemplateFull(id: string | undefined) {
  return useQuery({
    queryKey: ['session-template-full', id],
    queryFn: () => getAdapter().getSessionTemplateFull(id!),
    enabled: !!id,
  })
}

export function useCreateSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      template,
      groups,
    }: {
      template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>
      groups: Array<{
        group: Omit<ActivityGroup, 'id' | 'activities'>
        activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
      }>
    }) => getAdapter().createSessionTemplateFull(template, groups),
    onError: (err) => {
      console.error('[session-templates] Failed to create template:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session-templates'] })
    },
  })
}

export function useUpdateSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      template,
      groups,
    }: {
      template: SessionTemplate
      groups: Array<{
        group: Omit<ActivityGroup, 'activities'>
        activities: Array<Omit<Activity, 'id' | 'activityGroupId'>>
      }>
    }) => getAdapter().updateSessionTemplateFull(template, groups),
    onError: (err) => {
      console.error('[session-templates] Failed to update template:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['session-templates'] })
      queryClient.invalidateQueries({
        queryKey: ['session-template-full', variables.template.id],
      })
    },
  })
}

export function useCloneSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      getAdapter().cloneSessionTemplate(id, userId),
    onError: (err) => {
      console.error('[session-templates] Failed to clone:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session-templates'] })
    },
  })
}

export function useTouchSessionTemplateLastAssigned() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().touchSessionTemplateLastAssigned(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session-templates'] })
    },
  })
}

export function useDeleteSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().deleteSessionTemplate(id),
    onError: (err) => {
      console.error('[session-templates] Failed to delete template:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['session-templates'] })
    },
  })
}
