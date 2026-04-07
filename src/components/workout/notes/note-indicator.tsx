import { cn } from '@/lib/utils'

interface NoteIndicatorProps {
  hasNote: boolean
  className?: string
}

/**
 * Small ember dot signaling "a note is attached". Visual only — relies
 * on an adjacent label or aria to communicate meaning (color-blind
 * safety per Spec assertion 8).
 */
export function NoteIndicator({ hasNote, className }: NoteIndicatorProps) {
  if (!hasNote) return null
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2 w-2 bg-ember', className)}
      data-testid="note-indicator"
    />
  )
}
