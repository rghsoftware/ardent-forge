import { useState, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { WeekGrid } from './week-grid'
import { removeBlock, addWeekToBlock } from './builder-state'
import type { BlockDraft, ProgramDraft } from './builder-state'
import type { BlockType } from '@/domain/types'
import { BLOCK_TYPES } from './constants'
import type { DayOfWeek } from './constants'

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

interface BlockEditorProps {
  block: BlockDraft
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek?: (sourceWeekClientId: string) => void
}

export function BlockEditor({
  block,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: BlockEditorProps) {
  const [expanded, setExpanded] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.clientId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleNameChange = useCallback(
    (newName: string) => {
      onUpdate({
        ...draft,
        blocks: draft.blocks.map((b) =>
          b.clientId === block.clientId ? { ...b, name: newName } : b,
        ),
      })
    },
    [draft, block.clientId, onUpdate],
  )

  const handleBlockTypeChange = useCallback(
    (blockType: BlockType) => {
      onUpdate({
        ...draft,
        blocks: draft.blocks.map((b) => (b.clientId === block.clientId ? { ...b, blockType } : b)),
      })
    },
    [draft, block.clientId, onUpdate],
  )

  const handleDelete = useCallback(() => {
    onUpdate(removeBlock(draft, block.clientId))
  }, [draft, block.clientId, onUpdate])

  const handleAddWeek = useCallback(() => {
    onUpdate(addWeekToBlock(draft, block.clientId))
  }, [draft, block.clientId, onUpdate])

  const handleCopyWeek = useCallback(
    (sourceWeekClientId: string) => {
      onCopyWeek?.(sourceWeekClientId)
    },
    [onCopyWeek],
  )

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle if clicking interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[data-drag-handle]')
    ) {
      return
    }
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="bg-surface-iron">
      <div
        className="flex min-h-12 cursor-pointer items-center gap-2 px-3 py-2"
        onClick={handleHeaderClick}
      >
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          type="button"
          data-drag-handle
          className="cursor-grab touch-none text-warm-ash/60 hover:text-bone-white"
          aria-label="Drag to reorder block"
        >
          <Icon name="drag_indicator" size={20} />
        </button>

        {isEditingName ? (
          <input
            type="text"
            value={block.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditingName(false)
            }}
            autoFocus
            className="flex-1 border-0 border-b border-warm-ash/30 bg-transparent py-1 font-display text-sm font-medium text-bone-white focus:border-ember focus:outline-none"
            aria-label="Block name"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditingName(true)
            }}
            className="flex-1 text-left font-display text-sm font-medium text-bone-white hover:text-ember"
          >
            {block.name || 'Untitled block'}
          </button>
        )}

        <span className="bg-surface-steel px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-bone-white">
          {block.blockType}
        </span>

        <span className="text-[11px] font-medium uppercase tracking-wider text-warm-ash/60">
          {block.weeks.length} {block.weeks.length === 1 ? 'WEEK' : 'WEEKS'}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDelete()
          }}
          className="min-h-8 min-w-8 p-1 text-warm-ash/60 hover:text-warning-flare"
          aria-label="Delete block"
        >
          <Icon name="delete" size={18} />
        </button>

        <Icon
          name={expanded ? 'expand_less' : 'expand_more'}
          size={18}
          className="text-warm-ash/40"
        />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="flex flex-col gap-4 px-3 pb-4">
          <div className="flex flex-wrap gap-1">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.value}
                type="button"
                onClick={() => handleBlockTypeChange(bt.value)}
                className={`min-h-8 px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  block.blockType === bt.value
                    ? 'bg-forge text-on-forge'
                    : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>

          {block.weeks.map((week, weekIndex) => (
            <WeekGrid
              key={week.clientId}
              week={week}
              weekIndex={weekIndex}
              draft={draft}
              blockClientId={block.clientId}
              onUpdate={onUpdate}
              onPickSession={onPickSession}
              onCopyWeek={handleCopyWeek}
            />
          ))}

          <Button
            type="button"
            variant="secondary"
            onClick={handleAddWeek}
            className="min-h-10 text-xs"
          >
            <Icon name="add" size={16} />
            Add week
          </Button>
        </div>
      )}
    </div>
  )
}
