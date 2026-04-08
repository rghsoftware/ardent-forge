import type { VercelRequest, VercelResponse } from '@vercel/node'

// ---------------------------------------------------------------------------
// computeAppUrl (F019 D21)
//
// Derives the public-facing app origin for this deployment from the incoming
// request headers. Used to populate the `app_url` field on the discovery
// response so Tauri clients can persist a usable host at setup time and
// later build display URLs that are reachable from outside the device.
//
// Reads `x-forwarded-proto` when present and defaults to `https`. Vercel
// sets this header automatically; self-hosters running a reverse proxy
// (Caddy, nginx, Traefik, etc.) should verify that their proxy forwards
// the header -- the fallback is safe but collapses http-only deployments
// to https-in-URL, which TVs on the same LAN will not be able to reach.
// Returns `undefined` when the host header is missing so the caller can
// log and omit the field cleanly instead of emitting `https://undefined`.
// ---------------------------------------------------------------------------
function computeAppUrl(req: VercelRequest): string | undefined {
  const host = req.headers.host
  if (!host) {
    console.warn('[discovery] Missing Host header, omitting app_url from response')
    return undefined
  }
  const protoHeader = req.headers['x-forwarded-proto']
  const proto = typeof protoHeader === 'string' ? protoHeader : 'https'
  return `${proto}://${host}`
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_PUB_KEY

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Discovery not configured' })
    return
  }

  const appUrl = computeAppUrl(req)

  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    version: '1',
    supabase_url: supabaseUrl,
    supabase_publishable_key: supabaseKey,
    // Additive field (F019). Omitted entirely when host is missing so the
    // response stays valid against the pre-F019 discovery schema for any
    // client still validating strictly.
    ...(appUrl !== undefined && { app_url: appUrl }),
  })
}
