import type { WorkoutLog, LoggedSet } from '@/domain/types'

interface ExerciseHistoryListProps {
  history: { log: WorkoutLog; sets: LoggedSet[] }[]
}

function formatHistoryDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
}

function getWeightRange(sets: LoggedSet[]): string {
  const weights = sets.map((s) => s.actualWeight?.value).filter((v): v is number => v !== undefined)
  if (weights.length === 0) return 'BW'
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  if (min === max) return `${min}lb`
  return `${min}-${max}lb`
}

export function ExerciseHistoryList({ history }: ExerciseHistoryListProps) {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <p className="font-display text-sm uppercase tracking-widest text-warm-ash">
          NO WORKOUT HISTORY
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {history.map(({ log, sets }) => (
        <div
          key={log.id}
          className="border-b border-b-[rgba(91,64,57,0.15)] bg-surface-iron px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
              {formatHistoryDate(log.startedAt)}
            </span>
            <span className="text-xs text-warm-ash/60">{log.title || 'Untitled session'}</span>
          </div>
          <div className="mt-1.5 flex gap-4">
            <div>
              <span className="text-xs text-warm-ash/60">SETS</span>
              <span className="ml-1 font-display text-sm text-bone-white">{sets.length}</span>
            </div>
            <div>
              <span className="text-xs text-warm-ash/60">WEIGHT</span>
              <span className="ml-1 font-display text-sm text-bone-white">
                {getWeightRange(sets)}
              </span>
            </div>
            {sets.some((s) => s.actualReps !== undefined) && (
              <div>
                <span className="text-xs text-warm-ash/60">REPS</span>
                <span className="ml-1 font-display text-sm text-bone-white">
                  {sets
                    .map((s) => s.actualReps)
                    .filter((r): r is number => r !== undefined)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
