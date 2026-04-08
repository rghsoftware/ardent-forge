import { useState } from 'react'
import { NoteSheet } from './note-sheet'
import { NoteIndicator } from './note-indicator'
import type { NoteContent } from '@/domain/types'
import { cn } from '@/lib/utils'

type NoteLevel = 'session' | 'exercise' | 'set'

interface NoteAffordanceProps {
  value: NoteContent
  onChange: (next: NoteContent) => void
  level: NoteLevel
  /**
   * Visual style — `inline` for dense rows (set-row), `block` for wider
   * surfaces (exercise card header, workout header).
   */
  variant?: 'inline' | 'block'
  className?: string
}

/**
 * Tappable trigger that opens the <NoteSheet> editor. Owns its own open
 * state so consumers only pass value + onChange. Shows a <NoteIndicator>
 * when a note is present.
 */
export function NoteAffordance({
  value,
  onChange,
  level,
  variant = 'inline',
  className,
}: NoteAffordanceProps) {
  const [open, setOpen] = useState(false)
  const hasNote = value.text.trim().length > 0 || value.tags.length > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasNote ? `Edit ${level} note` : `Add ${level} note`}
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-12 min-w-12 items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors',
          variant === 'inline'
            ? 'px-3 text-warm-ash hover:text-bone-white'
            : 'bg-surface-steel px-4 text-bone-white hover:bg-surface-gunmetal',
          className,
        )}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          edit_note
        </span>
        <span>{hasNote ? 'Edit Note' : 'Add Note'}</span>
        {hasNote && <NoteIndicator hasNote />}
      </button>
      <NoteSheet
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={onChange}
        level={level}
      />
    </>
  )
}
