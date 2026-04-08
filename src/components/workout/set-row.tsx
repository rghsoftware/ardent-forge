import { useState, useCallback, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/icon'
import { computeVariance } from '@/lib/set-variance'
import type { SetType, NoteContent } from '@/domain/types'
import { NoteAffordance } from '@/components/workout/notes/note-affordance'
import { useActiveWorkoutStore } from '@/stores/active-workout-store'

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
   * Logged-set id. When provided, a note affordance is rendered and
   * tap-to-edit wires directly to the active workout store's setSetNote
   * action. Omitted for unsaved scaffolds.
   */
  loggedSetId?: string
}

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
  loggedSetId,
}: SetRowProps) {
  const setSetNote = useActiveWorkoutStore((s) => s.setSetNote)
  const storedSet = useActiveWorkoutStore((s) => {
    if (!loggedSetId) return undefined
    for (const g of s.loggedGroups) {
      for (const a of g.activities) {
        const match = a.sets.find((x) => x.id === loggedSetId)
        if (match) return match
      }
    }
    return undefined
  })
  const noteValue = useMemo<NoteContent>(
    () => ({ text: storedSet?.notes ?? '', tags: storedSet?.noteTags ?? [] }),
    [storedSet?.notes, storedSet?.noteTags],
  )
  const hasNote = noteValue.text.trim().length > 0 || noteValue.tags.length > 0
  const hasPrescription = prescribedWeight != null || prescribedReps != null

  const [weight, setWeight] = useState(initialWeight)
  const [reps, setReps] = useState(initialReps)
  const [setType, setSetType] = useState<SetType>('WORKING')
  const [showTypeSelector, setShowTypeSelector] = useState(false)

  // Sync local state when parent pre-fills new values (e.g. carry-forward from last set)
  useEffect(() => {
    setWeight(initialWeight)
  }, [initialWeight])
  useEffect(() => {
    setReps(initialReps)
  }, [initialReps])

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
    <div className="flex items-center gap-2 px-4 py-1">
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
                onChange={(e) => setWeight(e.target.value)}
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
              onChange={(e) => setReps(e.target.value)}
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
                onChange={(e) => setWeight(e.target.value)}
                disabled={confirmed}
                placeholder="--"
                className="w-full border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
                aria-label={`Weight for set ${setNumber}`}
              />
            )}
          </div>

          {/* Reps input -- ad-hoc path (unchanged) */}
          <div className="flex-1">
            <input
              type="text"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              disabled={confirmed}
              placeholder="--"
              className="w-full border-b border-warm-ash/30 bg-transparent py-2 text-center font-display text-sm tabular-nums text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none disabled:opacity-60"
              aria-label={`Reps for set ${setNumber}`}
            />
          </div>
        </>
      )}

      {/* Note affordance -- one tap opens the editor (Spec assertion 1) */}
      {loggedSetId && (
        <div className="flex shrink-0 items-center">
          <NoteAffordance
            value={noteValue}
            onChange={(next) => setSetNote(loggedSetId, next)}
            level="set"
            variant="inline"
            className="px-2"
          />
          <span className="sr-only">{hasNote ? 'Note attached' : 'No note'}</span>
        </div>
      )}

      {/* Confirm / Status */}
      <div className="flex w-14 shrink-0 items-center justify-center">
        {confirmed ? (
          variance === 'met' ? (
            <Icon name="check_circle" size={22} className="text-green-500" />
          ) : variance === 'under' ? (
            <Icon name="arrow_downward" size={22} className="text-amber-500" />
          ) : (
            <Badge variant="complete">DONE</Badge>
          )
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isConfirming ||
              confirmed ||
              (isBodyweight ? !reps.trim() : !weight.trim() && !reps.trim())
            }
            className="flex min-h-12 min-w-12 items-center justify-center text-ember transition-colors hover:text-forge disabled:opacity-40"
            aria-label={`Confirm set ${setNumber}`}
          >
            {isConfirming ? (
              <span className="text-xs uppercase tracking-wider text-warm-ash">...</span>
            ) : (
              <Icon name="check" size={24} />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
