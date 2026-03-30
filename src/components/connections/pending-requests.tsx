import {
  usePendingConnections,
  useAcceptConnection,
  useDeclineConnection,
  useRemoveConnection,
} from '@/hooks/use-connections'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DirectConnection } from '@/domain/types'

function formatDaysAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function ReceivedRow({
  connection,
  currentUserId,
}: {
  connection: DirectConnection
  currentUserId: string
}) {
  const otherId =
    connection.requesterId === currentUserId ? connection.recipientId : connection.requesterId
  const accept = useAcceptConnection()
  const decline = useDeclineConnection()
  const isPending = accept.isPending || decline.isPending

  return (
    <div className="flex items-center justify-between px-4 py-3 min-h-12 bg-surface-iron">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-heading text-sm text-bone-white truncate">{otherId}</span>
        <span className="text-xs text-warm-ash/60">
          Requested {formatDaysAgo(connection.createdAt)}
        </span>
        {(accept.isError || decline.isError) && (
          <span className="text-xs text-warning-flare">Action failed</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <Button
          variant="default"
          size="sm"
          className="min-h-10 rounded-none"
          disabled={isPending}
          onClick={() => accept.mutate(connection.id)}
        >
          Accept
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-10 rounded-none text-warm-ash"
          disabled={isPending}
          onClick={() => decline.mutate(connection.id)}
        >
          Decline
        </Button>
      </div>
    </div>
  )
}

function SentRow({
  connection,
  currentUserId,
}: {
  connection: DirectConnection
  currentUserId: string
}) {
  const otherId =
    connection.requesterId === currentUserId ? connection.recipientId : connection.requesterId
  const remove = useRemoveConnection()

  return (
    <div className="flex items-center justify-between px-4 py-3 min-h-12 bg-surface-iron">
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="font-heading text-sm text-bone-white truncate">{otherId}</span>
        <span className="text-xs text-warm-ash/60">
          Requested {formatDaysAgo(connection.createdAt)}
        </span>
        {remove.isError && <span className="text-xs text-warning-flare">Failed to cancel</span>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-10 rounded-none text-warm-ash shrink-0 ml-3"
        disabled={remove.isPending}
        onClick={() => remove.mutate(connection.id)}
      >
        Cancel
      </Button>
    </div>
  )
}

export function PendingRequests({ currentUserId }: { currentUserId: string }) {
  const { data: pending = [], isLoading } = usePendingConnections()

  const received = pending.filter((c) => c.recipientId === currentUserId)
  const sent = pending.filter((c) => c.requesterId === currentUserId)

  if (isLoading) {
    return (
      <div className="space-y-0">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 bg-surface-iron">
            <Skeleton className="h-4 w-40 rounded-none bg-surface-steel" />
            <Skeleton className="h-8 w-20 rounded-none bg-surface-steel" />
          </div>
        ))}
      </div>
    )
  }

  if (received.length === 0 && sent.length === 0) return null

  return (
    <div>
      {received.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-surface-charcoal">
            <span className="text-xs font-heading tracking-wide uppercase text-warm-ash/60">
              Received
            </span>
          </div>
          <div className="space-y-px">
            {received.map((c) => (
              <ReceivedRow key={c.id} connection={c} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-surface-charcoal">
            <span className="text-xs font-heading tracking-wide uppercase text-warm-ash/60">
              Sent
            </span>
          </div>
          <div className="space-y-px">
            {sent.map((c) => (
              <SentRow key={c.id} connection={c} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
