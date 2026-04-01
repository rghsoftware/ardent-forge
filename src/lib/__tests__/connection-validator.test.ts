import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateConnection } from '../connection-validator'

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js
// ---------------------------------------------------------------------------

const mockSelect = vi.fn()
const mockLimit = vi.fn()
const mockAbortSignal = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

function setupChain(result: { data?: unknown; error?: unknown }) {
  mockAbortSignal.mockResolvedValue(result)
  mockLimit.mockReturnValue({ abortSignal: mockAbortSignal })
  mockSelect.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// Helper to set up different results for reachability (call 1) and schema (call 2) checks.
function setupChainSequence(
  first: { data?: unknown; error?: unknown },
  second: { data?: unknown; error?: unknown },
) {
  let callCount = 0
  mockFrom.mockImplementation(() => {
    callCount++
    const result = callCount === 1 ? first : second
    return {
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          abortSignal: vi.fn().mockResolvedValue(result),
        })),
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateConnection', () => {
  const url = 'https://example.supabase.co'
  const key = 'test-anon-key'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('returns ok when both queries succeed', async () => {
    setupChainSequence({ data: [], error: null }, { data: [{ id: '1' }], error: null })

    const result = await validateConnection(url, key)

    expect(result).toEqual({ status: 'ok' })
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  // -----------------------------------------------------------------------
  // Step 1 failures -- reachability / key validity
  // -----------------------------------------------------------------------

  it('returns unreachable when key is invalid (401)', async () => {
    setupChain({
      error: { message: 'Invalid API key', status: 401 },
    })

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('API key')
  })

  it('returns unreachable when key is forbidden (403)', async () => {
    setupChain({
      error: { message: 'Forbidden', status: 403 },
    })

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('API key')
  })

  it('returns unreachable with timeout message on AbortError', async () => {
    mockAbortSignal.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))
    mockLimit.mockReturnValue({ abortSignal: mockAbortSignal })
    mockSelect.mockReturnValue({ limit: mockLimit })
    mockFrom.mockReturnValue({ select: mockSelect })

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('timed out')
  })

  it('returns unreachable on network failure', async () => {
    setupChain({
      error: { message: 'FetchError: Failed to fetch', status: undefined },
    })

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('Could not reach')
  })

  // -----------------------------------------------------------------------
  // Step 1 passes, step 2 failures -- schema check
  // -----------------------------------------------------------------------

  it('proceeds to schema check when reachability query returns table-not-found', async () => {
    // Step 1: table doesn't exist (expected) -- means server is reachable
    // Step 2: exercises table succeeds
    setupChainSequence(
      { error: { message: 'relation does not exist', code: '42P01' } },
      { data: [{ id: '1' }], error: null },
    )

    const result = await validateConnection(url, key)

    expect(result).toEqual({ status: 'ok' })
  })

  it('returns no-schema when exercises table does not exist', async () => {
    // Step 1 passes (no error)
    // Step 2 fails with a schema error
    setupChainSequence(
      { data: [], error: null },
      { error: { message: 'relation "exercises" does not exist', code: '42P01', status: 404 } },
    )

    const result = await validateConnection(url, key)

    expect(result.status).toBe('no-schema')
    expect((result as { message: string }).message).toContain('database schema')
  })

  it('returns unreachable when schema check gets 401', async () => {
    setupChainSequence(
      { data: [], error: null },
      { error: { message: 'Unauthorized', status: 401 } },
    )

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('API key')
  })

  // -----------------------------------------------------------------------
  // Uses Supabase client (not raw fetch)
  // -----------------------------------------------------------------------

  it('creates a Supabase client with the provided url and key', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    setupChainSequence({ data: [], error: null }, { data: [], error: null })

    await validateConnection(url, key)

    expect(createClient).toHaveBeenCalledWith(url, key)
  })
})
