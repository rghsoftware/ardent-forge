import { useState, useCallback, useEffect, useRef } from 'react'
import { Icon } from '@/components/icon'
import { computeVariance } from '@/lib/set-variance'
import type { SetType } from '@/domain/types'
import { cn } from '@/lib/utils'

const SET_TYPES: SetType[] = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']

interface SetRowProps {
  setNumber: number
  initialWeight?: string
  initialReps?: string
  onConfirm: (weight: string, reps: string, setType: SetType) => void
  confirmed: boolean
  isConfirming?: boolean
  prescribedWeight?: { value: number; unit: string }
  prescribedReps?: number
  isBodyweight?: boolean
  /**
   * When true, the row represents an unconfirmed placeholder (the auto-populated
   * next-set row). Renders dimmed to distinguish it from confirmed sets and shows
   * a PENDING label in the status column until the user edits a field.
   */
  isPending?: boolean
  /**
   * Fired when the user modifies a weight or reps input on a pending row.
   * Used by the parent to track whether the pending row has been dirtied.
   */
  onPendingDirty?: () => void
  /**
   * When provided, the row supports swipe-to-delete. Tapping the revealed DEL
   * button calls this handler.
   */
  onDelete?: () => void
  /**
   * When provided, tapping the done indicator on a confirmed set calls this
   * handler, allowing the user to un-confirm (remove) the set.
   */
  onUnconfirm?: () => void
}

const SWIPE_THRESHOLD = 64 // px -- full reveal width

export function SetRow({
  setNumber,
  initialWeight = '',
  initialReps = '',
  onConfirm,
  confirmed,
  isConfirming = false,
  prescribedWeight,
  prescribedReps,
  isBodyweight = false,
  isPending = false,
  onPendingDirty,
  onDelete,
  onUnconfirm,
}: SetRowProps) {
  const hasPrescription = prescribedWeight != null || prescribedReps != null

  const [weight, setWeight] = useState(initialWeight)
  const [reps, setReps] = useState(initialReps)
  const [setType, setSetType] = useState<SetType>('WORKING')
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  // Tracks whether the user has edited any input on a pending row.
  const [isDirty, setIsDirty] = useState(false)

  // Swipe-to-delete state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef(0)

  // Sync local state when parent pre-fills new values (e.g. carry-forward from last set)
  useEffect(() => {
    setWeight(initialWeight)
  }, [initialWeight])
  useEffect(() => {
    setReps(initialReps)
  }, [initialReps])

  // Marks the pending row dirty on first user edit and notifies the parent.
  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true)
      onPendingDirty?.()
    }
  }, [isDirty, onPendingDirty])

  const handleConfirm = useCallback(() => {
    if (confirmed || isConfirming) return
    onConfirm(isBodyweight ? '' : weight, reps, setType)
  }, [confirmed, isConfirming, weight, reps, setType, onConfirm, isBodyweight])

  // Prescribed label text (e.g. "120 lb x 5")
  const prescribedLabel = hasPrescription
    ? isBodyweight
      ? prescribedReps != null
        ? `BW x ${prescribedReps}`
        : 'BW'
      : [
          prescribedWeight ? `${prescribedWeight.value} ${prescribedWeight.unit}` : null,
          prescribedReps != null ? String(prescribedReps) : null,
        ]
          .filter(Boolean)
          .join(' x ')
    : null

  // Variance calculation for confirmed sets
  const prescribedWeightStr = prescribedWeight
    ? `${prescribedWeight.value} ${prescribedWeight.unit}`
    : undefined
  const prescribedRepsStr = prescribedReps != null ? String(prescribedReps) : undefined
  const variance = confirmed
    ? computeVariance(prescribedWeightStr, prescribedRepsStr, weight, reps)
    : null

  return (
    <div className="relative overflow-hidden">
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            onDelete()
            setSwipeX(0)
            setIsSwiping(false)
          }}
          style={{
            transform: `translateX(${SWIPE_THRESHOLD - swipeX}px)`,
            transition: isSwiping ? 'none' : 'transform 200ms',
          }}
          className="absolute right-0 top-0 h-full w-16 bg-red-700 text-xs font-bold uppercase tracking-widest text-bone-white"
          aria-label="Delete set"
        >
          DEL
        </button>
      )}
      <div
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 200ms',
        }}
        className={cn('flex items-center gap-2 px-4 py-1', isPending && 'opacity-40')}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX
          setIsSwiping(false)
        }}
        onTouchMove={(e) => {
          const delta = touchStartX.current - e.touches[0].clientX
          if (delta > 0) {
            setSwipeX(Math.min(delta, SWIPE_THRESHOLD))
            setIsSwiping(true)
          } else if (swipeX > 0) {
            setSwipeX(Math.max(0, swipeX + delta))
            setIsSwiping(true)
          }
        }}
        onTouchEnd={() => {
          if (swipeX >= SWIPE_THRESHOLD) {
            // latched open -- DEL button is visible
          } else {
            setSwipeX(0)
            setIsSwiping(false)
          }
        }}
      >
        {/* Set number + type */}
        <div className="relative flex w-12 shrink-0 flex-col items-center">
          <button
            type="button"
            onClick={() => !confirmed && setShowTypeSelector(!showTypeSelector)}
            disabled={confirmed}
            className={`text-center font-display text-sm tabular-nums text-on-surface-variant border-b transition-colors ${
              confirmed
                ? 'border-transparent'
                : showTypeSelector
                  ? 'border-ember'
                  : 'border-warm-ash/25'
            }`}
            aria-label={`Set ${setNumber}, type ${setType}`}
          >
            {setNumber}
          </button>
          {!confirmed && (
            <span
              className={`text-center text-[11px] uppercase tracking-wider transition-colors ${
                setType === 'WORKING' ? 'text-warm-ash/25' : 'text-warm-ash/60'
              }`}
            >
              {setType === 'WORKING' ? 'W' : setType}
            </span>
          )}

          {/* Set type selector dropdown */}
          {showTypeSelector && !confirmed && (
            <div className="absolute top-full left-0 z-40 mt-1 flex flex-col bg-surface-gunmetal shadow-lg">
              {SET_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSetType(type)
                    setShowTypeSelector(false)
                  }}
                  className={`min-h-10 px-3 py-1.5 text-left text-xs uppercase tracking-wider transition-colors ${
                    type === setType
                      ? 'bg-surface-steel text-ember'
                      : 'text-bone-white hover:bg-surface-steel/50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasPrescription ? (
          <>
            {/* Prescribed column */}
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-wider text-warm-ash/40">
                {prescribedLabel}
              </span>
            </div>

            {/* Actual column -- weight x reps inline */}
            <div className="flex flex-1 items-center gap-1">
              {isBodyweight ? (
                <span className="w-1/2 text-center text-[11px] uppercase tracking-widest text-warm-ash/60">
                  BW
                </span>
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value)
                    if (isPending) markDirty()
                  }}
                  disabled={confirmed}
                  placeholder="--"
                  className="w-1/2 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
                  aria-label={`Actual weight for set ${setNumber}`}
                />
              )}
              <span className="text-[11px] text-warm-ash/40">x</span>
              <input
                type="text"
                inputMode="numeric"
                value={reps}
                onChange={(e) => {
                  setReps(e.target.value)
                  if (isPending) markDirty()
                }}
                disabled={confirmed}
                placeholder="--"
                className="w-1/2 border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
                aria-label={`Actual reps for set ${setNumber}`}
              />
            </div>
          </>
        ) : (
          <>
            {/* Weight input -- ad-hoc path (hidden for bodyweight) */}
            <div className="flex flex-1 items-center justify-center">
              {isBodyweight ? (
                <span className="text-[11px] uppercase tracking-widest text-warm-ash/60">BW</span>
              ) : (
                <input
                  type="text"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => {
                    setWeight(e.target.value)
                    if (isPending) markDirty()
                  }}
                  disabled={confirmed}
                  placeholder="--"
                  className="w-full border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
                  aria-label={`Weight for set ${setNumber}`}
                />
              )}
            </div>

            {/* Reps input -- ad-hoc path */}
            <div className="flex-1">
              <input
                type="text"
                inputMode="numeric"
                value={reps}
                onChange={(e) => {
                  setReps(e.target.value)
                  if (isPending) markDirty()
                }}
                disabled={confirmed}
                placeholder="--"
                className="w-full border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
                aria-label={`Reps for set ${setNumber}`}
              />
            </div>
          </>
        )}

        {/* Confirm / Status */}
        <div className="flex w-14 shrink-0 items-center justify-center">
          {confirmed ? (
            <button
              type="button"
              onClick={onUnconfirm}
              className={`flex min-h-12 min-w-12 items-center justify-center transition-colors ${
                variance === 'met'
                  ? 'text-green-500 hover:text-green-400'
                  : variance === 'under'
                    ? 'text-amber-500 hover:text-amber-400'
                    : 'text-bone-white/70 hover:text-bone-white'
              }`}
              aria-label={`Undo set ${setNumber}`}
            >
              <Icon name="check_box" size={24} fill />
            </button>
          ) : isPending && !isDirty ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-warm-ash/40">
              PENDING
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || confirmed || !reps.trim()}
              className="flex min-h-12 min-w-12 items-center justify-center text-ember transition-colors hover:text-forge disabled:opacity-40"
              aria-label={`Confirm set ${setNumber}`}
            >
              {isConfirming ? (
                <span className="text-xs uppercase tracking-wider text-warm-ash">...</span>
              ) : (
                <Icon name="check_box_outline_blank" size={24} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
