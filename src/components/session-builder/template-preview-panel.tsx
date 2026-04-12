import { useMemo } from 'react'
import type { ActivityGroupData } from './activity-group-editor'
import type { Exercise, SessionType, ScoringType, Duration } from '@/domain/types'
import { formatSetsReps, formatSeconds } from '@/components/program-builder/session-detail-utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplatePreviewPanelProps {
  name: string
  category: SessionType
  scoring: ScoringType
  timeCap?: Duration
  groups: ActivityGroupData[]
  exercises: Exercise[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORING_LABEL = {
  NONE: 'NONE',
  FOR_TIME: 'FOR TIME',
  TIME: 'TIME',
  FOR_REPS: 'FOR REPS',
  ROUNDS_PLUS_REPS: 'ROUNDS + REPS',
  FOR_DISTANCE: 'FOR DISTANCE',
  LOAD: 'LOAD',
} satisfies Record<ScoringType, string>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TemplatePreviewPanel -- live read-only preview of the template draft as it
 * will appear on the gym floor. Shown as a right-side column at xl breakpoint.
 * Works entirely off in-memory form state; no server fetch required.
 */
export function TemplatePreviewPanel({
  name,
  category,
  scoring,
  timeCap,
  groups,
  exercises,
}: TemplatePreviewPanelProps) {
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e.name])),
    [exercises],
  )

  const populatedGroups = groups.filter((g) => g.activities.length > 0)

  return (
    <div className="hidden xl:flex xl:flex-col xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto 2xl:top-8 2xl:max-h-[calc(100dvh-4rem)]">
      {/* Panel header */}
      <div className="flex items-center gap-3 bg-surface-steel px-4 py-2">
        <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-bone-white">
          Preview
        </span>
        <span className="font-display text-[11px] uppercase tracking-wider text-warm-ash/50">
          as seen on gym floor
        </span>
      </div>

      {/* Template metadata */}
      <div className="flex flex-col gap-1 bg-surface-gunmetal px-4 py-3">
        <span className="truncate font-display text-sm font-medium text-bone-white">
          {name.trim() || (
            <span className="italic text-warm-ash/30">Untitled template</span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[10px] font-medium uppercase tracking-wider text-ember">
            {category}
          </span>
          {scoring !== 'NONE' && (
            <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/60">
              {SCORING_LABEL[scoring]}
            </span>
          )}
          {timeCap && (
            <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/60">
              {formatSeconds(timeCap.seconds)} cap
            </span>
          )}
        </div>
      </div>

      {/* Groups / empty state */}
      {populatedGroups.length === 0 ? (
        <div className="py-8 text-center font-display text-[10px] uppercase tracking-widest text-warm-ash/30">
          Add a group to see preview
        </div>
      ) : (
        <div className="flex flex-col">
          {populatedGroups.map((group) => {
            const activities = [...group.activities].sort((a, b) => a.ordinal - b.ordinal)

            return (
              <section key={group.clientId}>
                <header className="flex flex-wrap items-center gap-2 bg-surface-charcoal px-4 py-2">
                  <span className="font-display text-[11px] font-medium uppercase tracking-wider text-ember">
                    {group.groupType ? group.groupType.replace(/_/g, ' ') : '--'}
                  </span>
                  {group.rounds && group.rounds > 1 && (
                    <span className="font-display text-[11px] uppercase tracking-wider text-warm-ash/70">
                      {group.rounds} Rounds
                    </span>
                  )}
                  {group.restBetweenRounds && (
                    <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/50">
                      {formatSeconds(group.restBetweenRounds.seconds)} rest/rnd
                    </span>
                  )}
                  {group.restBetweenActivities && (
                    <span className="font-display text-[10px] uppercase tracking-wider text-warm-ash/50">
                      {formatSeconds(group.restBetweenActivities.seconds)} rest/ex
                    </span>
                  )}
                </header>
                {activities.map((activity, idx) => (
                  <div
                    key={activity.clientId}
                    className={`grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2 ${
                      idx % 2 === 0 ? 'bg-surface-gunmetal' : 'bg-surface-charcoal'
                    }`}
                  >
                    <span className="truncate text-[11px] text-bone-white/90">
                      {activity.exerciseId
                        ? (exerciseMap.get(activity.exerciseId) ?? 'Unknown')
                        : <span className="text-warm-ash/40">--</span>}
                    </span>
                    <span className="text-right font-display text-[10px] text-bone-white/70">
                      {formatSetsReps(activity.setScheme)}
                    </span>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
