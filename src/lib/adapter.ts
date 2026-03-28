import { isTauri } from '@tauri-apps/api/core'
import type { DataAdapter } from './data-adapter'
import { SupabaseAdapter } from './supabase-adapter'
import { TauriAdapter } from './tauri-adapter'
import { getSupabaseClient } from './supabase'

let _adapter: DataAdapter | null = null

/**
 * Returns the appropriate DataAdapter based on the runtime environment.
 *
 * - **Tauri mode** (desktop/mobile app): Returns a TauriAdapter that invokes
 *   Rust commands over the Tauri IPC bridge, backed by local SQLite.
 * - **Browser mode** (web-only): Returns a SupabaseAdapter that talks directly
 *   to the Supabase PostgreSQL backend.
 *
 * In Tauri mode before the user signs in via Supabase Auth, 'local-user' is
 * used as a fallback userId so the app works completely offline.
 */
export function getAdapter(userId?: string): DataAdapter {
  if (!_adapter) {
    if (isTauri()) {
      _adapter = new TauriAdapter(userId ?? 'local-user')
    } else {
      _adapter = new SupabaseAdapter(getSupabaseClient())
    }
  }
  return _adapter
}

/**
 * Resets the cached adapter instance. Call this when the user signs in or out
 * so the next `getAdapter()` call creates a fresh adapter with the correct
 * userId / auth state.
 */
export function resetAdapter(): void {
  _adapter = null
}
