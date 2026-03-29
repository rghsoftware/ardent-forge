import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// localStorage mock -- node environment does not provide one
// ---------------------------------------------------------------------------

const storage = new Map<string, string>()

const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeItem: vi.fn((key: string) => {
    storage.delete(key)
  }),
  clear: vi.fn(() => {
    storage.clear()
  }),
  get length() {
    return storage.size
  },
  key: vi.fn((index: number) => {
    const keys = Array.from(storage.keys())
    return keys[index] ?? null
  }),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Module mocks -- declared before imports that reference the real modules
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
}))

vi.mock('../connection-validator', () => ({
  validateConnection: vi.fn(),
}))

// Import after mocks are registered
import { getConfigStore, type BackendConfig } from '../config-store'
import { isTauri } from '@tauri-apps/api/core'
import { validateConnection } from '../connection-validator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ardentforge:config'

const validConfig: BackendConfig = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-key',
}

/** Helper to reset env vars between tests. */
function clearEnvVars() {
  delete import.meta.env.VITE_SUPABASE_URL
  delete import.meta.env.VITE_SUPABASE_PUB_KEY
}

/** Restore localStorage mock implementations to their defaults (after mockImplementation overrides). */
function restoreLocalStorageMocks() {
  vi.mocked(localStorageMock.getItem).mockImplementation((key: string) => storage.get(key) ?? null)
  vi.mocked(localStorageMock.setItem).mockImplementation((key: string, value: string) => {
    storage.set(key, value)
  })
  vi.mocked(localStorageMock.removeItem).mockImplementation((key: string) => {
    storage.delete(key)
  })
}

// ---------------------------------------------------------------------------
// BrowserConfigStore (via getConfigStore in non-Tauri mode)
// ---------------------------------------------------------------------------

describe('BrowserConfigStore', () => {
  let store: ReturnType<typeof getConfigStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    restoreLocalStorageMocks()
    storage.clear()
    // Reset the module-level singleton by re-importing
    vi.resetModules()
    const mod = await import('../config-store')
    store = mod.getConfigStore()
  })

  // 1. getConfig returns null when localStorage is empty
  it('getConfig() returns null when localStorage is empty', async () => {
    const result = await store.getConfig()
    expect(result).toBeNull()
  })

  // 2. getConfig returns stored config after setConfig
  it('getConfig() returns stored config after setConfig()', async () => {
    await store.setConfig(validConfig)
    const result = await store.getConfig()
    expect(result).toEqual(validConfig)
  })

  // 3. getConfig returns null (not throws) on invalid JSON in localStorage
  it('getConfig() returns null on invalid JSON in localStorage', async () => {
    storage.set(STORAGE_KEY, '{not-valid-json!!!')
    const result = await store.getConfig()
    expect(result).toBeNull()
  })

  // 4. getConfig returns null on valid JSON with wrong schema shape
  it('getConfig() returns null on valid JSON with wrong schema shape', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    const result = await store.getConfig()
    expect(result).toBeNull()
  })

  // 5. getConfig clears corrupt entry when it finds invalid data
  it('getConfig() clears corrupt entry when it finds invalid schema data', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
    await store.getConfig()
    expect(storage.has(STORAGE_KEY)).toBe(false)
  })

  // 6. hasConfig returns false initially
  it('hasConfig() returns false initially', async () => {
    const result = await store.hasConfig()
    expect(result).toBe(false)
  })

  // 7. hasConfig returns true after setConfig
  it('hasConfig() returns true after setConfig()', async () => {
    await store.setConfig(validConfig)
    const result = await store.hasConfig()
    expect(result).toBe(true)
  })

  // 8. hasConfig returns false after clearConfig
  it('hasConfig() returns false after clearConfig()', async () => {
    await store.setConfig(validConfig)
    await store.clearConfig()
    const result = await store.hasConfig()
    expect(result).toBe(false)
  })

  // 9. hasConfig returns false when stored data is corrupt
  it('hasConfig() returns false when stored data is corrupt', async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ invalid: true }))
    const result = await store.hasConfig()
    expect(result).toBe(false)
  })

  // 10. setConfig throws descriptive error when localStorage.setItem throws
  it('setConfig() throws descriptive error on QuotaExceededError', async () => {
    const quotaErr = new DOMException('QuotaExceededError', 'QuotaExceededError')
    vi.mocked(localStorageMock.setItem).mockImplementation(() => {
      throw quotaErr
    })

    await expect(store.setConfig(validConfig)).rejects.toThrow(
      /Failed to save config to localStorage/,
    )
  })
})

// ---------------------------------------------------------------------------
// getConfigStore (singleton / factory behavior)
// ---------------------------------------------------------------------------

describe('getConfigStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreLocalStorageMocks()
    storage.clear()
  })

  // 11. Returns a singleton -- same instance on multiple calls
  it('returns a singleton (same instance on multiple calls)', async () => {
    vi.resetModules()
    const mod = await import('../config-store')
    const first = mod.getConfigStore()
    const second = mod.getConfigStore()
    expect(first).toBe(second)
  })

  // 12. Returns BrowserConfigStore when not in Tauri environment
  it('returns BrowserConfigStore when not in Tauri environment', async () => {
    vi.resetModules()
    vi.mocked(isTauri).mockReturnValue(false)
    const mod = await import('../config-store')
    const store = mod.getConfigStore()
    // Verify it behaves as a BrowserConfigStore by testing localStorage interaction
    await store.setConfig(validConfig)
    expect(storage.get(STORAGE_KEY)).not.toBeUndefined()
    const retrieved = await store.getConfig()
    expect(retrieved).toEqual(validConfig)
  })
})

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------

describe('resolveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreLocalStorageMocks()
    storage.clear()
    clearEnvVars()
  })

  afterEach(() => {
    clearEnvVars()
  })

  // 13. Returns stored config without calling validateConnection
  it('returns stored config without calling validateConnection', async () => {
    vi.resetModules()
    const mod = await import('../config-store')
    const store = mod.getConfigStore()
    await store.setConfig(validConfig)

    const result = await mod.resolveConfig()
    expect(result).toEqual(validConfig)
    expect(validateConnection).not.toHaveBeenCalled()
  })

  // 14. Falls back to env var config when store is empty and env vars are set
  it('falls back to env var config when store is empty and env vars are set', async () => {
    vi.resetModules()

    import.meta.env.VITE_SUPABASE_URL = 'https://env.supabase.co'
    import.meta.env.VITE_SUPABASE_PUB_KEY = 'env-anon-key'

    vi.mocked(validateConnection).mockResolvedValue({ status: 'ok' })

    const mod = await import('../config-store')
    const result = await mod.resolveConfig()

    expect(result).toEqual({
      supabaseUrl: 'https://env.supabase.co',
      supabaseKey: 'env-anon-key',
    })
    expect(validateConnection).toHaveBeenCalledWith('https://env.supabase.co', 'env-anon-key')
  })

  // 15. Returns null with warning when env vars fail validation
  it('returns null when env vars fail validation', async () => {
    vi.resetModules()

    import.meta.env.VITE_SUPABASE_URL = 'https://bad.supabase.co'
    import.meta.env.VITE_SUPABASE_PUB_KEY = 'bad-key'

    vi.mocked(validateConnection).mockResolvedValue({
      status: 'unreachable',
      message: 'Could not reach',
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mod = await import('../config-store')
    const result = await mod.resolveConfig()

    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[config]'),
      expect.stringContaining('unreachable'),
      expect.anything(),
    )

    warnSpy.mockRestore()
  })

  // 16. Returns config even when setConfig throws (persistence failure -- I6 fix)
  it('returns config even when setConfig throws (persistence failure)', async () => {
    vi.resetModules()

    import.meta.env.VITE_SUPABASE_URL = 'https://persist-fail.supabase.co'
    import.meta.env.VITE_SUPABASE_PUB_KEY = 'persist-fail-key'

    vi.mocked(validateConnection).mockResolvedValue({ status: 'ok' })

    // Make localStorage.setItem throw to simulate persistence failure
    const quotaErr = new DOMException('QuotaExceededError', 'QuotaExceededError')
    vi.mocked(localStorageMock.setItem).mockImplementation(() => {
      throw quotaErr
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mod = await import('../config-store')
    const result = await mod.resolveConfig()

    // Config should still be returned even though persistence failed
    expect(result).toEqual({
      supabaseUrl: 'https://persist-fail.supabase.co',
      supabaseKey: 'persist-fail-key',
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[config] Failed to persist'),
      expect.anything(),
    )

    warnSpy.mockRestore()
  })
})
