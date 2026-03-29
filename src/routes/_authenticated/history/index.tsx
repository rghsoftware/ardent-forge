import { useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogsSummary } from '@/hooks/use-workout-logs'
import { WorkoutHistoryCard } from '@/components/history/workout-history-card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_authenticated/history/')({
  component: HistoryPage,
})

function HistoryListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-3 ${
            i % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
          }`}
        >
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-4 w-32 rounded-none bg-surface-steel" />
            <Skeleton className="h-3 w-48 rounded-none bg-surface-steel" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12 rounded-none bg-surface-steel" />
            <Skeleton className="h-5 w-14 rounded-none bg-surface-steel" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''

  const { data: summaries = [], isLoading, isError } = useWorkoutLogsSummary(userId)

  // Filter to only completed workouts
  const completedSummaries = summaries.filter((s) => !!s.log.completedAt)

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: completedSummaries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  const handleCardClick = (workoutId: string) => {
    navigate({ to: '/history/$workoutId', params: { workoutId } })
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-display text-xl font-medium text-bone-white">Tracker</h1>
      </div>

      {/* Content */}
      {isLoading ? (
        <HistoryListSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center px-4 py-16">
          <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
            cloud_off
          </span>
          <p className="font-display text-sm text-warning-flare">Failed to load history</p>
          <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
        </div>
      ) : completedSummaries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-warm-ash/40">
          <span
            className="material-symbols-outlined text-5xl"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
          >
            history
          </span>
          <p className="font-display text-sm text-warm-ash">No sessions logged</p>
          <p className="text-xs">Complete a workout to see it here</p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const summary = completedSummaries[virtualItem.index]
              return (
                <div
                  key={summary.log.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <WorkoutHistoryCard
                    summary={summary}
                    index={virtualItem.index}
                    onClick={() => handleCardClick(summary.log.id)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
