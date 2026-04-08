import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import { useCreateGym } from '@/hooks/use-gyms'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useQrScanner } from '@/hooks/use-qr-scanner'
import { parseDisplayUrlInput } from '@/lib/display-url'
import { derivePersonalGymName } from '@/lib/display-setup'
import { gymErrorMessage } from '@/lib/gym-error-messages'

// ---------------------------------------------------------------------------
// DisplaySetupPanel -- 0-gym setup UI (F019 D14, M12-M18)
//
// Two mutually-exclusive panels:
//
//   Panel A  "Use an existing display URL"
//     - auto-focused text input (accepts full URL / path-only / bare UUID)
//     - Enter key submits
//     - Scan QR button is visible only when useQrScanner() returns non-null
//     - On valid submission, navigates to /display/gym/$gymId
//     - On malformed input, renders an inline error
//
//   Panel B  "Start a personal display"
//     - One CTA that creates a gym with the derived personal name
//     - On success, navigates (replace) to the new gym's display
//     - On error, renders an inline error via gymErrorMessage
// ---------------------------------------------------------------------------

interface DisplaySetupPanelProps {
  userId: string
}

export function DisplaySetupPanel({ userId }: DisplaySetupPanelProps): ReactElement {
  const navigate = useNavigate()
  const createGym = useCreateGym()
  const { data: profile } = useUserProfile(userId)
  const qrScanner = useQrScanner()

  const [input, setInput] = useState('')
  const [panelAError, setPanelAError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // D19: manual auto-focus on mount instead of the `autoFocus` prop, which
  // has SSR / a11y quirks with React 19.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const navigateToGym = (gymId: string) => {
    navigate({
      to: '/display/gym/$gymId',
      params: { gymId },
    })
  }

  const handleSubmit = () => {
    const result = parseDisplayUrlInput(input)
    if (!result.ok) {
      setPanelAError(
        result.reason === 'empty'
          ? 'Enter a display URL.'
          : result.reason === 'not-a-uuid'
            ? 'That does not look like a display URL.'
            : 'That does not look like a display URL.',
      )
      return
    }
    setPanelAError(null)
    navigateToGym(result.gymId)
  }

  const handleScan = async () => {
    if (!qrScanner) return
    const content = await qrScanner.scan()
    if (content === null) return
    const result = parseDisplayUrlInput(content)
    if (!result.ok) {
      toast('Scanned code is not a display URL')
      inputRef.current?.focus()
      return
    }
    navigateToGym(result.gymId)
  }

  const handleStartPersonal = () => {
    const name = derivePersonalGymName(profile?.displayName)
    createGym.mutate(
      { name },
      {
        onSuccess: (newGym) => {
          navigate({
            to: '/display/gym/$gymId',
            params: { gymId: newGym.id },
            replace: true,
          })
        },
      },
    )
  }

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        <h1 className="mb-4 font-display text-2xl font-medium uppercase tracking-widest text-bone-white">
          SET UP DISPLAY
        </h1>
        <p data-testid="display-setup-intro" className="mb-8 text-sm text-warm-ash">
          Connect a TV at an existing gym, or broadcast only your own workouts to a personal
          display.
        </p>

        {/* Panel A: URL input */}
        <section className="mb-8 space-y-3">
          <h2 className={FORGE_LABEL_CLASS}>Use an existing display URL</h2>
          <div className="flex gap-2">
            <ForgeInput
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (panelAError) setPanelAError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Paste display URL or ID"
              aria-label="Display URL or ID"
              data-testid="display-setup-panel-a-input"
              className="flex-1"
            />
            {qrScanner && (
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-surface-charcoal hover:border-warm-ash hover:bg-surface-gunmetal"
                aria-label="Scan QR code"
                data-testid="display-setup-scan-qr"
                onClick={() => {
                  void handleScan()
                }}
              >
                <QrCode className="h-4 w-4 text-warm-ash" />
              </button>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            data-testid="display-setup-panel-a-submit"
            className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
          >
            Connect to display
          </Button>
          {panelAError && (
            <p
              role="alert"
              data-testid="display-setup-panel-a-error"
              className="text-xs text-warning-flare"
            >
              {panelAError}
            </p>
          )}
        </section>

        {/* Divider */}
        <div className="my-8 flex items-center gap-3">
          <div className="flex-1 border-t border-surface-steel" />
          <span className="text-xs uppercase tracking-widest text-warm-ash">or</span>
          <div className="flex-1 border-t border-surface-steel" />
        </div>

        {/* Panel B: Personal display */}
        <section className="space-y-3">
          <h2 className={FORGE_LABEL_CLASS}>Start a personal display</h2>
          <p className="text-xs text-warm-ash">
            Broadcast only your own workouts to a dedicated display for yourself.
          </p>
          <Button
            type="button"
            onClick={handleStartPersonal}
            disabled={createGym.isPending}
            data-testid="display-setup-panel-b-submit"
            className="min-h-[48px] w-full bg-surface-gunmetal text-bone-white hover:bg-surface-gunmetal/80 disabled:opacity-40"
          >
            {createGym.isPending ? 'Creating...' : 'Create personal display'}
          </Button>
          {createGym.isError && (
            <p
              role="alert"
              data-testid="display-setup-panel-b-error"
              className="text-xs text-warning-flare"
            >
              {gymErrorMessage(createGym.error, 'create')}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
