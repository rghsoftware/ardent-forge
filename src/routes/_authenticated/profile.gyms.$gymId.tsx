import { useState, type ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useGym, useDeleteGym, useUpdateGym } from '@/hooks/use-gyms'
import {
  useGymRoster,
  useJoinGym,
  useLeaveGym,
  useKickGymMember,
} from '@/hooks/use-gym-members'
import { useProposeGymTransfer } from '@/hooks/use-gym-transfers'
import { GymDetailHeader } from '@/components/profile/gym-detail/gym-detail-header'
import { GymRoster } from '@/components/profile/gym-detail/gym-roster'
import { GymOwnerActions } from '@/components/profile/gym-detail/gym-owner-actions'
import { PendingTransferBanner } from '@/components/profile/gym-detail/pending-transfer-banner'
import { GymInviteDialog } from '@/components/profile/gym-detail/gym-invite-dialog'

export const Route = createFileRoute('/_authenticated/profile/gyms/$gymId')({
  component: GymDetailPage,
})

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">{children}</div>
    </div>
  )
}

function GymDetailPage() {
  const { gymId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const { data: gym, isLoading: gymLoading, isError: gymError } = useGym(gymId)
  const { data: roster } = useGymRoster(gymId)
  const updateGym = useUpdateGym()
  const deleteGym = useDeleteGym()
  const joinGym = useJoinGym()
  const leaveGym = useLeaveGym()
  const kickGymMember = useKickGymMember()
  const proposeTransfer = useProposeGymTransfer()

  const [inviteOpen, setInviteOpen] = useState(false)

  if (gymLoading) {
    return (
      <PageShell>
        <p data-testid="gym-detail-loading" className="px-4 py-8 text-xs text-warm-ash">
          Loading gym...
        </p>
      </PageShell>
    )
  }

  if (gymError || !gym) {
    return (
      <PageShell>
        <p
          data-testid="gym-detail-error"
          className="px-4 py-8 text-xs text-warning-flare"
          role="alert"
        >
          Failed to load this gym. It may have been deleted or you may not have access.
        </p>
      </PageShell>
    )
  }

  const isOwner = currentUserId === gym.ownerUserId
  const isMember = (roster ?? []).some((m) => m.userId === currentUserId)
  const ownerEntry = (roster ?? []).find((m) => m.userId === gym.ownerUserId)

  const handleRename = (name: string) => {
    updateGym.mutate({ id: gymId, name })
  }
  const handleDelete = () => {
    deleteGym.mutate(gymId, {
      onSuccess: () => navigate({ to: '/profile' }),
    })
  }
  const handleProposeTransfer = (targetUserId: string) => {
    proposeTransfer.mutate({ gymId, targetUserId })
  }
  const handleKick = (userId: string) => {
    kickGymMember.mutate({ gymId, userId })
  }

  return (
    <PageShell>
      <div className="space-y-4 py-4">
        <GymDetailHeader
          gym={gym}
          ownerDisplayName={ownerEntry?.displayName ?? null}
          memberCount={roster?.length ?? 0}
        />
        {currentUserId && <PendingTransferBanner gymId={gymId} currentUserId={currentUserId} />}
        <GymRoster
          gymId={gymId}
          onKick={isOwner ? handleKick : undefined}
          kickingUserId={
            kickGymMember.isPending && kickGymMember.variables
              ? kickGymMember.variables.userId
              : null
          }
        />
        {isOwner && (
          <GymOwnerActions
            gym={gym}
            members={roster ?? []}
            onRename={handleRename}
            onDelete={handleDelete}
            onProposeTransfer={handleProposeTransfer}
            onGenerateInvite={() => setInviteOpen(true)}
            renamePending={updateGym.isPending}
            deletePending={deleteGym.isPending}
          />
        )}
        {!isOwner && isMember && (
          <div className="bg-surface-pit/40 px-4 py-4">
            <Button
              variant="outline"
              data-testid="leave-gym-button"
              className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
              onClick={() => leaveGym.mutate(gymId, { onSuccess: () => navigate({ to: '/profile' }) })}
              disabled={leaveGym.isPending}
            >
              {leaveGym.isPending ? 'Leaving...' : 'Leave gym'}
            </Button>
          </div>
        )}
        {!isOwner && !isMember && (
          <div className="bg-surface-pit/40 px-4 py-4">
            <Button
              data-testid="join-gym-button"
              className="min-h-[48px] bg-forge text-on-forge hover:bg-forge/80"
              onClick={() => joinGym.mutate(gymId)}
              disabled={joinGym.isPending}
            >
              {joinGym.isPending ? 'Joining...' : 'Join gym'}
            </Button>
          </div>
        )}
        <GymInviteDialog gymId={gymId} open={inviteOpen} onOpenChange={setInviteOpen} />
      </div>
    </PageShell>
  )
}
