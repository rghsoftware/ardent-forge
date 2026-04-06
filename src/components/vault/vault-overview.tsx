import { useAuth } from '@/lib/auth'
import { useVaultSummary } from '@/hooks/use-analytics'
import { useUserProfile } from '@/hooks/use-user-profile'
import { VaultMetricCard } from './vault-metric-card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'

function formatVolume(volumeLb: number, isMetric: boolean): string {
  if (isMetric) {
    const kg = Math.round(volumeLb / 2.205)
    return `${kg.toLocaleString()} kg`
  }
  return `${Math.round(volumeLb).toLocaleString()} lb`
}

export function VaultOverview() {
  const { user } = useAuth()
  const userId = user?.id
  const { data: profile } = useUserProfile(userId ?? '')
  const { data: summary, isLoading, isError } = useVaultSummary(userId)

  const isMetric = profile?.preferredUnits === 'METRIC'

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-none bg-surface-steel" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="font-display text-sm text-warning-flare">Failed to load analytics</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <EmptyState
        icon="monitoring"
        heading="No analytics yet."
        subtext="Complete your first workout and your metrics will populate here."
        className="py-12"
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 pt-4">
      <VaultMetricCard label="WORKOUTS" value={summary.totalWorkouts} />
      <VaultMetricCard label="VOLUME" value={formatVolume(summary.totalVolumeLb, isMetric)} />
      <VaultMetricCard label="THIS WEEK" value={summary.thisWeekWorkouts} />
      <VaultMetricCard
        label="THIS WEEK VOL"
        value={formatVolume(summary.thisWeekVolumeLb, isMetric)}
      />
    </div>
  )
}
