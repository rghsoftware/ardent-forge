import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SESSION_TYPE_BADGE } from '@/components/program-builder/constants'
import type { SessionTemplate, ScoringType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionTemplateCardProps {
  template: SessionTemplate
  groupCount?: number
  exerciseCount?: number
  onEdit: () => void
  onDelete: () => void
  onClone?: () => void
  isCloning?: boolean
}

// ---------------------------------------------------------------------------
// Display constants (SESSION_TYPE_BADGE imported from program-builder/constants)
// ---------------------------------------------------------------------------

const SCORING_LABELS = {
  NONE: null,
  FOR_TIME: 'For time',
  TIME: 'Time',
  FOR_REPS: 'For reps',
  ROUNDS_PLUS_REPS: 'Rounds+Reps',
  FOR_DISTANCE: 'For distance',
  LOAD: 'Load',
} satisfies Record<ScoringType, string | null>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionTemplateCard({
  template,
  groupCount,
  exerciseCount,
  onEdit,
  onDelete,
  onClone,
  isCloning,
}: SessionTemplateCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const scoringLabel = SCORING_LABELS[template.scoring]

  return (
    <>
      <div className="flex w-full items-center gap-3 bg-surface-iron px-4 py-4 transition-colors hover:bg-surface-gunmetal">
        {/* Clickable content area */}
        <button
          type="button"
          onClick={onEdit}
          className="flex flex-1 flex-col gap-1.5 text-left"
          aria-label={`Edit template ${template.name}`}
        >
          <span className="font-display text-sm font-medium text-bone-white">{template.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${SESSION_TYPE_BADGE[template.category] ?? 'bg-surface-steel text-warm-ash'}`}
            >
              {template.category}
            </span>
            {scoringLabel && <span className="text-[11px] text-warm-ash/60">{scoringLabel}</span>}
          </div>
          {(groupCount !== undefined || exerciseCount !== undefined) && (
            <span className="text-[11px] text-warm-ash/50">
              {[
                groupCount !== undefined &&
                  `${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`,
                exerciseCount !== undefined &&
                  `${exerciseCount} ${exerciseCount === 1 ? 'exercise' : 'exercises'}`,
              ]
                .filter(Boolean)
                .join(' / ')}
            </span>
          )}
        </button>

        {/* Clone button */}
        {onClone && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              if (!isCloning) onClone()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                if (!isCloning) onClone()
              }
            }}
            className={`flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-ember ${isCloning ? 'animate-pulse opacity-50' : ''}`}
            aria-label={`Duplicate ${template.name}`}
          >
            <Icon name="content_copy" size={18} />
          </div>
        )}

        {/* Delete button */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
          aria-label={`Delete ${template.name}`}
        >
          <Icon name="delete" size={18} />
        </button>
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="text-xs text-ember">Delete Template</DialogTitle>
            <DialogDescription className="text-sm text-warm-ash">
              Are you sure you want to delete &quot;{template.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="min-h-12 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                onDelete()
              }}
              className="min-h-12 text-xs"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
