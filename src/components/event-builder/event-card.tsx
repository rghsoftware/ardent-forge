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
import { useEventItems } from '@/hooks/use-event-items'
import type { SessionTemplate } from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventCardProps {
  template: SessionTemplate
  onEdit: () => void
  onDelete: () => void
  onClone: () => void
  isCloning?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventDate(isoDate: string | undefined): string {
  if (!isoDate) return 'TBD'
  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return 'TBD'
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventCard({ template, onEdit, onDelete, onClone, isCloning }: EventCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { data: items = [] } = useEventItems(template.id, 'template')

  const metadata = template.eventMetadata
  const eventDate = formatEventDate(metadata?.eventDate)
  const location = metadata?.location

  return (
    <>
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-3 border-l-2 border-ember bg-surface-iron px-4 py-4 text-left transition-colors hover:bg-surface-gunmetal"
        aria-label={`Edit event ${template.name}`}
      >
        {/* Flag icon */}
        <div className="flex min-h-10 min-w-10 shrink-0 items-center justify-center text-ember">
          <Icon name="flag" size={20} fill />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-display text-sm font-medium uppercase tracking-wider text-bone-white">
            {template.name}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
              {eventDate}
            </span>
            {location && (
              <>
                <span className="text-warm-ash/30">|</span>
                <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">
                  {location}
                </span>
              </>
            )}
          </div>

          {items.length > 0 && (
            <Badge className="mt-1 w-fit text-[11px]">
              {items.length} {items.length === 1 ? 'ITEM' : 'ITEMS'}
            </Badge>
          )}
        </div>

        {/* Clone button */}
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
          aria-label={`Clone ${template.name}`}
        >
          <Icon name="content_copy" size={18} />
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
            <DialogTitle className="text-xs text-ember">DELETE EVENT</DialogTitle>
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
