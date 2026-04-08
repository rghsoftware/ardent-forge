import { useEffect, useState, type ReactElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { isTauri } from '@tauri-apps/api/core'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buildDisplayUrl, isDevOrigin } from '@/lib/display-url'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { discoverInstance } from '@/lib/discovery'
import { getConfigStore, type BackendConfig } from '@/lib/config-store'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// ShowDisplayPanel -- inline panel revealed under MyGymRow (F019 D18, M1-M5)
//
// Purely presentational over a small amount of local state: resolves the
// display URL from config / window.location on mount, renders the URL +
// Copy + QR, and surfaces the D22 backfill form when the Tauri config
// lacks `appUrl`.
//
// Props:
//   - gym: the gym this row belongs to
//   - isOpen: whether the panel should render (controlled by MyGymsList)
//
// Origin resolution:
//   - Web (isTauri() === false): `window.location.origin`
//   - Tauri + appUrl present:     persisted config.appUrl
//   - Tauri + appUrl missing:     null → D22 backfill form path
// ---------------------------------------------------------------------------

interface ShowDisplayPanelProps {
  gym: Gym
  isOpen: boolean
}

export function ShowDisplayPanel({ gym, isOpen }: ShowDisplayPanelProps): ReactElement | null {
  const [origin, setOrigin] = useState<string | null>(() =>
    isTauri() ? null : window.location.origin,
  )
  const [originLoaded, setOriginLoaded] = useState(!isTauri())

  // On Tauri, read the persisted appUrl asynchronously from the config
  // store. Only runs when the panel is opened to avoid touching the
  // Tauri SQLite layer eagerly for every collapsed row.
  useEffect(() => {
    if (!isOpen) return
    if (!isTauri()) return
    let cancelled = false
    ;(async () => {
      try {
        const config = await getConfigStore().getConfig()
        if (cancelled) return
        setOrigin(config?.appUrl ?? null)
      } catch (err) {
        console.error('[show-display-panel] Failed to read config for origin:', err)
        if (!cancelled) setOrigin(null)
      } finally {
        if (!cancelled) setOriginLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  if (!isOpen) return null

  // Still loading the Tauri config for the first time -- render nothing
  // transient rather than flashing the backfill form.
  if (!originLoaded) {
    return (
      <div className="mt-2 bg-surface-pit/60 px-3 py-3 text-[11px] text-warm-ash">
        Loading display URL...
      </div>
    )
  }

  const urlResult = buildDisplayUrl(gym.id, origin)

  if (!urlResult.ok) {
    return <BackfillForm gymId={gym.id} onRepaired={(newOrigin) => setOrigin(newOrigin)} />
  }
  const url = urlResult.url

  const devOrigin = origin !== null && isDevOrigin(origin)

  return (
    <div className="mt-2 flex flex-col gap-3 bg-surface-pit/60 px-3 py-3">
      <div className="flex flex-col gap-1">
        <span className={FORGE_LABEL_CLASS}>Display URL</span>
        <div className="flex min-h-12 items-center gap-2">
          <code
            data-testid={`show-display-url-${gym.id}`}
            className="flex-1 break-all bg-surface-charcoal/60 px-2 py-2 font-mono text-[11px] text-bone-white"
          >
            {url}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Copy display URL"
            data-testid={`show-display-copy-${gym.id}`}
            className="min-h-[48px] shrink-0 text-warm-ash hover:text-bone-white"
            onClick={() => {
              void copyToClipboard(url, {
                successMessage: 'Display URL copied',
                failureMessage: 'Copy failed -- long-press the URL to select it manually.',
                logPrefix: 'show-display-panel',
              })
            }}
          >
            <Copy className="mr-1 h-4 w-4" />
            Copy
          </Button>
        </div>
      </div>

      {devOrigin && (
        <p
          data-testid={`show-display-dev-warning-${gym.id}`}
          className="text-[11px] text-warning-flare/80"
        >
          This URL points at a dev origin. TVs outside this machine cannot reach it.
        </p>
      )}

      <div className="flex justify-center bg-surface-iron p-4">
        <QRCodeSVG
          value={url}
          size={192}
          level="M"
          marginSize={4}
          fgColor="#e5e2e1"
          bgColor="#201f1f"
          title="Display URL QR code"
          aria-label="Display URL QR code"
          className="h-auto w-full max-w-[192px]"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BackfillForm -- D22 repair path for Tauri configs missing appUrl
//
// Tauri users who went through Advanced-mode setup or upgraded from a
// pre-F019 build do not have `config.appUrl` persisted. Rather than
// logging them out and forcing a full re-setup, render an inline form
// that repairs the config in place: one text input for the server URL,
// one Save button. On Save we hit the discovery endpoint, merge the
// returned `app_url` into the existing persisted config, and hand
// control back to the parent panel which re-renders in URL + Copy + QR
// mode.
// ---------------------------------------------------------------------------

interface BackfillFormProps {
  gymId: string
  onRepaired: (newOrigin: string) => void
}

function BackfillForm({ gymId, onRepaired }: BackfillFormProps): ReactElement {
  const [serverUrl, setServerUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    if (!serverUrl.trim()) {
      setError('Enter a server URL.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const result = await discoverInstance(serverUrl)
      if (!result.ok) {
        // P15-007: Single error-object argument to stay within the
        // `[module] Description:` convention (log aggregators drop positional
        // args after the first error value).
        // P15-032: Distinct user copy per failure code so users can self-correct.
        console.error(
          `[show-display-panel] Backfill discovery failed (${result.error}):`,
          result.message,
        )
        switch (result.error) {
          case 'NETWORK_ERROR':
            setError('Could not reach that server. Check the URL and your connection.')
            break
          case 'NOT_FOUND':
            setError('No Ardent Forge instance found at that URL.')
            break
          case 'INVALID_RESPONSE':
            setError("That URL doesn't look like an Ardent Forge instance.")
            break
          case 'INVALID_INPUT':
            setError('Enter a valid URL (including http:// or https://).')
            break
          default: {
            const _exhaustive: never = result.error
            console.warn('[show-display-panel] Unmapped discovery error:', _exhaustive)
            setError('Could not verify that server. Check the URL and try again.')
          }
        }
        return
      }
      if (!result.appUrl) {
        console.error('[show-display-panel] Backfill discovery returned no app_url')
        setError('That server does not support display URLs. Upgrade the server and try again.')
        return
      }

      const store = getConfigStore()
      const existing = await store.getConfig()
      if (!existing) {
        console.error('[show-display-panel] Backfill: no existing config to merge into')
        setError('App is not configured yet. Complete setup first.')
        return
      }

      const merged: BackendConfig = {
        ...existing,
        appUrl: result.appUrl,
      }
      // P15-004: Wrap setConfig in its own try/catch so Tauri SQLite write
      // failures (quota exhaustion, broken plugin handle) produce a specific
      // log and a persist-specific user message, not a generic "unexpected
      // error" that could also mean the discovery fetch failed.
      try {
        await store.setConfig(merged)
      } catch (persistErr) {
        console.error('[show-display-panel] Backfill: setConfig failed', persistErr)
        setError('Failed to save the repaired configuration. Try again or restart the app.')
        return
      }
      onRepaired(result.appUrl)
    } catch (err) {
      console.error('[show-display-panel] Backfill unexpected error:', err)
      setError('Unexpected error. Check the URL and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid={`show-display-backfill-${gymId}`}
      className="mt-2 flex flex-col gap-3 bg-surface-pit/60 px-3 py-3"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={`backfill-server-url-${gymId}`} className={FORGE_LABEL_CLASS}>
            Server URL
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11px] uppercase tracking-wider text-ember hover:text-ember/80"
                aria-label="What is a server URL?"
              >
                What is this?
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 rounded-none border-surface-steel bg-surface-iron p-3 text-xs text-warm-ash">
              The URL where your Ardent Forge app is hosted. This is the same URL you used when you
              first set up the app.
            </PopoverContent>
          </Popover>
        </div>
        <ForgeInput
          id={`backfill-server-url-${gymId}`}
          type="text"
          placeholder="forge.example.com"
          value={serverUrl}
          onChange={(e) => {
            setServerUrl(e.target.value)
            if (error) setError(null)
          }}
          data-testid={`show-display-backfill-input-${gymId}`}
        />
      </div>

      <Button
        type="button"
        onClick={handleSave}
        disabled={saving}
        data-testid={`show-display-backfill-save-${gymId}`}
        className="min-h-[48px] bg-forge text-on-forge hover:bg-forge/80 disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>

      {error && (
        <p
          role="alert"
          data-testid={`show-display-backfill-error-${gymId}`}
          className="text-xs text-warning-flare"
        >
          {error}
        </p>
      )}
    </div>
  )
}
