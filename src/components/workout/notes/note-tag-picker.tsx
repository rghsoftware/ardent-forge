import { useMemo, useState } from 'react'
import { STARTER_NOTE_TAGS, noteTagSchema } from '@/domain/types'
import { useRecentTagsStore } from '@/stores/recent-tags-store'
import { cn } from '@/lib/utils'

interface NoteTagPickerProps {
  /** Currently-selected tags (already normalized). */
  selected: string[]
  /** Fires when the selection changes. */
  onChange: (next: string[]) => void
}

/**
 * Chip grid of note tags. Combines recently-used tags (front) with the
 * curated starter set (back), deduped case-insensitively. An inline
 * "+ NEW TAG" affordance opens a small input to create a custom tag.
 *
 * Visual: Iron & Ember — no border-radius, tonal layering for active
 * state, ALL-CAPS labels, 48px+ touch targets.
 */
export function NoteTagPicker({ selected, onChange }: NoteTagPickerProps) {
  const recent = useRecentTagsStore((s) => s.recent)
  const markUsed = useRecentTagsStore((s) => s.markUsed)
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  // Merge recent + starter, recent-first, dedupe case-insensitively.
  // Also ensure currently-selected tags always appear in the grid.
  const chips = useMemo(() => {
    const seen = new Set<string>()
    const merged: string[] = []
    const push = (tag: string) => {
      const key = tag.toUpperCase()
      if (seen.has(key)) return
      seen.add(key)
      merged.push(tag)
    }
    for (const t of recent) push(t)
    for (const t of STARTER_NOTE_TAGS) push(t)
    for (const t of selected) push(t)
    return merged
  }, [recent, selected])

  const selectedSet = useMemo(() => new Set(selected.map((t) => t.toUpperCase())), [selected])

  const toggleTag = (tag: string) => {
    const upper = tag.toUpperCase()
    if (selectedSet.has(upper)) {
      onChange(selected.filter((t) => t.toUpperCase() !== upper))
    } else {
      if (selected.length >= 16) return
      markUsed(tag)
      onChange([...selected, tag])
    }
  }

  const submitCustom = () => {
    const parsed = noteTagSchema.safeParse(customValue)
    if (!parsed.success) {
      setCustomError('1-32 chars required')
      return
    }
    const normalized = parsed.data
    if (selectedSet.has(normalized)) {
      setCustomValue('')
      setCustomOpen(false)
      setCustomError(null)
      return
    }
    if (selected.length >= 16) {
      setCustomError('Max 16 tags')
      return
    }
    markUsed(normalized)
    onChange([...selected, normalized])
    setCustomValue('')
    setCustomOpen(false)
    setCustomError(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((tag) => {
          const active = selectedSet.has(tag.toUpperCase())
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={active}
              className={cn(
                'flex min-h-12 items-center px-4 text-xs font-bold uppercase tracking-widest transition-colors',
                active
                  ? 'bg-ember text-surface-pit'
                  : 'bg-surface-steel text-bone-white hover:bg-surface-gunmetal',
              )}
            >
              {/* Shape cue for color-blind safety: leading marker flips on active */}
              <span aria-hidden="true" className="mr-2 font-display">
                {active ? '[*]' : '[ ]'}
              </span>
              {tag}
            </button>
          )
        })}
        {!customOpen && (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="flex min-h-12 items-center px-4 text-xs font-bold uppercase tracking-widest text-ember bg-surface-pit hover:bg-surface-steel"
            aria-label="Create a new tag"
          >
            + NEW TAG
          </button>
        )}
      </div>

      {customOpen && (
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              autoFocus
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value)
                if (customError) setCustomError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitCustom()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setCustomOpen(false)
                  setCustomValue('')
                  setCustomError(null)
                }
              }}
              placeholder="NEW TAG"
              maxLength={32}
              className="min-h-12 flex-1 border-b border-warm-ash/30 bg-transparent px-3 text-sm uppercase tracking-widest text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
              aria-label="New tag name"
            />
            <button
              type="button"
              onClick={submitCustom}
              className="min-h-12 bg-ember px-4 text-xs font-bold uppercase tracking-widest text-surface-pit"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false)
                setCustomValue('')
                setCustomError(null)
              }}
              className="min-h-12 bg-surface-steel px-4 text-xs font-bold uppercase tracking-widest text-warm-ash hover:text-bone-white"
            >
              Cancel
            </button>
          </div>
          {customError && (
            <span className="text-xs uppercase tracking-wider text-red-400">{customError}</span>
          )}
        </div>
      )}
    </div>
  )
}
