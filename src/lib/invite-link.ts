const SCHEME = 'ardentforge:'
const HOST = 'connect'

export function buildInviteLink(supabaseUrl: string, publishableKey: string): string {
  return `ardentforge://connect?url=${encodeURIComponent(supabaseUrl)}&key=${encodeURIComponent(publishableKey)}`
}

export function parseInviteLink(raw: string): { url: string; key: string } | null {
  try {
    const trimmed = raw.trim()
    const parsed = new URL(trimmed)

    if (parsed.protocol !== SCHEME) return null
    if (parsed.hostname !== HOST && parsed.pathname !== `///${HOST}`) {
      // URL constructor parses ardentforge://connect as hostname="connect"
      // but some browsers may parse it as pathname="///connect"
      return null
    }

    const url = parsed.searchParams.get('url')
    const key = parsed.searchParams.get('key')

    if (!url || !key) return null

    return { url, key }
  } catch (err) {
    console.error('[invite-link] Failed to parse invite link:', err)
    return null
  }
}
