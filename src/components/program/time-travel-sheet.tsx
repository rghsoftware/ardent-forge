import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icon'
import { useAuth } from '@/lib/auth'
import { getAdapter } from '@/lib/adapter'
import { computePositionFromDate, validateProgramPosition } from '@/lib/program-position'
import { useWeekStatuses } from '@/hooks/use-week-statuses'
import type { ProgramActivation, Block, BlockWeek } from '@/domain/types'
import type { ProgramFull } from '@/lib/data-adapter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeTravelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activation: ProgramActivation
  programFull: ProgramFull
}

type SkipLabel = 'done' | 'skipped' | 'unmarked'

interface IntermediateWeek {
  blockOrdinal: number
  blockName: string
  weekNumber: number
  label: SkipLabel
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format today as YYYY-MM-DD in local time */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Get the max week number for a block from blockWeeks */
function maxWeekForBlock(blockId: string, blockWeeks: BlockWeek[]): number {
  return blockWeeks
    .filter((w) => w.blockId === blockId)
    .reduce((max, w) => Math.max(max, w.weekNumber), 0)
}

/**
 * Linearize a position into a global week index for comparison.
 * Returns -1 if the position cannot be resolved.
 */
function linearize(
  blockOrdinal: number,
  weekNumber: number,
  blocks: Block[],
  blockWeeks: BlockWeek[],
): number {
  const sorted = [...blocks].sort((a, b) => a.ordinal - b.ordinal)
  let accumulated = 0
  for (const block of sorted) {
    const maxWeek = maxWeekForBlock(block.id, blockWeeks)
    if (block.ordinal === blockOrdinal) {
      return accumulated + weekNumber
    }
    accumulated += maxWeek
  }
  return -1
}

/**
 * Build the list of intermediate weeks between current and target (exclusive of both).
 */
function buildIntermediateWeeks(
  currentOrdinal: number,
  currentWeek: number,
  targetOrdinal: number,
  targetWeek: number,
  blocks: Block[],
  blockWeeks: BlockWeek[],
): IntermediateWeek[] {
  const sorted = [...blocks].sort((a, b) => a.ordinal - b.ordinal)
  const currentLinear = linearize(currentOrdinal, currentWeek, blocks, blockWeeks)
  const targetLinear = linearize(targetOrdinal, targetWeek, blocks, blockWeeks)

  if (currentLinear < 0 || targetLinear < 0 || targetLinear <= currentLinear) return []

  const weeks: IntermediateWeek[] = []
  let accumulated = 0

  for (const block of sorted) {
    const maxWeek = maxWeekForBlock(block.id, blockWeeks)
    for (let w = 1; w <= maxWeek; w++) {
      const globalIdx = accumulated + w
      // Include weeks strictly between current and target
      if (globalIdx > currentLinear && globalIdx < targetLinear) {
        weeks.push({
          blockOrdinal: block.ordinal,
          blockName: block.name,
          weekNumber: w,
          label: 'unmarked',
        })
      }
    }
    accumulated += maxWeek
  }

  return weeks
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeTravelSheet({
  open,
  onOpenChange,
  activation,
  programFull,
}: TimeTravelSheetProps) {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const {
    upsertStatusesAsync,
    isUpserting,
    isError: weekStatusError,
  } = useWeekStatuses(activation.id)

  const { blocks, blockWeeks } = programFull
  const sortedBlocks = useMemo(() => [...blocks].sort((a, b) => a.ordinal - b.ordinal), [blocks])

  // -------------------------------------------------------------------------
  // Section 1: Start Date state
  // -------------------------------------------------------------------------

  const [startDate, setStartDate] = useState(activation.startDate)
  const [startDateSaving, setStartDateSaving] = useState(false)
  const [startDateError, setStartDateError] = useState<string | null>(null)

  const today = todayISO()

  const startDatePreview = useMemo(() => {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null
    return computePositionFromDate(startDate, today, blocks, blockWeeks)
  }, [startDate, today, blocks, blockWeeks])

  const startDateChanged = startDate !== activation.startDate
  const startDateInFuture = startDate > today

  const handleStartDateSave = useCallback(async () => {
    if (!userId) {
      console.error('[time-travel] Cannot save start date: no authenticated user')
      setStartDateError('You must be signed in to update the start date.')
      return
    }
    if (!startDatePreview) {
      console.error('[time-travel] Cannot save start date: invalid date or position')
      setStartDateError('Invalid date. Please enter a valid date.')
      return
    }
    if (startDateInFuture) {
      console.error('[time-travel] Cannot save start date: date is in the future')
      setStartDateError('Start date cannot be in the future.')
      return
    }

    setStartDateError(null)
    setStartDateSaving(true)
    try {
      await getAdapter().updateActiveProgram(userId, {
        startDate,
        currentBlockOrdinal: startDatePreview.blockOrdinal,
        currentWeekNumber: startDatePreview.weekNumber,
      })
      queryClient.invalidateQueries({ queryKey: ['active-program', userId] })
      onOpenChange(false)
    } catch (err) {
      console.error('[time-travel] Failed to update start date:', err)
      setStartDateError('Failed to save. Please try again.')
    } finally {
      setStartDateSaving(false)
    }
  }, [userId, startDate, startDatePreview, startDateInFuture, queryClient, onOpenChange])

  // -------------------------------------------------------------------------
  // Section 2: Position Jump state
  // -------------------------------------------------------------------------

  const [selectedBlockOrdinal, setSelectedBlockOrdinal] = useState(activation.currentBlockOrdinal)
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(activation.currentWeekNumber)
  const [skipLabels, setSkipLabels] = useState<IntermediateWeek[]>([])
  const [jumpSaving, setJumpSaving] = useState(false)
  const [jumpError, setJumpError] = useState<string | null>(null)

  const selectedBlock = useMemo(
    () => sortedBlocks.find((b) => b.ordinal === selectedBlockOrdinal),
    [sortedBlocks, selectedBlockOrdinal],
  )

  const weeksForSelectedBlock = useMemo(() => {
    if (!selectedBlock) return []
    return blockWeeks
      .filter((w) => w.blockId === selectedBlock.id)
      .sort((a, b) => a.weekNumber - b.weekNumber)
  }, [selectedBlock, blockWeeks])

  const positionChanged =
    selectedBlockOrdinal !== activation.currentBlockOrdinal ||
    selectedWeekNumber !== activation.currentWeekNumber

  const isForwardJump = useMemo(() => {
    if (!positionChanged) return false
    const currentLinear = linearize(
      activation.currentBlockOrdinal,
      activation.currentWeekNumber,
      blocks,
      blockWeeks,
    )
    const targetLinear = linearize(selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks)
    return targetLinear > currentLinear
  }, [
    positionChanged,
    activation.currentBlockOrdinal,
    activation.currentWeekNumber,
    selectedBlockOrdinal,
    selectedWeekNumber,
    blocks,
    blockWeeks,
  ])

  const isValidPosition = useMemo(
    () => validateProgramPosition(selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks),
    [selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks],
  )

  // Recompute intermediate weeks when selection changes (forward jump)
  const intermediateWeeks = useMemo(() => {
    if (!isForwardJump) return []
    return buildIntermediateWeeks(
      activation.currentBlockOrdinal,
      activation.currentWeekNumber,
      selectedBlockOrdinal,
      selectedWeekNumber,
      blocks,
      blockWeeks,
    )
  }, [
    isForwardJump,
    activation.currentBlockOrdinal,
    activation.currentWeekNumber,
    selectedBlockOrdinal,
    selectedWeekNumber,
    blocks,
    blockWeeks,
  ])

  // Sync skipLabels when intermediateWeeks changes
  useEffect(() => {
    setSkipLabels(intermediateWeeks)
  }, [intermediateWeeks])

  const handleBlockChange = useCallback((value: string) => {
    const ordinal = Number(value)
    setSelectedBlockOrdinal(ordinal)
    // Reset week to 1 when block changes
    setSelectedWeekNumber(1)
    setJumpError(null)
  }, [])

  const handleWeekChange = useCallback((value: string) => {
    setSelectedWeekNumber(Number(value))
    setJumpError(null)
  }, [])

  const handleSkipLabelChange = useCallback((index: number, label: SkipLabel) => {
    setSkipLabels((prev) => prev.map((w, i) => (i === index ? { ...w, label } : w)))
  }, [])

  const handleBulkLabel = useCallback((label: SkipLabel) => {
    setSkipLabels((prev) => prev.map((w) => ({ ...w, label })))
  }, [])

  const handleJumpSave = useCallback(async () => {
    if (!userId) {
      console.error('[time-travel] Cannot jump position: no authenticated user')
      setJumpError('You must be signed in to jump position.')
      return
    }
    if (!isValidPosition) {
      console.error('[time-travel] Cannot jump: invalid position')
      setJumpError('Selected position is not valid for this program.')
      return
    }

    setJumpError(null)
    setJumpSaving(true)
    try {
      // Update position
      await getAdapter().updateActiveProgram(userId, {
        currentBlockOrdinal: selectedBlockOrdinal,
        currentWeekNumber: selectedWeekNumber,
      })

      // Upsert labeled weeks (skip "unmarked" -- only persist done/skipped)
      const labeled = skipLabels.filter((w) => w.label !== 'unmarked')
      if (labeled.length > 0) {
        await upsertStatusesAsync(
          labeled.map((w) => ({
            blockOrdinal: w.blockOrdinal,
            weekNumber: w.weekNumber,
            status: w.label as 'done' | 'skipped',
          })),
        )
      }

      queryClient.invalidateQueries({ queryKey: ['active-program', userId] })
      queryClient.invalidateQueries({ queryKey: ['week-statuses', activation.id] })
      onOpenChange(false)
    } catch (err) {
      console.error('[time-travel] Failed to jump position:', err)
      setJumpError('Failed to save position. Please try again.')
    } finally {
      setJumpSaving(false)
    }
  }, [
    userId,
    isValidPosition,
    selectedBlockOrdinal,
    selectedWeekNumber,
    skipLabels,
    upsertStatusesAsync,
    queryClient,
    activation.id,
    onOpenChange,
  ])

  // Find block name for display
  const blockNameFor = useCallback(
    (ordinal: number) =>
      sortedBlocks.find((b) => b.ordinal === ordinal)?.name ?? `Block ${ordinal}`,
    [sortedBlocks],
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-0 bg-surface-anvil p-0" showCloseButton={false}>
        <div className="mx-auto flex max-h-[85dvh] w-full max-w-5xl flex-col overflow-y-auto">
          {/* Header */}
          <SheetHeader className="flex-row items-center justify-between gap-2 px-4 pt-6 pb-3">
            <SheetTitle className="font-display text-xl font-medium text-bone-white">
              Time Travel
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Close time travel"
            >
              <Icon name="close" size={18} />
            </Button>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 pb-8">
            {/* ============================================================= */}
            {/* Section 1: Start Date Edit                                     */}
            {/* ============================================================= */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                Start date
              </h3>

              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={startDate}
                  max={todayISO()}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setStartDateError(null)
                  }}
                  className="min-h-[48px] flex-1 bg-surface-iron px-3 py-2 text-sm text-bone-white focus:outline-none focus:ring-1 focus:ring-forge [color-scheme:dark]"
                  aria-label="Program start date"
                />
              </div>

              {startDateInFuture && (
                <p className="text-xs text-alarm-red">Start date cannot be in the future.</p>
              )}

              {startDateChanged && startDatePreview && !startDateInFuture && (
                <div className="bg-surface-iron px-3 py-2">
                  <p className="text-xs text-warm-ash">
                    This will move you to{' '}
                    <span className="font-medium text-bone-white">
                      {blockNameFor(startDatePreview.blockOrdinal)}, Week{' '}
                      {startDatePreview.weekNumber}
                    </span>
                  </p>
                </div>
              )}

              {startDateError && <p className="text-xs text-alarm-red">{startDateError}</p>}

              <Button
                onClick={handleStartDateSave}
                disabled={
                  !startDateChanged || startDateInFuture || !startDatePreview || startDateSaving
                }
                className="min-h-[48px] self-start"
              >
                {startDateSaving ? 'Saving...' : 'Update start date'}
              </Button>
            </section>

            {/* Divider */}
            <div className="h-px bg-surface-steel" />

            {/* ============================================================= */}
            {/* Section 2: Position Jump                                       */}
            {/* ============================================================= */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                Jump to position
              </h3>

              {/* Block + Week selectors */}
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-xs text-warm-ash">Block</label>
                  <Select value={String(selectedBlockOrdinal)} onValueChange={handleBlockChange}>
                    <SelectTrigger className="min-h-[48px] bg-surface-iron text-bone-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedBlocks.map((block) => (
                        <SelectItem key={block.id} value={String(block.ordinal)}>
                          {block.ordinal}. {block.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-28 flex-col gap-1.5">
                  <label className="text-xs text-warm-ash">Week</label>
                  <Select value={String(selectedWeekNumber)} onValueChange={handleWeekChange}>
                    <SelectTrigger className="min-h-[48px] bg-surface-iron text-bone-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weeksForSelectedBlock.map((bw) => (
                        <SelectItem key={bw.id} value={String(bw.weekNumber)}>
                          Week {bw.weekNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Change summary */}
              {positionChanged && isValidPosition && (
                <div className="bg-surface-iron px-3 py-2">
                  <p className="text-xs text-warm-ash">
                    <span className="text-warm-ash/60">Current:</span>{' '}
                    <span className="font-medium text-bone-white">
                      {blockNameFor(activation.currentBlockOrdinal)}, Week{' '}
                      {activation.currentWeekNumber}
                    </span>
                    <span className="mx-2 text-warm-ash/40">&rarr;</span>
                    <span className="text-warm-ash/60">New:</span>{' '}
                    <span className="font-medium text-ember">
                      {blockNameFor(selectedBlockOrdinal)}, Week {selectedWeekNumber}
                    </span>
                  </p>
                </div>
              )}

              {positionChanged && !isValidPosition && (
                <p className="text-xs text-alarm-red">
                  This position does not exist in the program.
                </p>
              )}

              {/* Skip label UI (forward jumps only) */}
              {isForwardJump && skipLabels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-warm-ash/60">
                      Skipped weeks
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleBulkLabel('done')}
                        className="min-h-12 bg-surface-steel px-2.5 py-1 text-[11px] font-medium text-warm-ash hover:text-bone-white"
                      >
                        All done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkLabel('skipped')}
                        className="min-h-12 bg-surface-steel px-2.5 py-1 text-[11px] font-medium text-warm-ash hover:text-bone-white"
                      >
                        All skipped
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkLabel('unmarked')}
                        className="min-h-12 bg-surface-steel px-2.5 py-1 text-[11px] font-medium text-warm-ash hover:text-bone-white"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    {skipLabels.map((week, idx) => (
                      <div
                        key={`${week.blockOrdinal}-${week.weekNumber}`}
                        className="flex items-center justify-between bg-surface-iron px-3 py-2"
                      >
                        <span className="text-xs text-warm-ash">
                          {week.blockName}, Week {week.weekNumber}
                        </span>

                        {/* 3-option toggle */}
                        <div className="flex gap-0.5">
                          <ToggleOption
                            active={week.label === 'done'}
                            onClick={() => handleSkipLabelChange(idx, 'done')}
                            label="Done"
                            activeClass="bg-quenched/20 text-quenched"
                          />
                          <ToggleOption
                            active={week.label === 'skipped'}
                            onClick={() => handleSkipLabelChange(idx, 'skipped')}
                            label="Skipped"
                            activeClass="bg-warm-ash/20 text-warm-ash"
                          />
                          <ToggleOption
                            active={week.label === 'unmarked'}
                            onClick={() => handleSkipLabelChange(idx, 'unmarked')}
                            label="Unmarked"
                            activeClass="bg-surface-steel text-bone-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {jumpError && <p className="text-xs text-alarm-red">{jumpError}</p>}
              {weekStatusError && (
                <p className="text-xs text-alarm-red">Failed to load week statuses.</p>
              )}

              <Button
                onClick={handleJumpSave}
                disabled={!positionChanged || !isValidPosition || jumpSaving || isUpserting}
                className="min-h-[48px] self-start"
              >
                {jumpSaving || isUpserting ? 'Saving...' : 'Jump to position'}
              </Button>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// ToggleOption -- small inline toggle button for skip labels
// ---------------------------------------------------------------------------

function ToggleOption({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  label: string
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 min-w-[64px] px-2 py-1 text-[11px] font-medium ${
        active ? activeClass : 'bg-surface-charcoal text-warm-ash/40 hover:text-warm-ash'
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}
