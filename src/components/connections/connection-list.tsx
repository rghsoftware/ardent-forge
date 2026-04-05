import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import {
  useConnections,
  usePendingConnections,
  useRemoveConnection,
  useUpdateWriteAccess,
} from '@/hooks/use-connections'
import { ConnectionRequestDialog } from './connection-request-dialog'
import { PendingRequests } from './pending-requests'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import type { DirectConnection } from '@/domain/types'

function ConnectionListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-4 ${
            i % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
          }`}
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-4 w-40 rounded-none bg-surface-steel" />
            <Skeleton className="h-3 w-56 rounded-none bg-surface-steel" />
          </div>
          <Skeleton className="h-5 w-20 rounded-none bg-surface-steel" />
        </div>
      ))}
    </div>
  )
}

function ConnectionRow({
  connection,
  currentUserId,
  index,
}: {
  connection: DirectConnection
  currentUserId: string
  index: number
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const remove = useRemoveConnection()
  const updateWrite = useUpdateWriteAccess()

  const isRequester = connection.requesterId === currentUserId
  const otherId = isRequester ? connection.recipientId : connection.requesterId
  const iGrantWrite = isRequester
    ? connection.requesterGrantsWrite
    : connection.recipientGrantsWrite
  const theyGrantWrite = isRequester
    ? connection.recipientGrantsWrite
    : connection.requesterGrantsWrite

  const connectedDate = connection.acceptedAt
    ? new Date(connection.acceptedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  function handleToggleWrite(checked: boolean) {
    updateWrite.mutate({ connectionId: connection.id, grantsWrite: checked })
  }

  return (
    <div
      className={`px-4 py-4 min-h-12 ${
        index % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="font-heading text-sm font-medium text-bone-white truncate">
            {otherId}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="complete">Connected</Badge>
            {connectedDate && <span className="text-xs text-warm-ash/50">{connectedDate}</span>}
          </div>
        </div>

        {confirmRemove ? (
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <Button
              variant="destructive"
              size="sm"
              className="min-h-10 rounded-none"
              disabled={remove.isPending}
              onClick={() => remove.mutate(connection.id)}
            >
              {remove.isPending ? '...' : 'Remove'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-10 rounded-none text-warm-ash"
              onClick={() => setConfirmRemove(false)}
            >
              Keep
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="shrink-0 ml-3 p-2 min-h-10 min-w-10 flex items-center justify-center text-warm-ash/40 hover:text-warning-flare transition-colors"
            onClick={() => setConfirmRemove(true)}
            aria-label="Remove connection"
          >
            <Icon name="person_remove" size={18} />
          </button>
        )}
      </div>

      {/* Write access controls */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-warm-ash/5">
        <label className="flex items-center gap-2 text-xs text-warm-ash/70 cursor-pointer">
          <Switch
            checked={iGrantWrite}
            onCheckedChange={handleToggleWrite}
            disabled={updateWrite.isPending}
            className="rounded-none"
          />
          You share write
        </label>
        <span className="flex items-center gap-1 text-xs text-warm-ash/50">
          {theyGrantWrite ? (
            <Icon name="check" size={14} className="text-forge-ember" />
          ) : (
            <Icon name="close" size={14} className="text-warm-ash/30" />
          )}
          They share write
        </span>
      </div>

      {(remove.isError || updateWrite.isError) && (
        <p className="mt-2 text-xs text-warning-flare">
          {remove.isError ? 'Failed to remove connection' : 'Failed to update write access'}
        </p>
      )}
    </div>
  )
}

export function ConnectionList() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const { data: connections = [], isLoading, isError } = useConnections()
  const { data: pending = [] } = usePendingConnections()

  const pendingCount = pending.length

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-6 pb-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Icon name="person_add" size={24} className="text-warm-ash" />
            <h1 className="font-display text-2xl font-medium text-bone-white">Connections</h1>
            {pendingCount > 0 && <Badge variant="default">{pendingCount} pending</Badge>}
          </div>
          <ConnectionRequestDialog />
        </div>

        {/* Pending requests */}
        {currentUserId && <PendingRequests currentUserId={currentUserId} />}

        {/* Active connections */}
        {isLoading ? (
          <ConnectionListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <Icon name="cloud_off" size={36} className="mb-3 text-warning-flare" />
            <p className="font-display text-sm text-warning-flare">Failed to load connections</p>
            <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
            <Icon name="people" size={48} className="text-warm-ash/30" />
            <p className="text-sm font-heading text-warm-ash">No connections yet.</p>
            <p className="text-xs text-warm-ash/50 leading-relaxed">
              Connect with other athletes to see their workouts.
            </p>
            <ConnectionRequestDialog />
          </div>
        ) : (
          <div className="flex-1">
            {connections.map((conn, i) => (
              <ConnectionRow
                key={conn.id}
                connection={conn}
                currentUserId={currentUserId}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
