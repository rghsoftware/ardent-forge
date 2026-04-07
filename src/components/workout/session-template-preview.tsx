import { useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import { useSessionTemplateFull } from '@/hooks/use-session-template-full'
import { Button } from '@/components/ui/button'
import { formatSetsReps, formatLoad } from '@/components/program-builder/session-detail-utils'

interface SessionTemplatePreviewProps {
  sessionTemplateId: string | null
  /** When false, the inner query is disabled (used by collapsed Sheets). */
  enabled?: boolean
}

/**
 * SessionTemplatePreview -- read-only render of a session template's groups,
 * exercises, sets, and prescribed loads. Used by both WorkoutPreviewSheet
 * (modal context) and ProgramSessionCard (inline on the Forge page).
 *
 * Returns its own loading / error / empty states; the parent only needs to
 * supply a templateId and a render container.
 */
export function SessionTemplatePreview({
  sessionTemplateId,
  enabled = true,
}: SessionTemplatePreviewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()

  const {
    data: templateFull,
    isLoading,
    isError,
    refetch,
  } = useSessionTemplateFull(enabled ? sessionTemplateId : null)

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const exerciseMaxes = profile?.exerciseMaxes ?? {}

  const sortedGroups = useMemo(() => {
    if (!templateFull) return []
    return [...templateFull.groups].sort((a, b) => a.ordinal - b.ordinal)
  }, [templateFull])

  if (isLoading) {
    return (
      <div className="py-8 text-center font-display text-xs uppercase tracking-wider text-warm-ash/60">
        Loading...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="font-display text-xs uppercase tracking-wider text-ember">
          Failed to load session template
        </p>
        <Button variant="outline" className="h-12 rounded-none" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!templateFull || sortedGroups.length === 0) {
    return (
      <div className="py-8 text-center text-xs uppercase tracking-wider text-warm-ash/40">
        No exercises assigned
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {sortedGroups.map((group) => {
        const groupActivities = templateFull.activities
          .filter((a) => a.activityGroupId === group.id)
          .sort((a, b) => a.ordinal - b.ordinal)

        return (
          <section key={group.id} className="flex flex-col">
            <header className="flex items-center gap-2 bg-surface-charcoal px-4 py-2">
              <span className="font-display text-[11px] font-medium uppercase tracking-wider text-ember">
                {group.groupType.replace(/_/g, ' ')}
              </span>
              {group.rounds && group.rounds > 1 && (
                <span className="font-display text-[11px] uppercase tracking-wider text-warm-ash/70">
                  {group.rounds} Rounds
                </span>
              )}
            </header>
            {groupActivities.length === 0 ? (
              <div className="bg-surface-gunmetal px-4 py-2 text-[11px] text-warm-ash/40">
                No exercises
              </div>
            ) : (
              groupActivities.map((activity, idx) => (
                <div
                  key={activity.id}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 ${
                    idx % 2 === 0 ? 'bg-surface-gunmetal' : 'bg-surface-charcoal'
                  }`}
                >
                  <span className="text-xs text-bone-white/90">
                    {exerciseMap.get(activity.exerciseId) ?? 'Unknown'}
                  </span>
                  <span className="text-right font-display text-[11px] text-bone-white/80">
                    {formatSetsReps(activity.setScheme)}
                  </span>
                  <span className="w-20 text-right font-display text-[11px] text-bone-white/60">
                    {formatLoad(activity.setScheme, exerciseMaxes, activity.exerciseId)}
                  </span>
                </div>
              ))
            )}
          </section>
        )
      })}
    </div>
  )
}
