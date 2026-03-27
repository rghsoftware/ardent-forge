import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

// TODO: Add `createClient<Database>` type parameter once `supabase gen types typescript`
// has been run against a live Supabase instance.

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUB_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
        'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUB_KEY are set in .env.local',
    )
  }

  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error(
      `VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}". ` +
        'Expected format: "https://<project-ref>.supabase.co".',
    )
  }

  try {
    _client = createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    throw new Error(
      'Failed to initialize Supabase client. Verify VITE_SUPABASE_URL and VITE_SUPABASE_PUB_KEY in .env.local are correct.',
      { cause: error },
    )
  }
  return _client
}
