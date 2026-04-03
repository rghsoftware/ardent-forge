import { useAuth } from '@/lib/auth'
import { useBlockedUsersStore } from '@/stores/blocked-users-store'

export function useBlockedUsers() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''

  const initialize = useBlockedUsersStore((s) => s.initialize)
  const blockedIds = useBlockedUsersStore((s) => s.blockedIds)
  const blockUser = useBlockedUsersStore((s) => s.blockUser)
  const unblockUser = useBlockedUsersStore((s) => s.unblockUser)
  const isBlocked = useBlockedUsersStore((s) => s.isBlocked)

  initialize(currentUserId)

  return { blockedIds, blockUser, unblockUser, isBlocked }
}
