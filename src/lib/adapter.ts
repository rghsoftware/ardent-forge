import type { DataAdapter } from './data-adapter'
import { SupabaseAdapter } from './supabase-adapter'
import { getSupabaseClient } from './supabase'

let _adapter: DataAdapter | null = null

// Phase 0: always Supabase. Phase 1 (Step 8): detect Tauri environment and return TauriAdapter.
export function getAdapter(): DataAdapter {
  if (!_adapter) {
    _adapter = new SupabaseAdapter(getSupabaseClient())
  }
  return _adapter
}
