import { useState, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { SetSchemeEditor } from './set-scheme-editor'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import type { Exercise, GroupType, SessionType, SetScheme } from '@/domain/types'

export interface PickerComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExerciseSelected: (exercise: Exercise, groupType: GroupType) => void
  userId?: string
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityData {
  clientId: string
  exerciseId: string | null
  setScheme: SetScheme
  notes?: string
  ordinal: number
}

interface ActivityEditorProps {
  activity: ActivityData
  exercises: Exercise[]
  sessionCategory: SessionType
  showAllSchemeTypes: boolean
  onShowAllSchemeTypesChange: (v: boolean) => void
  onChange: (updated: ActivityData) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
  PickerComponent?: ComponentType<PickerComponentProps>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityEditor({
  activity,
  exercises,
  sessionCategory,
  showAllSchemeTypes,
  onShowAllSchemeTypesChange,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  PickerComponent = AddExerciseSheet,
}: ActivityEditorProps) {
  const [showExerciseSheet, setShowExerciseSheet] = useState(false)
  const [showNotes, setShowNotes] = useState(!!activity.notes)

  const exercise = activity.exerciseId ? exercises.find((e) => e.id === activity.exerciseId) : null

  return (
    <div className="bg-surface-iron">
      {/* Header row: ordinal + exercise name + actions */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-surface-steel font-display text-xs tabular-nums text-bone-white">
          {activity.ordinal}
        </span>

        {exercise ? (
          <div className="flex flex-1 items-center gap-2">
            <span className="font-display text-sm font-medium text-bone-white">
              {exercise.name}
            </span>
            <button
              type="button"
              onClick={() => setShowExerciseSheet(true)}
              className="min-h-8 px-2 text-xs font-medium text-warm-ash/60 hover:text-bone-white"
            >
              Change
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowExerciseSheet(true)}
            className="flex-1 text-xs"
          >
            Select exercise
          </Button>
        )}

        <div className="flex items-center gap-0.5">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="flex min-h-10 min-w-8 items-center justify-center text-warm-ash/60 hover:text-bone-white disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Move activity up"
            >
              <Icon name="keyboard_arrow_up" size={18} />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="flex min-h-10 min-w-8 items-center justify-center text-warm-ash/60 hover:text-bone-white disabled:opacity-25 disabled:pointer-events-none"
              aria-label="Move activity down"
            >
              <Icon name="keyboard_arrow_down" size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-bone-white"
            aria-label="Toggle notes"
          >
            <Icon name="notes" size={18} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
            aria-label="Delete activity"
          >
            <Icon name="delete" size={18} />
          </button>
        </div>
      </div>

      {/* Set scheme editor */}
      <div className="px-4 pb-4">
        <SetSchemeEditor
          value={activity.setScheme}
          onChange={(scheme) => onChange({ ...activity, setScheme: scheme })}
          exerciseSupports1RM={exercise?.supports1RM}
          sessionCategory={sessionCategory}
          showAllTypes={showAllSchemeTypes}
          onShowAllTypesChange={onShowAllSchemeTypesChange}
        />
      </div>

      {/* Notes (collapsible) */}
      {showNotes && (
        <div className="border-t border-warm-ash/10 px-4 py-3">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-warm-ash/60">
            Notes
          </span>
          <textarea
            value={activity.notes ?? ''}
            onChange={(e) => onChange({ ...activity, notes: e.target.value || undefined })}
            placeholder="Optional notes for this exercise"
            rows={2}
            className="min-h-12 w-full resize-none border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            aria-label="Activity notes"
          />
        </div>
      )}

      {/* Exercise picker (sheet or drawer, injected by parent route) */}
      <PickerComponent
        open={showExerciseSheet}
        onOpenChange={setShowExerciseSheet}
        onExerciseSelected={(ex) => {
          onChange({ ...activity, exerciseId: ex.id })
        }}
      />
    </div>
  )
}
