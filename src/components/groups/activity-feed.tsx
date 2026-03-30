import { useGroupActivityFeed, useConnectionActivityFeed } from '@/hooks/use-activity-feed'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Icon } from '@/components/icon'
import type { ActivityFeedWorkoutSummary } from '@/lib/data-adapter'

function formatFeedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function FeedEntrySkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface-iron">
      <div className="flex flex-col gap-1.5 flex-1">
        <Skeleton className="h-3 w-24 rounded-none bg-surface-steel" />
        <Skeleton className="h-4 w-44 rounded-none bg-surface-steel" />
      </div>
      <Skeleton className="h-4 w-16 rounded-none bg-surface-steel" />
    </div>
  )
}

function FeedEntry({ entry }: { entry: ActivityFeedWorkoutSummary }) {
  const duration = formatDuration(entry.durationSeconds)

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-iron border-b border-ghost-line/10">
      {/* Left: user + workout info */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-xs text-warm-ash/60 truncate">
          {entry.userDisplayName || entry.userId.slice(0, 8)}
        </span>
        <span className="text-sm text-bone-white truncate">
          {entry.title || 'Untitled workout'}
        </span>
        <div className="flex items-center gap-3 text-xs text-warm-ash/50">
          <span>{entry.exerciseCount} exercises</span>
          {duration && <span>{duration}</span>}
        </div>
      </div>

      {/* Right: date */}
      <span className="text-xs text-warm-ash/40 shrink-0">{formatFeedDate(entry.startedAt)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group activity feed -- uses useGroupActivityFeed hook
// ---------------------------------------------------------------------------
function GroupFeed({ groupId }: { groupId: string }) {
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGroupActivityFeed(groupId)

  const entries: ActivityFeedWorkoutSummary[] = data?.pages.flatMap((page) => page) ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <FeedEntrySkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Icon name="cloud_off" size={28} className="mb-2 text-warning-flare" />
        <p className="text-xs text-warning-flare">Failed to load activity feed</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Icon name="fitness_center" size={32} className="mb-2 text-warm-ash/30" />
        <p className="text-xs text-warm-ash/50">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <FeedEntry key={`${entry.id}-${entry.startedAt}`} entry={entry} />
      ))}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connection activity feed -- uses useConnectionActivityFeed hook
// ---------------------------------------------------------------------------
function ConnectionFeed() {
  const { data, isLoading, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useConnectionActivityFeed()

  const entries: ActivityFeedWorkoutSummary[] = data?.pages.flatMap((page) => page) ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <FeedEntrySkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Icon name="cloud_off" size={28} className="mb-2 text-warning-flare" />
        <p className="text-xs text-warning-flare">Failed to load activity feed</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <Icon name="fitness_center" size={32} className="mb-2 text-warm-ash/30" />
        <p className="text-xs text-warm-ash/50">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <FeedEntry key={`${entry.id}-${entry.startedAt}`} entry={entry} />
      ))}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component -- dispatches to the appropriate feed sub-component
// ---------------------------------------------------------------------------
interface ActivityFeedProps {
  groupId?: string
  showConnectionFeed?: boolean
}

export function ActivityFeed({ groupId, showConnectionFeed }: ActivityFeedProps) {
  if (groupId) return <GroupFeed groupId={groupId} />
  if (showConnectionFeed) return <ConnectionFeed />
  return null
}
