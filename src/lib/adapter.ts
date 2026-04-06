import { isTauri } from '@tauri-apps/api/core'
import type { DataAdapter } from './data-adapter'
import { SupabaseAdapter } from './supabase-adapter'
import { TauriAdapter } from './tauri-adapter'
import { getSupabaseClient } from './supabase'
import { GUEST_USER_ID } from './auth'

let _adapter: DataAdapter | null = null

/**
 * Returns the appropriate DataAdapter based on the runtime environment.
 *
 * - **Tauri mode** (mobile app): Returns a TauriAdapter that invokes
 *   Rust commands over the Tauri IPC bridge, backed by local SQLite.
 * - **Browser mode** (web-only): Returns a SupabaseAdapter that talks directly
 *   to the Supabase PostgreSQL backend.
 *
 * In Tauri mode before the user signs in via Supabase Auth, GUEST_USER_ID is
 * used as a fallback userId so the app works completely offline.
 */
export function getAdapter(userId?: string): DataAdapter {
  if (!_adapter) {
    if (isTauri()) {
      // In offline/guest mode, GUEST_USER_ID serves as the owner for all data.
      // Call resetAdapter() after auth to switch to the real user ID.
      _adapter = new TauriAdapter(userId ?? GUEST_USER_ID)
    } else {
      const client = getSupabaseClient()
      if (!client) {
        throw new Error(
          'Cannot create SupabaseAdapter: no backend configured. ' +
            'The route guard should have redirected to /setup.',
        )
      }
      _adapter = new SupabaseAdapter(client)
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
