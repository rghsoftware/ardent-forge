import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase'

/**
 * Fetches a user's display name for author attribution on public content.
 * Reads through the `user_profiles_public_display_name` RLS policy, which
 * permits any authenticated user to read display_name from any profile.
 * (F018 dropped the prior `display_visible = true` filter when gym
 * membership replaced the per-user opt-in flag.)
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
        // PGRST116 = row not found
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
