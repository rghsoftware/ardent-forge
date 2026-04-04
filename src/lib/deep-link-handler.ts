import { toast } from 'sonner'
import { parseInviteLink } from '@/lib/invite-link'
import { getConfigStore } from '@/lib/config-store'
import { usePendingConnect } from '@/lib/pending-connect'

type Navigate = (path: string) => void

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
