import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import {
  addBlock,
  removeBlock,
  reorderBlocks,
  addWeekToBlock,
  removeWeekFromBlock,
  removeSession,
} from './builder-state'
import type { ProgramDraft, BlockDraft } from './builder-state'
import type { BlockType } from '@/domain/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_TYPES: Array<{ value: BlockType; label: string }> = [
  { value: 'ACCUMULATION', label: 'ACCUMULATION' },
  { value: 'INTENSIFICATION', label: 'INTENSIFICATION' },
  { value: 'REALIZATION', label: 'REALIZATION' },
  { value: 'DELOAD', label: 'DELOAD' },
  { value: 'TEST', label: 'TEST' },
]

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

// Day order: Mon(1) through Sun(0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

// ---------------------------------------------------------------------------
// MobileBlockEditor
// ---------------------------------------------------------------------------

interface MobileBlockEditorProps {
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
  onCopyWeek: (sourceWeekClientId: string) => void
}

export function MobileBlockEditor({
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: MobileBlockEditorProps) {
  const handleAddBlock = useCallback(() => {
    onUpdate(addBlock(draft, 'ACCUMULATION'))
  }, [draft, onUpdate])

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
        />
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={handleAddBlock}
        className="min-h-12 w-full text-xs uppercase tracking-wider"
      >
        <Icon name="add" size={16} />
        ADD BLOCK
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileBlockCard -- expandable accordion card for each block
// ---------------------------------------------------------------------------

function MobileBlockCard({
  block,
  blockIndex,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: {
  block: BlockDraft
  blockIndex: number
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
  onCopyWeek: (sourceWeekClientId: string) => void
}) {
  const [expanded, setExpanded] = useState(blockIndex === 0)
  const [isEditingName, setIsEditingName] = useState(false)

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
    onUpdate(addWeekToBlock(draft, block.clientId))
  }, [draft, block.clientId, onUpdate])

  return (
    <div className="bg-surface-iron">
      {/* Card header */}
      <div className="flex min-h-12 items-center gap-2 px-3 py-2">
        {/* Block name */}
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
            className="min-w-0 flex-1 border-0 border-b border-warm-ash/30 bg-transparent py-1 font-display text-sm font-medium uppercase tracking-wider text-bone-white focus:border-ember focus:outline-none"
            aria-label="Block name"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="min-w-0 flex-1 text-left font-display text-sm font-medium uppercase tracking-wider text-bone-white hover:text-ember"
          >
            {block.name || 'UNTITLED BLOCK'}
          </button>
        )}

        {/* Block type badge */}
        <span className="bg-surface-steel px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-bone-white">
          {block.blockType}
        </span>

        {/* Duration label */}
        <span className="text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
          {block.durationWeeks} {block.durationWeeks === 1 ? 'WK' : 'WKS'}
        </span>

        {/* Move up */}
        <button
          type="button"
          onClick={handleMoveUp}
          disabled={isFirst}
          className="min-h-12 min-w-10 p-1 text-warm-ash/60 hover:text-bone-white disabled:opacity-30"
          aria-label="Move block up"
        >
          <Icon name="arrow_upward" size={18} />
        </button>

        {/* Move down */}
        <button
          type="button"
          onClick={handleMoveDown}
          disabled={isLast}
          className="min-h-12 min-w-10 p-1 text-warm-ash/60 hover:text-bone-white disabled:opacity-30"
          aria-label="Move block down"
        >
          <Icon name="arrow_downward" size={18} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="min-h-12 min-w-10 p-1 text-warm-ash/60 hover:text-warning-flare"
          aria-label="Delete block"
        >
          <Icon name="delete" size={18} />
        </button>

        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="min-h-12 min-w-10 p-1 text-warm-ash/40"
          aria-label={expanded ? 'Collapse block' : 'Expand block'}
        >
          <Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="flex flex-col gap-4 px-3 pb-4">
          {/* Block type selector */}
          <div className="flex flex-wrap gap-1">
            {BLOCK_TYPES.map((bt) => (
              <button
                key={bt.value}
                type="button"
                onClick={() => handleBlockTypeChange(bt.value)}
                className={`min-h-10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  block.blockType === bt.value
                    ? 'bg-forge text-on-forge'
                    : 'bg-surface-steel text-bone-white hover:bg-surface-slag'
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>

          {/* Weeks */}
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
            />
          ))}

          {/* Add week button */}
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddWeek}
            className="min-h-10 text-xs uppercase tracking-wider"
          >
            <Icon name="add" size={16} />
            ADD WEEK
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileWeekSection -- vertical list of day slots for a week
// ---------------------------------------------------------------------------

function MobileWeekSection({
  weekIndex,
  weekClientId,
  sessions,
  draft,
  blockClientId,
  onUpdate,
  onPickSession,
  onCopyWeek,
}: {
  weekIndex: number
  weekClientId: string
  sessions: ProgramDraft['blocks'][0]['weeks'][0]['sessions']
  draft: ProgramDraft
  blockClientId: string
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
  onCopyWeek: (sourceWeekClientId: string) => void
}) {
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

  return (
    <div className="flex flex-col gap-1">
      {/* Week header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-widest text-warm-ash/60">
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
          onClick={handleRemoveWeek}
          className="min-h-10 p-1 text-warm-ash/40 hover:text-warning-flare"
          aria-label={`Remove week ${weekIndex + 1}`}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>

      {/* Day rows -- vertical list */}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// MobileDayRow -- single day slot as a tappable row
// ---------------------------------------------------------------------------

function MobileDayRow({
  dayOfWeek,
  session,
  weekClientId,
  draft,
  onUpdate,
  onPickSession,
}: {
  dayOfWeek: number
  session: ProgramDraft['blocks'][0]['weeks'][0]['sessions'][0] | undefined
  weekClientId: string
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: number) => void
}) {
  const handleTap = useCallback(() => {
    onPickSession(weekClientId, dayOfWeek)
  }, [weekClientId, dayOfWeek, onPickSession])

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (session) {
        onUpdate(removeSession(draft, weekClientId, session.clientId))
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
        aria-label={`Assign session to ${DAY_LABELS[dayOfWeek]}`}
      >
        <span className="w-8 text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
          {DAY_LABELS[dayOfWeek]}
        </span>
        <span className="flex-1 text-xs text-warm-ash/40">TAP TO ASSIGN</span>
        <Icon name="add" size={16} className="text-warm-ash/30" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="flex min-h-12 items-center gap-3 bg-surface-charcoal px-3 py-2 text-left transition-colors hover:bg-surface-steel"
      aria-label={`Session: ${session.templateName ?? 'Unnamed'} on ${DAY_LABELS[dayOfWeek]}`}
    >
      <span className="w-8 text-[10px] font-medium uppercase tracking-wider text-warm-ash/60">
        {DAY_LABELS[dayOfWeek]}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-bone-white">
        {session.templateName ?? 'Unnamed'}
      </span>
      <span className="bg-surface-steel px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-warm-ash">
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
