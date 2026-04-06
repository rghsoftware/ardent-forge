import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { isTauri } from '@tauri-apps/api/core'
import { ChevronDown, ChevronUp, QrCode, X } from 'lucide-react'
import { toast } from 'sonner'
import { getConfigStore } from '@/lib/config-store'
import type { BackendConfig } from '@/lib/config-store'
import { validateConnection } from '@/lib/connection-validator'
import { discoverInstance } from '@/lib/discovery'
import { parseInviteLink } from '@/lib/invite-link'
import { initSupabaseFromConfig } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'

type SetupState =
  | { phase: 'idle' }
  | { phase: 'discovering'; serverUrl: string }
  | { phase: 'discovery-failed'; serverUrl: string; error: string }
  | { phase: 'validating'; supabaseUrl: string; supabaseKey: string }
  | { phase: 'validation-failed'; supabaseUrl: string; supabaseKey: string; error: string }
  | { phase: 'schema-missing'; supabaseUrl: string; supabaseKey: string }
  | { phase: 'success' }

export const Route = createFileRoute('/setup')({
  validateSearch: (search: Record<string, unknown>): { url?: string; key?: string } => ({
    url: typeof search.url === 'string' ? search.url || undefined : undefined,
    key: typeof search.key === 'string' ? search.key || undefined : undefined,
  }),
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
  // Build-time env vars only apply to web builds -- on Tauri (mobile)
  // they point to the dev machine's localhost and are not reachable.
  const hasEnvVars = !isTauri() && Boolean(envUrl && envKey)

  // Form input state (controlled inputs)
  const [serverUrl, setServerUrl] = useState('')
  const [url, setUrl] = useState(envUrl)
  const [key, setKey] = useState(envKey)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [showPasteField, setShowPasteField] = useState(false)

  // Make the webview transparent while the QR scanner is active so the
  // native camera feed (rendered behind the webview) is visible.
  useEffect(() => {
    if (!scanning) return
    const html = document.documentElement
    const body = document.body
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    return () => {
      html.style.background = ''
      body.style.background = ''
    }
  }, [scanning])

  // Unified process state -- one discriminated union, no impossible states
  const [state, setState] = useState<SetupState>({ phase: 'idle' })
  const autoValidated = useRef(false)

  const isBusy = state.phase === 'discovering' || state.phase === 'validating'

  const validateAndSave = async (supabaseUrl: string, supabaseKey: string) => {
    setState({ phase: 'validating', supabaseUrl, supabaseKey })

    const result = await validateConnection(supabaseUrl, supabaseKey)

    if (result.status === 'ok') {
      try {
        const config: BackendConfig = { supabaseUrl, supabaseKey }
        await getConfigStore().setConfig(config)
        initSupabaseFromConfig(config)
        setState({ phase: 'success' })
        router.navigate({ to: '/sign-in', search: { reason: undefined } })
        return true
      } catch (err) {
        console.error('[setup] Failed to save configuration after validation:', err)
        setState({
          phase: 'validation-failed',
          supabaseUrl,
          supabaseKey,
          error: 'Connected but failed to save configuration. Please try again.',
        })
        return false
      }
    }

    if (result.status === 'no-schema') {
      setState({ phase: 'schema-missing', supabaseUrl, supabaseKey })
    } else {
      setState({
        phase: 'validation-failed',
        supabaseUrl,
        supabaseKey,
        error: result.message,
      })
    }
    return false
  }

  const handleConnect = async () => {
    if (!url || !key) {
      setState({
        phase: 'validation-failed',
        supabaseUrl: url,
        supabaseKey: key,
        error: 'Both fields are required.',
      })
      return
    }

    try {
      await validateAndSave(url, key)
    } catch (err) {
      console.error('[setup] Unexpected error in handleConnect:', err)
      setState({
        phase: 'validation-failed',
        supabaseUrl: url,
        supabaseKey: key,
        error: 'An unexpected error occurred. Please try again.',
      })
    }
  }

  const processInviteLink = async (raw: string) => {
    const parsed = parseInviteLink(raw)
    if (!parsed) {
      toast('Invalid invite link')
      return
    }
    setUrl(parsed.url)
    setKey(parsed.key)
    setAdvancedOpen(true)
    setShowPasteField(false)
    try {
      await validateAndSave(parsed.url, parsed.key)
    } catch (err) {
      console.error('[setup] Unexpected error in processInviteLink:', err)
      setState({
        phase: 'validation-failed',
        supabaseUrl: parsed.url,
        supabaseKey: parsed.key,
        error: 'An unexpected error occurred. Please try again.',
      })
    }
  }

  const cancelRef = useRef<(() => Promise<void>) | null>(null)

  const handleScan = async () => {
    if (!isTauri()) {
      console.error('[setup] QR scanning is only available in Tauri')
      return
    }
    try {
      const { scan, cancel, checkPermissions, requestPermissions, openAppSettings, Format } =
        await import('@tauri-apps/plugin-barcode-scanner')

      cancelRef.current = cancel

      let perms = await checkPermissions()
      if (perms === 'prompt') perms = await requestPermissions()
      if (perms !== 'granted') {
        toast('Camera permission required')
        await openAppSettings()
        return
      }

      setScanning(true)
      document.documentElement.classList.add('scanner-active')

      let content: string
      try {
        const result = await scan({ windowed: true, formats: [Format.QRCode] })
        await cancel()
        content = result.content
      } catch (err) {
        console.error('[setup] Barcode scan failed:', err)
        toast('QR scan failed. Try pasting the invite link instead.')
        return
      } finally {
        document.documentElement.classList.remove('scanner-active')
        setScanning(false)
      }

      try {
        await processInviteLink(content)
      } catch (err) {
        console.error('[setup] Failed to process scanned invite:', err)
        toast('Could not process the scanned invite. The link may be invalid or expired.')
      }
    } catch (err) {
      console.error('[setup] QR scan setup failed:', err)
      toast('QR scanner is not available. Try pasting the invite link instead.')
    }
  }

  const handleDiscoverAndConnect = async () => {
    if (isBusy) return

    if (!serverUrl) {
      setState({ phase: 'discovery-failed', serverUrl, error: 'Server address is required.' })
      return
    }

    setState({ phase: 'discovering', serverUrl })

    try {
      const result = await discoverInstance(serverUrl)

      if (!result.ok) {
        setState({
          phase: 'discovery-failed',
          serverUrl,
          error: `${result.message} Try manual configuration below.`,
        })
        return
      }

      setUrl(result.supabaseUrl)
      setKey(result.supabaseKey)

      await validateAndSave(result.supabaseUrl, result.supabaseKey)
    } catch (err) {
      console.error('[setup] Unexpected error in handleDiscoverAndConnect:', err)
      setState({
        phase: 'discovery-failed',
        serverUrl,
        error: 'An unexpected error occurred. Please try again.',
      })
    }
  }

  const search = Route.useSearch()
  const deepLinkPopulated = useRef(false)

  // Pre-populate from deep link search params (url & key from /connect redirect)
  useEffect(() => {
    if (search.url && search.key && !deepLinkPopulated.current) {
      deepLinkPopulated.current = true
      setUrl(search.url)
      setKey(search.key)
      setAdvancedOpen(true)
      validateAndSave(search.url, search.key).catch((err) => {
        console.error('[setup] Auto-validate from deep link failed:', err)
        toast('Auto-connection failed. Please try connecting manually.')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-validate when env vars pre-fill both fields so the user
  // immediately sees why the connection failed instead of a blank form.
  useEffect(() => {
    if (hasEnvVars && !autoValidated.current && !deepLinkPopulated.current) {
      autoValidated.current = true
      handleConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showEnvWarning =
    hasEnvVars && (state.phase === 'validation-failed' || state.phase === 'schema-missing')

  if (scanning) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
        <div className="h-[280px] w-[280px] rounded-lg border-2 border-ember" />
        <button
          type="button"
          className="mt-8 flex items-center gap-2 rounded-md bg-black/60 px-6 py-3 text-sm text-bone-white"
          onClick={async () => {
            try {
              await cancelRef.current?.()
            } catch (err) {
              console.error('[setup] Failed to cancel scan:', err)
            }
            setScanning(false)
          }}
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    )
  }

  return (
    <AuthPageShell>
      <h1 className="font-display text-xl font-medium text-bone-white">Connect to server</h1>

      {showEnvWarning && (
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-surface-charcoal hover:border-warm-ash hover:bg-surface-gunmetal"
              aria-label={isTauri() ? 'Scan QR code' : 'Paste invite link'}
              onClick={() => {
                if (isTauri()) {
                  handleScan().catch((err) => {
                    console.error('[setup] QR scan failed:', err)
                    toast('QR scan failed. Try pasting the invite link instead.')
                  })
                } else {
                  setShowPasteField(!showPasteField)
                }
              }}
            >
              <QrCode className="h-4 w-4 text-warm-ash" />
            </button>
          </div>

          {/* Browser paste field */}
          {!isTauri() && showPasteField && (
            <ForgeInput
              type="text"
              placeholder="Paste invite link"
              aria-label="Paste invite link"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  processInviteLink(e.currentTarget.value).catch((err) => {
                    console.error('[setup] Failed to process invite link:', err)
                    toast('Something went wrong. Please try again.')
                  })
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                if (pasted) {
                  e.preventDefault()
                  processInviteLink(pasted).catch((err) => {
                    console.error('[setup] Failed to process invite link:', err)
                    toast('Something went wrong. Please try again.')
                  })
                }
              }}
            />
          )}
        </div>

        <Button
          type="button"
          className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/90"
          onClick={handleDiscoverAndConnect}
          disabled={isBusy}
        >
          {state.phase === 'discovering'
            ? 'Looking up server...'
            : state.phase === 'validating'
              ? 'Connecting...'
              : 'Connect'}
        </Button>

        {/* Discovery status feedback */}
        {state.phase === 'discovering' && (
          <p className="text-xs text-warm-ash animate-pulse">Looking up server...</p>
        )}
        {state.phase === 'discovery-failed' && (
          <p className="text-xs text-warning-flare">{state.error}</p>
        )}

        {/* Validation status feedback (shared by both discovery and manual flows) */}
        {state.phase === 'validating' && (
          <p className="text-xs text-warm-ash animate-pulse">Connecting...</p>
        )}
        {state.phase === 'success' && <p className="text-xs text-forge">Connected successfully.</p>}
        {(state.phase === 'validation-failed' || state.phase === 'schema-missing') && (
          <p className="text-xs text-warning-flare">
            {state.phase === 'validation-failed'
              ? state.error
              : 'Database schema not found. Check that migrations have been applied.'}
          </p>
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
        aria-expanded={advancedOpen}
        aria-controls="manual-config-section"
      >
        Manual configuration
        {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {advancedOpen && (
        <div id="manual-config-section" className="space-y-5">
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
            disabled={state.phase === 'validating'}
          >
            {state.phase === 'validating' ? 'Connecting...' : 'Connect'}
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
      {/* Scanning overlay (Tauri/Android only) */}
      {scanning && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
          <div className="h-[280px] w-[280px] rounded-lg border-2 border-ember" />
          <button
            type="button"
            className="mt-8 flex items-center gap-2 rounded-md px-6 py-3 text-sm text-bone-white hover:bg-surface-gunmetal"
            onClick={async () => {
              try {
                await cancelRef.current?.()
              } catch (err) {
                console.error('[setup] Failed to cancel scan:', err)
              }
              setScanning(false)
            }}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      )}
    </AuthPageShell>
  )
}
