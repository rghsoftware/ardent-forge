import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateConnection } from '../connection-validator'

// ---------------------------------------------------------------------------
// validateConnection -- unit tests
// ---------------------------------------------------------------------------

describe('validateConnection', () => {
  const url = 'https://example.supabase.co'
  const key = 'test-anon-key'

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200 })),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('returns ok when both fetches succeed', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result).toEqual({ status: 'ok' })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  // -----------------------------------------------------------------------
  // Step 1 failures -- reachability
  // -----------------------------------------------------------------------

  it('returns unreachable when step 1 responds with non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('500')
  })

  it('returns unreachable with timeout message when step 1 throws TimeoutError', async () => {
    const timeoutError = new DOMException('signal timed out', 'TimeoutError')
    const mockFetch = vi.fn().mockRejectedValueOnce(timeoutError)
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('timed out')
  })

  it('returns unreachable when step 1 throws a network TypeError', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('Could not reach')
  })

  // -----------------------------------------------------------------------
  // Step 2 failures -- schema check
  // -----------------------------------------------------------------------

  it('returns no-schema when step 1 ok but step 2 returns 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('no-schema')
    expect((result as { message: string }).message).toContain('database schema')
  })

  it('returns unreachable when step 1 ok but step 2 throws a network TypeError', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('network error')
  })

  it('returns unreachable with API key message when step 2 returns 401', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('API key')
  })

  it('returns unreachable with API key message when step 2 returns 403', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal('fetch', mockFetch)

    const result = await validateConnection(url, key)

    expect(result.status).toBe('unreachable')
    expect((result as { message: string }).message).toContain('API key')
  })

  // -----------------------------------------------------------------------
  // Header verification
  // -----------------------------------------------------------------------

  it('sends correct headers on the step 2 request', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    await validateConnection(url, key)

    // Step 2 is the second call
    const [step2Url, step2Init] = mockFetch.mock.calls[1]

    expect(step2Url).toBe(`${url}/rest/v1/exercises?select=id&limit=1`)
    expect(step2Init.headers).toEqual(
      expect.objectContaining({
        apikey: key,
        Authorization: `Bearer ${key}`,
      }),
    )
  })
})
