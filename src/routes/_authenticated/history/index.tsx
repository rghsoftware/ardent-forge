import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '@/lib/auth'
import { useWorkoutLogsSummary } from '@/hooks/use-workout-logs'
import { WorkoutHistoryCard } from '@/components/history/workout-history-card'
import { GhostSessionPreview } from '@/components/shared/ghost-session-preview'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import { useOnboarding } from '@/hooks/use-onboarding'
import { filterHistoryBySessionNote } from './filter-history'

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
  const { user, isGuest } = useAuth()
  const navigate = useNavigate()
  const userId = user?.id ?? ''
  const { markRouteVisited } = useOnboarding()

  useEffect(() => {
    markRouteVisited('/history')
  }, [markRouteVisited])

  const { data: summaries = [], isLoading, isError } = useWorkoutLogsSummary(userId)

  const [searchQuery, setSearchQuery] = useState('')

  // Filter to only completed workouts, then apply search
  const completedSummaries = useMemo(
    () =>
      filterHistoryBySessionNote(
        summaries.filter((s) => !!s.log.completedAt),
        searchQuery,
      ),
    [summaries, searchQuery],
  )
  const hasActiveQuery = searchQuery.trim().length > 0

  const parentRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer manages its own deps
  const rowVirtualizer = useVirtualizer({
    count: completedSummaries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  // If no userId and not guest, show loading -- avoids silent empty-data state
  if (!userId && !isGuest) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  const handleCardClick = (workoutId: string) => {
    navigate({ to: '/history/$workoutId', params: { workoutId } })
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-anvil">
      {/* Header */}
      <div className="mx-auto w-full max-w-5xl flex items-center gap-3 px-4 pt-6 pb-4 md:px-6 lg:px-8">
        <Icon name="history" size={24} className="text-warm-ash" />
        <h1 className="font-display text-2xl font-medium text-bone-white">Tracker</h1>
        <button
          type="button"
          onClick={() => navigate({ to: '/log/new' })}
          aria-label="Log past workout"
          className="ml-auto h-12 w-12 flex items-center justify-center text-warm-ash hover:text-bone-white"
        >
          <Icon name="add" size={24} />
        </button>
      </div>

      {/* Search */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-3 md:px-6 lg:px-8">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes, tags, or titles..."
          aria-label="Search workout history"
          className="h-12 w-full border border-warm-ash/25 bg-surface-pit px-3 text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="mx-auto w-full max-w-5xl md:px-6 lg:px-8">
          <HistoryListSkeleton />
        </div>
      ) : isError ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 py-16 md:px-6 lg:px-8">
          <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">
            cloud_off
          </span>
          <p className="font-display text-sm text-warning-flare">Failed to load history</p>
          <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
        </div>
      ) : completedSummaries.length === 0 && hasActiveQuery ? (
        <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6 lg:px-8">
          <p className="text-center text-sm text-warm-ash">No workouts match.</p>
        </div>
      ) : completedSummaries.length === 0 ? (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col md:px-6 lg:px-8">
          {/* Ghost preview: mirrors real history row layout */}
          <GhostSessionPreview />

          <EmptyState
            icon="history"
            heading="Your training history starts here"
            subtext="Every completed workout appears here with exercise breakdowns, volume totals, and PR indicators."
            action={
              <button
                type="button"
                onClick={() => navigate({ to: '/' })}
                className="inline-flex min-h-[48px] items-center bg-forge px-4 py-2 text-xs font-medium text-on-forge hover:bg-forge/80"
              >
                Log your first workout
              </button>
            }
            className="py-10"
          />
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
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <div className="w-full max-w-5xl md:px-6 lg:px-8">
                    <WorkoutHistoryCard
                      summary={summary}
                      index={virtualItem.index}
                      onClick={() => handleCardClick(summary.log.id)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
