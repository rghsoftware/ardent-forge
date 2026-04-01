import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { getConfigStore } from '@/lib/config-store'
import type { BackendConfig } from '@/lib/config-store'
import { validateConnection } from '@/lib/connection-validator'
import type { ConnectionUiStatus } from '@/lib/connection-validator'
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

function SetupPage() {
  const router = useRouter()

  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const envKey = import.meta.env.VITE_SUPABASE_PUB_KEY?.trim() ?? ''
  const hasEnvVars = Boolean(envUrl && envKey)

  const [url, setUrl] = useState(envUrl)
  const [key, setKey] = useState(envKey)
  const [status, setStatus] = useState<ConnectionUiStatus>('idle')
  const [message, setMessage] = useState('')
  const autoValidated = useRef(false)

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
      try {
        setStatus('ok')
        setMessage('Connected successfully.')

        const config: BackendConfig = { supabaseUrl: url, supabaseKey: key }
        await getConfigStore().setConfig(config)
        initSupabaseFromConfig(config)

        router.navigate({ to: '/sign-in', search: { reason: undefined } })
        return
      } catch (err) {
        console.error('[setup] Failed to save configuration after validation:', err)
        setStatus('unreachable')
        setMessage('Connected but failed to save configuration. Please try again.')
        return
      }
    }

    setStatus(result.status)
    setMessage(result.message)
  }

  // Auto-validate when env vars pre-fill both fields so the user
  // immediately sees why the connection failed instead of a blank form.
  useEffect(() => {
    if (hasEnvVars && !autoValidated.current) {
      autoValidated.current = true
      handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthPageShell>
      <p className="text-sm text-warm-ash">Configure Backend</p>

      {hasEnvVars && status !== 'ok' && status !== 'idle' && status !== 'validating' && (
        <p className="rounded-md bg-warning-flare/10 px-3 py-2 text-xs text-warning-flare">
          Environment variables were detected but the connection failed. Check the values below.
        </p>
      )}

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
