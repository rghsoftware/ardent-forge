import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import handler from '../discovery'

// ---------------------------------------------------------------------------
// Test helpers: minimal VercelRequest / VercelResponse mocks. We only need
// the subset of the API that `handler` touches.
// ---------------------------------------------------------------------------

interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  setHeader: (key: string, value: string) => MockResponse
  status: (code: number) => MockResponse
  json: (body: unknown) => MockResponse
  end: () => MockResponse
}

function mockRequest(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: { host: 'ardent-forge.vercel.app', ...overrides.headers },
    ...overrides,
  } as unknown as VercelRequest
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) {
      this.headers[key] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
    end() {
      return this
    },
  }
  return res
}

// ---------------------------------------------------------------------------
// Env var scaffolding
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://abc.supabase.co'
  process.env.VITE_SUPABASE_PUB_KEY = 'ey-test-key'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('api/discovery handler', () => {
  it('returns app_url derived from the Host header', () => {
    const req = mockRequest({ headers: { host: 'forge.example.com' } })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      version: '1',
      supabase_url: 'https://abc.supabase.co',
      supabase_publishable_key: 'ey-test-key',
      app_url: 'https://forge.example.com',
    })
  })

  it('defaults the protocol to https when x-forwarded-proto is missing', () => {
    const req = mockRequest({ headers: { host: 'ardent-forge.vercel.app' } })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect((res.body as { app_url: string }).app_url).toBe('https://ardent-forge.vercel.app')
  })

  it('honors x-forwarded-proto when it is "http"', () => {
    const req = mockRequest({
      headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' },
    })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect((res.body as { app_url: string }).app_url).toBe('http://localhost:3000')
  })

  it('honors x-forwarded-proto when it is "https"', () => {
    const req = mockRequest({
      headers: { host: 'forge.example.com', 'x-forwarded-proto': 'https' },
    })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect((res.body as { app_url: string }).app_url).toBe('https://forge.example.com')
  })

  it('includes Cache-Control on success', () => {
    const req = mockRequest()
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.headers['Cache-Control']).toBe('public, max-age=3600')
  })

  it('always sets CORS headers', () => {
    const req = mockRequest()
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS')
  })
})

// ---------------------------------------------------------------------------
// OPTIONS preflight path
// ---------------------------------------------------------------------------

describe('api/discovery OPTIONS preflight', () => {
  it('returns 204 for OPTIONS requests', () => {
    const req = mockRequest({ method: 'OPTIONS' })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.statusCode).toBe(204)
    expect(res.body).toBeUndefined()
  })

  it('still sets CORS headers on OPTIONS', () => {
    const req = mockRequest({ method: 'OPTIONS' })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.headers['Access-Control-Allow-Origin']).toBe('*')
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS')
  })
})

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('api/discovery error paths', () => {
  it('returns 500 when VITE_SUPABASE_URL is missing', () => {
    delete process.env.VITE_SUPABASE_URL
    const req = mockRequest()
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Discovery not configured' })
  })

  it('returns 500 when VITE_SUPABASE_PUB_KEY is missing', () => {
    delete process.env.VITE_SUPABASE_PUB_KEY
    const req = mockRequest()
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Discovery not configured' })
  })

  it('logs a warn and omits app_url when host header is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const req = mockRequest({ headers: {} })
    const res = mockResponse()

    handler(req, res as unknown as VercelResponse)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      version: '1',
      supabase_url: 'https://abc.supabase.co',
      supabase_publishable_key: 'ey-test-key',
    })
    expect(res.body).not.toHaveProperty('app_url')
    expect(warnSpy).toHaveBeenCalledWith(
      '[discovery] Missing Host header, omitting app_url from response',
    )
  })
})
