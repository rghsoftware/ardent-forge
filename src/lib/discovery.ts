export type DiscoveryError = 'NETWORK_ERROR' | 'NOT_FOUND' | 'INVALID_RESPONSE'

export type DiscoveryResult =
  | { ok: true; supabaseUrl: string; supabaseKey: string }
  | { ok: false; error: DiscoveryError; message: string }

/**
 * Resolves a human-friendly server URL into Supabase credentials by fetching
 * the well-known discovery JSON file at `/.well-known/ardent-forge.json`.
 *
 * The returned credentials can be passed directly to `createClient` or to
 * the connection validator for further verification.
 */
export async function discoverInstance(serverUrl: string): Promise<DiscoveryResult> {
  // Normalize: prepend https:// if no protocol, strip trailing slashes
  let normalized = serverUrl.trim()
  if (!normalized.includes('://')) {
    normalized = `https://${normalized}`
  }
  normalized = normalized.replace(/\/+$/, '')

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
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message: isTimeout
        ? 'Connection timed out. Check the server URL and try again.'
        : 'Could not reach the server. Check the URL and your network connection.',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      error: 'NOT_FOUND',
      message: `Server returned ${response.status}. No discovery file found at ${discoveryUrl}.`,
    }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    return {
      ok: false,
      error: 'NOT_FOUND',
      message:
        'Response was not valid JSON. Verify the server URL points to an Ardent Forge instance.',
    }
  }

  // Validate required fields
  if (
    typeof json !== 'object' ||
    json === null ||
    typeof (json as Record<string, unknown>).version !== 'string' ||
    typeof (json as Record<string, unknown>).supabase_url !== 'string' ||
    typeof (json as Record<string, unknown>).supabase_publishable_key !== 'string'
  ) {
    return {
      ok: false,
      error: 'INVALID_RESPONSE',
      message:
        'Discovery file is missing required fields (version, supabase_url, supabase_publishable_key).',
    }
  }

  const record = json as Record<string, string>

  return {
    ok: true,
    supabaseUrl: record.supabase_url,
    supabaseKey: record.supabase_publishable_key,
  }
}
