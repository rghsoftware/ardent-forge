import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActivityGroupEditor, type ActivityGroupData } from './activity-group-editor'
import { DurationInputCompact } from './duration-input-compact'
import { defaultScheme } from './set-scheme-defaults'
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
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_CATEGORIES: Array<{ value: SessionType; label: string }> = [
  { value: 'STRENGTH', label: 'STRENGTH' },
  { value: 'CONDITIONING', label: 'CONDITIONING' },
  { value: 'SE', label: 'SE' },
  { value: 'MIXED', label: 'MIXED' },
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
      groupType: g.groupType,
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
      groupType: g.groupType,
      ordinal: g.ordinal,
      rounds: g.rounds ?? undefined,
      restBetweenRounds: g.restBetweenRounds ?? undefined,
      restBetweenActivities: g.restBetweenActivities ?? undefined,
      activities: groupActivities.map((a) => ({
        exerciseId: a.exerciseId,
        setScheme: a.setScheme,
        notes: a.notes,
        ordinal: a.ordinal,
      })),
    }
  })
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function SessionTemplateForm({ initial, onSave, onCancel }: SessionTemplateFormProps) {
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
  const [errors, setErrors] = useState<string[]>([])

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleAddGroup = useCallback(() => {
    const newGroup: ActivityGroupData = {
      groupType: 'STRAIGHT_SETS',
      ordinal: groups.length + 1,
      activities: [
        {
          exerciseId: null,
          setScheme: defaultScheme('fixedSets'),
          ordinal: 1,
        },
      ],
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

  const validate = useCallback((): boolean => {
    const errs: string[] = []

    if (!name.trim()) errs.push('Template name is required')
    if (groups.length === 0) errs.push('At least one activity group is required')

    for (const g of groups) {
      if (g.activities.length === 0) {
        errs.push(`Group ${g.ordinal} must have at least one activity`)
      }
      for (const a of g.activities) {
        if (!a.exerciseId) {
          errs.push(`Group ${g.ordinal}, activity ${a.ordinal}: exercise is required`)
        }
      }
    }

    setErrors(errs)
    return errs.length === 0
  }, [name, groups])

  const handleSave = useCallback(async () => {
    if (!validate()) return
    if (!userId) return

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
        onSave?.(result.template)
      } else {
        const result = await createMutation.mutateAsync({
          template: {
            userId,
            name: name.trim(),
            category,
            description: description.trim() || undefined,
            scoring,
            timeCap,
            restBetweenGroups,
          },
          groups: groupPayload,
        })
        onSave?.(result.template)
      }
    } catch (err) {
      const action = isEditing ? 'update' : 'create'
      console.error(`[session-template-form] Failed to ${action} template "${name.trim()}":`, err)
      setErrors([`Failed to ${action} session template. Please try again.`])
    }
  }, [
    validate,
    userId,
    groups,
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
  ])

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Template name */}
      <div className="px-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="w-full border-0 border-b border-warm-ash/30 bg-transparent py-3 font-display text-lg font-medium text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Template name"
        />
      </div>

      {/* Category selector */}
      <div className="px-4">
        <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          CATEGORY
        </span>
        <div className="flex flex-wrap gap-1">
          {SESSION_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`min-h-10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                category === c.value
                  ? 'bg-forge text-on-forge'
                  : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="px-4">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          DESCRIPTION (OPTIONAL)
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

      {/* Scoring */}
      <div className="px-4">
        <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          SCORING
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

      {/* Time cap */}
      <div className="px-4">
        <DurationInputCompact value={timeCap} onChange={setTimeCap} label="TIME CAP (OPTIONAL)" />
      </div>

      {/* Rest between groups */}
      <div className="px-4">
        <DurationInputCompact
          value={restBetweenGroups}
          onChange={setRestBetweenGroups}
          label="REST BETWEEN GROUPS (OPTIONAL)"
        />
      </div>

      {/* Activity groups */}
      <div className="flex flex-col gap-3">
        <div className="px-4">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            ACTIVITY GROUPS
          </span>
        </div>

        {groups.map((group, index) => (
          <ActivityGroupEditor
            key={index}
            group={group}
            exercises={exercises}
            onChange={(updated) => handleUpdateGroup(index, updated)}
            onDelete={() => handleDeleteGroup(index)}
          />
        ))}

        <div className="px-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddGroup}
            className="w-full min-h-12 text-xs"
          >
            <Icon name="add" size={16} />
            Add group
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-1 px-4">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 px-4">
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
