import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getConfigStore } from '@/lib/config-store'
import type { BackendConfig } from '@/lib/config-store'
import { validateConnection } from '@/lib/connection-validator'
import { initSupabaseFromConfig } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'

export const Route = createFileRoute('/setup')({
  beforeLoad: async () => {
    const hasConfig = await getConfigStore().hasConfig()
    if (hasConfig) {
      throw redirect({ to: '/' })
    }
  },
  component: SetupPage,
})

type Status = 'idle' | 'validating' | 'ok' | 'no-schema' | 'unreachable'

function SetupPage() {
  const router = useRouter()

  const [url, setUrl] = useState(import.meta.env.VITE_SUPABASE_URL?.trim() ?? '')
  const [key, setKey] = useState(import.meta.env.VITE_SUPABASE_PUB_KEY?.trim() ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleConnect = async () => {
    if (!url || !key) {
      setStatus('unreachable')
      setMessage('Both fields are required.')
      return
    }

    setStatus('validating')
    setMessage('')

    const result = await validateConnection(url, key)

    if (result.status === 'ok') {
      setStatus('ok')
      setMessage('Connected successfully.')

      const config: BackendConfig = { supabaseUrl: url, supabaseKey: key }
      await getConfigStore().setConfig(config)
      initSupabaseFromConfig(config)

      router.navigate({ to: '/sign-in', search: { reason: undefined } })
      return
    }

    setStatus(result.status)
    setMessage(
      result.status === 'no-schema'
        ? 'Connected, but database schema not found. See the setup guide.'
        : 'Cannot reach server. Check URL and key.',
    )
  }

  return (
    <AuthPageShell>
      <p className="text-sm text-warm-ash">Configure Backend</p>

      <div className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="setup-url" className={FORGE_LABEL_CLASS}>
            Supabase URL
          </label>
          <ForgeInput
            id="setup-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project.supabase.co"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="setup-key" className={FORGE_LABEL_CLASS}>
            Publishable Key
          </label>
          <ForgeInput
            id="setup-key"
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="eyJ..."
          />
        </div>

        {/* Status feedback */}
        {status === 'validating' && (
          <p className="text-xs text-warm-ash animate-pulse">Connecting...</p>
        )}
        {status === 'ok' && <p className="text-xs text-forge">{message}</p>}
        {(status === 'no-schema' || status === 'unreachable') && (
          <p className="text-xs text-warning-flare">{message}</p>
        )}

        <Button
          type="button"
          className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/90"
          onClick={handleConnect}
          disabled={status === 'validating'}
        >
          {status === 'validating' ? 'Connecting...' : 'Connect'}
        </Button>
      </div>

      <p className="text-center text-xs text-warm-ash/50">
        Self-hosting?{' '}
        <a
          href="https://github.com/rghsoftware/ardent-forge#self-hosting"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ember hover:text-ember/80"
        >
          See the setup guide
        </a>
      </p>
    </AuthPageShell>
  )
}
