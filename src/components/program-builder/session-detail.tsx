import { useMemo } from 'react'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import { DAY_ABBREVIATIONS, SESSION_TYPE_BADGE } from './constants'
import {
  formatSetsReps,
  formatLoad,
  buildGroupedActivities,
  useSessionTemplatesFull,
} from './session-detail-utils'
import type { DayOfWeek } from './constants'
import type { SessionDraft } from './builder-state'

// ---------------------------------------------------------------------------
// Inline session type badge styles
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WeekInlinePreview -- session exercise details rendered inline
// ---------------------------------------------------------------------------

interface WeekInlinePreviewProps {
  sessions: SessionDraft[]
}

export function WeekInlinePreview({ sessions }: WeekInlinePreviewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()

  const templateIds = useMemo(
    () => [
      ...new Set(sessions.filter((s) => s.dayOfWeek !== null).map((s) => s.sessionTemplateId)),
    ],
    [sessions],
  )
  const templates = useSessionTemplatesFull(templateIds)
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const exerciseMaxes = profile?.exerciseMaxes ?? {}

  const assigned = useMemo(() => {
    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    return sessions
      .filter((s) => s.dayOfWeek !== null)
      .sort((a, b) => dayOrder.indexOf(a.dayOfWeek!) - dayOrder.indexOf(b.dayOfWeek!))
  }, [sessions])

  if (assigned.length === 0) return null

  const isLoading = templateIds.length > 0 && templates.size === 0

  if (isLoading) {
    return (
      <div className="py-2 text-center text-[11px] text-warm-ash/40">
        Loading session details...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-warm-ash/10 pt-2">
      {assigned.map((session) => {
        const templateFull = templates.get(session.sessionTemplateId)
        if (!templateFull) return null

        const dayLabel = DAY_ABBREVIATIONS[session.dayOfWeek as DayOfWeek]

        if (session.sessionType === 'EVENT') {
          const eventMeta = templateFull.template.eventMetadata
          return (
            <div
              key={session.clientId}
              className="border-l-2 border-ember bg-surface-charcoal px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
                  {dayLabel}
                </span>
                <Icon name="flag" size={10} fill className="shrink-0 text-ember" />
                <span className="font-display text-[11px] font-medium uppercase tracking-wider text-ember">
                  {session.templateName ?? 'Unnamed'}
                </span>
              </div>
              {eventMeta?.eventDate && (
                <span className="mt-0.5 block text-[10px] tracking-wider text-warm-ash/70">
                  {new Date(eventMeta.eventDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          )
        }

        const activities = buildGroupedActivities(templateFull)

        return (
          <div key={session.clientId} className="flex flex-col">
            <div className="flex items-center gap-1.5 bg-surface-charcoal px-2 py-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
                {dayLabel}
              </span>
              <span className="text-[11px] font-medium text-bone-white">
                {session.templateName ?? 'Unnamed'}
              </span>
              <span
                className={`px-1 py-px text-[9px] font-medium uppercase tracking-wider ${
                  SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'
                }`}
              >
                {session.sessionType}
              </span>
            </div>
            {activities.length === 0 ? (
              <div className="px-2 py-1 bg-surface-gunmetal">
                <span className="text-[10px] text-warm-ash/40">No exercises assigned</span>
              </div>
            ) : (
              activities.map((activity, idx) => (
                <div
                  key={`${session.clientId}-${idx}`}
                  className={`grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1 ${
                    idx % 2 === 0 ? 'bg-surface-gunmetal' : 'bg-surface-charcoal'
                  }`}
                >
                  <span className="text-[11px] text-bone-white/80">
                    {exerciseMap.get(activity.exerciseId) ?? 'Unknown'}
                  </span>
                  <span className="text-right font-display text-[11px] text-bone-white/80">
                    {formatSetsReps(activity.setScheme)}
                  </span>
                  <span className="w-16 text-right font-display text-[11px] text-bone-white/60">
                    {formatLoad(activity.setScheme, exerciseMaxes, activity.exerciseId)}
                  </span>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
