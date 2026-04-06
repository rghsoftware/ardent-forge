import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

/**
 * Fetches a user's display name for author attribution on public content.
 * Requires the `user_profiles_public_display_name` RLS policy so that
 * authenticated users can read display_name for profiles with display_visible = true.
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profiles', 'display-name', userId],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) {
        console.error('[use-profile] Supabase client not initialized')
        return null
      }

      const { data, error } = await client
        .from('user_profiles')
        .select('display_name')
        .eq('id', userId!)
        .single()

      if (error) {
        // PGRST116 = row not found -- user may not have display_visible enabled
        if (error.code === 'PGRST116') return null
        console.error('[use-profile] Failed to fetch display name:', error)
        throw error
      }

      return data?.display_name as string | null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes -- display names rarely change
  })
}
