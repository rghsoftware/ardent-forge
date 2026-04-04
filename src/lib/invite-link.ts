const SCHEME = 'ardentforge:'
const HOST = 'connect'

// The publishable (anon) key is not a secret -- safe to embed in QR codes and invite
// links since it is already bundled into every client build.
export function buildInviteLink(supabaseUrl: string, publishableKey: string): string {
  return `${SCHEME}//${HOST}?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`
}

export function parseInviteLink(raw: string): { url: string; key: string } | null {
  try {
    const trimmed = raw.trim()
    const parsed = new URL(trimmed)

    if (parsed.protocol !== SCHEME) return null
    if (parsed.hostname !== HOST) return null

    const url = parsed.searchParams.get('url')
    const key = parsed.searchParams.get('key')

    if (!url || !key) return null

    if (!url.startsWith('https://')) return null

    return { url, key }
  } catch (err) {
    console.error('[invite-link] Failed to parse invite link:', err)
    return null
  }
}
