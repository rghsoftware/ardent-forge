import type { DataAdapter } from './data-adapter'
import { SupabaseAdapter } from './supabase-adapter'
import { getSupabaseClient } from './supabase'

let _adapter: DataAdapter | null = null

// Returns SupabaseAdapter for browser-only mode. When Tauri is integrated (Step 8), this factory
// will detect the runtime environment and return the appropriate adapter.
export function getAdapter(): DataAdapter {
  if (!_adapter) {
    _adapter = new SupabaseAdapter(getSupabaseClient())
  }
  return _adapter
}
