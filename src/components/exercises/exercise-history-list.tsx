import { useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/format-duration'
import { VolumeLoadBar } from '@/components/history/volume-load-bar'
import type { WorkoutLog, LoggedSet } from '@/domain/types'

interface ExerciseHistoryListProps {
  history: { log: WorkoutLog; sets: LoggedSet[] }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function computeVolume(sets: LoggedSet[]): number {
  return sets
    .filter((s) => s.completed && s.actualReps != null && s.actualWeight != null)
    .reduce((sum, s) => sum + (s.actualWeight?.value ?? 0) * (s.actualReps ?? 0), 0)
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`
  return `${Math.round(vol)}`
}

function formatSetDetail(set: LoggedSet): string {
  const parts: string[] = []

  if (set.actualWeight?.value != null) {
    parts.push(`${set.actualWeight.value}${set.actualWeight.unit}`)
  }

  if (set.actualReps != null) {
    if (parts.length > 0) {
      parts.push(`x ${set.actualReps}`)
    } else {
      parts.push(`${set.actualReps} reps`)
    }
  }

  if (set.actualDuration != null) {
    parts.push(formatDuration(set.actualDuration.seconds))
  }

  if (set.actualDistance != null) {
    const dist = set.actualDistance
    parts.push(`${dist.value}${dist.unit}`)
  }

  if (parts.length === 0) return '--'
  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExerciseHistoryList({ history }: ExerciseHistoryListProps) {
  // Last 3 sessions expanded by default
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    history.slice(0, 3).forEach(({ log }) => initial.add(log.id))
    return initial
  })

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <Icon name="history" size={48} className="text-warm-ash/30" />
        <p className="text-sm font-heading text-warm-ash">No workout history</p>
        <p className="text-xs text-warm-ash/50">
          Log a session with this exercise and it will appear here.
        </p>
      </div>
    )
  }

  const maxVolume = Math.max(...history.map(({ sets }) => computeVolume(sets)), 0)

  function toggleSession(logId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  return (
    <div>
      {history.map(({ log, sets }, idx) => {
        const isExpanded = expanded.has(log.id)
        const volume = computeVolume(sets)
        const stripeBg = idx % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'

        return (
          <div key={log.id}>
            {/* Session header -- tappable to expand/collapse */}
            <button
              type="button"
              onClick={() => toggleSession(log.id)}
              className={cn(
                'flex min-h-12 w-full items-center justify-between border-b border-b-[rgba(91,64,57,0.15)] px-4 py-3 text-left',
                stripeBg,
              )}
              aria-expanded={isExpanded}
              aria-controls={`session-${log.id}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                  {formatHistoryDate(log.startedAt)}
                </span>
                <span className="text-[11px] text-warm-ash/50">
                  {log.title || 'Untitled session'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Summary badges */}
                <div className="flex gap-2">
                  <span className="font-body text-[11px] uppercase text-warm-ash/60">
                    {sets.length}S
                  </span>
                  <span className="font-body text-[11px] uppercase text-warm-ash/60">
                    {getWeightRange(sets)}
                  </span>
                  {volume > 0 && (
                    <span className="font-display text-xs font-medium text-ember">
                      {formatVolume(volume)}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'material-symbols-outlined text-base text-warm-ash/40 transition-transform',
                    isExpanded && 'rotate-180',
                  )}
                >
                  expand_more
                </span>
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div
                id={`session-${log.id}`}
                className={cn('border-b border-b-[rgba(91,64,57,0.15)]', stripeBg)}
              >
                {/* Set-by-set rows */}
                <div className="px-4 pt-2 pb-1">
                  {sets
                    .slice()
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((set) => (
                      <div
                        key={set.id}
                        className="flex min-h-8 items-center justify-between py-1 pl-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-body text-[11px] uppercase text-warm-ash/50">
                            SET {set.setNumber}
                          </span>
                          {set.setType !== 'WORKING' && (
                            <span className="bg-surface-steel px-1.5 py-0.5 font-body text-[9px] uppercase tracking-wider text-warm-ash/60">
                              {set.setType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xs text-bone-white">
                            {formatSetDetail(set)}
                          </span>
                          {set.rpe != null && (
                            <span className="font-body text-[11px] text-warm-ash/50">
                              RPE {set.rpe}
                            </span>
                          )}
                          {set.completed ? (
                            <span className="material-symbols-outlined text-sm text-ember">
                              check_circle
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-sm text-warm-ash/30">
                              radio_button_unchecked
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Volume load bar */}
                {volume > 0 && (
                  <div className="px-4 pt-1 pb-3">
                    <VolumeLoadBar
                      value={volume}
                      maxValue={maxVolume}
                      label={`${formatVolume(volume)} vol`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
