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
    })
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
})
