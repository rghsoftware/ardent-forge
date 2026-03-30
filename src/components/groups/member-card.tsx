import { useUpdateMemberRole, useRemoveMember } from '@/hooks/use-groups'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import type { GroupMember } from '@/domain/types'

interface MemberCardProps {
  member: GroupMember
  isCoach: boolean
  currentUserId: string
  groupId: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function MemberCard({ member, isCoach, currentUserId, groupId }: MemberCardProps) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const isCurrentUser = member.userId === currentUserId
  const initial = member.userId.charAt(0).toUpperCase()
  const displayId = isCurrentUser ? 'You' : `${member.userId.slice(0, 8)}...`

  const handleToggleRole = () => {
    const newRole = member.role === 'COACH' ? 'MEMBER' : 'COACH'
    updateRole.mutate({ groupId, userId: member.userId, role: newRole })
  }

  const handleRemove = () => {
    removeMember.mutate({ groupId, userId: member.userId })
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 min-h-12 bg-surface-iron">
      {/* Avatar + info */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-ember/20 text-ember text-xs font-semibold uppercase shrink-0">
          {initial}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm text-bone-white truncate">{displayId}</span>
          <span className="text-xs text-warm-ash/50">Joined {formatDate(member.joinedAt)}</span>
        </div>
      </div>

      {/* Role + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={member.role === 'COACH' ? 'complete' : 'default'}>{member.role}</Badge>

        {isCoach && !isCurrentUser && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleToggleRole}
              disabled={updateRole.isPending}
              aria-label={`Change role to ${member.role === 'COACH' ? 'member' : 'coach'}`}
            >
              <Icon name="swap_horiz" size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleRemove}
              disabled={removeMember.isPending}
              aria-label="Remove member"
            >
              <Icon name="person_remove" size={16} className="text-warning-flare" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
