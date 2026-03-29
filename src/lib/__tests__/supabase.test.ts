import { vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js -- vi.hoisted ensures the mock fn is available
// when the vi.mock factory runs (vi.mock calls are hoisted above imports).
// ---------------------------------------------------------------------------

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

// Import module under test after mocks are registered
import { getSupabaseClient, initSupabaseFromConfig, resetSupabaseClient } from '@/lib/supabase'

// ===========================================================================
// Supabase client lifecycle
// ===========================================================================

describe('supabase client lifecycle', () => {
  beforeEach(() => {
    resetSupabaseClient()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. getSupabaseClient() returns null before init
  // -------------------------------------------------------------------------
  it('returns null before initSupabaseFromConfig is called', () => {
    expect(getSupabaseClient()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 2. initSupabaseFromConfig() returns a client and caches it
  // -------------------------------------------------------------------------
  it('returns a client from initSupabaseFromConfig and caches it', () => {
    const client = initSupabaseFromConfig({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'test-anon-key',
    })

    expect(client).toBeDefined()
    expect(client).toBe(getSupabaseClient())
    expect(mockCreateClient).toHaveBeenCalledWith('https://example.supabase.co', 'test-anon-key')
  })

  // -------------------------------------------------------------------------
  // 3. getSupabaseClient() returns the cached client after init
  // -------------------------------------------------------------------------
  it('returns the same cached client on repeated getSupabaseClient calls', () => {
    initSupabaseFromConfig({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'test-anon-key',
    })

    const first = getSupabaseClient()
    const second = getSupabaseClient()

    expect(first).not.toBeNull()
    expect(first).toBe(second)
    // createClient should only have been invoked once
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // 4. resetSupabaseClient() clears the cache
  // -------------------------------------------------------------------------
  it('clears the cached client when resetSupabaseClient is called', () => {
    initSupabaseFromConfig({
      supabaseUrl: 'https://example.supabase.co',
      supabaseKey: 'test-anon-key',
    })

    expect(getSupabaseClient()).not.toBeNull()

    resetSupabaseClient()

    expect(getSupabaseClient()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 5. Calling initSupabaseFromConfig() twice replaces the client
  // -------------------------------------------------------------------------
  it('replaces the cached client on a second init call', () => {
    const clientA = { auth: {}, from: vi.fn(), tag: 'A' }
    const clientB = { auth: {}, from: vi.fn(), tag: 'B' }
    mockCreateClient.mockReturnValueOnce(clientA).mockReturnValueOnce(clientB)

    const first = initSupabaseFromConfig({
      supabaseUrl: 'https://a.supabase.co',
      supabaseKey: 'key-a',
    })
    const second = initSupabaseFromConfig({
      supabaseUrl: 'https://b.supabase.co',
      supabaseKey: 'key-b',
    })

    expect(first).toBe(clientA)
    expect(second).toBe(clientB)
    expect(first).not.toBe(second)
    expect(getSupabaseClient()).toBe(clientB)
    expect(mockCreateClient).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // 6. initSupabaseFromConfig() throws on invalid URL
  // -------------------------------------------------------------------------
  it('throws a descriptive error when given an invalid URL', () => {
    expect(() =>
      initSupabaseFromConfig({
        supabaseUrl: 'not-a-url',
        supabaseKey: 'test-anon-key',
      }),
    ).toThrow(/Invalid Supabase URL/)

    // createClient should never have been called
    expect(mockCreateClient).not.toHaveBeenCalled()
    // Cache should remain null
    expect(getSupabaseClient()).toBeNull()
  })
})
