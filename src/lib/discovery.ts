import { z } from 'zod'

export type DiscoveryError = 'INVALID_INPUT' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'INVALID_RESPONSE'

export type DiscoveryResult =
  | { ok: true; supabaseUrl: string; supabaseKey: string }
  | { ok: false; error: DiscoveryError; message: string }

const DiscoverySchema = z.object({
  version: z.string().min(1),
  supabase_url: z.string().url(),
  supabase_publishable_key: z.string().min(1),
})

/**
 * Resolves a human-friendly server URL into Supabase credentials by fetching
 * the well-known discovery JSON file at `/.well-known/ardent-forge.json`.
 *
 * The returned credentials can be passed to `validateConnection` and then
 * persisted via the config store.
 */
export async function discoverInstance(serverUrl: string): Promise<DiscoveryResult> {
  // Normalize: prepend https:// if no protocol, validate protocol, strip trailing slashes
  let normalized = serverUrl.trim()
  if (!normalized.includes('://')) {
    normalized = `https://${normalized}`
  }

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch (err) {
    console.error('[discovery] Invalid URL:', err)
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Invalid URL. Please enter a valid server address.',
    }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    console.error('[discovery] Unsupported protocol:', parsed.protocol)
    return {
      ok: false,
      error: 'INVALID_INPUT',
      message: 'Only http:// and https:// URLs are supported.',
    }
  }

  normalized = parsed.origin
  const discoveryUrl = `${normalized}/.well-known/ardent-forge.json`

  let response: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    response = await fetch(discoveryUrl, { signal: controller.signal })

    clearTimeout(timer)
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')
    console.error('[discovery] Fetch failed:', err)
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: isTimeout
        ? 'Connection timed out. Check the server URL and try again.'
        : 'Could not reach the server. Check the URL and your network connection.',
    }
  }

  if (!response.ok) {
    console.error('[discovery] HTTP %d from %s', response.status, discoveryUrl)
    return {
      ok: false,
      error: 'NOT_FOUND',
      message: `Server returned ${response.status}. No discovery file found at ${discoveryUrl}.`,
    }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (err) {
    console.error('[discovery] JSON parse failed:', err)
    return {
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Response was not valid JSON. Verify the server URL points to an Ardent Forge instance.',
    }
  }

  const result = DiscoverySchema.safeParse(json)

  if (!result.success) {
    console.error('[discovery] Schema validation failed:', result.error.issues)
    return {
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    }
  }

  return {
    ok: true,
    supabaseUrl: result.data.supabase_url,
    supabaseKey: result.data.supabase_publishable_key,
  }
}
