import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BackendConfig } from './config-store'

let _client: SupabaseClient | null = null

// TODO: Add `createClient<Database>` type parameter once `supabase gen types typescript`
// has been run against a live Supabase instance.

/**
 * Returns the cached Supabase client, or null if not yet initialized.
 * Call `initSupabaseFromConfig()` first (typically in main.tsx at startup).
 */
export function getSupabaseClient(): SupabaseClient | null {
  return _client
}

/**
 * Constructs and caches a Supabase client from the given config.
 * Returns the newly created client.
 */
export function initSupabaseFromConfig(config: BackendConfig): SupabaseClient {
  _client = createClient(config.supabaseUrl, config.supabaseKey)
  return _client
}

/**
 * Discards the cached client. Call this when the backend configuration
 * changes so the next `initSupabaseFromConfig()` creates a fresh client.
 */
export function resetSupabaseClient(): void {
  _client = null
}
