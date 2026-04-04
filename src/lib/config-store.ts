import { z } from 'zod'
import { isTauri, invoke } from '@tauri-apps/api/core'
import { validateConnection } from './connection-validator'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const backendConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseKey: z.string().min(1),
})

export type BackendConfig = z.infer<typeof backendConfigSchema>

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
      const parsed = backendConfigSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        console.warn('[config-store] Corrupt config found, clearing:', raw?.slice(0, 50))
        this.clearConfig()
        return null
      }
      return parsed.data
    } catch (err) {
      console.error('[config-store] Failed to parse stored config:', err)
      return null
    }
  }

  async setConfig(config: BackendConfig): Promise<void> {
    try {
      localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(config))
    } catch (err) {
      throw new Error(
        'Failed to save config to localStorage: ' +
          (err instanceof Error ? err.message : 'Unknown error'),
      )
    }
  }

  async clearConfig(): Promise<void> {
    localStorage.removeItem(BROWSER_STORAGE_KEY)
  }

  async hasConfig(): Promise<boolean> {
    const raw = localStorage.getItem(BROWSER_STORAGE_KEY)
    if (!raw) return false
    try {
      return backendConfigSchema.safeParse(JSON.parse(raw)).success
    } catch (err) {
      console.error('[config-store] Failed to validate stored config:', err)
      return false
    }
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
      const parsed = backendConfigSchema.safeParse(JSON.parse(raw))
      if (!parsed.success) {
        console.warn('[config-store] Corrupt config found, clearing:', raw?.slice(0, 50))
        this.clearConfig()
        return null
      }
      return parsed.data
    } catch (err) {
      console.error('[config-store] Failed to parse stored config:', err)
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

  // 3. Validate env var defaults before persisting (CF-5: validate before persist)
  const result = await validateConnection(envUrl, envKey)
  if (result.status !== 'ok') {
    console.warn(
      '[config] Env vars found but validation failed:',
      result.status,
      (result as { message?: string }).message,
    )
    return null
  }

  // 4. Persist validated defaults so they are used on subsequent launches
  const config: BackendConfig = { supabaseUrl: envUrl, supabaseKey: envKey }
  try {
    await store.setConfig(config)
  } catch (err) {
    console.warn('[config] Failed to persist validated env-var config:', err)
    // still return the config -- it's valid, just not persisted
  }
  return config
}
