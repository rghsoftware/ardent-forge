import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { getSupabaseClient } from '@/lib/supabase'
import type { ShareableEntityType, ShareLink } from '@/domain/types'
import type { ProgramFull } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useShareLinks(userId?: string) {
  return useQuery({
    queryKey: ['share-links', userId],
    queryFn: () => getAdapter().getShareLinks(userId!),
    enabled: !!userId,
  })
}

export function useShareLinksForEntity(entityType: ShareableEntityType, entityId?: string) {
  return useQuery({
    queryKey: ['share-links', entityType, entityId],
    queryFn: () => getAdapter().getShareLinksForEntity(entityType, entityId!),
    enabled: !!entityId,
  })
}

/**
 * Resolves a share link by token via Supabase RPC.
 * This is a PUBLIC query -- it calls Supabase directly (not via the adapter)
 * because the viewer may be unauthenticated.
 */
export function useResolveShareLink(token: string) {
  return useQuery({
    queryKey: ['share-link', token],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('No Supabase client')
      const { data, error } = await client.rpc('resolve_share_link', { lookup_token: token })
      if (error) throw error
      return data as {
        id: string
        token: string
        entity_type: ShareableEntityType
        entity_id: string
        is_active: boolean
        created_at: string
      } | null
    },
    enabled: !!token,
  })
}

/**
 * Fetches full program data for a shared link via Supabase RPC.
 * PUBLIC -- no auth required.
 */
export function useSharedProgram(token: string) {
  return useQuery({
    queryKey: ['shared-program', token],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('No Supabase client')
      const { data, error } = await client.rpc('get_shared_program', { lookup_token: token })
      if (error) throw error
      return data
    },
    enabled: !!token,
  })
}

/**
 * Fetches full workout log data for a shared link via Supabase RPC.
 * PUBLIC -- no auth required.
 */
export function useSharedWorkout(token: string) {
  return useQuery({
    queryKey: ['shared-workout', token],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('No Supabase client')
      const { data, error } = await client.rpc('get_shared_workout', { lookup_token: token })
      if (error) throw error
      return data
    },
    enabled: !!token,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (link: Omit<ShareLink, 'id' | 'createdAt' | 'updatedAt'>) =>
      getAdapter().createShareLink(link),
    onError: (err) => {
      console.error('[share-links] Failed to create share link:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

export function useRevokeShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().revokeShareLink(id),
    onError: (err) => {
      console.error('[share-links] Failed to revoke share link:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

export function useDeleteShareLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().deleteShareLink(id),
    onError: (err) => {
      console.error('[share-links] Failed to delete share link:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['share-links'] })
    },
  })
}

/**
 * Clones a shared program into the authenticated user's account.
 * Strips all IDs from the source program hierarchy so the adapter generates new UUIDs.
 * Sets the source to 'SHARED' to indicate the program was cloned from a share link.
 */
export function useCloneProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ program, userId }: { program: ProgramFull; userId: string }) => {
      const adapter = getAdapter()
      return adapter.createProgramFull(
        {
          userId,
          name: program.program.name,
          description: program.program.description,
          source: 'SHARED',
          durationWeeks: program.program.durationWeeks,
          isPublic: false,
          createdBy: userId,
        },
        program.blocks.map((block) => ({
          block: {
            name: block.name,
            ordinal: block.ordinal,
            durationWeeks: block.durationWeeks,
            blockType: block.blockType,
          },
          weeks: program.blockWeeks
            .filter((bw) => bw.blockId === block.id)
            .map((week) => ({
              week: { weekNumber: week.weekNumber },
              sessions: program.scheduledSessions
                .filter((ss) => ss.blockWeekId === week.id)
                .map((ss) => ({
                  dayOfWeek: ss.dayOfWeek,
                  dayLabel: ss.dayLabel,
                  sessionType: ss.sessionType,
                  sessionTemplateId: ss.sessionTemplateId,
                  notes: ss.notes,
                })),
            })),
        })),
      )
    },
    onError: (err) => {
      console.error('[share-links] Failed to clone program:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}
