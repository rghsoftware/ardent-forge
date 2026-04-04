import { useState, useCallback, useEffect, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import {
  addBlock,
  removeBlock,
  reorderBlocks,
  addWeekToBlock,
  removeWeekFromBlock,
  removeSession,
} from './builder-state'
import type { ProgramDraft, BlockDraft, SessionDraft } from './builder-state'
import type { BlockType } from '@/domain/types'
import {
  BLOCK_TYPES,
  DAY_ABBREVIATIONS,
  DAY_ORDER,
  SESSION_TINT,
  SESSION_TYPE_BADGE,
} from './constants'
import type { DayOfWeek } from './constants'

const BLOCK_TYPE_STYLES: Record<string, string> = {
  ACCUMULATION: 'bg-quenched/15 text-quenched',
  INTENSIFICATION: 'bg-ember/15 text-ember',
  REALIZATION: 'bg-forge/15 text-forge',
  DELOAD: 'bg-arc/15 text-arc',
  TEST: 'bg-warm-ash/15 text-warm-ash',
}

// ---------------------------------------------------------------------------
// MobileBlockEditor
// ---------------------------------------------------------------------------

interface MobileBlockEditorProps {
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek: (sourceWeekClientId: string) => void
}

export function MobileBlockEditor({
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: MobileBlockEditorProps) {
  const [newBlockId, setNewBlockId] = useState<string | null>(null)

  const handleAddBlock = useCallback(() => {
    const updated = addBlock(draft, 'ACCUMULATION')
    const newBlock = updated.blocks[updated.blocks.length - 1]
    setNewBlockId(newBlock.clientId)
    onUpdate(updated)
  }, [draft, onUpdate])

  useEffect(() => {
    if (newBlockId) {
      const t = setTimeout(() => setNewBlockId(null), 350)
      return () => clearTimeout(t)
    }
  }, [newBlockId])

  return (
    <div className="flex flex-col gap-3">
      {draft.blocks.map((block, blockIndex) => (
        <MobileBlockCard
          key={block.clientId}
          block={block}
          blockIndex={blockIndex}
          draft={draft}
          onUpdate={onUpdate}
          onPickSession={onPickSession}
          onCopyWeek={onCopyWeek}
          isNew={block.clientId === newBlockId}
        />
      ))}

      {draft.blocks.length === 0 && (
        <p className="py-8 text-center text-sm text-warm-ash/50">
          Start by adding your first training block.
        </p>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={handleAddBlock}
        className="min-h-12 w-full text-xs"
      >
        <Icon name="add" size={16} />
        Add block
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileBlockCard -- expandable accordion card for each block
// ---------------------------------------------------------------------------

interface MobileBlockCardProps {
  block: BlockDraft
  blockIndex: number
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek: (sourceWeekClientId: string) => void
  isNew?: boolean
}

function MobileBlockCard({
  block,
  blockIndex,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
  isNew,
}: MobileBlockCardProps) {
  const [expanded, setExpanded] = useState(blockIndex === 0)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newWeekId, setNewWeekId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isFirst = blockIndex === 0
  const isLast = blockIndex === draft.blocks.length - 1

  const handleMoveUp = useCallback(() => {
    if (isFirst) return
    onUpdate(reorderBlocks(draft, blockIndex, blockIndex - 1))
  }, [draft, blockIndex, isFirst, onUpdate])

  const handleMoveDown = useCallback(() => {
    if (isLast) return
    onUpdate(reorderBlocks(draft, blockIndex, blockIndex + 1))
  }, [draft, blockIndex, isLast, onUpdate])

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

  return (
    <>
      <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
        <div
          className="border-l-2 border-forge bg-surface-iron milled-edge"
          style={isNew ? { animation: 'block-enter 0.3s ease-out both' } : undefined}
        >
          <div className="flex min-h-12 items-center gap-2 px-3 py-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-h-12 min-w-8 items-center justify-center text-warm-ash/40"
                aria-label={expanded ? 'Collapse block' : 'Expand block'}
              >
                <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
              </button>
            </CollapsibleTrigger>

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
                className="min-w-0 flex-1 border-0 border-b border-warm-ash/30 bg-transparent py-1 font-display text-sm font-medium text-bone-white focus:border-ember focus:outline-none"
                aria-label="Block name"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="min-w-0 flex-1 text-left font-display text-sm font-medium text-bone-white hover:text-ember"
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
              {block.weeks.length} {block.weeks.length === 1 ? 'WK' : 'WKS'}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-12 min-w-10 items-center justify-center text-warm-ash/60 hover:text-bone-white"
                  aria-label="Block actions"
                >
                  <Icon name="more_vert" size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem disabled={isFirst} onSelect={handleMoveUp}>
                  <Icon name="arrow_upward" size={16} />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={isLast} onSelect={handleMoveDown}>
                  <Icon name="arrow_downward" size={16} />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setShowDeleteConfirm(true)}>
                  <Icon name="delete" size={16} />
                  Delete block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <MobileWeekSection
                  key={week.clientId}
                  weekIndex={weekIndex}
                  weekClientId={week.clientId}
                  sessions={week.sessions}
                  draft={draft}
                  blockClientId={block.clientId}
                  onUpdate={onUpdate}
                  onPickSession={onPickSession}
                  onCopyWeek={onCopyWeek}
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

// ---------------------------------------------------------------------------
// MobileWeekSection -- vertical list of day slots for a week
// ---------------------------------------------------------------------------

interface MobileWeekSectionProps {
  weekIndex: number
  weekClientId: string
  sessions: SessionDraft[]
  draft: ProgramDraft
  blockClientId: string
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek: (sourceWeekClientId: string) => void
  isNew?: boolean
}

function MobileWeekSection({
  weekIndex,
  weekClientId,
  sessions,
  draft,
  blockClientId,
  onUpdate,
  onPickSession,
  onCopyWeek,
  isNew,
}: MobileWeekSectionProps) {
  const [showWeekDeleteConfirm, setShowWeekDeleteConfirm] = useState(false)

  // Build session lookup by dayOfWeek
  const sessionsByDay = new Map(
    sessions.filter((s) => s.dayOfWeek !== null).map((s) => [s.dayOfWeek!, s]),
  )

  const handleRemoveWeek = useCallback(() => {
    onUpdate(removeWeekFromBlock(draft, blockClientId, weekClientId))
  }, [draft, blockClientId, weekClientId, onUpdate])

  const handleCopy = useCallback(() => {
    onCopyWeek(weekClientId)
  }, [weekClientId, onCopyWeek])

  const weekDeleteDescription = useMemo(() => {
    if (sessions.length > 0)
      return `This will remove ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}.`
    return 'This week is empty.'
  }, [sessions.length])

  return (
    <div
      className="flex flex-col gap-1"
      style={isNew ? { animation: 'block-enter 0.25s ease-out both' } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
          WEEK {weekIndex + 1}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-10 p-1 text-warm-ash/40 hover:text-ember"
          aria-label={`Copy week ${weekIndex + 1}`}
        >
          <Icon name="content_copy" size={14} />
        </button>
        <button
          type="button"
          onClick={() => setShowWeekDeleteConfirm(true)}
          className="min-h-10 p-1 text-warm-ash/40 hover:text-warning-flare"
          aria-label={`Remove week ${weekIndex + 1}`}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {DAY_ORDER.map((dayOfWeek) => {
          const session = sessionsByDay.get(dayOfWeek)

          return (
            <MobileDayRow
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              session={session}
              weekClientId={weekClientId}
              draft={draft}
              onUpdate={onUpdate}
              onPickSession={onPickSession}
            />
          )
        })}
      </div>

      <ConfirmDeleteDialog
        open={showWeekDeleteConfirm}
        onOpenChange={setShowWeekDeleteConfirm}
        title={`Delete week ${weekIndex + 1}?`}
        description={weekDeleteDescription}
        onConfirm={handleRemoveWeek}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileDayRow -- single day slot as a tappable row
// ---------------------------------------------------------------------------

interface MobileDayRowProps {
  dayOfWeek: DayOfWeek
  session: SessionDraft | undefined
  weekClientId: string
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
}

function MobileDayRow({
  dayOfWeek,
  session,
  weekClientId,
  draft,
  onUpdate,
  onPickSession,
}: MobileDayRowProps) {
  const handleTap = useCallback(() => {
    onPickSession(weekClientId, dayOfWeek)
  }, [weekClientId, dayOfWeek, onPickSession])

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (session) {
        const previousDraft = draft
        onUpdate(removeSession(draft, weekClientId, session.clientId))
        toast('Session removed', {
          action: {
            label: 'Undo',
            onClick: () => onUpdate(previousDraft),
          },
          duration: 5000,
        })
      }
    },
    [session, draft, weekClientId, onUpdate],
  )

  if (!session) {
    return (
      <button
        type="button"
        onClick={handleTap}
        className="flex min-h-12 items-center gap-3 bg-surface-charcoal px-3 py-2 text-left transition-colors hover:bg-surface-steel"
        aria-label={`Assign session to ${DAY_ABBREVIATIONS[dayOfWeek]}`}
      >
        <span className="w-8 text-[11px] font-medium uppercase tracking-wider text-warm-ash/60">
          {DAY_ABBREVIATIONS[dayOfWeek]}
        </span>
        <span className="flex-1 text-xs text-warm-ash/40">Tap to assign</span>
        <Icon name="add" size={16} className="text-warm-ash/30" />
      </button>
    )
  }

  const isEvent = session.sessionType === 'EVENT'

  return (
    <button
      type="button"
      onClick={handleTap}
      className={`flex min-h-12 items-center gap-3 px-3 py-2 text-left transition-colors ${
        isEvent
          ? 'border-l-2 border-ember bg-surface-iron hover:bg-surface-steel'
          : 'bg-surface-charcoal hover:bg-surface-steel'
      } ${SESSION_TINT[session.sessionType] ?? ''}`}
      aria-label={`Session: ${session.templateName ?? 'Unnamed'} on ${DAY_ABBREVIATIONS[dayOfWeek]}`}
    >
      <span className="w-8 text-[11px] font-medium uppercase tracking-wider text-warm-ash/60">
        {DAY_ABBREVIATIONS[dayOfWeek]}
      </span>
      {isEvent && <Icon name="flag" size={14} fill className="shrink-0 text-ember" />}
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          isEvent ? 'font-display uppercase tracking-wider text-bone-white' : 'text-bone-white'
        }`}
      >
        {session.templateName ?? 'Unnamed'}
      </span>
      <span
        className={`px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
          SESSION_TYPE_BADGE[session.sessionType] ?? 'bg-surface-steel text-warm-ash'
        }`}
      >
        {session.sessionType}
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRemove}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleRemove(e as unknown as React.MouseEvent)
        }}
        className="min-h-10 min-w-10 flex items-center justify-center text-warm-ash/40 hover:text-warning-flare"
        aria-label="Remove session"
      >
        <Icon name="close" size={14} />
      </div>
    </button>
  )
}
