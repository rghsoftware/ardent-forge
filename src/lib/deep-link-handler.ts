import { toast } from 'sonner'
import { parseInviteLink } from '@/lib/invite-link'
import { getConfigStore } from '@/lib/config-store'
import { usePendingConnect } from '@/lib/pending-connect'

type Navigate = (path: string) => void

/**
 * F021: Handles `ardentforge://gyms/join?token=...` deep links. The raw URL
 * is parsed, the token is validated at this module boundary (non-empty,
 * length >= 24 per A-014), and on success we navigate to the join route
 * which performs the redemption RPC call.
 */
export function handleGymJoinLink(urlStr: string, navigate: Navigate = defaultNavigate): void {
  let parsed: URL
  try {
    parsed = new URL(urlStr)
  } catch (err) {
    console.error('[deep-link-handler] Invalid gym join URL:', { urlStr, err })
    toast('Invalid gym invite link')
    return
  }

  if (parsed.protocol !== 'ardentforge:' || parsed.host !== 'gyms' || parsed.pathname !== '/join') {
    console.error('[deep-link-handler] Unexpected gym join URL shape:', urlStr)
    toast('Invalid gym invite link')
    return
  }

  const token = parsed.searchParams.get('token') ?? ''
  if (token.length < 24) {
    console.error('[deep-link-handler] Gym join token too short or missing')
    toast('Invalid gym invite link')
    return
  }

  navigate(`/gyms/join?token=${encodeURIComponent(token)}`)
}

// Default navigation uses window.location.href for contexts without a router
// (e.g. the Tauri deep-link listener in auth.tsx which runs outside React).
const defaultNavigate: Navigate = (path) => {
  window.location.href = path
}

export async function handleConnectLink(
  urlStr: string,
  navigate: Navigate = defaultNavigate,
): Promise<void> {
  const parsed = parseInviteLink(urlStr)
  if (!parsed) {
    toast('Invalid invite link')
    return
  }

  try {
    const store = getConfigStore()
    const hasConfig = await store.hasConfig()

    if (!hasConfig) {
      navigate(`/setup?url=${encodeURIComponent(parsed.url)}&key=${encodeURIComponent(parsed.key)}`)
      return
    }

    const config = await store.getConfig()
    if (config && config.supabaseUrl === parsed.url) {
      toast('Already connected to this server')
      return
    }

    usePendingConnect.getState().setPending(parsed.url, parsed.key)
    navigate('/profile')
  } catch (err) {
    console.error('[deep-link] Failed to process connect link:', err)
    toast('Failed to process invite link. Please try again.')
  }
}
