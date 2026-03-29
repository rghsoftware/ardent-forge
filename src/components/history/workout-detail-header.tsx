import { Link } from '@tanstack/react-router'
import { formatDateLabel, formatDuration } from '@/lib/format-duration'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import type { WorkoutLog, LoggedSet } from '@/domain/types'

interface WorkoutDetailHeaderProps {
  log: WorkoutLog
  allSets: LoggedSet[]
  onDelete: () => void
}

export function WorkoutDetailHeader({ log, allSets, onDelete }: WorkoutDetailHeaderProps) {
  const startedAt = new Date(log.startedAt)
  const completedAt = log.completedAt ? new Date(log.completedAt) : null

  const durationSeconds = completedAt
    ? Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)
    : null

  const dateLabel = formatDateLabel(startedAt)

  // Total volume: sum of (actualWeight.value * actualReps) for completed sets
  const totalVolume = allSets.reduce((acc, set) => {
    if (!set.completed) return acc
    const weight = set.actualWeight?.value ?? 0
    const reps = set.actualReps ?? 0
    return acc + weight * reps
  }, 0)

  return (
    <div className="bg-surface-anvil">
      {/* Back button + title row */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-2">
        <Link
          to="/history"
          className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash"
          aria-label="Back to history"
        >
          <Icon name="arrow_back" size={20} />
        </Link>
        <h1 className="font-heading text-xl font-medium text-bone-white">
          {log.title ?? dateLabel}
        </h1>
      </div>

      {/* Duration readout */}
      {durationSeconds != null && (
        <div className="flex flex-col items-center py-4">
          <span className="text-readout text-bone-white">{formatDuration(durationSeconds)}</span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-warm-ash/60">
            DURATION
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-0 px-4 pb-4">
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {allSets.filter((s) => s.completed).length}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">SETS</span>
        </div>
        <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
          <span className="font-display text-2xl tabular-nums text-bone-white">
            {totalVolume > 0 ? Math.round(totalVolume).toLocaleString() : '--'}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">VOLUME</span>
        </div>
        {log.perceivedDifficulty != null && (
          <div className="flex flex-1 flex-col items-center bg-surface-iron py-3">
            <span className="font-display text-2xl tabular-nums text-bone-white">
              {log.perceivedDifficulty}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-warm-ash/60">RPE</span>
          </div>
        )}
      </div>

      {/* Notes block */}
      {log.overallNotes && (
        <div className="px-4 pb-4">
          <span className="block text-[10px] uppercase tracking-widest text-warm-ash/60 mb-1">
            NOTES
          </span>
          <p className="text-sm text-bone-white bg-surface-iron px-3 py-2">{log.overallNotes}</p>
        </div>
      )}

      {/* Program context */}
      {log.programContext && (
        <div className="px-4 pb-4">
          <Badge className="bg-surface-gunmetal text-bone-white text-xs px-2 py-0.5 uppercase tracking-widest">
            PROGRAM: {log.programContext.dayLabel}
          </Badge>
        </div>
      )}

      {/* Delete button */}
      <div className="px-4 pb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="w-full text-xs text-warning-flare"
        >
          Delete workout
        </Button>
      </div>
    </div>
  )
}
