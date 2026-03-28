import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { Program, Block, BlockWeek, ScheduledSession } from '@/domain/types'

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePrograms(userId: string | undefined) {
  return useQuery({
    queryKey: ['programs', userId],
    queryFn: () => getAdapter().getPrograms(userId!),
    enabled: !!userId,
  })
}

export function useProgramFull(id: string | undefined) {
  return useQuery({
    queryKey: ['program-full', id],
    queryFn: () => getAdapter().getProgramFull(id!),
    enabled: !!id,
  })
}

export function useActiveProgram(userId: string | undefined) {
  return useQuery({
    queryKey: ['active-program', userId],
    queryFn: () => getAdapter().getActiveProgram(userId!),
    enabled: !!userId,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      program,
      blocks,
    }: {
      program: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>
      blocks: Array<{
        block: Omit<Block, 'id' | 'programId'>
        weeks: Array<{
          week: Omit<BlockWeek, 'id' | 'blockId'>
          sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
        }>
      }>
    }) => getAdapter().createProgramFull(program, blocks),
    onError: (err) => {
      console.error('[programs] Failed to create program:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
    },
  })
}

export function useUpdateProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      program,
      blocks,
    }: {
      program: Program
      blocks: Array<{
        block: Omit<Block, 'programId'>
        weeks: Array<{
          week: Omit<BlockWeek, 'blockId'>
          sessions: Array<Omit<ScheduledSession, 'id' | 'blockWeekId'>>
        }>
      }>
    }) => getAdapter().updateProgramFull(program, blocks),
    onError: (err) => {
      console.error('[programs] Failed to update program:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({
        queryKey: ['program-full', variables.program.id],
      })
    },
  })
}

export function useDeleteProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => getAdapter().deleteProgram(id),
    onError: (err) => {
      console.error('[programs] Failed to delete program:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] })
      queryClient.invalidateQueries({ queryKey: ['active-program'] })
    },
  })
}

export function useSetActiveProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      programId,
      startDate,
    }: {
      userId: string
      programId: string
      startDate?: string
    }) => getAdapter().setActiveProgram(userId, programId, startDate),
    onError: (err) => {
      console.error('[programs] Failed to set active program:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-program'] })
    },
  })
}

export function useUpdateActiveProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      updates,
    }: {
      userId: string
      updates: { currentBlockOrdinal?: number; currentWeekNumber?: number }
    }) => getAdapter().updateActiveProgram(userId, updates),
    onError: (err) => {
      console.error('[programs] Failed to update active program:', err)
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['active-program', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['programs', variables.userId] })
    },
  })
}

export function useClearActiveProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => getAdapter().clearActiveProgram(userId),
    onError: (err) => {
      console.error('[programs] Failed to clear active program:', err)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-program'] })
    },
  })
}
