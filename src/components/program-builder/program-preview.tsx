import { useState, useMemo } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { useUserProfile } from '@/hooks/use-user-profile'
import { useExercises } from '@/hooks/use-exercises'
import {
  formatSetsReps,
  formatLoad,
  buildGroupedActivities,
  useSessionTemplatesFull,
} from './session-detail-utils'
import type { ProgramDraft } from './builder-state'
import {
  DAY_COLUMNS,
  WEEKDAY_COLUMNS,
  SOURCE_LABELS,
  SESSION_TINT,
  SESSION_TYPE_BADGE,
} from './constants'

// ---------------------------------------------------------------------------
// ProgramPreview
// ---------------------------------------------------------------------------

interface ProgramPreviewProps {
  draft: ProgramDraft
  open: boolean
  onClose: () => void
}

export function ProgramPreview({ draft, open, onClose }: ProgramPreviewProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: profile } = useUserProfile(userId)
  const { data: exercises = [] } = useExercises()
  const [showWeekends, setShowWeekends] = useState(false)

  // Collect unique template IDs across all blocks/weeks/sessions
  const templateIds = useMemo(() => {
    const ids = new Set<string>()
    for (const block of draft.blocks) {
      for (const week of block.weeks) {
        for (const session of week.sessions) {
          ids.add(session.sessionTemplateId)
        }
      }
    }
    return Array.from(ids)
  }, [draft])

  const sessionTemplates = useSessionTemplatesFull(templateIds)

  // Build exercise name lookup
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])

  const exerciseMaxes = profile?.exerciseMaxes ?? {}
  const previewColumns = showWeekends ? DAY_COLUMNS : WEEKDAY_COLUMNS
  const previewGridCols = showWeekends ? 'grid-cols-7' : 'grid-cols-5'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-none h-screen w-screen p-0 border-0 rounded-none bg-surface-anvil"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="h-full overflow-y-auto">
          <div className="flex items-center justify-between px-4 pt-6 pb-4">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-medium text-bone-white">
                {draft.name || 'Untitled program'}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-surface-steel px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-bone-white">
                  {SOURCE_LABELS[draft.source] ?? draft.source}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWeekends((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  showWeekends
                    ? 'bg-forge/15 text-forge'
                    : 'bg-surface-steel text-warm-ash hover:text-bone-white'
                }`}
                aria-label={showWeekends ? 'Hide weekends' : 'Show weekends'}
              >
                <Icon name={showWeekends ? 'date_range' : 'calendar_view_week'} size={14} />
                {showWeekends ? '7 days' : '5 days'}
              </button>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="min-h-10 text-xs text-warm-ash hover:text-bone-white"
              >
                Close preview
                <Icon name="close" size={16} />
              </Button>
            </div>
          </div>

          {draft.description && (
            <div className="px-4 pb-4">
              <p className="text-sm text-warm-ash">{draft.description}</p>
            </div>
          )}

          <div className="flex flex-col gap-6 px-4 pb-8">
            {draft.blocks.map((block) => (
              <div key={block.clientId} className="bg-surface-iron">
                <div className="flex items-center gap-3 px-3 py-3">
                  <span className="font-display text-sm font-medium text-bone-white">
                    {block.name || 'Untitled block'}
                  </span>
                  <span className="bg-surface-steel px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-bone-white">
                    {block.blockType}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
                    {block.weeks.length} {block.weeks.length === 1 ? 'WEEK' : 'WEEKS'}
                  </span>
                </div>

                <div className="flex flex-col gap-4 px-3 pb-4">
                  {block.weeks.map((week, weekIdx) => {
                    const sessionsByDay = new Map(
                      week.sessions
                        .filter((s) => s.dayOfWeek !== null)
                        .map((s) => [s.dayOfWeek!, s]),
                    )

                    return (
                      <div key={week.clientId} className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                          WEEK {weekIdx + 1}
                        </span>

                        {/* Day grid (5 or 7 columns) */}
                        <div className={`grid ${previewGridCols} gap-1`}>
                          {previewColumns.map((col) => (
                            <div
                              key={`hdr-${col.dayOfWeek}`}
                              className="text-center text-xs font-semibold uppercase tracking-widest text-warm-ash/60"
                            >
                              {col.label}
                            </div>
                          ))}

                          {previewColumns.map((col) => {
                            const session = sessionsByDay.get(col.dayOfWeek)

                            if (!session) {
                              return (
                                <div
                                  key={`cell-${col.dayOfWeek}`}
                                  className="min-h-[60px] bg-surface-charcoal"
                                />
                              )
                            }

                            const isEventCell = session.sessionType === 'EVENT'
                            const eventDate = isEventCell
                              ? sessionTemplates.get(session.sessionTemplateId)?.template
                                  .eventMetadata?.eventDate
                              : undefined

                            return (
                              <div
                                key={`cell-${col.dayOfWeek}`}
                                className={`flex min-h-[60px] flex-col p-1 ${
                                  isEventCell
                                    ? 'border-l-2 border-ember bg-surface-iron'
                                    : 'bg-surface-charcoal'
                                } ${SESSION_TINT[session.sessionType] ?? ''}`}
                              >
                                <div className="flex items-start gap-0.5">
                                  {isEventCell && (
                                    <Icon
                                      name="flag"
                                      size={9}
                                      fill
                                      className="mt-0.5 shrink-0 text-ember"
                                    />
                                  )}
                                  <span
                                    className={`line-clamp-2 text-[10px] font-medium text-bone-white ${
                                      isEventCell ? 'uppercase tracking-wider' : ''
                                    }`}
                                  >
                                    {session.templateName ?? 'UNNAMED'}
                                  </span>
                                </div>
                                {isEventCell && eventDate && (
                                  <span className="text-[10px] tracking-wider text-ember/80">
                                    {new Date(eventDate).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                )}
                                <span
                                  className={`mt-0.5 inline-block self-start px-1 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                    SESSION_TYPE_BADGE[session.sessionType] ??
                                    'bg-surface-steel text-warm-ash'
                                  }`}
                                >
                                  {session.sessionType}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {!showWeekends &&
                          (() => {
                            const weekendCount = week.sessions.filter(
                              (s) => s.dayOfWeek === 0 || s.dayOfWeek === 6,
                            ).length
                            return weekendCount > 0 ? (
                              <p className="text-[10px] text-warm-ash/50">
                                +{weekendCount} weekend{' '}
                                {weekendCount === 1 ? 'session' : 'sessions'}
                              </p>
                            ) : null
                          })()}

                        {/* Session detail tables */}
                        {week.sessions
                          .filter((s) => s.dayOfWeek !== null)
                          .map((session) => {
                            const templateFull = sessionTemplates.get(session.sessionTemplateId)
                            if (!templateFull) return null

                            const isEventDetail = session.sessionType === 'EVENT'
                            const eventMeta = isEventDetail
                              ? templateFull.template.eventMetadata
                              : undefined

                            // EVENT sessions show event summary instead of exercise table
                            if (isEventDetail) {
                              return (
                                <div key={session.clientId} className="flex flex-col gap-0">
                                  <div className="border-l-2 border-ember bg-surface-iron px-2 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Icon
                                        name="flag"
                                        size={12}
                                        fill
                                        className="shrink-0 text-ember"
                                      />
                                      <span className="font-display text-[11px] font-medium uppercase tracking-wider text-ember">
                                        {session.templateName ?? 'UNNAMED'}
                                      </span>
                                    </div>
                                    {eventMeta?.eventDate && (
                                      <span className="mt-0.5 block text-[10px] tracking-wider text-warm-ash">
                                        {new Date(eventMeta.eventDate).toLocaleDateString(
                                          undefined,
                                          { weekday: 'short', month: 'short', day: 'numeric' },
                                        )}
                                      </span>
                                    )}
                                    {eventMeta?.location && (
                                      <span className="mt-0.5 block text-[10px] tracking-wider text-warm-ash/70">
                                        {eventMeta.location}
                                      </span>
                                    )}
                                  </div>
                                  {templateFull.eventItems.length > 0 && (
                                    <div className="bg-surface-gunmetal px-2 py-1">
                                      <span className="text-[10px] tracking-wider text-warm-ash/60">
                                        {templateFull.eventItems.length} PACKING{' '}
                                        {templateFull.eventItems.length === 1 ? 'ITEM' : 'ITEMS'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            const groupedActivities = buildGroupedActivities(templateFull)

                            return (
                              <div key={session.clientId} className="flex flex-col gap-0">
                                <div className="bg-surface-steel px-2 py-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-medium uppercase tracking-wider text-bone-white">
                                      {session.templateName ?? 'UNNAMED'}
                                    </span>
                                  </div>
                                </div>

                                {groupedActivities.length === 0 ? (
                                  <div className="bg-surface-gunmetal px-2 py-1.5">
                                    <span className="text-[10px] text-warm-ash/40">
                                      No exercises assigned
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-surface-gunmetal px-2 py-1">
                                      <span className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                                        EXERCISE
                                      </span>
                                      <span className="text-right text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                                        SETS x REPS
                                      </span>
                                      <span className="w-20 text-right text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                                        LOAD
                                      </span>
                                    </div>

                                    {groupedActivities.map((activity, actIdx) => (
                                      <div
                                        key={`${session.clientId}-${actIdx}`}
                                        className={`grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1.5 ${
                                          actIdx % 2 === 0
                                            ? 'bg-surface-steel'
                                            : 'bg-surface-charcoal'
                                        }`}
                                      >
                                        <span className="text-xs text-bone-white">
                                          {exerciseMap.get(activity.exerciseId) ??
                                            'Unknown Exercise'}
                                        </span>
                                        <span className="text-right font-display text-xs text-bone-white">
                                          {formatSetsReps(activity.setScheme)}
                                        </span>
                                        <span className="w-20 text-right font-display text-xs text-bone-white">
                                          {formatLoad(
                                            activity.setScheme,
                                            exerciseMaxes,
                                            activity.exerciseId,
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
