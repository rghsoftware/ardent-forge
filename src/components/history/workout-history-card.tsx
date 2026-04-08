import { useNavigate } from '@tanstack/react-router'
import { formatDateLabel, formatDuration } from '@/lib/format-duration'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/icon'
import { NoteIndicator } from '@/components/workout/notes/note-indicator'
import type { WorkoutLogSummary } from '@/lib/data-adapter'

interface WorkoutHistoryCardProps {
  summary: WorkoutLogSummary
  index: number
  onClick: () => void
}

export function WorkoutHistoryCard({ summary, index, onClick }: WorkoutHistoryCardProps) {
  const navigate = useNavigate()
  const { log, exerciseNames, setCount } = summary
  const startedAt = new Date(log.startedAt)
  const completedAt = log.completedAt ? new Date(log.completedAt) : null

  const durationSeconds = completedAt
    ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
    : null

  const dateLabel = formatDateLabel(startedAt)
  const exerciseList = exerciseNames.join(', ')
  const hasSessionNote =
    (log.overallNotes != null && log.overallNotes.trim().length > 0) ||
    (log.noteTags != null && log.noteTags.length > 0)

  const isEven = index % 2 === 0

  return (
    <div
      className={`flex w-full min-h-[60px] items-center justify-between transition-colors ${
        isEven ? 'bg-surface-iron' : 'bg-surface-charcoal'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex flex-1 min-w-0 items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer active:brightness-125"
        aria-label={`View workout from ${dateLabel}`}
      >
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-3">
          <span className="flex items-center gap-1.5 font-heading text-sm text-bone-white">
            <span className="truncate">{log.title ?? dateLabel}</span>
            <NoteIndicator hasNote={hasSessionNote} />
          </span>
          <span className="text-xs text-warm-ash/60 truncate">
            {exerciseList || 'No exercises'}
          </span>
        </div>
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          navigate({ to: '/log/$workoutId/edit', params: { workoutId: log.id } })
        }}
        aria-label="Edit workout"
        className="h-12 w-12 flex items-center justify-center shrink-0 text-warm-ash hover:text-bone-white pr-2"
      >
        <Icon name="edit" size={20} />
      </button>
    </div>
  )
}
