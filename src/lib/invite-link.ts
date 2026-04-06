const SCHEME = 'ardentforge:'
const HOST = 'connect'

const WEB_APP_ORIGIN = 'https://ardent-forge.vercel.app'

// The publishable (anon) key is not a secret -- safe to embed in QR codes and invite
// links since it is already bundled into every client build.

/**
 * Build a deep-link invite URL for QR codes (scanned directly by the mobile app).
 * Format: ardentforge://connect?url=...&key=...
 */
export function buildDeepLink(supabaseUrl: string, publishableKey: string): string {
  return `${SCHEME}//${HOST}?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`
}

/**
 * Build a shareable HTTPS invite URL that opens the web app's /connect route,
 * which bridges to the deep link on mobile or handles setup directly on web.
 * Format: https://ardent-forge.vercel.app/connect?url=...&key=...
 */
export function buildInviteLink(supabaseUrl: string, publishableKey: string): string {
  return `${WEB_APP_ORIGIN}/connect?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`
}

export function parseInviteLink(raw: string): { url: string; key: string } | null {
  try {
    const trimmed = raw.trim()
    const parsed = new URL(trimmed)

    // Accept both ardentforge:// deep links and https:// web links
    const isDeepLink = parsed.protocol === SCHEME && parsed.hostname === HOST
    const isWebLink = parsed.protocol === 'https:' && parsed.pathname === '/connect'

    if (!isDeepLink && !isWebLink) return null

    const url = parsed.searchParams.get('url')
    const key = parsed.searchParams.get('key')

    if (!url || !key) return null

    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) return null
    } catch {
      return null
    }

    return { url, key }
  } catch (err) {
    console.error('[invite-link] Failed to parse invite link:', err)
    return null
  }
}
