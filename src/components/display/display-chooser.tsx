import { type ReactElement } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useCreateGym } from '@/hooks/use-gyms'
import { useUserProfile } from '@/hooks/use-user-profile'
import { derivePersonalGymName } from '@/lib/display-setup'
import { gymErrorMessage } from '@/lib/gym-error-messages'
import type { Gym } from '@/domain/types'

// ---------------------------------------------------------------------------
// DisplayChooser -- 2+-gym full-page selection (F019 D14, M10-M11, TA6-TA7)
//
// Lists every gym the user is a member of as a real <Link> so the browser
// can hover-preview the destination and middle-click opens in a new tab.
// Renders a muted tonal "Start a personal display" row at the bottom so
// multi-gym users can still opt into the zero-ceremony personal flow
// without having to leave all their gyms first (Spec RD-16 / TA23).
// ---------------------------------------------------------------------------

interface DisplayChooserProps {
  gyms: Gym[]
  userId: string
}

export function DisplayChooser({ gyms, userId }: DisplayChooserProps): ReactElement {
  const { data: profile } = useUserProfile(userId)
  const createGym = useCreateGym()
  const navigate = useNavigate()

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
        <h1 className="mb-6 font-display text-2xl font-medium uppercase tracking-widest text-bone-white">
          SELECT DISPLAY
        </h1>

        <ul className="flex flex-col gap-1">
          {gyms.map((gym) => (
            <li key={gym.id} data-testid={`display-chooser-row-${gym.id}`}>
              <Link
                to="/display/gym/$gymId"
                params={{ gymId: gym.id }}
                aria-label={`Open display for ${gym.name}`}
                className="flex min-h-[48px] items-center bg-surface-charcoal/40 px-4 py-3 text-sm font-medium uppercase tracking-wider text-bone-white hover:bg-surface-charcoal/70"
              >
                {gym.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-surface-steel pt-6">
          <p className="mb-3 font-sans text-xs uppercase tracking-widest text-warm-ash">Or</p>
          <Button
            type="button"
            data-testid="display-chooser-start-personal"
            onClick={handleStartPersonal}
            disabled={createGym.isPending}
            className="min-h-[48px] w-full bg-surface-gunmetal text-warm-ash hover:bg-surface-gunmetal/80"
          >
            {createGym.isPending ? 'Creating...' : 'Start a personal display'}
          </Button>
          {createGym.isError && (
            <p
              role="alert"
              data-testid="display-chooser-personal-error"
              className="mt-2 text-xs text-warning-flare"
            >
              {gymErrorMessage(createGym.error, 'create')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
