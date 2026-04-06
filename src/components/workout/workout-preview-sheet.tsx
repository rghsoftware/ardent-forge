import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdapter } from '@/lib/adapter'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SESSION_TYPE_BADGE } from '@/components/program-builder/constants'
import { formatSetsReps, formatLoad } from '@/components/program-builder/session-detail-utils'
import type { SessionType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Hook: fetch a single full session template by ID (scoped to this sheet)
// ---------------------------------------------------------------------------

function useSessionTemplateFull(id: string | null) {
  return useQuery({
    queryKey: ['session-template-full', id],
    queryFn: () => {
      if (!id) return Promise.resolve(null)
      return getAdapter().getSessionTemplateFull(id)
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkoutPreviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionTemplateId: string | null
  onStart?: () => void
}

export function WorkoutPreviewSheet({
  open,
  onOpenChange,
  sessionTemplateId,
  onStart,
}: WorkoutPreviewSheetProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()

  const {
    data: templateFull,
    isLoading,
    isError,
    refetch,
  } = useSessionTemplateFull(open ? sessionTemplateId : null)

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const exerciseMaxes = profile?.exerciseMaxes ?? {}

  const sortedGroups = useMemo(() => {
    if (!templateFull) return []
    return [...templateFull.groups].sort((a, b) => a.ordinal - b.ordinal)
  }, [templateFull])

  const handleStart = () => {
    onStart?.()
    onOpenChange(false)
  }

  const sessionType = (templateFull?.template.category ?? 'STRENGTH') as SessionType

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[90vh] flex-col gap-0 rounded-none border-t border-warm-ash/10 bg-surface-anvil p-0 text-bone-white"
      >
        <SheetHeader className="gap-2 border-b border-warm-ash/10 bg-surface-pit p-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-display text-base font-medium uppercase tracking-wider text-bone-white">
              {templateFull?.template.name ?? 'Workout Preview'}
            </SheetTitle>
            {templateFull && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  SESSION_TYPE_BADGE[sessionType] ?? 'bg-surface-steel text-warm-ash'
                }`}
              >
                {sessionType}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="py-8 text-center font-display text-xs uppercase tracking-wider text-warm-ash/60">
              Loading...
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="font-display text-xs uppercase tracking-wider text-ember">
                Failed to load session template
              </p>
              <Button variant="outline" className="h-12 rounded-none" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && templateFull && sortedGroups.length === 0 && (
            <div className="py-8 text-center text-xs uppercase tracking-wider text-warm-ash/40">
              No exercises assigned
            </div>
          )}

          {!isLoading && !isError && templateFull && sortedGroups.length > 0 && (
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
          )}
        </div>

        <SheetFooter className="mt-0 gap-0 border-t border-warm-ash/10 bg-surface-pit p-4">
          <Button
            onClick={handleStart}
            disabled={!templateFull || isLoading || isError}
            className="h-12 w-full rounded-none bg-ember font-display text-sm font-medium uppercase tracking-wider text-surface-pit hover:bg-ember/90"
          >
            Start Workout
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
