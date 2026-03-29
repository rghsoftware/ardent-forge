import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { isTauri, invoke } from '@tauri-apps/api/core'
import { getConfigStore } from '@/lib/config-store'
import type { BackendConfig } from '@/lib/config-store'
import { validateConnection } from '@/lib/connection-validator'
import type { ConnectionUiStatus } from '@/lib/connection-validator'
import { resetSupabaseClient, initSupabaseFromConfig } from '@/lib/supabase'
import { resetAdapter } from '@/lib/adapter'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function BackendSettings() {
  const router = useRouter()
  const { signOut } = useAuth()

  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<ConnectionUiStatus>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    getConfigStore()
      .getConfig()
      .then((config) => {
        if (config) setCurrentUrl(config.supabaseUrl)
      })
      .catch((err) => {
        console.error('[backend-settings] Failed to load config:', err)
      })
  }, [])

  const truncatedUrl =
    currentUrl && currentUrl.length > 30 ? currentUrl.slice(0, 30) + '...' : currentUrl

  const handleCopy = async () => {
    if (!currentUrl) return
    try {
      await navigator.clipboard.writeText(currentUrl)
    } catch {
      // Copy is non-critical, swallow silently
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const applyBackendChange = async (skipValidation = false) => {
    setStatus('validating')
    setMessage('')

    if (!skipValidation) {
      const result = await validateConnection(url, key)

      if (result.status !== 'ok') {
        setStatus(result.status)
        setMessage(
          result.status === 'no-schema'
            ? 'Connected, but database schema not found. See the setup guide.'
            : 'Cannot reach server. Check URL and key.',
        )
        return
      }
    }

    try {
      // Tauri mode: wipe synced data first
      if (isTauri()) {
        try {
          await invoke('wipe_synced_data', { confirmation: 'WIPE_CONFIRMED' })
        } catch (err) {
          console.error('[backend-settings] Failed to wipe synced data:', err)
          setStatus('unreachable')
          setMessage('Could not clear local data. Please try again or restart the app.')
          return
        }
      }

      // Clear auth, persist new config, reset client + adapter
      await signOut()
      const config: BackendConfig = { supabaseUrl: url, supabaseKey: key }
      await getConfigStore().setConfig(config)
      resetSupabaseClient()
      initSupabaseFromConfig(config)
      resetAdapter()

      router.navigate({ to: '/sign-in', search: { reason: undefined } })
    } catch (err) {
      console.error('[backend-settings] Unexpected error during backend change:', err)
      setStatus('unreachable')
      setMessage('An unexpected error occurred. Please try again.')
    }
  }

  const handleSubmit = async () => {
    if (!url || !key) {
      setStatus('unreachable')
      setMessage('Both fields are required.')
      return
    }

    if (isTauri()) {
      // Validate first, then show confirmation dialog
      setStatus('validating')
      setMessage('')
      const result = await validateConnection(url, key)

      if (result.status !== 'ok') {
        setStatus(result.status)
        setMessage(
          result.status === 'no-schema'
            ? 'Connected, but database schema not found. See the setup guide.'
            : 'Cannot reach server. Check URL and key.',
        )
        return
      }

      setStatus('idle')
      setConfirmOpen(true)
    } else {
      await applyBackendChange()
    }
  }

  const handleConfirm = async () => {
    setConfirmOpen(false)
    await applyBackendChange(true)
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Current URL display */}
      {currentUrl && !editing && (
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate font-mono text-xs text-bone-white">{truncatedUrl}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-warm-ash hover:text-bone-white"
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}

      {!editing && (
        <Button
          variant="outline"
          className="min-h-[48px] w-full border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
          onClick={() => {
            setEditing(true)
            setStatus('idle')
            setMessage('')
            setUrl('')
            setKey('')
          }}
        >
          Change backend
        </Button>
      )}

      {editing && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="backend-url" className={FORGE_LABEL_CLASS}>
              Supabase URL
            </label>
            <ForgeInput
              id="backend-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="backend-key" className={FORGE_LABEL_CLASS}>
              Publishable Key
            </label>
            <ForgeInput
              id="backend-key"
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
          {(status === 'no-schema' || status === 'unreachable') && (
            <p className="text-xs text-warning-flare">{message}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[48px] flex-1 border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              className="min-h-[48px] flex-1 bg-forge text-on-forge hover:bg-forge/90"
              onClick={handleSubmit}
              disabled={status === 'validating'}
            >
              {status === 'validating' ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {/* Tauri confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Change backend</DialogTitle>
            <DialogDescription className="text-warm-ash">
              Changing the backend will sign you out and delete all locally cached data. Your data
              on the previous server is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-warning-flare text-on-forge hover:bg-warning-flare/80"
              onClick={handleConfirm}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
