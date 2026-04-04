import { toast } from 'sonner'
import { parseInviteLink } from '@/lib/invite-link'
import { getConfigStore } from '@/lib/config-store'
import { usePendingConnect } from '@/lib/pending-connect'

export async function handleConnectLink(urlStr: string): Promise<void> {
  const parsed = parseInviteLink(urlStr)
  if (!parsed) {
    toast('Invalid invite link')
    return
  }

  const store = getConfigStore()
  const hasConfig = await store.hasConfig()

  if (!hasConfig) {
    window.location.href = `/setup?url=${encodeURIComponent(parsed.url)}&key=${encodeURIComponent(parsed.key)}`
    return
  }

  const config = await store.getConfig()
  if (config && config.supabaseUrl === parsed.url) {
    toast('Already connected to this server')
    return
  }

  usePendingConnect.getState().setPending(parsed.url, parsed.key)
  window.location.href = '/profile'
}
