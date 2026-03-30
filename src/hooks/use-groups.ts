import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { AccountabilityGroup, GroupRole } from '@/domain/types'

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => getAdapter().getGroups(),
  })
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => getAdapter().getGroup(groupId),
    enabled: !!groupId,
  })
}

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId, 'members'],
    queryFn: () => getAdapter().getGroupMembers(groupId),
    enabled: !!groupId,
  })
}

export function useGroupInvites(groupId: string) {
  return useQuery({
    queryKey: ['groups', groupId, 'invites'],
    queryFn: () => getAdapter().getGroupInvites(groupId),
    enabled: !!groupId,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (group: Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>) =>
      getAdapter().createGroup(group),
    onError: (err) => {
      console.error('[groups] Failed to create group:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Pick<AccountabilityGroup, 'name' | 'description' | 'dataRetentionDays'>>
    }) => getAdapter().updateGroup(id, updates),
    onError: (err) => {
      console.error('[groups] Failed to update group:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().deleteGroup(id),
    onError: (err) => {
      console.error('[groups] Failed to delete group:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useJoinGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => getAdapter().joinGroupByCode(code),
    onError: (err) => {
      console.error('[groups] Failed to join group:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useLeaveGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      getAdapter().removeGroupMember(groupId, userId),
    onError: (err) => {
      console.error('[groups] Failed to leave group:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (groupId: string) => getAdapter().createInvite(groupId),
    onError: (err) => {
      console.error('[groups] Failed to create invite:', err)
    },
    onSettled: (_data, _err, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'invites'] })
    },
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ inviteId, groupId: _groupId }: { inviteId: string; groupId: string }) =>
      getAdapter().revokeInvite(inviteId),
    onError: (err) => {
      console.error('[groups] Failed to revoke invite:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'invites'] })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role: GroupRole }) =>
      getAdapter().updateMemberRole(groupId, userId, role),
    onError: (err) => {
      console.error('[groups] Failed to update member role:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      getAdapter().removeGroupMember(groupId, userId),
    onError: (err) => {
      console.error('[groups] Failed to remove member:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] })
    },
  })
}
