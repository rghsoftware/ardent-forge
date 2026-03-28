import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
import type { SessionTemplate } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionTemplateCardProps {
  template: SessionTemplate & { groupCount: number; exerciseCount: number }
  onEdit: () => void
  onDelete: () => void
}

// ---------------------------------------------------------------------------
// Category color map
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  STRENGTH: 'STRENGTH',
  CONDITIONING: 'CONDITIONING',
  SE: 'SE',
  MIXED: 'MIXED',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionTemplateCard({ template, onEdit, onDelete }: SessionTemplateCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-3 bg-surface-iron px-4 py-4 text-left transition-colors hover:bg-surface-gunmetal"
        aria-label={`Edit template ${template.name}`}
      >
        {/* Content */}
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-display text-sm font-medium text-bone-white">{template.name}</span>
          <div className="flex items-center gap-2">
            <Badge className="text-[10px]">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </Badge>
            <span className="text-[10px] uppercase tracking-wider text-warm-ash/60">
              {template.exerciseCount} exercise{template.exerciseCount !== 1 ? 's' : ''}
              {' \u00B7 '}
              {template.groupCount} group{template.groupCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Delete button */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            setConfirmOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              setConfirmOpen(true)
            }
          }}
          className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/60 hover:text-warning-flare"
          aria-label={`Delete ${template.name}`}
        >
          <Icon name="delete" size={18} />
        </div>
      </button>

      {/* Confirm delete dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="text-xs uppercase tracking-widest text-ember">
              DELETE TEMPLATE
            </DialogTitle>
            <DialogDescription className="text-sm text-warm-ash">
              Are you sure you want to delete &quot;{template.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="min-h-12 text-xs uppercase tracking-wider"
            >
              CANCEL
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                onDelete()
              }}
              className="min-h-12 text-xs uppercase tracking-wider"
            >
              DELETE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
