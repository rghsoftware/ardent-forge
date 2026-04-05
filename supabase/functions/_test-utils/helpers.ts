/**
 * Shared test helpers for Supabase Edge Function tests.
 */

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

export function buildRequest(options: {
  method?: string
  body?: unknown
  authHeader?: string
  headers?: Record<string, string>
}): Request {
  const headers = new Headers(options.headers)
  if (options.authHeader) headers.set('Authorization', options.authHeader)

  return new Request('http://localhost/test', {
    method: options.method ?? 'POST',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

// ---------------------------------------------------------------------------
// Deno.env.get mock
// ---------------------------------------------------------------------------

export function mockEnv(vars: Record<string, string>): () => void {
  const originalGet = Deno.env.get
  Deno.env.get = (key: string): string | undefined => vars[key]
  return () => {
    Deno.env.get = originalGet
  }
}

// ---------------------------------------------------------------------------
// globalThis.fetch mock
// ---------------------------------------------------------------------------

export function mockFetch(
  handler: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): () => void {
  const original = globalThis.fetch
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.fetch = handler as any
  return () => {
    globalThis.fetch = original
  }
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

export async function parseJson(
  res: Response,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const status = res.status
  const text = await res.text()
  try {
    return { status, body: JSON.parse(text) }
  } catch {
    return { status, body: { _raw: text } }
  }
}

// ---------------------------------------------------------------------------
// Standard env vars shared by all edge functions
// ---------------------------------------------------------------------------

export const STANDARD_ENV: Record<string, string> = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
}
