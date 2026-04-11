import { useState, useCallback, useEffect, useMemo, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActivityGroupEditor, type ActivityGroupData } from './activity-group-editor'
import type { PickerComponentProps } from './activity-editor'
import { CollapsedFieldsRow } from './collapsed-fields-row'
import { DurationInput } from './inputs/duration-input'
import { CATEGORY_FIELD_VISIBILITY } from '@/components/builders/visibility-maps'
import { useExercises } from '@/hooks/use-exercises'
import { useCreateSessionTemplate, useUpdateSessionTemplate } from '@/hooks/use-session-templates'
import { useAuth } from '@/lib/auth'
import type {
  SessionTemplate,
  SessionType,
  ScoringType,
  Duration,
  ActivityGroup,
  Activity,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionTemplateFull {
  template: SessionTemplate
  groups: Array<Omit<ActivityGroup, 'activities'>>
  activities: Activity[]
}

interface SessionTemplateFormProps {
  initial?: SessionTemplateFull
  onSave?: (template: SessionTemplate) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  PickerComponent?: ComponentType<PickerComponentProps>
}

interface GroupValidationErrors {
  noType?: string
  noActivities?: string
}

interface ValidationErrors {
  name?: string
  noGroups?: string
  groups: Record<string, GroupValidationErrors>
  activities: Record<string, string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_CATEGORIES: Array<{ value: SessionType; label: string }> = [
  { value: 'STRENGTH', label: 'Strength' },
  { value: 'CONDITIONING', label: 'Conditioning' },
  { value: 'SE', label: 'SE' },
  { value: 'MIXED', label: 'Mixed' },
]

const SCORING_TYPES: Array<{ value: ScoringType; label: string }> = [
  { value: 'NONE', label: 'NONE' },
  { value: 'FOR_TIME', label: 'FOR TIME' },
  { value: 'TIME', label: 'TIME' },
  { value: 'FOR_REPS', label: 'FOR REPS' },
  { value: 'ROUNDS_PLUS_REPS', label: 'ROUNDS + REPS' },
  { value: 'FOR_DISTANCE', label: 'FOR DISTANCE' },
  { value: 'LOAD', label: 'LOAD' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGroupsFromData(groups: ActivityGroupData[]) {
  return groups.map((g) => ({
    group: {
      sessionTemplateId: '',
      groupType: g.groupType!,
      ordinal: g.ordinal,
      rounds: g.rounds,
      restBetweenRounds: g.restBetweenRounds,
      restBetweenActivities: g.restBetweenActivities,
    },
    activities: g.activities.map((a) => ({
      exerciseId: a.exerciseId ?? '',
      setScheme: a.setScheme,
      ordinal: a.ordinal,
      notes: a.notes,
    })),
  }))
}

function hydrateGroups(initial: SessionTemplateFull): ActivityGroupData[] {
  return initial.groups.map((g) => {
    const groupActivities = initial.activities
      .filter((a) => a.activityGroupId === g.id)
      .sort((a, b) => a.ordinal - b.ordinal)

    return {
      clientId: crypto.randomUUID(),
      groupType: g.groupType,
      ordinal: g.ordinal,
      rounds: g.rounds ?? undefined,
      restBetweenRounds: g.restBetweenRounds ?? undefined,
      restBetweenActivities: g.restBetweenActivities ?? undefined,
      activities: groupActivities.map((a) => ({
        clientId: crypto.randomUUID(),
        exerciseId: a.exerciseId,
        setScheme: a.setScheme,
        notes: a.notes,
        ordinal: a.ordinal,
      })),
    }
  })
}

function computeErrors(name: string, groups: ActivityGroupData[]): ValidationErrors {
  const errs: ValidationErrors = { groups: {}, activities: {} }
  if (!name.trim()) errs.name = 'Give your template a name'
  if (groups.length === 0) errs.noGroups = 'Add at least one group to continue'
  for (const g of groups) {
    const ge: GroupValidationErrors = {}
    if (!g.groupType) ge.noType = 'Pick a group type'
    if (g.activities.length === 0) ge.noActivities = 'Add at least one exercise'
    if (ge.noType || ge.noActivities) errs.groups[g.clientId] = ge
    for (const a of g.activities) {
      if (!a.exerciseId) errs.activities[a.clientId] = 'Select an exercise'
    }
  }
  return errs
}

function hasValidationErrors(e: ValidationErrors): boolean {
  return !!(
    e.name ||
    e.noGroups ||
    Object.keys(e.groups).length > 0 ||
    Object.keys(e.activities).length > 0
  )
}

function scrollToFirstError(e: ValidationErrors, orderedGroups: ActivityGroupData[]): void {
  let id: string | null = null

  if (e.name) {
    id = 'field-name'
  } else if (e.noGroups) {
    id = 'field-add-group'
  } else {
    loop: for (const g of orderedGroups) {
      if (e.groups[g.clientId]?.noType) {
        id = `field-group-${g.clientId}-type`
        break loop
      }
      if (e.groups[g.clientId]?.noActivities) {
        id = `field-group-${g.clientId}-add-activity`
        break loop
      }
      for (const a of g.activities) {
        if (e.activities[a.clientId]) {
          id = `field-activity-${a.clientId}-exercise`
          break loop
        }
      }
    }
  }

  if (!id) return
  const el = document.getElementById(id)
  if (!el) return
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  el.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' })
  if (el instanceof HTMLElement) el.focus()
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function SessionTemplateForm({
  initial,
  onSave,
  onCancel,
  onDirtyChange,
  PickerComponent,
}: SessionTemplateFormProps) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const { data: exercises = [] } = useExercises()
  const createMutation = useCreateSessionTemplate()
  const updateMutation = useUpdateSessionTemplate()

  const isEditing = !!initial

  // Form state
  const [name, setName] = useState(initial?.template.name ?? '')
  const [category, setCategory] = useState<SessionType>(initial?.template.category ?? 'STRENGTH')
  const [description, setDescription] = useState(initial?.template.description ?? '')
  const [scoring, setScoring] = useState<ScoringType>(initial?.template.scoring ?? 'NONE')
  const [timeCap, setTimeCap] = useState<Duration | undefined>(
    initial?.template.timeCap ?? undefined,
  )
  const [restBetweenGroups, setRestBetweenGroups] = useState<Duration | undefined>(
    initial?.template.restBetweenGroups ?? undefined,
  )
  const [groups, setGroups] = useState<ActivityGroupData[]>(initial ? hydrateGroups(initial) : [])
  const [showAllSchemeTypes, setShowAllSchemeTypes] = useState(false)

  // Validation state
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Always-current derived errors (no useState -- avoids stale reads in handlers)
  const errors = useMemo(() => computeErrors(name, groups), [name, groups])

  // Display gating: name shows on blur or after first save attempt; group/activity
  // errors show only after first save attempt so the form doesn't scold on first load.
  const showNameError = (nameTouched || hasAttemptedSave) && !!errors.name
  const visibleGroupErrors = hasAttemptedSave ? errors.groups : {}
  const visibleActivityErrors = hasAttemptedSave ? errors.activities : {}

  // Clickable error summary -- only materializes after the first save attempt
  const summaryItems = useMemo(() => {
    if (!hasAttemptedSave) return []
    const items: Array<{ label: string; anchorId: string }> = []
    if (errors.name) items.push({ label: 'Template needs a name', anchorId: 'field-name' })
    if (errors.noGroups)
      items.push({ label: 'Add at least one group', anchorId: 'field-add-group' })
    for (const g of groups) {
      if (errors.groups[g.clientId]?.noType)
        items.push({
          label: `Group ${g.ordinal} - pick a group type`,
          anchorId: `field-group-${g.clientId}-type`,
        })
      if (errors.groups[g.clientId]?.noActivities)
        items.push({
          label: `Group ${g.ordinal} - add at least one exercise`,
          anchorId: `field-group-${g.clientId}-add-activity`,
        })
      for (const a of g.activities) {
        if (errors.activities[a.clientId])
          items.push({
            label: `Group ${g.ordinal}, activity ${a.ordinal} - select an exercise`,
            anchorId: `field-activity-${a.clientId}-exercise`,
          })
      }
    }
    return items
  }, [hasAttemptedSave, errors, groups])

  // Dirty tracking: snapshot initial form state, compare to current on every render.
  // After successful save, snapshot is reset so navigating away is unblocked.
  const computeSnapshot = useCallback(
    (
      n: string,
      c: SessionType,
      d: string,
      s: ScoringType,
      tc: Duration | undefined,
      rbg: Duration | undefined,
      g: ActivityGroupData[],
    ) => JSON.stringify({ n, c, d, s, tc, rbg, g }),
    [],
  )
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    computeSnapshot(
      initial?.template.name ?? '',
      initial?.template.category ?? 'STRENGTH',
      initial?.template.description ?? '',
      initial?.template.scoring ?? 'NONE',
      initial?.template.timeCap ?? undefined,
      initial?.template.restBetweenGroups ?? undefined,
      initial ? hydrateGroups(initial) : [],
    ),
  )
  const currentSnapshot = useMemo(
    () => computeSnapshot(name, category, description, scoring, timeCap, restBetweenGroups, groups),
    [computeSnapshot, name, category, description, scoring, timeCap, restBetweenGroups, groups],
  )
  const dirty = currentSnapshot !== baselineSnapshot
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleAddGroup = useCallback(() => {
    const newGroup: ActivityGroupData = {
      clientId: crypto.randomUUID(),
      groupType: null,
      ordinal: groups.length + 1,
      activities: [],
    }
    setGroups((prev) => [...prev, newGroup])
  }, [groups.length])

  const handleUpdateGroup = useCallback((index: number, updated: ActivityGroupData) => {
    setGroups((prev) => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }, [])

  const handleDeleteGroup = useCallback((index: number) => {
    setGroups((prev) =>
      prev.filter((_, i) => i !== index).map((g, i) => ({ ...g, ordinal: i + 1 })),
    )
  }, [])

  const handleMoveGroup = useCallback((fromIndex: number, toIndex: number) => {
    setGroups((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) {
        console.warn('[session-template-form] handleMoveGroup: target index out of bounds')
        return prev
      }
      const reordered = [...prev]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      return reordered.map((g, i) => ({ ...g, ordinal: i + 1 }))
    })
  }, [])

  const handleSave = useCallback(async () => {
    setHasAttemptedSave(true)
    setServerError(null)

    if (hasValidationErrors(errors)) {
      scrollToFirstError(errors, groups)
      return
    }
    if (!userId) {
      console.error('[session-template-form] Cannot save: no authenticated user')
      setServerError('You must be signed in to save templates.')
      return
    }

    const groupPayload = buildGroupsFromData(groups)

    try {
      if (isEditing && initial) {
        const result = await updateMutation.mutateAsync({
          template: {
            ...initial.template,
            name: name.trim(),
            category,
            description: description.trim() || undefined,
            scoring,
            timeCap,
            restBetweenGroups,
          },
          groups: groupPayload.map((g) => ({
            ...g,
            group: {
              ...g.group,
              id: '',
              sessionTemplateId: initial.template.id,
            },
          })),
        })
        setBaselineSnapshot(currentSnapshot)
        onSave?.(result.template)
      } else {
        const result = await createMutation.mutateAsync({
          template: {
            userId,
            name: name.trim(),
            category,
            description: description.trim() || undefined,
            scoring,
            isPublic: false,
            timeCap,
            restBetweenGroups,
          },
          groups: groupPayload,
        })
        setBaselineSnapshot(currentSnapshot)
        onSave?.(result.template)
      }
    } catch (err) {
      const action = isEditing ? 'update' : 'create'
      console.error(`[session-template-form] Failed to ${action} template "${name.trim()}":`, err)
      setServerError(`Failed to ${action} session template. Please try again.`)
    }
  }, [
    errors,
    groups,
    userId,
    isEditing,
    initial,
    name,
    category,
    description,
    scoring,
    timeCap,
    restBetweenGroups,
    createMutation,
    updateMutation,
    onSave,
    currentSnapshot,
  ])

  const { scoring: showScoring, timeCap: showTimeCap } = CATEGORY_FIELD_VISIBILITY[category]

  return (
    <div className="flex flex-col gap-6 pb-8 lg:grid lg:grid-cols-[320px_1fr] lg:gap-8">
      {/* ---- Left column: template metadata ---- */}
      {/* Sticky within its grid cell so it remains visible while scrolling the activity groups column */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-0 lg:self-start">
        {/* Template name */}
        <div className="px-4 lg:px-0">
          <input
            id="field-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="Template name"
            aria-label="Template name"
            aria-invalid={showNameError || undefined}
            aria-describedby={showNameError ? 'field-name-error' : undefined}
            className={`w-full border-0 border-b bg-transparent py-3 font-display text-lg font-medium text-bone-white placeholder:text-warm-ash/40 focus:outline-none ${
              showNameError
                ? 'border-destructive focus:border-destructive'
                : 'border-warm-ash/30 focus:border-ember'
            }`}
          />
          {showNameError && (
            <p id="field-name-error" role="alert" className="mt-1 text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        {/* Category selector */}
        <div className="px-4 lg:px-0">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
            Category
          </span>
          <ToggleGroup
            type="single"
            value={category}
            onValueChange={(v) => {
              if (v) setCategory(v as SessionType)
            }}
            className="flex flex-wrap gap-1"
          >
            {SESSION_CATEGORIES.map((c) => (
              <ToggleGroupItem
                key={c.value}
                value={c.value}
                className="min-h-10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
              >
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Description */}
        <div className="px-4 lg:px-0">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
            Description (optional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this session"
            rows={2}
            className="min-h-12 w-full resize-none border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            aria-label="Template description"
          />
        </div>

        {/* Scoring & Time Cap -- visibility depends on category */}
        {(() => {
          const scoringField = (
            <div className="px-4 lg:px-0">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
                Scoring
              </span>
              <Select value={scoring} onValueChange={(v) => setScoring(v as ScoringType)}>
                <SelectTrigger className="min-h-12 border-0 border-b border-warm-ash/30 bg-transparent text-xs uppercase tracking-wider text-bone-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-gunmetal">
                  {SCORING_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs uppercase">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )

          const timeCapField = (
            <div className="px-4 lg:px-0">
              <DurationInput
                size="compact"
                clearable
                value={timeCap}
                onChange={setTimeCap}
                label="Time Cap (optional)"
              />
            </div>
          )

          const collapsedLabels = [
            ...(!showScoring ? ['Scoring'] : []),
            ...(!showTimeCap ? ['Time Cap'] : []),
          ]

          const visibleFields = (
            <>
              {showScoring && scoringField}
              {showTimeCap && timeCapField}
            </>
          )

          const collapsedFields = (
            <div className="flex flex-col gap-6 py-4">
              {!showScoring && scoringField}
              {!showTimeCap && timeCapField}
            </div>
          )

          return (
            <>
              {visibleFields}
              {collapsedLabels.length > 0 && (
                <CollapsedFieldsRow labels={collapsedLabels as [string, ...string[]]}>
                  {collapsedFields}
                </CollapsedFieldsRow>
              )}
            </>
          )
        })()}

        {/* Rest between groups -- always visible */}
        <div className="px-4 lg:px-0">
          <DurationInput
            size="compact"
            clearable
            value={restBetweenGroups}
            onChange={setRestBetweenGroups}
            label="Rest Between Groups (optional)"
          />
        </div>
      </div>

      {/* ---- Right column: activity groups ---- */}
      <div className="flex flex-col gap-3">
        <div className="px-4 lg:px-0">
          <span className="text-xs font-medium uppercase tracking-wider text-warm-ash/60">
            Activity Groups
          </span>
        </div>

        {groups.map((group, index) => (
          <ActivityGroupEditor
            key={group.clientId}
            group={group}
            exercises={exercises}
            sessionCategory={category}
            showAllSchemeTypes={showAllSchemeTypes}
            onShowAllSchemeTypesChange={setShowAllSchemeTypes}
            onChange={(updated) => handleUpdateGroup(index, updated)}
            onDelete={() => handleDeleteGroup(index)}
            onMoveUp={() => handleMoveGroup(index, index - 1)}
            onMoveDown={() => handleMoveGroup(index, index + 1)}
            isFirst={index === 0}
            isLast={index === groups.length - 1}
            PickerComponent={PickerComponent}
            groupErrors={visibleGroupErrors[group.clientId]}
            activityErrors={visibleActivityErrors}
          />
        ))}

        <div className="flex flex-col gap-1 px-4 lg:px-0">
          <Button
            id="field-add-group"
            type="button"
            variant="secondary"
            onClick={handleAddGroup}
            className="w-full min-h-12 text-xs"
          >
            <Icon name="add" size={16} />
            Add group
          </Button>
          {hasAttemptedSave && errors.noGroups && (
            <p role="alert" className="text-center text-xs text-destructive">
              {errors.noGroups}
            </p>
          )}
        </div>
      </div>

      {/* ---- Full-width footer: error summary + actions ---- */}
      {summaryItems.length > 0 && (
        <div className="flex flex-col gap-1 px-4 lg:col-span-2 lg:px-0">
          {summaryItems.map((item) => (
            <button
              key={item.anchorId}
              type="button"
              className="text-left text-xs text-destructive underline-offset-2 hover:underline"
              onClick={() => {
                const el = document.getElementById(item.anchorId)
                if (!el) return
                const reducedMotion =
                  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
                el.scrollIntoView({
                  behavior: reducedMotion ? 'instant' : 'smooth',
                  block: 'center',
                })
                if (el instanceof HTMLElement) el.focus()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {serverError && (
        <div className="px-4 lg:col-span-2 lg:px-0">
          <p role="alert" className="text-xs text-destructive">
            {serverError}
          </p>
        </div>
      )}

      <div className="flex gap-3 px-4 lg:col-span-2 lg:px-0">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="min-h-12 flex-1 text-xs"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-12 flex-1 text-xs"
        >
          {isSaving ? 'Saving...' : 'Save template'}
        </Button>
      </div>
    </div>
  )
}
