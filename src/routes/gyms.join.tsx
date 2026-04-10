import { useEffect, useState, type ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useRedeemGymInvite } from '@/hooks/use-gym-invites'
import type { RedeemInviteError } from '@/domain/types'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/gyms/join')({
  validateSearch: searchSchema,
  component: JoinGymPage,
})

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">{children}</div>
    </div>
  )
}

function JoinGymPage() {
  const { token: tokenFromUrl } = Route.useSearch()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [token] = useState<string | null>(tokenFromUrl ?? null)
  const [errorKind, setErrorKind] = useState<RedeemInviteError['kind'] | 'missing' | null>(null)
  const [unexpectedError, setUnexpectedError] = useState<string | null>(null)
  const redeem = useRedeemGymInvite()

  // Strip token from URL on mount so it doesn't leak via history/referrer.
  useEffect(() => {
    if (tokenFromUrl) {
      navigate({
        to: '/gyms/join',
        search: (prev) => ({ ...prev, token: undefined }),
        replace: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auth gate + redemption trigger.
  useEffect(() => {
    if (authLoading) return
    if (!token) {
      setErrorKind('missing')
      return
    }
    if (!user) {
      const returnTo = `/gyms/join?token=${encodeURIComponent(token)}`
      navigate({
        to: '/sign-in',
        search: { returnTo } as never,
        replace: true,
      })
      return
    }
    if (redeem.isIdle) {
      redeem.mutate(token, {
        onSuccess: (result) => {
          if (result.ok) {
            navigate({
              to: '/profile/gyms/$gymId',
              params: { gymId: result.gymId },
              replace: true,
            })
          } else {
            setErrorKind(result.error.kind)
          }
        },
        onError: (err) => {
          setUnexpectedError(err instanceof Error ? err.message : 'Unknown error')
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token])

  if (authLoading || (token && !errorKind && !unexpectedError && redeem.isPending)) {
    return (
      <PageShell>
        <p data-testid="join-gym-loading" className="text-xs text-warm-ash">
          Redeeming invite...
        </p>
      </PageShell>
    )
  }

  if (errorKind === 'missing') {
    return (
      <PageShell>
        <h1 className="font-sans text-lg font-semibold uppercase tracking-wider text-bone-white">
          Missing invite token
        </h1>
        <p data-testid="join-gym-missing" className="mt-2 text-sm text-warm-ash">
          The invite link is missing its token. Ask for a new link.
        </p>
        <Button
          className="mt-4 min-h-[48px] bg-forge text-on-forge hover:bg-forge/80"
          onClick={() => navigate({ to: '/profile' })}
        >
          Go to profile
        </Button>
      </PageShell>
    )
  }

  if (errorKind === 'invalid') {
    return (
      <PageShell>
        <h1 className="font-sans text-lg font-semibold uppercase tracking-wider text-bone-white">
          Invalid invite
        </h1>
        <p data-testid="join-gym-invalid" className="mt-2 text-sm text-warm-ash">
          This invite link is not valid. It may have been revoked.
        </p>
      </PageShell>
    )
  }

  if (errorKind === 'expired') {
    return (
      <PageShell>
        <h1 className="font-sans text-lg font-semibold uppercase tracking-wider text-bone-white">
          Expired invite
        </h1>
        <p data-testid="join-gym-expired" className="mt-2 text-sm text-warm-ash">
          This invite has expired. Ask the gym owner for a new one.
        </p>
      </PageShell>
    )
  }

  if (errorKind === 'exhausted') {
    return (
      <PageShell>
        <h1 className="font-sans text-lg font-semibold uppercase tracking-wider text-bone-white">
          Invite fully used
        </h1>
        <p data-testid="join-gym-exhausted" className="mt-2 text-sm text-warm-ash">
          This invite has reached its maximum uses. Ask the gym owner for a new one.
        </p>
      </PageShell>
    )
  }

  if (unexpectedError) {
    return (
      <PageShell>
        <h1 className="font-sans text-lg font-semibold uppercase tracking-wider text-bone-white">
          Something went wrong
        </h1>
        <p
          data-testid="join-gym-unexpected"
          className="mt-2 text-sm text-warning-flare"
          role="alert"
        >
          {unexpectedError}
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <p className="text-xs text-warm-ash">Preparing...</p>
    </PageShell>
  )
}
