import { isTauri, invoke } from '@tauri-apps/api/core'
import { validateConnection } from './connection-validator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BackendConfig = {
  supabaseUrl: string
  supabaseKey: string
}

export interface ConfigStore {
  getConfig(): Promise<BackendConfig | null>
  setConfig(config: BackendConfig): Promise<void>
  clearConfig(): Promise<void>
  hasConfig(): Promise<boolean>
}

// ---------------------------------------------------------------------------
// Browser implementation (localStorage)
// ---------------------------------------------------------------------------

const BROWSER_STORAGE_KEY = 'ardentforge:config'

class BrowserConfigStore implements ConfigStore {
  async getConfig(): Promise<BackendConfig | null> {
    const raw = localStorage.getItem(BROWSER_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as BackendConfig
    } catch {
      return null
    }
  }

  async setConfig(config: BackendConfig): Promise<void> {
    localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config))
  }

  async clearConfig(): Promise<void> {
    localStorage.removeItem(BROWSER_STORAGE_KEY)
  }

  async hasConfig(): Promise<boolean> {
    return localStorage.getItem(BROWSER_STORAGE_KEY) !== null
  }
}

// ---------------------------------------------------------------------------
// Tauri implementation (SQLite app_config table via Rust commands)
// ---------------------------------------------------------------------------

const TAURI_CONFIG_KEY = 'backend_config'

class TauriConfigStore implements ConfigStore {
  async getConfig(): Promise<BackendConfig | null> {
    const raw = await invoke<string | null>('get_app_config', { key: TAURI_CONFIG_KEY })
    if (!raw) return null
    try {
      return JSON.parse(raw) as BackendConfig
    } catch {
      return null
    }
  }

  async setConfig(config: BackendConfig): Promise<void> {
    await invoke('set_app_config', {
      key: TAURI_CONFIG_KEY,
      value: JSON.stringify(config),
    })
  }

  async clearConfig(): Promise<void> {
    await invoke('clear_app_config', { key: TAURI_CONFIG_KEY })
  }

  async hasConfig(): Promise<boolean> {
    const raw = await invoke<string | null>('get_app_config', { key: TAURI_CONFIG_KEY })
    return raw !== null
  }
}

// ---------------------------------------------------------------------------
// Factory (singleton)
// ---------------------------------------------------------------------------

let _store: ConfigStore | null = null

export function getConfigStore(): ConfigStore {
  if (!_store) {
    _store = isTauri() ? new TauriConfigStore() : new BrowserConfigStore()
  }
  return _store
}

// ---------------------------------------------------------------------------
// resolveConfig -- called once at app startup
//
// Resolution order: local store -> env vars -> null
// If env vars are found and not yet persisted, validate them, persist on
// success, and return the config. This is the "smart defaults" flow.
// ---------------------------------------------------------------------------

export async function resolveConfig(): Promise<BackendConfig | null> {
  const store = getConfigStore()

  // 1. Check local store first (CF-4: persisted config takes precedence)
  const stored = await store.getConfig()
  if (stored) return stored

  // 2. Fall back to build-time env vars
  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const envKey = import.meta.env.VITE_SUPABASE_PUB_KEY?.trim()

  if (!envUrl || !envKey) return null

  // 3. Validate env var defaults before persisting (CF-5)
  const result = await validateConnection(envUrl, envKey)
  if (result.status !== 'ok') return null

  // 4. Persist validated defaults so they are used on subsequent launches
  const config: BackendConfig = { supabaseUrl: envUrl, supabaseKey: envKey }
  await store.setConfig(config)
  return config
}
