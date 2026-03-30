import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useConnections() {
  return useQuery({
    queryKey: ['connections'],
    queryFn: () => getAdapter().getConnections(),
  })
}

export function usePendingConnections() {
  return useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: () => getAdapter().getPendingConnections(),
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useRequestConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (recipientId: string) => getAdapter().requestConnection(recipientId),
    onError: (err) => {
      console.error('[connections] Failed to request connection:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] })
    },
  })
}

export function useAcceptConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) => getAdapter().acceptConnection(connectionId),
    onError: (err) => {
      console.error('[connections] Failed to accept connection:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] })
    },
  })
}

export function useDeclineConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) => getAdapter().declineConnection(connectionId),
    onError: (err) => {
      console.error('[connections] Failed to decline connection:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] })
    },
  })
}

export function useRemoveConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (connectionId: string) => getAdapter().removeConnection(connectionId),
    onError: (err) => {
      console.error('[connections] Failed to remove connection:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    },
  })
}

export function useUpdateWriteAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ connectionId, grantsWrite }: { connectionId: string; grantsWrite: boolean }) =>
      getAdapter().updateConnectionWriteAccess(connectionId, grantsWrite),
    onError: (err) => {
      console.error('[connections] Failed to update write access:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    },
  })
}
