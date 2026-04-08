import { describe, it, expect, vi, beforeEach } from 'vitest'

import { discoverInstance } from '../discovery'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

const VALID_DISCOVERY = {
  version: '1',
  supabase_url: 'https://abc.supabase.co',
  supabase_publishable_key: 'ey-test-key',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('discoverInstance', () => {
  it('returns ok with supabaseUrl and supabaseKey for a valid response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: true,
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'ey-test-key',
      appUrl: undefined,
    })
  })

  it('passes through app_url when present in the discovery response (F019)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ...VALID_DISCOVERY, app_url: 'https://forge.example.com' }),
    )

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: true,
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'ey-test-key',
      appUrl: 'https://forge.example.com',
    })
  })

  it('logs a warn when the server omits app_url (pre-F019 server)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    const result = await discoverInstance('https://forge.example.com')

    expect(result.ok).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[discovery] Server did not return app_url'),
    )
    warnSpy.mockRestore()
  })

  it('rejects an invalid app_url shape', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ...VALID_DISCOVERY, app_url: 'not-a-url' }))

    const result = await discoverInstance('https://forge.example.com')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('INVALID_RESPONSE')
    }
  })

  // -------------------------------------------------------------------------
  // URL normalization
  // -------------------------------------------------------------------------

  it('prepends https:// for a bare domain', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    await discoverInstance('forge.example.com')

    expect(fetch).toHaveBeenCalledWith(
      'https://forge.example.com/.well-known/ardent-forge.json',
      expect.any(Object),
    )
  })

  it('strips trailing slashes before appending the discovery path', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    await discoverInstance('https://forge.example.com/')

    expect(fetch).toHaveBeenCalledWith(
      'https://forge.example.com/.well-known/ardent-forge.json',
      expect.any(Object),
    )
  })

  it('preserves an explicit http:// protocol', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    await discoverInstance('http://forge.example.com')

    expect(fetch).toHaveBeenCalledWith(
      'http://forge.example.com/.well-known/ardent-forge.json',
      expect.any(Object),
    )
  })

  it('returns INVALID_INPUT for a file:// URL', async () => {
    const result = await discoverInstance('file:///etc/passwd')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Only http:// and https:// URLs are supported.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns INVALID_INPUT for a ftp:// URL', async () => {
    const result = await discoverInstance('ftp://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Only http:// and https:// URLs are supported.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns INVALID_INPUT for a javascript: URL', async () => {
    // P15-050: defense-in-depth for the setup discovery flow. The URL
    // parser at display-url.ts already rejects `javascript:` tokens for
    // the TV-open path, but setup discovery is a separate code path and
    // must independently refuse to fetch the well-known discovery JSON
    // from an executable scheme. In discovery.ts the normalization step
    // prepends `https://` (because `javascript:alert(1)` has no `://`),
    // producing `https://javascript:alert(1)` which the URL constructor
    // rejects as malformed -- the guard fires on the parse-error branch
    // rather than the protocol-check branch, but the net effect is the
    // same: INVALID_INPUT and no fetch.
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await discoverInstance('javascript:alert(1)')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Invalid URL. Please enter a valid server address.',
    })
    expect(fetch).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns INVALID_INPUT for an empty string', async () => {
    const result = await discoverInstance('')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Invalid URL. Please enter a valid server address.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns INVALID_INPUT for whitespace-only input', async () => {
    const result = await discoverInstance('   ')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Invalid URL. Please enter a valid server address.',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Network errors
  // -------------------------------------------------------------------------

  it('returns NETWORK_ERROR when fetch throws a TypeError', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check the URL and your network connection.',
    })
  })

  it('returns NETWORK_ERROR with timeout message when fetch throws an AbortError', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.mocked(fetch).mockRejectedValue(abortError)

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'NETWORK_ERROR',
      message: 'Connection timed out. Check the server URL and try again.',
    })
  })

  // -------------------------------------------------------------------------
  // HTTP error responses
  // -------------------------------------------------------------------------

  it('returns NOT_FOUND for a 404 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
      message:
        'Server returned 404. No discovery file found at https://forge.example.com/.well-known/ardent-forge.json.',
    })
  })

  // -------------------------------------------------------------------------
  // Invalid body
  // -------------------------------------------------------------------------

  it('returns INVALID_RESPONSE when a 200 response contains non-JSON (HTML)', async () => {
    const htmlResponse = new Response('<html><body>Hello</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
    // Override .json() to throw, simulating invalid JSON parse
    htmlResponse.json = () => {
      throw new SyntaxError('Unexpected token <')
    }
    vi.mocked(fetch).mockResolvedValue(htmlResponse)

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Response was not valid JSON. Verify the server URL points to an Ardent Forge instance.',
    })
  })

  // -------------------------------------------------------------------------
  // Schema validation
  // -------------------------------------------------------------------------

  it('returns INVALID_RESPONSE when the version field is missing', async () => {
    const { version: _, ...noVersion } = VALID_DISCOVERY
    vi.mocked(fetch).mockResolvedValue(jsonResponse(noVersion))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    })
  })

  it('returns INVALID_RESPONSE when supabase_url is missing', async () => {
    const { supabase_url: _, ...noUrl } = VALID_DISCOVERY
    vi.mocked(fetch).mockResolvedValue(jsonResponse(noUrl))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    })
  })

  it('returns INVALID_RESPONSE when supabase_url is a number instead of string', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ...VALID_DISCOVERY, supabase_url: 12345 }))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    })
  })

  it('returns INVALID_RESPONSE when supabase_publishable_key is missing', async () => {
    const { supabase_publishable_key: _, ...noKey } = VALID_DISCOVERY
    vi.mocked(fetch).mockResolvedValue(jsonResponse(noKey))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    })
  })

  // -------------------------------------------------------------------------
  // Additional HTTP error codes
  // -------------------------------------------------------------------------

  it('returns NOT_FOUND for a 500 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Internal Server Error', { status: 500 }))

    const result = await discoverInstance('https://forge.example.com')

    expect(result).toEqual({
      ok: false,
      error: 'NOT_FOUND',
      message:
        'Server returned 500. No discovery file found at https://forge.example.com/.well-known/ardent-forge.json.',
    })
  })

  // -------------------------------------------------------------------------
  // URL path stripping
  // -------------------------------------------------------------------------

  it('strips path components and fetches from origin only', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(VALID_DISCOVERY))

    await discoverInstance('forge.example.com/app')

    expect(fetch).toHaveBeenCalledWith(
      'https://forge.example.com/.well-known/ardent-forge.json',
      expect.any(Object),
    )
  })
})
