import { formatDateLabel, formatDuration } from '@/lib/format-duration'
import { Badge } from '@/components/ui/badge'
import type { WorkoutLogSummary } from '@/lib/data-adapter'

interface WorkoutHistoryCardProps {
  summary: WorkoutLogSummary
  index: number
  onClick: () => void
}

export function WorkoutHistoryCard({ summary, index, onClick }: WorkoutHistoryCardProps) {
  const { log, exerciseNames, setCount } = summary
  const startedAt = new Date(log.startedAt)
  const completedAt = log.completedAt ? new Date(log.completedAt) : null

  const durationSeconds = completedAt
    ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
    : null

  const dateLabel = formatDateLabel(startedAt)
  const exerciseList = exerciseNames.join(', ')

  const isEven = index % 2 === 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-h-[60px] items-center justify-between px-4 py-3 cursor-pointer text-left transition-colors active:brightness-125 ${
        isEven ? 'bg-surface-iron' : 'bg-surface-charcoal'
      }`}
      aria-label={`View workout from ${dateLabel}`}
    >
      {/* Left side: date + exercise names */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
        <span className="font-heading text-sm text-bone-white">{log.title ?? dateLabel}</span>
        <span className="text-xs text-warm-ash/60 truncate">{exerciseList || 'No exercises'}</span>
      </div>

      {/* Right side: duration + set count badge */}
      <div className="flex items-center gap-2 shrink-0">
        {durationSeconds != null && (
          <span className="font-display text-sm text-warm-ash tabular-nums">
            {formatDuration(durationSeconds)}
          </span>
        )}
        <Badge className="bg-surface-gunmetal text-bone-white text-xs px-2 py-0.5 uppercase tracking-widest">
          {setCount} {setCount === 1 ? 'SET' : 'SETS'}
        </Badge>
      </div>
    </button>
  )
}
