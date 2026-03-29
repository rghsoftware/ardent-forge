// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import type { AuthError } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Hoisted variables -- available inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockIsTauri } = vi.hoisted(() => {
  const mockIsTauri = vi.fn(() => false)
  return { mockIsTauri }
})

// ---------------------------------------------------------------------------
// Module mocks -- getSupabaseClient returns null to simulate no backend config
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: mockIsTauri,
}))

vi.mock('@tauri-apps/plugin-deep-link', () => ({
  onOpenUrl: vi.fn().mockResolvedValue(vi.fn()),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => null,
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
// Test helper: renders AuthProvider and captures auth context methods/state
// ---------------------------------------------------------------------------

interface AuthHandle {
  signIn: (email: string, password: string) => Promise<{ error?: AuthError }>
  signUp: (email: string, password: string) => Promise<{ error?: AuthError }>
  signOut: () => Promise<{ error?: AuthError }>
  loading: boolean
}

function TestConsumer({ onReady }: { onReady: (handle: AuthHandle) => void }) {
  const auth = useAuth()
  onReady({
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: auth.signOut,
    loading: auth.loading,
  })
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
// Tests: Auth null-guard paths (no Supabase client configured)
// ===========================================================================

describe('Auth null-guard paths (no backend configured)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(false)
  })

  it('signIn returns error with "No backend configured" when client is null', async () => {
    const { getHandle } = renderWithProvider()

    let result: { error?: AuthError }
    await act(async () => {
      result = await getHandle().signIn('user@example.com', 'password123')
    })

    expect(result!.error).toBeDefined()
    expect(result!.error!.message).toContain('No backend configured')
  })

  it('signUp returns error with "No backend configured" when client is null', async () => {
    const { getHandle } = renderWithProvider()

    let result: { error?: AuthError }
    await act(async () => {
      result = await getHandle().signUp('user@example.com', 'password123')
    })

    expect(result!.error).toBeDefined()
    expect(result!.error!.message).toContain('No backend configured')
  })

  it('signOut returns no error when client is null (user is already signed out)', async () => {
    const { getHandle } = renderWithProvider()

    let result: { error?: AuthError }
    await act(async () => {
      result = await getHandle().signOut()
    })

    expect(result!.error).toBeUndefined()
  })

  it('AuthProvider sets loading to false immediately when client is null', async () => {
    const { getHandle } = renderWithProvider()

    await waitFor(() => {
      expect(getHandle().loading).toBe(false)
    })
  })
})
