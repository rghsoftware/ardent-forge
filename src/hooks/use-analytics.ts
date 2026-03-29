import { useQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import type { WeeklyVolumeEntry } from '@/domain/types'
import type { VaultSummary } from '@/lib/data-adapter'

export function useWeeklyVolume(
  userId: string | undefined,
  exerciseId: string | undefined,
  weeks = 8,
) {
  return useQuery<WeeklyVolumeEntry[]>({
    queryKey: ['weeklyVolume', userId, exerciseId, weeks],
    queryFn: () => getAdapter().getWeeklyVolume(userId!, exerciseId!, weeks),
    enabled: !!userId && !!exerciseId,
  })
}

export function useVaultSummary(userId: string | undefined) {
  return useQuery<VaultSummary>({
    queryKey: ['vaultSummary', userId],
    queryFn: () => getAdapter().getVaultSummary(userId!),
    enabled: !!userId,
  })
}
