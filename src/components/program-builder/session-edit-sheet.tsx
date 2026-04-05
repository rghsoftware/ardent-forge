import { useState, useMemo, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { SetSchemeEditor } from '@/components/session-builder/set-scheme-editor'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import { useSessionTemplateFull } from '@/hooks/use-session-templates'
import { useExercises } from '@/hooks/use-exercises'
import { formatSetsReps, formatLoad, buildGroupedActivities } from './session-detail-utils'
import { SESSION_TYPE_BADGE } from './constants'
import type { SessionDraft } from './builder-state'
import type { SetScheme, SessionOverrides, ActivityOverride } from '@/domain/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionDraft
  weekClientId: string
  userId: string
  onUpdate: (session: SessionDraft) => void
  onRemove: () => void
  onChangeTemplate: () => void
}

// ---------------------------------------------------------------------------
// SessionEditSheet
// ---------------------------------------------------------------------------

export function SessionEditSheet({
  open,
  onOpenChange,
  session,
  weekClientId: _weekClientId,
  userId: _userId,
  onUpdate,
  onRemove,
  onChangeTemplate,
}: SessionEditSheetProps) {
  const { data: templateFull, isLoading } = useSessionTemplateFull(session.sessionTemplateId)
  const { data: exercises = [] } = useExercises()

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [exercisePickerActivityId, setExercisePickerActivityId] = useState<string | null>(null)
  const [showAllSchemeTypes, setShowAllSchemeTypes] = useState(false)

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  // Build the flat activity list from the template
  const templateActivities = useMemo(() => {
    if (!templateFull) return []
    return buildGroupedActivities(templateFull).map((a, idx) => ({
      ...a,
      // Use the activity id from the template's actual activities array
      activityId: findActivityId(templateFull, idx),
      ordinal: idx + 1,
    }))
  }, [templateFull])

  // ---------------------------------------------------------------------------
  // Override helpers
  // ---------------------------------------------------------------------------

  const getOverride = useCallback(
    (activityId: string): ActivityOverride | undefined => {
      return session.overrides?.activityOverrides?.[activityId]
    },
    [session.overrides],
  )

  const updateOverride = useCallback(
    (activityId: string, patch: Partial<ActivityOverride>) => {
      const currentOverrides = session.overrides ?? {}
      const currentActivityOverrides = currentOverrides.activityOverrides ?? {}
      const currentOverride = currentActivityOverrides[activityId] ?? {}

      const merged: ActivityOverride = { ...currentOverride, ...patch }

      // Remove undefined fields to keep overrides clean
      const cleaned: ActivityOverride = {}
      if (merged.exerciseId !== undefined) cleaned.exerciseId = merged.exerciseId
      if (merged.setScheme !== undefined) cleaned.setScheme = merged.setScheme

      const newActivityOverrides = {
        ...currentActivityOverrides,
        [activityId]: cleaned,
      }

      const newOverrides: SessionOverrides = {
        ...currentOverrides,
        activityOverrides: newActivityOverrides,
      }

      onUpdate({ ...session, overrides: newOverrides })
    },
    [session, onUpdate],
  )

  const resetOverride = useCallback(
    (activityId: string) => {
      if (!session.overrides?.activityOverrides?.[activityId]) return

      const { [activityId]: _removed, ...rest } = session.overrides.activityOverrides
      const hasRemainingOverrides = Object.keys(rest).length > 0

      const newOverrides: SessionOverrides | undefined = hasRemainingOverrides
        ? { ...session.overrides, activityOverrides: rest }
        : undefined

      onUpdate({ ...session, overrides: newOverrides })
    },
    [session, onUpdate],
  )

  // ---------------------------------------------------------------------------
  // Notes handler
  // ---------------------------------------------------------------------------

  const handleNotesChange = useCallback(
    (value: string) => {
      onUpdate({ ...session, notes: value || undefined })
    },
    [session, onUpdate],
  )

  // ---------------------------------------------------------------------------
  // Exercise swap handler
  // ---------------------------------------------------------------------------

  const handleExerciseSelected = useCallback(
    (exercise: { id: string }) => {
      if (!exercisePickerActivityId) {
        console.error('[session-edit-sheet] No activity ID set for exercise picker')
        return
      }
      updateOverride(exercisePickerActivityId, { exerciseId: exercise.id })
      setExercisePickerActivityId(null)
    },
    [exercisePickerActivityId, updateOverride],
  )

  // ---------------------------------------------------------------------------
  // Set scheme change handler
  // ---------------------------------------------------------------------------

  const handleSetSchemeChange = useCallback(
    (activityId: string, scheme: SetScheme) => {
      updateOverride(activityId, { setScheme: scheme })
    },
    [updateOverride],
  )

  // ---------------------------------------------------------------------------
  // Resolve display values (override or template)
  // ---------------------------------------------------------------------------

  function resolveExerciseId(activityId: string, templateExerciseId: string): string {
    const override = session.overrides?.activityOverrides?.[activityId]
    return override?.exerciseId ?? templateExerciseId
  }

  function resolveSetScheme(activityId: string, templateScheme: SetScheme): SetScheme {
    const override = session.overrides?.activityOverrides?.[activityId]
    return override?.setScheme ?? templateScheme
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const badgeClass = SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex max-h-screen w-full flex-col overflow-hidden bg-surface-anvil p-0 sm:max-w-md"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="font-display text-sm text-bone-white">
              {session.templateName ?? 'Session'}
            </SheetTitle>
            <span
              className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${badgeClass}`}
            >
              {session.sessionType}
            </span>
          </div>
          <SheetDescription className="sr-only">
            Edit per-instance overrides for this scheduled session
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pt-3 pb-4">
          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="session-notes"
              className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/50"
            >
              Session notes
            </label>
            <textarea
              id="session-notes"
              value={session.notes ?? ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes for this instance (e.g., deload week, focus cues)"
              rows={2}
              className="min-h-12 w-full resize-none border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            />
          </div>

          {/* Activity list */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/50">
              Activities
            </p>

            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-14 w-full bg-surface-iron" />
                <Skeleton className="h-14 w-full bg-surface-iron" />
                <Skeleton className="h-14 w-full bg-surface-iron" />
              </div>
            ) : templateActivities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Icon name="fitness_center" size={28} className="text-warm-ash/30" />
                <p className="text-center text-xs text-warm-ash/50">
                  No activities in this template
                </p>
              </div>
            ) : (
              templateActivities.map((activity) => {
                const override = getOverride(activity.activityId)
                const hasOverride = !!override
                const displayExerciseId = resolveExerciseId(
                  activity.activityId,
                  activity.exerciseId,
                )
                const displayScheme = resolveSetScheme(activity.activityId, activity.setScheme)
                const exerciseEntry = exerciseMap.get(displayExerciseId)
                const exerciseName = exerciseEntry?.name ?? 'Unknown exercise'
                const isEditing = editingActivityId === activity.activityId

                return (
                  <div
                    key={activity.activityId}
                    className={`bg-surface-iron ${hasOverride ? 'border-l-2 border-arc' : ''}`}
                  >
                    {/* Activity summary row */}
                    <button
                      type="button"
                      onClick={() => setEditingActivityId(isEditing ? null : activity.activityId)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-gunmetal"
                      aria-label={`Edit ${exerciseName}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-surface-steel font-display text-[10px] tabular-nums text-bone-white">
                        {activity.ordinal}
                      </span>

                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium text-bone-white">
                            {exerciseName}
                          </span>
                          {override?.exerciseId && (
                            <Icon name="swap_horiz" size={12} className="shrink-0 text-arc" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-warm-ash/60">
                          <span>{formatSetsReps(displayScheme)}</span>
                          <span>{formatLoad(displayScheme, {}, displayExerciseId)}</span>
                          {override?.setScheme && (
                            <Icon name="edit" size={10} className="shrink-0 text-arc" />
                          )}
                        </div>
                      </div>

                      <Icon
                        name={isEditing ? 'expand_less' : 'expand_more'}
                        size={18}
                        className="shrink-0 text-warm-ash/40"
                      />
                    </button>

                    {/* Expanded editor */}
                    {isEditing && (
                      <div className="flex flex-col gap-3 border-t border-warm-ash/10 px-3 py-3">
                        {/* Exercise swap */}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setExercisePickerActivityId(activity.activityId)}
                            className="text-[11px]"
                          >
                            <Icon name="swap_horiz" size={14} />
                            Swap exercise
                          </Button>
                          {hasOverride && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                resetOverride(activity.activityId)
                                setEditingActivityId(null)
                              }}
                              className="text-[11px] text-warning-flare"
                            >
                              <Icon name="restart_alt" size={14} />
                              Reset to template
                            </Button>
                          )}
                        </div>

                        {/* Set scheme editor */}
                        <SetSchemeEditor
                          value={displayScheme}
                          onChange={(scheme) => handleSetSchemeChange(activity.activityId, scheme)}
                          exerciseSupports1RM={exerciseEntry?.supports1RM}
                          sessionCategory={session.sessionType}
                          showAllTypes={showAllSchemeTypes}
                          onShowAllTypesChange={setShowAllSchemeTypes}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 border-t border-warm-ash/10 px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onChangeTemplate}
            className="min-h-10 w-full text-xs"
          >
            <Icon name="swap_horiz" size={16} />
            Change template
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onRemove}
            className="min-h-10 w-full text-xs text-warning-flare"
          >
            <Icon name="delete" size={16} />
            Remove session
          </Button>
        </div>
      </SheetContent>

      {/* Exercise picker sheet (for swapping) */}
      <AddExerciseSheet
        open={!!exercisePickerActivityId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setExercisePickerActivityId(null)
        }}
        onExerciseSelected={(exercise) => handleExerciseSelected(exercise)}
      />
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the actual activity ID from the template's activities array by ordinal
 * position (matching the buildGroupedActivities flattened order).
 */
function findActivityId(
  templateFull: NonNullable<ReturnType<typeof useSessionTemplateFull>['data']>,
  flatIndex: number,
): string {
  const { groups, activities } = templateFull
  const sortedGroups = [...groups].sort((a, b) => a.ordinal - b.ordinal)
  let idx = 0

  for (const group of sortedGroups) {
    const groupActivities = activities
      .filter((a) => a.activityGroupId === group.id)
      .sort((a, b) => a.ordinal - b.ordinal)

    for (const activity of groupActivities) {
      if (idx === flatIndex) return activity.id
      idx++
    }
  }

  // Fallback -- should not happen if template data is consistent
  console.warn('[session-edit-sheet] Could not find activity ID for flat index', flatIndex)
  return `unknown-${flatIndex}`
}
