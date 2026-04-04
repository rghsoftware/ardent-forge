import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { WeekDraft } from './builder-state'

// ---------------------------------------------------------------------------
// CopyWeekDialog
// ---------------------------------------------------------------------------

interface CopyWeekDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceWeek: WeekDraft
  allWeeks: WeekDraft[]
  onCopy: (targetWeekClientIds: string[]) => void
}

export function CopyWeekDialog({
  open,
  onOpenChange,
  sourceWeek,
  allWeeks,
  onCopy,
}: CopyWeekDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [prevSourceId, setPrevSourceId] = useState(sourceWeek.clientId)
  if (prevSourceId !== sourceWeek.clientId) {
    setPrevSourceId(sourceWeek.clientId)
    setSelected(new Set())
  }

  // Non-source weeks only
  const targetWeeks = allWeeks.filter((w) => w.clientId !== sourceWeek.clientId)

  const handleToggle = useCallback((weekClientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(weekClientId)) {
        next.delete(weekClientId)
      } else {
        next.add(weekClientId)
      }
      return next
    })
  }, [])

  const handleSelectAllRemaining = useCallback(() => {
    // Select all weeks after the source week within this block
    const sourceIndex = allWeeks.findIndex((w) => w.clientId === sourceWeek.clientId)
    const remaining = allWeeks.slice(sourceIndex + 1).map((w) => w.clientId)
    setSelected(new Set(remaining))
  }, [allWeeks, sourceWeek.clientId])

  const handleConfirm = useCallback(() => {
    if (selected.size > 0) {
      onCopy(Array.from(selected))
    }
    setSelected(new Set())
    onOpenChange(false)
  }, [selected, onCopy, onOpenChange])

  const handleCancel = useCallback(() => {
    setSelected(new Set())
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-iron">
        <DialogHeader>
          <DialogTitle className="text-xs text-ember">Copy Week</DialogTitle>
          <DialogDescription className="text-sm text-warm-ash">
            Copy sessions from Week {sourceWeek.weekNumber} to other weeks. Existing sessions in
            target weeks will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Source week label */}
          <div className="flex items-center gap-2 bg-surface-charcoal px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-warm-ash/60">
              SOURCE
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-bone-white">
              WEEK {sourceWeek.weekNumber}
            </span>
            <span className="text-[11px] text-warm-ash/40">
              ({sourceWeek.sessions.length}{' '}
              {sourceWeek.sessions.length === 1 ? 'session' : 'sessions'})
            </span>
          </div>

          {/* Select all remaining button */}
          {targetWeeks.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleSelectAllRemaining}
              className="min-h-10 text-xs text-ember"
            >
              Select all remaining
            </Button>
          )}

          {/* Target week checkboxes */}
          <div className="flex flex-col gap-1">
            {targetWeeks.map((week) => (
              <label
                key={week.clientId}
                className="flex min-h-10 cursor-pointer items-center gap-3 bg-surface-charcoal px-3 py-2 transition-colors hover:bg-surface-gunmetal"
              >
                <Checkbox
                  checked={selected.has(week.clientId)}
                  onCheckedChange={() => handleToggle(week.clientId)}
                />
                <span className="text-xs font-medium uppercase tracking-wider text-bone-white">
                  WEEK {week.weekNumber}
                </span>
                {week.sessions.length > 0 && (
                  <span className="text-[11px] text-warning-flare/70">
                    ({week.sessions.length} existing -- will be replaced)
                  </span>
                )}
              </label>
            ))}
          </div>

          {targetWeeks.length === 0 && (
            <p className="py-4 text-center text-xs text-warm-ash/60">
              No other weeks to copy to. Add more weeks first.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCancel} className="min-h-12 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="min-h-12 text-xs"
          >
            Confirm copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
