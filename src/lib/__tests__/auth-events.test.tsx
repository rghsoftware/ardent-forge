// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Hoisted variables
// ---------------------------------------------------------------------------

const {
  mockIsTauri,
  mockSupabaseAuth,
  mockResetAdapter,
  mockResetRealtimeManager,
  mockInitSync,
  mockStopSync,
  mockSetSyncState,
  mockGetConfig,
  stableSupabaseClient,
} = vi.hoisted(() => {
  const mockIsTauri = vi.fn(() => false)
  const mockResetAdapter = vi.fn()
  const mockResetRealtimeManager = vi.fn()
  const mockInitSync = vi.fn().mockResolvedValue(undefined)
  const mockStopSync = vi.fn().mockResolvedValue(undefined)
  const mockSetSyncState = vi.fn()
  const mockGetConfig = vi.fn()

  const mockSupabaseAuth = {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  }

  const stableSupabaseClient = {
    auth: mockSupabaseAuth,
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  }

  return {
    mockIsTauri,
    mockSupabaseAuth,
    mockResetAdapter,
    mockResetRealtimeManager,
    mockInitSync,
    mockStopSync,
    mockSetSyncState,
    mockGetConfig,
    stableSupabaseClient,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: mockIsTauri,
}))

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  onOpenUrl: vi.fn().mockResolvedValue(vi.fn()),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => stableSupabaseClient,
}))

vi.mock('@/lib/adapter', () => ({
  resetAdapter: mockResetAdapter,
}))

vi.mock('@/lib/realtime-manager', () => ({
  resetRealtimeManager: mockResetRealtimeManager,
}))

vi.mock('@/lib/sync-bridge', () => ({
  initSync: mockInitSync,
  stopSync: mockStopSync,
}))

vi.mock('@/stores/sync-store', () => ({
  useSyncStore: { getState: () => ({ setSyncState: mockSetSyncState }) },
}))

vi.mock('@/lib/config-store', () => ({
  getConfigStore: () => ({ getConfig: mockGetConfig }),
}))

vi.mock('@/lib/deep-link-handler', () => ({
  handleConnectLink: vi.fn(),
}))

// Import after mocks
import { AuthProvider, useAuth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// localStorage polyfill
// ---------------------------------------------------------------------------

const localStorageStore = new Map<string, string>()

beforeEach(() => {
  localStorageStore.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => localStorageStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStorageStore.set(key, value),
      removeItem: (key: string) => localStorageStore.delete(key),
      clear: () => localStorageStore.clear(),
      get length() {
        return localStorageStore.size
      },
      key: (index: number) => [...localStorageStore.keys()][index] ?? null,
    },
    writable: true,
    configurable: true,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: 'user-001',
  email: 'test@example.com',
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: {},
} as User

const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
} as Session

type AuthChangeCallback = (event: AuthChangeEvent, session: Session | null) => Promise<void>
let capturedAuthCallback: AuthChangeCallback

function resetAuthMockDefaults() {
  mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSupabaseAuth.onAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
    capturedAuthCallback = cb
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })

  // Reset the from().upsert() chain
  stableSupabaseClient.from.mockReturnValue({
    upsert: vi.fn().mockResolvedValue({ error: null }),
  })

  mockGetConfig.mockResolvedValue({
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
  })
}

interface AuthHandle {
  user: User | null
  loading: boolean
  isGuest: boolean
}

function TestConsumer({ onReady }: { onReady: (handle: AuthHandle) => void }) {
  const auth = useAuth()
  onReady({ user: auth.user, loading: auth.loading, isGuest: auth.isGuest })
  return null
}

function renderWithProvider() {
  let handle: AuthHandle | undefined

  render(
    <AuthProvider>
      <TestConsumer
        onReady={(h) => {
          handle = h
        }}
      />
    </AuthProvider>,
  )

  return {
    getHandle: () => {
      if (!handle) throw new Error('AuthProvider did not render TestConsumer')
      return handle
    },
  }
}

// ===========================================================================
// Tests
// ===========================================================================

describe('AuthProvider auth events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(false)
    resetAuthMockDefaults()
  })

  // -------------------------------------------------------------------------
  // Session hydration
  // -------------------------------------------------------------------------

  describe('session hydration on mount', () => {
    it('hydrates user from existing session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(getHandle().loading).toBe(false)
      })
      expect(getHandle().user?.id).toBe('user-001')
    })

    it('sets user to null when no session exists', async () => {
      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(getHandle().loading).toBe(false)
      })
      expect(getHandle().user).toBeNull()
    })

    it('handles hydration error gracefully', async () => {
      mockSupabaseAuth.getSession.mockRejectedValue(new Error('Network failure'))

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(getHandle().loading).toBe(false)
      })
      expect(getHandle().user).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // SIGNED_IN event
  // -------------------------------------------------------------------------

  describe('SIGNED_IN event', () => {
    it('calls resetAdapter on sign-in', async () => {
      renderWithProvider()

      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      expect(mockResetAdapter).toHaveBeenCalled()
    })

    it('performs fire-and-forget profile upsert without blocking', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      stableSupabaseClient.from.mockReturnValue({ upsert: upsertMock })

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      // The upsert is fire-and-forget but should still be called
      await waitFor(() => {
        expect(stableSupabaseClient.from).toHaveBeenCalledWith('user_profiles')
        expect(upsertMock).toHaveBeenCalledWith(
          { id: 'user-001', preferred_units: 'IMPERIAL' },
          { onConflict: 'id', ignoreDuplicates: true },
        )
      })
    })

    it('logs error when profile upsert fails but does not throw', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const upsertMock = vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } })
      stableSupabaseClient.from.mockReturnValue({ upsert: upsertMock })

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[auth] Failed to create user profile on sign-in:',
          expect.objectContaining({ message: 'Insert failed' }),
        )
      })

      consoleSpy.mockRestore()
    })

    it('initializes sync engine in Tauri mode', async () => {
      mockIsTauri.mockReturnValue(true)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      await waitFor(() => {
        expect(mockInitSync).toHaveBeenCalledWith(
          'mock-access-token',
          'https://test.supabase.co',
          'test-key',
        )
      })
    })

    it('does not initialize sync engine in web mode', async () => {
      mockIsTauri.mockReturnValue(false)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      // Give async operations time to settle
      await new Promise((r) => setTimeout(r, 50))
      expect(mockInitSync).not.toHaveBeenCalled()
    })

    it('handles missing config gracefully during sync init', async () => {
      mockIsTauri.mockReturnValue(true)
      mockGetConfig.mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[sync] No backend config found, skipping sync init',
        )
      })
      expect(mockInitSync).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  // -------------------------------------------------------------------------
  // SIGNED_OUT event
  // -------------------------------------------------------------------------

  describe('SIGNED_OUT event', () => {
    it('calls resetAdapter and resetRealtimeManager', async () => {
      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_OUT', null)

      expect(mockResetAdapter).toHaveBeenCalled()
      expect(mockResetRealtimeManager).toHaveBeenCalled()
    })

    it('stops sync engine in Tauri mode', async () => {
      mockIsTauri.mockReturnValue(true)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_OUT', null)

      expect(mockStopSync).toHaveBeenCalled()
    })

    it('does not stop sync engine in web mode', async () => {
      mockIsTauri.mockReturnValue(false)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_OUT', null)

      expect(mockStopSync).not.toHaveBeenCalled()
    })

    it('handles stopSync failure gracefully', async () => {
      mockIsTauri.mockReturnValue(true)
      mockStopSync.mockRejectedValue(new Error('Sync cleanup failed'))

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_OUT', null)

      await waitFor(() => {
        expect(mockSetSyncState).toHaveBeenCalledWith('error', 'Failed to stop sync')
      })
    })
  })

  // -------------------------------------------------------------------------
  // TOKEN_REFRESHED event
  // -------------------------------------------------------------------------

  describe('TOKEN_REFRESHED event', () => {
    it('re-initializes sync engine in Tauri mode with fresh token', async () => {
      mockIsTauri.mockReturnValue(true)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      const refreshedSession = {
        ...mockSession,
        access_token: 'refreshed-token',
      } as Session

      await capturedAuthCallback('TOKEN_REFRESHED', refreshedSession)

      await waitFor(() => {
        expect(mockInitSync).toHaveBeenCalledWith(
          'refreshed-token',
          'https://test.supabase.co',
          'test-key',
        )
      })
    })

    it('does not re-initialize sync in web mode', async () => {
      mockIsTauri.mockReturnValue(false)

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('TOKEN_REFRESHED', mockSession)

      await new Promise((r) => setTimeout(r, 50))
      expect(mockInitSync).not.toHaveBeenCalled()
    })

    it('handles sync init failure on token refresh', async () => {
      mockIsTauri.mockReturnValue(true)
      mockGetConfig.mockRejectedValue(new Error('Config read failed'))

      renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('TOKEN_REFRESHED', mockSession)

      await waitFor(() => {
        expect(mockSetSyncState).toHaveBeenCalledWith('error', 'Failed to start sync')
      })
    })
  })

  // -------------------------------------------------------------------------
  // State updates from events
  // -------------------------------------------------------------------------

  describe('auth state updates', () => {
    it('sets user on SIGNED_IN', async () => {
      const { getHandle } = renderWithProvider()
      await waitFor(() => expect(capturedAuthCallback).toBeDefined())

      await capturedAuthCallback('SIGNED_IN', mockSession)

      await waitFor(() => {
        expect(getHandle().user?.id).toBe('user-001')
        expect(getHandle().loading).toBe(false)
        expect(getHandle().isGuest).toBe(false)
      })
    })

    it('clears user on SIGNED_OUT', async () => {
      // Start with a session
      mockSupabaseAuth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { getHandle } = renderWithProvider()
      await waitFor(() => expect(getHandle().user?.id).toBe('user-001'))

      await capturedAuthCallback('SIGNED_OUT', null)

      await waitFor(() => {
        expect(getHandle().user).toBeNull()
      })
    })
  })
})
