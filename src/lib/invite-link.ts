const SCHEME = 'ardentforge:'
const HOST = 'connect'

// Encodes the Supabase publishable (anon) key -- not a secret. Safe to expose in QR codes
// and invite links since the anon key is already bundled into every client build.
export function buildInviteLink(supabaseUrl: string, publishableKey: string): string {
  return `ardentforge://connect?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`
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

    return { url, key }
  } catch (err) {
    console.error('[invite-link] Failed to parse invite link:', err)
    return null
  }
}
