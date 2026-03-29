import { vi, beforeEach, afterEach } from 'vitest'
import type { DataAdapter } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Module mocks -- must be declared before imports that pull in the real modules
// ---------------------------------------------------------------------------

const mockSupabaseClient = {} as unknown

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: vi.fn(() => false),
}))

vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
}))

// Minimal stub adapters -- only need to satisfy the DataAdapter interface type.
// vi.fn() mocks used with `new` must use class-style implementation.
const fakeSupabaseAdapter = { _brand: 'supabase' } as unknown as DataAdapter
const fakeTauriAdapter = { _brand: 'tauri' } as unknown as DataAdapter

vi.mock('@/lib/supabase-adapter', () => {
  const MockSupabaseAdapter = vi.fn(function () {
    return fakeSupabaseAdapter
  })
  return { SupabaseAdapter: MockSupabaseAdapter }
})

vi.mock('@/lib/tauri-adapter', () => {
  const MockTauriAdapter = vi.fn(function () {
    return fakeTauriAdapter
  })
  return { TauriAdapter: MockTauriAdapter }
})

// Import after mocks are registered
import { getAdapter, resetAdapter } from '@/lib/adapter'
import { isTauri } from '@tauri-apps/api/core'
import { SupabaseAdapter } from '@/lib/supabase-adapter'
import { TauriAdapter } from '@/lib/tauri-adapter'

// ===========================================================================
// getAdapter / resetAdapter
// ===========================================================================

describe('getAdapter', () => {
  beforeEach(() => {
    resetAdapter()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAdapter()
  })

  it('returns a DataAdapter instance', () => {
    const adapter = getAdapter()
    expect(adapter).toBeDefined()
  })

  it('returns a SupabaseAdapter when not in Tauri mode', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const adapter = getAdapter()
    expect(adapter).toBe(fakeSupabaseAdapter)
    expect(SupabaseAdapter).toHaveBeenCalledWith(mockSupabaseClient)
  })

  it('returns a TauriAdapter when in Tauri mode', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    const adapter = getAdapter()
    expect(adapter).toBe(fakeTauriAdapter)
    expect(TauriAdapter).toHaveBeenCalledWith('local-user')
  })

  it('passes custom userId to TauriAdapter', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    getAdapter('user-123')
    expect(TauriAdapter).toHaveBeenCalledWith('user-123')
  })

  it('caches the adapter -- calling getAdapter() twice returns same instance', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const first = getAdapter()
    const second = getAdapter()
    expect(first).toBe(second)
    // Constructor should only be called once
    expect(SupabaseAdapter).toHaveBeenCalledTimes(1)
  })

  it('ignores userId on second call because cached adapter is returned', () => {
    vi.mocked(isTauri).mockReturnValue(true)
    getAdapter('user-A')
    getAdapter('user-B')
    expect(TauriAdapter).toHaveBeenCalledTimes(1)
    expect(TauriAdapter).toHaveBeenCalledWith('user-A')
  })
})

describe('resetAdapter', () => {
  beforeEach(() => {
    resetAdapter()
    vi.clearAllMocks()
  })

  it('clears the cache so a new adapter is created on next call', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const first = getAdapter()
    resetAdapter()
    const second = getAdapter()
    // Both are fakeSupabaseAdapter from the mock, but the constructor should run twice
    expect(SupabaseAdapter).toHaveBeenCalledTimes(2)
    expect(first).toBe(second) // same mock return value, but constructor ran again
  })

  it('allows switching from Supabase to Tauri after reset', () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const browser = getAdapter()
    expect(browser).toBe(fakeSupabaseAdapter)

    resetAdapter()
    vi.mocked(isTauri).mockReturnValue(true)
    const tauri = getAdapter('real-user')
    expect(tauri).toBe(fakeTauriAdapter)
    expect(TauriAdapter).toHaveBeenCalledWith('real-user')
  })
})
