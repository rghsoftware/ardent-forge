import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { handleConnectLink } from '@/lib/deep-link-handler'

export const Route = createFileRoute('/connect')({
  validateSearch: (search: Record<string, unknown>): { url?: string; key?: string } => ({
    url: (search.url as string) || undefined,
    key: (search.key as string) || undefined,
  }),
  component: ConnectPage,
})

function ConnectPage() {
  const { url, key } = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    if (!url || !key) {
      toast('Invalid invite link')
      navigate({ to: '/setup' })
      return
    }

    handleConnectLink(
      `ardentforge://connect?url=${encodeURIComponent(url)}&key=${encodeURIComponent(key)}`,
    ).catch((err) => {
      console.error('[connect] Failed to handle connect link:', err)
      toast('Something went wrong. Please try again.')
      navigate({ to: '/setup' })
    })
  }, [url, key, navigate])

  return null
}
