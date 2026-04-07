import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { NoteTagPicker } from './note-tag-picker'
import type { NoteContent } from '@/domain/types'

type NoteLevel = 'session' | 'exercise' | 'set'

interface NoteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: NoteContent
  /**
   * Called on blur of the textarea, on every tag toggle, and on a final
   * flush when the sheet closes. Never called on every keystroke.
   */
  onChange: (next: NoteContent) => void
  level: NoteLevel
}

const LEVEL_TITLE = {
  session: 'Session Note',
  exercise: 'Exercise Note',
  set: 'Set Note',
} satisfies Record<NoteLevel, string>

/**
 * Bottom-sheet note editor (F020). Multiline textarea plus an embedded
 * <NoteTagPicker>. Autosave semantics: onChange fires on textarea blur,
 * on every tag toggle, and as a final flush when the sheet closes. No
 * save button.
 *
 * Renders as an overlay so the active workout shell stays mounted —
 * the rest timer keeps running underneath per Spec assertion 7.
 */
export function NoteSheet({ open, onOpenChange, value, onChange, level }: NoteSheetProps) {
  // Draft state only commits to parent on textarea blur, tag toggle, or
  // final close flush — never on every keystroke.
  const [draftText, setDraftText] = useState<string>(value.text)
  const [draftTags, setDraftTags] = useState<string[]>(value.tags)
  const [textDirty, setTextDirty] = useState<boolean>(false)

  // Re-sync draft whenever the sheet transitions from closed → open.
  // React 19 "previous state" pattern: derive from prevOpen during
  // render instead of calling setters in an effect.
  const [prevOpen, setPrevOpen] = useState<boolean>(open)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setDraftText(value.text)
    setDraftTags(value.tags)
    setTextDirty(false)
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  const commitText = () => {
    if (!textDirty) return
    onChange({ text: draftText, tags: draftTags })
    setTextDirty(false)
  }

  const handleTagsChange = (nextTags: string[]) => {
    setDraftTags(nextTags)
    onChange({ text: draftText, tags: nextTags })
    setTextDirty(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && textDirty) {
      onChange({ text: draftText, tags: draftTags })
      setTextDirty(false)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] bg-surface-anvil p-0 motion-reduce:transition-none motion-reduce:animate-none"
      >
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-xs uppercase tracking-widest text-ember">
            {LEVEL_TITLE[level]}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Add free-text and tags for this {level}. Autosaves on blur and on close.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
          <textarea
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value)
              setTextDirty(true)
            }}
            onBlur={commitText}
            placeholder="Add a note..."
            rows={5}
            className="min-h-32 w-full resize-none border border-warm-ash/25 bg-surface-pit px-3 py-2 text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            aria-label={`${LEVEL_TITLE[level]} text`}
          />

          <NoteTagPicker selected={draftTags} onChange={handleTagsChange} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
