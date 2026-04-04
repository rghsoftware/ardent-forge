import { useState, useCallback, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { WeekGrid } from './week-grid'
import { removeBlock, addWeekToBlock } from './builder-state'
import type { BlockDraft, ProgramDraft } from './builder-state'
import type { BlockType } from '@/domain/types'
import { BLOCK_TYPES } from './constants'
import type { DayOfWeek } from './constants'

const BLOCK_TYPE_STYLES: Record<string, string> = {
  ACCUMULATION: 'bg-quenched/15 text-quenched',
  INTENSIFICATION: 'bg-ember/15 text-ember',
  REALIZATION: 'bg-forge/15 text-forge',
  DELOAD: 'bg-arc/15 text-arc',
  TEST: 'bg-warm-ash/15 text-warm-ash',
}

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

interface BlockEditorProps {
  block: BlockDraft
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek?: (sourceWeekClientId: string) => void
  showWeekends: boolean
  isNew?: boolean
}

export function BlockEditor({
  block,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
  showWeekends,
  isNew,
}: BlockEditorProps) {
  const [expanded, setExpanded] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newWeekId, setNewWeekId] = useState<string | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.clientId })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(isNew ? { animation: 'block-enter 0.3s ease-out both' } : {}),
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
    const updated = addWeekToBlock(draft, block.clientId)
    const updatedBlock = updated.blocks.find((b) => b.clientId === block.clientId)
    const newWeek = updatedBlock?.weeks[updatedBlock.weeks.length - 1]
    if (newWeek) setNewWeekId(newWeek.clientId)
    onUpdate(updated)
  }, [draft, block.clientId, onUpdate])

  useEffect(() => {
    if (newWeekId) {
      const t = setTimeout(() => setNewWeekId(null), 350)
      return () => clearTimeout(t)
    }
  }, [newWeekId])

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
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="border-l-2 border-forge bg-surface-iron milled-edge"
      >
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

          <span
            className={`shrink-0 px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${BLOCK_TYPE_STYLES[block.blockType] ?? 'bg-surface-steel text-bone-white'}`}
          >
            {block.blockType}
          </span>

          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-warm-ash/60">
            {block.weeks.length} {block.weeks.length === 1 ? 'WEEK' : 'WEEKS'}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-8 min-w-8 items-center justify-center text-warm-ash/60 hover:text-bone-white"
                aria-label="Block actions"
              >
                <Icon name="more_vert" size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                <Icon name="delete" size={16} />
                Delete block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Icon
            name={expanded ? 'expand_less' : 'expand_more'}
            size={18}
            className="shrink-0 text-warm-ash/40"
          />
        </div>

        {/* Expanded content */}
        <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200">
          <div className="flex flex-col gap-4 px-3 pb-4">
            <ToggleGroup
              type="single"
              value={block.blockType}
              onValueChange={(v) => {
                if (v) handleBlockTypeChange(v as BlockType)
              }}
              className="flex flex-wrap gap-1"
            >
              {BLOCK_TYPES.map((bt) => (
                <ToggleGroupItem
                  key={bt.value}
                  value={bt.value}
                  className="min-h-8 px-2 py-1 text-[11px] font-medium uppercase tracking-wider"
                >
                  {bt.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

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
                showWeekends={showWeekends}
                isNew={week.clientId === newWeekId}
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
