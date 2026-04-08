import { useState, useMemo, useCallback, useRef } from 'react'
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
import {
  computePositionFromDate,
  computeDateFromPosition,
  validateProgramPosition,
  linearize,
  buildIntermediateWeeks,
} from '@/lib/program-position'
import type { IntermediateWeek } from '@/lib/program-position'
import { useWeekStatuses } from '@/hooks/use-week-statuses'
import type { ProgramActivation } from '@/domain/types'
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format today as YYYY-MM-DD in local time */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  const today = todayISO()

  // -------------------------------------------------------------------------
  // Unified state: start date + position are bidirectionally synced
  // -------------------------------------------------------------------------

  const [startDate, setStartDate] = useState(activation.startDate)
  const [selectedBlockOrdinal, setSelectedBlockOrdinal] = useState(activation.currentBlockOrdinal)
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(activation.currentWeekNumber)
  const [skipLabels, setSkipLabels] = useState<IntermediateWeek[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startDateInFuture = startDate > today

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

  const isValidPosition = useMemo(
    () => validateProgramPosition(selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks),
    [selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks],
  )

  const hasChanged =
    startDate !== activation.startDate ||
    selectedBlockOrdinal !== activation.currentBlockOrdinal ||
    selectedWeekNumber !== activation.currentWeekNumber

  const isForwardJump = useMemo(() => {
    if (!hasChanged) return false
    const currentLinear = linearize(
      activation.currentBlockOrdinal,
      activation.currentWeekNumber,
      blocks,
      blockWeeks,
    )
    const targetLinear = linearize(selectedBlockOrdinal, selectedWeekNumber, blocks, blockWeeks)
    return targetLinear > currentLinear
  }, [
    hasChanged,
    activation.currentBlockOrdinal,
    activation.currentWeekNumber,
    selectedBlockOrdinal,
    selectedWeekNumber,
    blocks,
    blockWeeks,
  ])

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
  const prevIntermediateRef = useRef(intermediateWeeks)
  if (prevIntermediateRef.current !== intermediateWeeks) {
    prevIntermediateRef.current = intermediateWeeks
    setSkipLabels(intermediateWeeks)
  }

  // -------------------------------------------------------------------------
  // Bidirectional sync handlers
  // -------------------------------------------------------------------------

  const handleStartDateChange = useCallback(
    (value: string) => {
      setStartDate(value)
      setError(null)
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return
      if (value > today) return
      const pos = computePositionFromDate(value, today, blocks, blockWeeks)
      setSelectedBlockOrdinal(pos.blockOrdinal)
      setSelectedWeekNumber(pos.weekNumber)
    },
    [today, blocks, blockWeeks],
  )

  const handleBlockChange = useCallback(
    (value: string) => {
      const ordinal = Number(value)
      setSelectedBlockOrdinal(ordinal)
      setSelectedWeekNumber(1)
      setError(null)
      const computed = computeDateFromPosition(ordinal, 1, today, blocks, blockWeeks)
      if (computed) setStartDate(computed)
    },
    [today, blocks, blockWeeks],
  )

  const handleWeekChange = useCallback(
    (value: string) => {
      const week = Number(value)
      setSelectedWeekNumber(week)
      setError(null)
      const computed = computeDateFromPosition(
        selectedBlockOrdinal,
        week,
        today,
        blocks,
        blockWeeks,
      )
      if (computed) setStartDate(computed)
    },
    [today, blocks, blockWeeks, selectedBlockOrdinal],
  )

  // -------------------------------------------------------------------------
  // Skip label handlers
  // -------------------------------------------------------------------------

  const handleSkipLabelChange = useCallback((index: number, label: SkipLabel) => {
    setSkipLabels((prev) => prev.map((w, i) => (i === index ? { ...w, label } : w)))
  }, [])

  const handleBulkLabel = useCallback((label: SkipLabel) => {
    setSkipLabels((prev) => prev.map((w) => ({ ...w, label })))
  }, [])

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!userId) {
      console.error('[time-travel] Cannot save: no authenticated user')
      setError('You must be signed in.')
      return
    }
    if (startDateInFuture) {
      console.error('[time-travel] Cannot save: start date is in the future')
      setError('Start date cannot be in the future.')
      return
    }
    if (!isValidPosition) {
      console.error('[time-travel] Cannot save: invalid position')
      setError('Selected position is not valid for this program.')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await getAdapter().updateActiveProgram(userId, {
        startDate,
        currentBlockOrdinal: selectedBlockOrdinal,
        currentWeekNumber: selectedWeekNumber,
      })
    } catch (err) {
      console.error('[time-travel] Failed to update program:', err)
      setError('Failed to save. Please try again.')
      setSaving(false)
      return
    }

    try {
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
      console.error('[time-travel] Position updated but failed to save week labels:', err)
      queryClient.invalidateQueries({ queryKey: ['active-program', userId] })
      setError('Position updated, but week labels failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [
    userId,
    startDateInFuture,
    isValidPosition,
    startDate,
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

          <div className="flex flex-col gap-5 px-4 pb-8">
            {/* Start date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-warm-ash">Start date</label>
              <input
                type="date"
                value={startDate}
                max={today}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="min-h-[48px] bg-surface-iron px-3 py-2 text-sm text-bone-white focus:outline-none focus:ring-1 focus:ring-forge [color-scheme:dark]"
                aria-label="Program start date"
              />
              {startDateInFuture && (
                <p className="text-xs text-alarm-red">Start date cannot be in the future.</p>
              )}
            </div>

            {/* Position selectors */}
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
            {hasChanged && isValidPosition && !startDateInFuture && (
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

            {hasChanged && !isValidPosition && (
              <p className="text-xs text-alarm-red">This position does not exist in the program.</p>
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

            {error && <p className="text-xs text-alarm-red">{error}</p>}
            {weekStatusError && (
              <p className="text-xs text-alarm-red">Failed to load week statuses.</p>
            )}

            <Button
              onClick={handleSave}
              disabled={
                !hasChanged || !isValidPosition || startDateInFuture || saving || isUpserting
              }
              className="min-h-[48px] self-start"
            >
              {saving || isUpserting ? 'Saving...' : 'Save'}
            </Button>
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
