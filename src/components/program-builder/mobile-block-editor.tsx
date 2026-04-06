import { useState, useCallback, useEffect, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { EmptyState } from '@/components/shared/empty-state'
import { toast } from 'sonner'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'
import {
  addBlock,
  removeBlock,
  reorderBlocks,
  addWeekToBlock,
  removeWeekFromBlock,
  removeSession,
  weeksMatch,
} from './builder-state'
import type { ProgramDraft, BlockDraft, SessionDraft, ValidationError } from './builder-state'
import { BlockTypeSelector } from './block-type-selector'
import type { BlockType } from '@/domain/types'
import {
  BLOCK_TYPE_STYLES,
  DAY_ABBREVIATIONS,
  DAY_ORDER,
  WEEKDAY_ORDER,
  SESSION_TINT,
  SESSION_TYPE_BADGE,
} from './constants'
import type { DayOfWeek } from './constants'

// ---------------------------------------------------------------------------
// MobileBlockEditor
// ---------------------------------------------------------------------------

interface MobileBlockEditorProps {
  draft: ProgramDraft
  onUpdate: (draft: ProgramDraft) => void
  onPickSession: (weekClientId: string, dayOfWeek: DayOfWeek) => void
  onCopyWeek: (sourceWeekClientId: string) => void
  showWeekends: boolean
  onToggleWeekends: () => void
  fieldErrors?: ValidationError[]
}

export function MobileBlockEditor({
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
  showWeekends,
  onToggleWeekends,
  fieldErrors = [],
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
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onToggleWeekends}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
            showWeekends
              ? 'bg-forge/15 text-forge'
              : 'bg-surface-steel text-warm-ash hover:text-bone-white'
          }`}
          aria-label={showWeekends ? 'Hide weekends' : 'Show weekends'}
        >
          <Icon name={showWeekends ? 'date_range' : 'calendar_view_week'} size={14} />
          {showWeekends ? '7 days' : '5 days'}
        </button>
      </div>

      {draft.blocks.map((block, blockIndex) => (
        <MobileBlockCard
          key={block.clientId}
          block={block}
          blockIndex={blockIndex}
          draft={draft}
          onUpdate={onUpdate}
          onPickSession={onPickSession}
          onCopyWeek={onCopyWeek}
          showWeekends={showWeekends}
          isNew={block.clientId === newBlockId}
          errors={fieldErrors.filter((e) => e.blockClientId === block.clientId)}
        />
      ))}

      {draft.blocks.length === 0 && (
        <EmptyState
          icon="dashboard_customize"
          heading="Start by adding your first training block."
          className="py-12"
        />
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
  showWeekends: boolean
  isNew?: boolean
  errors?: ValidationError[]
}

function MobileBlockCard({
  block,
  blockIndex,
  draft,
  onUpdate,
  onPickSession,
  onCopyWeek,
  showWeekends,
  isNew,
  errors = [],
}: MobileBlockCardProps) {
  const [expanded, setExpanded] = useState(blockIndex === 0)
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
                className={`min-w-0 flex-1 border-0 border-b bg-transparent py-1 font-display text-sm font-medium text-bone-white focus:outline-none ${
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
                onClick={() => setIsEditingName(true)}
                className={`min-w-0 flex-1 text-left font-display text-sm font-medium ${
                  nameError ? 'text-warning-flare' : 'text-bone-white hover:text-ember'
                }`}
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
                      <span className="text-[10px] text-warm-ash/40">
                        same as Week {refWeekNum}
                      </span>
                      <div className="flex items-center gap-1">
                        {sessionTypes.map((st) => (
                          <span
                            key={st}
                            className={`px-1 py-px text-[9px] font-medium uppercase tracking-wider ${SESSION_TYPE_BADGE[st] ?? 'bg-surface-steel text-warm-ash'}`}
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
                        className="min-h-10 p-1 text-warm-ash/40 active:text-bone-white"
                        aria-label={`Expand week ${weekIndex + 1}`}
                      >
                        <Icon name="expand_more" size={14} />
                      </button>
                    </div>
                  )
                }

                return (
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
  showWeekends: boolean
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
  showWeekends,
  isNew,
}: MobileWeekSectionProps) {
  const [showWeekDeleteConfirm, setShowWeekDeleteConfirm] = useState(false)

  // Build session lookup by dayOfWeek
  const sessionsByDay = new Map(
    sessions.filter((s) => s.dayOfWeek !== null).map((s) => [s.dayOfWeek!, s]),
  )

  const weekendSessionCount = useMemo(() => {
    if (showWeekends) return 0
    return sessions.filter((s) => s.dayOfWeek === 0 || s.dayOfWeek === 6).length
  }, [showWeekends, sessions])

  const isLastWeek = useMemo(() => {
    const block = draft.blocks.find((b) => b.clientId === blockClientId)
    return !block || block.weeks.length <= 1
  }, [draft.blocks, blockClientId])

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
          disabled={isLastWeek}
          className={`min-h-10 p-1 ${
            isLastWeek
              ? 'cursor-not-allowed text-warm-ash/20'
              : 'text-warm-ash/40 hover:text-warning-flare'
          }`}
          aria-label={`Remove week ${weekIndex + 1}`}
          title={isLastWeek ? 'A block must have at least one week' : undefined}
        >
          <Icon name="delete" size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {(showWeekends ? DAY_ORDER : WEEKDAY_ORDER).map((dayOfWeek) => {
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

      {!showWeekends && weekendSessionCount > 0 && (
        <p className="px-1 text-[10px] text-warm-ash/50">
          +{weekendSessionCount} weekend {weekendSessionCount === 1 ? 'session' : 'sessions'}
        </p>
      )}

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
    if (!session) {
      onPickSession(weekClientId, dayOfWeek)
    }
  }, [weekClientId, dayOfWeek, session, onPickSession])

  const handleRemove = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
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
        className="flex min-h-12 items-center gap-3 bg-surface-gunmetal/40 px-3 py-2 text-left transition-colors active:bg-surface-steel"
        aria-label={`Assign session to ${DAY_ABBREVIATIONS[dayOfWeek]}`}
      >
        <span className="w-8 text-[11px] font-medium uppercase tracking-wider text-warm-ash/40">
          {DAY_ABBREVIATIONS[dayOfWeek]}
        </span>
        <span className="flex-1 text-[10px] font-medium uppercase tracking-wider text-warm-ash/20">
          Rest
        </span>
        <Icon name="add" size={14} className="text-warm-ash/20" />
      </button>
    )
  }

  const isEvent = session.sessionType === 'EVENT'

  return (
    <div
      className={`flex min-h-12 items-center gap-3 px-3 py-2 ${
        isEvent ? 'border-l-2 border-ember bg-surface-iron' : 'bg-surface-charcoal'
      } ${SESSION_TINT[session.sessionType] ?? ''}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
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
      </div>
      <button
        type="button"
        onClick={handleRemove}
        className="flex min-h-10 min-w-10 items-center justify-center text-warm-ash/40 hover:text-warning-flare"
        aria-label="Remove session"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}
