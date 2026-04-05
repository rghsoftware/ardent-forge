import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { BlockTypeSelector } from './block-type-selector'
import { WeekGrid } from './week-grid'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import { removeBlock, addWeekToBlock, weeksMatch } from './builder-state'
import type { BlockDraft, ProgramDraft, ValidationError } from './builder-state'
import type { BlockType } from '@/domain/types'
import { BLOCK_TYPE_STYLES, SESSION_TYPE_BADGE } from './constants'
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
  showWeekends: boolean
  isNew?: boolean
  errors?: ValidationError[]
}

export function BlockEditor({
  block,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
  showWeekends,
  isNew,
  errors = [],
}: BlockEditorProps) {
  const [expanded, setExpanded] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newWeekId, setNewWeekId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set())

  // Determine which weeks match the first week in the block
  const collapsibleWeeks = useMemo(() => {
    if (block.weeks.length < 2) return new Map<string, number>()
    const first = block.weeks[0]
    const map = new Map<string, number>()
    for (let i = 1; i < block.weeks.length; i++) {
      if (weeksMatch(first, block.weeks[i]) && first.sessions.length > 0) {
        map.set(block.weeks[i].clientId, 1) // references week 1
      }
    }
    return map
  }, [block.weeks])

  const nameError = errors.find((e) => e.field === 'blockName')?.message
  const weeksError = errors.find((e) => e.field === 'blockWeeks')?.message

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

  const totalSessions = useMemo(
    () => block.weeks.reduce((sum, w) => sum + w.sessions.length, 0),
    [block.weeks],
  )

  const deleteDescription = useMemo(() => {
    const parts: string[] = []
    if (block.weeks.length > 0)
      parts.push(`${block.weeks.length} ${block.weeks.length === 1 ? 'week' : 'weeks'}`)
    if (totalSessions > 0)
      parts.push(`${totalSessions} ${totalSessions === 1 ? 'session' : 'sessions'}`)
    return parts.length > 0 ? `This will remove ${parts.join(' and ')}.` : 'This block is empty.'
  }, [block.weeks.length, totalSessions])

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
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          id={`block-${block.clientId}`}
          className="border-l-2 border-forge bg-surface-iron milled-edge"
        >
          {/* Block header -- two rows for breathing room */}
          <div className="cursor-pointer px-3 py-3" onClick={handleHeaderClick}>
            {/* Row 1: drag handle + name + menu */}
            <div className="flex items-center gap-2">
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
                  className={`flex-1 border-0 border-b bg-transparent py-1 font-display text-sm font-medium text-bone-white focus:outline-none ${
                    nameError
                      ? 'border-warning-flare focus:border-warning-flare'
                      : 'border-warm-ash/30 focus:border-ember'
                  }`}
                  aria-label="Block name"
                  aria-invalid={!!nameError}
                />
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditingName(true)
                  }}
                  className={`flex-1 text-left font-display text-sm font-medium ${
                    nameError ? 'text-warning-flare' : 'text-bone-white hover:text-ember'
                  }`}
                >
                  {block.name || 'Untitled block'}
                </button>
              )}

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
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setShowDeleteConfirm(true)}
                  >
                    <Icon name="delete" size={16} />
                    Delete block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Row 2: type badge + week count + expand/collapse */}
            <div className="mt-1.5 flex items-center gap-2 pl-7">
              <span
                className={`shrink-0 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${BLOCK_TYPE_STYLES[block.blockType] ?? 'bg-surface-steel text-bone-white'}`}
              >
                {block.blockType}
              </span>

              <span className="shrink-0 text-xs font-medium text-warm-ash/60">
                {block.weeks.length} {block.weeks.length === 1 ? 'week' : 'weeks'}
              </span>

              {totalSessions > 0 && (
                <span className="text-[11px] text-warm-ash/40">
                  {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'}
                </span>
              )}

              <div className="flex-1" />

              <Icon
                name={expanded ? 'expand_less' : 'expand_more'}
                size={18}
                className="shrink-0 text-warm-ash/50"
              />
            </div>
          </div>

          {/* Inline validation errors */}
          {errors.length > 0 && (
            <div className="flex flex-col gap-1 px-3 pb-2">
              {nameError && <p className="text-xs text-warning-flare">{nameError}</p>}
              {weeksError && <p className="text-xs text-warning-flare">{weeksError}</p>}
            </div>
          )}

          {/* Expanded content */}
          <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200">
            <div className="flex flex-col gap-4 px-3 pb-4">
              <BlockTypeSelector value={block.blockType} onChange={handleBlockTypeChange} />

              {block.weeks.map((week, weekIndex) => {
                const isCollapsible = collapsibleWeeks.has(week.clientId)
                const isForceExpanded = manuallyExpanded.has(week.clientId)

                if (isCollapsible && !isForceExpanded) {
                  const refWeekNum = collapsibleWeeks.get(week.clientId)!
                  const sessionTypes = [...new Set(week.sessions.map((s) => s.sessionType))]
                  return (
                    <div
                      key={week.clientId}
                      className="flex items-center gap-2 border-t border-warm-ash/10 pt-3 mt-1"
                    >
                      <span className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                        Week {weekIndex + 1}
                      </span>
                      <span className="text-[11px] text-warm-ash/50">
                        same as Week {refWeekNum}
                      </span>
                      <div className="flex items-center gap-1">
                        {sessionTypes.map((st) => (
                          <span
                            key={st}
                            className={`px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${SESSION_TYPE_BADGE[st] ?? 'bg-surface-steel text-warm-ash'}`}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setManuallyExpanded((prev) => new Set([...prev, week.clientId]))
                        }
                        className="p-1 text-warm-ash/40 hover:text-bone-white"
                        aria-label={`Expand week ${weekIndex + 1}`}
                      >
                        <Icon name="expand_more" size={14} />
                      </button>
                    </div>
                  )
                }

                return (
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
                )
              })}

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

      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${block.name || 'Untitled block'}?`}
        description={deleteDescription}
        onConfirm={handleDelete}
      />
    </>
  )
}
