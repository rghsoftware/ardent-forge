import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getSupabaseClient } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const supabase = getSupabaseClient()
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (!code) {
      navigate({ to: '/sign-in', search: { reason: 'oauth_error' } })
      return
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error('[auth/callback] Failed to exchange code for session:', error.message)
          navigate({ to: '/sign-in', search: { reason: 'oauth_error' } })
        } else {
          navigate({ to: '/' })
        }
      })
      .catch((err: unknown) => {
        console.error('[auth/callback] Unexpected error during code exchange:', err)
        navigate({ to: '/sign-in', search: { reason: 'oauth_error' } })
      })
  }, [navigate])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-warm-ash animate-pulse">Signing in...</p>
    </div>
  )
}
