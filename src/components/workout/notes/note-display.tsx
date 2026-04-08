import type { NoteContent } from '@/domain/types'
import { cn } from '@/lib/utils'

interface NoteDisplayProps {
  value: NoteContent
  className?: string
}

/**
 * Read-only renderer for a note: free-text paragraph plus any tag chips.
 * Renders nothing when there is no text and no tags (Spec assertion 9:
 * no empty placeholders). Used by history detail views.
 */
export function NoteDisplay({ value, className }: NoteDisplayProps) {
  const hasText = value.text.trim().length > 0
  const hasTags = value.tags.length > 0
  if (!hasText && !hasTags) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {hasText && (
        <p className="whitespace-pre-wrap text-sm text-bone-white">{value.text.trim()}</p>
      )}
      {hasTags && (
        <div className="flex flex-wrap gap-1.5">
          {value.tags.map((tag) => (
            <span
              key={tag}
              className="flex min-h-6 items-center bg-surface-steel px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-warm-ash"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
