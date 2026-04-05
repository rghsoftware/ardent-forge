import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useGroups } from '@/hooks/use-groups'
import { GroupCreateDialog } from './group-create-dialog'
import { JoinGroupDialog } from './join-group-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import type { AccountabilityGroup } from '@/domain/types'

function GroupListSkeleton() {
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
          <Skeleton className="h-5 w-16 rounded-none bg-surface-steel" />
        </div>
      ))}
    </div>
  )
}

function GroupCard({
  group,
  memberCount,
  role,
  onClick,
  index,
}: {
  group: AccountabilityGroup
  memberCount?: number
  role?: string
  onClick: () => void
  index: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-4 min-h-12 text-left transition-colors hover:bg-surface-gunmetal ${
        index % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
      }`}
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="font-heading text-sm font-medium text-bone-white truncate">
          {group.name}
        </span>
        {group.description && (
          <span className="text-xs text-warm-ash/70 truncate">{group.description}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {memberCount !== undefined && (
          <span className="flex items-center gap-1 text-xs text-warm-ash/60">
            <Icon name="group" size={14} />
            {memberCount}
          </span>
        )}
        {role && <Badge variant={role === 'COACH' ? 'complete' : 'default'}>{role}</Badge>}
        <Icon name="chevron_right" size={18} className="text-warm-ash/40" />
      </div>
    </button>
  )
}

export function GroupList() {
  const navigate = useNavigate()
  const { data: groups = [], isLoading, isError } = useGroups()
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-6 pb-4 md:px-6 lg:px-8">
          <h1 className="font-display text-xl font-medium text-bone-white">Groups</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setJoinOpen(true)}>
              Join
            </Button>
            <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
              Create
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <GroupListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-16">
            <Icon name="cloud_off" size={36} className="mb-3 text-warning-flare" />
            <p className="font-display text-sm text-warning-flare">Failed to load groups</p>
            <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
            <Icon name="groups" size={48} className="text-warm-ash/30" />
            <p className="text-sm font-heading text-warm-ash">You're not in any groups yet.</p>
            <p className="text-xs text-warm-ash/50 leading-relaxed">
              Create a group to train with friends, or join one with an invite code.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={() => setJoinOpen(true)}>
                Join group
              </Button>
              <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
                Create group
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            {groups.map((group, i) => (
              <GroupCard
                key={group.id}
                group={group}
                index={i}
                onClick={() => navigate({ to: '/groups/$groupId', params: { groupId: group.id } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <GroupCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  )
}
