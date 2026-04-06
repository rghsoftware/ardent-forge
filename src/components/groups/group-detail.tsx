import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useGroup,
  useGroupMembers,
  useGroupInvites,
  useCreateInvite,
  useUpdateGroup,
  useDeleteGroup,
} from '@/hooks/use-groups'
import { useAuth } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import { EmptyState } from '@/components/shared/empty-state'
import { ActivityFeed } from './activity-feed'
import { MemberCard } from './member-card'
import { InviteCodeDisplay } from './invite-code-display'

interface GroupDetailProps {
  groupId: string
}

function DetailSkeleton() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      <div className="mx-auto w-full max-w-5xl">
        <div className="px-4 pt-6 pb-4 md:px-6 lg:px-8">
          <Skeleton className="h-6 w-48 rounded-none bg-surface-steel" />
          <Skeleton className="mt-2 h-4 w-72 rounded-none bg-surface-steel" />
        </div>
        <div className="px-4 py-2 md:px-6 lg:px-8">
          <Skeleton className="h-9 w-64 rounded-none bg-surface-steel" />
        </div>
        <div className="px-4 py-4 md:px-6 lg:px-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="mt-3 h-12 w-full rounded-none bg-surface-steel" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings tab (owner only)
// ---------------------------------------------------------------------------
function GroupSettings({ groupId }: { groupId: string }) {
  const { data: group } = useGroup(groupId)
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const navigate = useNavigate()

  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [retentionDays, setRetentionDays] = useState(String(group?.dataRetentionDays ?? 30))
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Group name is required.')
      return
    }
    if (trimmedName.length > 200) {
      setFormError('Group name must be 200 characters or fewer.')
      return
    }

    const days = parseInt(retentionDays, 10)
    if (isNaN(days) || days < 1 || days > 90) {
      setFormError('Data retention must be between 1 and 90 days.')
      return
    }

    try {
      await updateGroup.mutateAsync({
        id: groupId,
        updates: {
          name: trimmedName,
          description: description.trim() || undefined,
          dataRetentionDays: days,
        },
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update group.')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteGroup.mutateAsync(groupId)
      navigate({ to: '/groups' })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to delete group.')
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 px-4 py-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-name" className="text-xs text-warm-ash">
          Name
        </Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          error={!!formError && !name.trim()}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-desc" className="text-xs text-warm-ash">
          Description
        </Label>
        <textarea
          id="settings-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-surface-gunmetal text-bone-white px-3 py-2 rounded-none border-0 border-b-2 border-transparent outline-none placeholder:text-warm-ash/50 focus:border-b-ember resize-none text-sm"
        />
      </div>

      {/* Data retention */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settings-retention" className="text-xs text-warm-ash">
          Data retention (days)
        </Label>
        <Input
          id="settings-retention"
          type="number"
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          min={1}
          max={90}
        />
      </div>

      {formError && <p className="text-xs text-warning-flare">{formError}</p>}

      <Button type="submit" size="sm" disabled={updateGroup.isPending}>
        {updateGroup.isPending ? 'Saving...' : 'Save changes'}
      </Button>

      {/* Danger zone */}
      <div className="border-t border-ghost-line/15 pt-5 mt-3">
        <p className="text-xs uppercase tracking-wider text-warning-flare mb-3">Danger zone</p>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-warm-ash flex-1">
              This will permanently delete the group and all its data.
            </p>
            <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={handleDelete}
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending ? 'Deleting...' : 'Confirm delete'}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            Delete group
          </Button>
        )}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Members tab
// ---------------------------------------------------------------------------
function MembersTab({
  groupId,
  isCoach,
  currentUserId,
}: {
  groupId: string
  isCoach: boolean
  currentUserId: string
}) {
  const { data: members = [], isLoading } = useGroupMembers(groupId)
  const { data: invites = [] } = useGroupInvites(groupId)
  const createInvite = useCreateInvite()

  const activeInvites = invites.filter((inv) => inv.isActive)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0 px-0 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full bg-surface-steel" />
            <div className="flex flex-col gap-1 flex-1">
              <Skeleton className="h-4 w-28 rounded-none bg-surface-steel" />
              <Skeleton className="h-3 w-20 rounded-none bg-surface-steel" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Invite section (coaches only) */}
      {isCoach && (
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-ghost-line/10">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-warm-ash/60">Invite codes</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => createInvite.mutate(groupId)}
              disabled={createInvite.isPending}
            >
              {createInvite.isPending ? 'Creating...' : 'New invite'}
            </Button>
          </div>
          {createInvite.isError && (
            <p className="text-xs text-warning-flare">Failed to create invite</p>
          )}
          {activeInvites.length === 0 ? (
            <EmptyState
              icon="mail"
              heading="No active invites"
              subtext="Create an invite to add members to this group."
              className="px-4 py-6"
            />
          ) : (
            activeInvites.map((inv) => (
              <InviteCodeDisplay key={inv.id} invite={inv} groupId={groupId} />
            ))
          )}
        </div>
      )}

      {/* Members list */}
      <div className="flex flex-col">
        {members.length === 0 ? (
          <EmptyState
            icon="group"
            heading="No members yet"
            subtext="Invite connections to join this group."
            className="px-4 py-6"
          />
        ) : (
          members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isCoach={isCoach}
              currentUserId={currentUserId}
              groupId={groupId}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main group detail component
// ---------------------------------------------------------------------------
export function GroupDetail({ groupId }: GroupDetailProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: group, isLoading, isError } = useGroup(groupId)
  const { data: members = [] } = useGroupMembers(groupId)

  const currentUserId = user?.id ?? ''
  const currentMember = members.find((m) => m.userId === currentUserId)
  const isCoach = currentMember?.role === 'COACH'
  const isOwner = group?.createdBy === currentUserId

  if (isLoading) return <DetailSkeleton />

  if (isError) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 md:px-6 lg:px-8">
          <Icon name="error" size={36} className="mb-3 text-warning-flare" />
          <p className="font-display text-sm text-warning-flare">Failed to load group</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => navigate({ to: `/groups/${groupId}` })}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 md:px-6 lg:px-8">
          <Icon name="search_off" size={36} className="mb-3 text-warm-ash/50" />
          <p className="font-display text-sm text-warm-ash">Group not found</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => navigate({ to: '/groups' })}
          >
            Back to groups
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-6 pb-2 md:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate({ to: '/groups' })}
            className="flex items-center gap-1 text-xs text-warm-ash/60 hover:text-ember mb-3 min-h-8"
          >
            <Icon name="arrow_back" size={16} />
            <span>Groups</span>
          </button>
          <h1 className="font-display text-2xl font-medium text-bone-white">{group.name}</h1>
          {group.description && (
            <p className="mt-1 text-sm text-warm-ash/70">{group.description}</p>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="feed" className="flex-1">
          <TabsList variant="line" className="px-4 md:px-6 lg:px-8 w-full justify-start">
            <TabsTrigger value="feed" className="min-h-10 text-xs uppercase tracking-wider">
              Feed
            </TabsTrigger>
            <TabsTrigger value="members" className="min-h-10 text-xs uppercase tracking-wider">
              Members
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="settings" className="min-h-10 text-xs uppercase tracking-wider">
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="feed">
            <ActivityFeed groupId={groupId} />
          </TabsContent>

          <TabsContent value="members">
            <MembersTab groupId={groupId} isCoach={isCoach} currentUserId={currentUserId} />
          </TabsContent>

          {isOwner && (
            <TabsContent value="settings">
              <GroupSettings groupId={groupId} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
