import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, QrCode } from 'lucide-react'
import { getConfigStore } from '@/lib/config-store'
import type { BackendConfig } from '@/lib/config-store'
import { validateConnection } from '@/lib/connection-validator'
import type { ConnectionUiStatus } from '@/lib/connection-validator'
import { discoverInstance } from '@/lib/discovery'
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

  const [serverUrl, setServerUrl] = useState('')
  const [discoveryStatus, setDiscoveryStatus] = useState<
    'idle' | 'discovering' | 'discovery-failed'
  >('idle')
  const [discoveryMessage, setDiscoveryMessage] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const validateAndSave = async (supabaseUrl: string, supabaseKey: string) => {
    setStatus('validating')
    setMessage('')

    const result = await validateConnection(supabaseUrl, supabaseKey)

    if (result.status === 'ok') {
      try {
        setStatus('ok')
        setMessage('Connected successfully.')

        const config: BackendConfig = { supabaseUrl, supabaseKey }
        await getConfigStore().setConfig(config)
        initSupabaseFromConfig(config)

        router.navigate({ to: '/sign-in', search: { reason: undefined } })
        return true
      } catch (err) {
        console.error('[setup] Failed to save configuration after validation:', err)
        setStatus('unreachable')
        setMessage('Connected but failed to save configuration. Please try again.')
        return false
      }
    }

    setStatus(result.status)
    setMessage(result.message)
    return false
  }

  const handleConnect = async () => {
    if (!url || !key) {
      setStatus('unreachable')
      setMessage('Both fields are required.')
      return
    }

    await validateAndSave(url, key)
  }

  const handleDiscoverAndConnect = async () => {
    if (!serverUrl) {
      setDiscoveryStatus('discovery-failed')
      setDiscoveryMessage('Server address is required.')
      return
    }

    setDiscoveryStatus('discovering')
    setDiscoveryMessage('')
    setStatus('idle')
    setMessage('')

    const result = await discoverInstance(serverUrl)

    if (!result.ok) {
      setDiscoveryStatus('discovery-failed')
      setDiscoveryMessage(`${result.message} Try manual configuration below.`)
      return
    }

    setDiscoveryStatus('idle')
    setUrl(result.supabaseUrl)
    setKey(result.supabaseKey)

    await validateAndSave(result.supabaseUrl, result.supabaseKey)
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
      <p className="text-sm text-warm-ash">Connect to Server</p>

      {hasEnvVars && status !== 'ok' && status !== 'idle' && status !== 'validating' && (
        <p className="rounded-md bg-warning-flare/10 px-3 py-2 text-xs text-warning-flare">
          Environment variables were detected but the connection failed. Check the values below.
        </p>
      )}

      {/* Primary section: Server URL discovery */}
      <div className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="setup-server-url" className={FORGE_LABEL_CLASS}>
            Server address
          </label>
          <div className="flex gap-2">
            <ForgeInput
              id="setup-server-url"
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="forge.example.com"
              className="flex-1"
            />
            <button
              type="button"
              disabled
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-surface-charcoal opacity-30 cursor-not-allowed"
              aria-label="Scan QR code (coming soon)"
            >
              <QrCode className="h-4 w-4 text-warm-ash" />
            </button>
          </div>
        </div>

        <Button
          type="button"
          className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/90"
          onClick={handleDiscoverAndConnect}
          disabled={discoveryStatus === 'discovering' || status === 'validating'}
        >
          {discoveryStatus === 'discovering'
            ? 'Looking up server...'
            : status === 'validating'
              ? 'Connecting...'
              : 'Connect'}
        </Button>

        {/* Discovery status feedback */}
        {discoveryStatus === 'discovering' && (
          <p className="text-xs text-warm-ash animate-pulse">Looking up server...</p>
        )}
        {discoveryStatus === 'discovery-failed' && (
          <p className="text-xs text-warning-flare">{discoveryMessage}</p>
        )}

        {/* Validation status feedback (shown after discovery succeeds) */}
        {status === 'validating' && (
          <p className="text-xs text-warm-ash animate-pulse">Connecting...</p>
        )}
        {status === 'ok' && <p className="text-xs text-forge">{message}</p>}
        {(status === 'no-schema' || status === 'unreachable') && (
          <p className="text-xs text-warning-flare">{message}</p>
        )}
      </div>

      {/* "Or" divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-surface-charcoal" />
        <span className="text-xs text-industrial">or</span>
        <div className="flex-1 border-t border-surface-charcoal" />
      </div>

      {/* Manual configuration toggle */}
      <button
        type="button"
        className="flex w-full items-center justify-between text-sm text-warm-ash"
        onClick={() => setAdvancedOpen(!advancedOpen)}
      >
        Manual configuration
        {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {advancedOpen && (
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

          <Button
            type="button"
            className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/90"
            onClick={handleConnect}
            disabled={status === 'validating'}
          >
            {status === 'validating' ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      )}

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
