import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { BackendConfig } from './config-store'

let _client: SupabaseClient | null = null

// TODO: Add `createClient<Database>` type parameter once the canonical schema types are generated.

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
  try {
    new URL(config.supabaseUrl)
  } catch {
    throw new Error(
      `[supabase] Invalid Supabase URL: "${config.supabaseUrl}". Provide a valid HTTPS URL.`,
    )
  }
  _client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      detectSessionInUrl: false,
    },
  })
  return _client
}

/**
 * Discards the cached client. Must be paired with a subsequent `initSupabaseFromConfig()` call,
 * since `getSupabaseClient()` will return `null` until a new client is constructed.
 */
export function resetSupabaseClient(): void {
  _client = null
}
