import type { ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import {
  usePendingGymTransfer,
  useAcceptGymTransfer,
  useCancelOrDeclineGymTransfer,
} from '@/hooks/use-gym-transfers'

interface PendingTransferBannerProps {
  gymId: string
  currentUserId: string
}

export function PendingTransferBanner({
  gymId,
  currentUserId,
}: PendingTransferBannerProps): ReactElement | null {
  const { data: pending, isError } = usePendingGymTransfer(gymId)
  const accept = useAcceptGymTransfer()
  const cancelOrDecline = useCancelOrDeclineGymTransfer()

  if (isError || !pending) return null

  const isTarget = pending.proposedTo === currentUserId
  const isProposer = pending.proposedBy === currentUserId

  if (!isTarget && !isProposer) return null

  return (
    <section data-testid="pending-transfer-banner" className="bg-forge/20 px-4 py-3" role="status">
      <p className="font-sans text-[11px] font-medium uppercase tracking-widest text-forge">
        PENDING OWNERSHIP TRANSFER
      </p>
      <p className="mt-1 font-sans text-sm text-bone-white">
        {isTarget
          ? 'You have been proposed as the new owner of this gym.'
          : 'You have proposed transferring ownership of this gym.'}
      </p>
      <div className="mt-3 flex gap-2">
        {isTarget && (
          <>
            <Button
              data-testid="accept-transfer-button"
              className="min-h-[48px] bg-forge text-on-forge hover:bg-forge/80"
              onClick={() => accept.mutate({ gymId })}
              disabled={accept.isPending}
            >
              {accept.isPending ? 'Accepting...' : 'Accept'}
            </Button>
            <Button
              variant="outline"
              data-testid="decline-transfer-button"
              className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
              onClick={() => cancelOrDecline.mutate({ gymId })}
              disabled={cancelOrDecline.isPending}
            >
              {cancelOrDecline.isPending ? 'Declining...' : 'Decline'}
            </Button>
          </>
        )}
        {isProposer && (
          <Button
            variant="outline"
            data-testid="cancel-transfer-button"
            className="min-h-[48px] rounded-none border-surface-steel text-warm-ash hover:bg-surface-gunmetal"
            onClick={() => cancelOrDecline.mutate({ gymId })}
            disabled={cancelOrDecline.isPending}
          >
            {cancelOrDecline.isPending ? 'Cancelling...' : 'Cancel'}
          </Button>
        )}
      </div>
    </section>
  )
}
