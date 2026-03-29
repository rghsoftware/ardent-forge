// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import type { AuthError } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Hoisted variables -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockIsTauri, mockOnOpenUrl, mockSupabaseAuth, stableSupabaseClient } = vi.hoisted(() => {
  const mockIsTauri = vi.fn(() => false)
  const mockOnOpenUrl = vi.fn().mockResolvedValue(vi.fn())

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

  // Stable reference so AuthProvider's useEffect dependency on `supabase`
  // does not trigger infinite re-render loops.
  const stableSupabaseClient = { auth: mockSupabaseAuth, from: vi.fn() }

  return { mockIsTauri, mockOnOpenUrl, mockSupabaseAuth, stableSupabaseClient }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: mockIsTauri,
}))

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  onOpenUrl: mockOnOpenUrl,
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => stableSupabaseClient,
}))

vi.mock('@/lib/adapter', () => ({
  resetAdapter: vi.fn(),
}))

vi.mock('@/lib/sync-bridge', () => ({
  initSync: vi.fn(),
  stopSync: vi.fn(),
}))

vi.mock('@/stores/sync-store', () => ({
  useSyncStore: { getState: vi.fn(() => ({ setSyncState: vi.fn() })) },
}))

// Import after mocks are registered
import { AuthProvider, useAuth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// localStorage polyfill for Node.js 25+.
// Node 25 exposes a native localStorage global but getItem/setItem/removeItem
// are undefined unless --localstorage-file is provided. happy-dom should
// override this, but in practice the native object can shadow it. We provide
// a simple in-memory stub to guarantee the Storage API is available.
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
// Resets auth mock defaults to their happy-path values.
// ---------------------------------------------------------------------------
function resetAuthMockDefaults() {
  mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: { id: 'mock-user-001', email: 'test@example.com' } },
    error: null,
  })
  mockSupabaseAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mockSupabaseAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null })
  mockSupabaseAuth.signUp.mockResolvedValue({ data: {}, error: null })
  mockSupabaseAuth.signOut.mockResolvedValue({ error: null })
  mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: 'https://mock-oauth-url.example.com' },
    error: null,
  })
  mockSupabaseAuth.exchangeCodeForSession.mockResolvedValue({
    data: { session: null, user: null },
    error: null,
  })
  mockSupabaseAuth.resetPasswordForEmail.mockResolvedValue({ error: null })
}

// ---------------------------------------------------------------------------
// Test helper: renders AuthProvider and captures the signInWithGoogle function
// ---------------------------------------------------------------------------

interface AuthHandle {
  signInWithGoogle: () => Promise<{ error?: AuthError }>
}

function TestConsumer({ onReady }: { onReady: (handle: AuthHandle) => void }) {
  const auth = useAuth()
  onReady({ signInWithGoogle: auth.signInWithGoogle })
  return null
}

function renderWithProvider(): { getHandle: () => AuthHandle } {
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

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(false)
    mockOnOpenUrl.mockResolvedValue(vi.fn())
    resetAuthMockDefaults()

    vi.spyOn(window, 'open').mockReturnValue({} as Window)

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...window.location, origin: 'http://localhost:3000' },
    })
  })

  // -----------------------------------------------------------------------
  // Tauri mode tests
  // -----------------------------------------------------------------------

  describe('Tauri mode', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true)
    })

    it('calls signInWithOAuth with skipBrowserRedirect and deep-link redirectTo', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://accounts.google.com/oauth' },
        error: null,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'ardentforge://auth/callback',
          skipBrowserRedirect: true,
        },
      })

      expect(result!.error).toBeUndefined()
    })

    it('calls window.open with the returned URL', async () => {
      const oauthUrl = 'https://accounts.google.com/oauth?state=abc'
      mockSupabaseAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: oauthUrl },
        error: null,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      await act(async () => {
        await getHandle().signInWithGoogle()
      })

      expect(window.open).toHaveBeenCalledWith(oauthUrl, '_blank')
    })

    it('returns error when data.url is missing', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: null },
        error: null,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(result!.error).toBeDefined()
      expect(result!.error!.message).toContain('Unable to start Google sign-in')
    })

    it('returns error when deepLinkFailed is true (setup failure)', async () => {
      mockOnOpenUrl.mockRejectedValueOnce(new Error('Deep link plugin unavailable'))

      // Wrap render + full async chain (call -> rejection -> setDeepLinkFailed) in one act
      // so the state update does not fire outside act boundaries.
      let getHandle!: () => AuthHandle
      await act(async () => {
        const rendered = renderWithProvider()
        getHandle = rendered.getHandle
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
      })

      let result!: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(result.error).toBeDefined()
      expect(result.error!.message).toContain('Google sign-in is unavailable')
      expect(mockSupabaseAuth.signInWithOAuth).not.toHaveBeenCalled()
    })

    it('returns error when window.open is blocked (returns null)', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://accounts.google.com/oauth' },
        error: null,
      })

      vi.spyOn(window, 'open').mockReturnValue(null)

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(result!.error).toBeDefined()
      expect(result!.error!.message).toContain('Browser blocked the sign-in window')
    })
  })

  // -----------------------------------------------------------------------
  // Web mode tests
  // -----------------------------------------------------------------------

  describe('Web mode', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(false)
    })

    it('calls signInWithOAuth with origin-based redirectTo and no skipBrowserRedirect', async () => {
      mockSupabaseAuth.signInWithOAuth.mockResolvedValueOnce({
        data: { provider: 'google', url: 'https://accounts.google.com/oauth' },
        error: null,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      })

      const callArgs = mockSupabaseAuth.signInWithOAuth.mock.calls[0][0]
      expect(callArgs.options).not.toHaveProperty('skipBrowserRedirect')

      expect(result!.error).toBeUndefined()
    })
  })

  // -----------------------------------------------------------------------
  // Error propagation (both modes)
  // -----------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates signInWithOAuth error in Tauri mode', async () => {
      mockIsTauri.mockReturnValue(true)

      const oauthError = { message: 'OAuth provider unavailable', status: 500 }
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: oauthError,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(result!.error).toBe(oauthError)
    })

    it('propagates signInWithOAuth error in Web mode', async () => {
      mockIsTauri.mockReturnValue(false)

      const oauthError = { message: 'OAuth provider unavailable', status: 500 }
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: oauthError,
      })

      const { getHandle } = renderWithProvider()

      await waitFor(() => {
        expect(mockSupabaseAuth.getSession).toHaveBeenCalled()
      })

      let result: { error?: AuthError }
      await act(async () => {
        result = await getHandle().signInWithGoogle()
      })

      expect(result!.error).toBe(oauthError)
    })
  })
})
