import { useState, useCallback, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/icon'
import type { SetType } from '@/domain/types'

const SET_TYPES: SetType[] = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']

interface SetRowProps {
  setNumber: number
  initialWeight?: string
  initialReps?: string
  onConfirm: (weight: string, reps: string, setType: SetType) => void
  confirmed: boolean
  isConfirming?: boolean
}

export function SetRow({
  setNumber,
  initialWeight = '',
  initialReps = '',
  onConfirm,
  confirmed,
  isConfirming = false,
}: SetRowProps) {
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
    onConfirm(weight, reps, setType)
  }, [confirmed, isConfirming, weight, reps, setType, onConfirm])

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      {/* Set number + type */}
      <div className="relative flex w-12 shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={() => !confirmed && setShowTypeSelector(!showTypeSelector)}
          disabled={confirmed}
          className="text-center font-display text-sm tabular-nums text-on-surface-variant"
          aria-label={`Set ${setNumber}, type ${setType}`}
        >
          {setNumber}
        </button>
        {!confirmed && (
          <span className="text-center text-[10px] uppercase tracking-wider text-warm-ash/60">
            {setType === 'WORKING' ? '' : setType}
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

      {/* Weight input */}
      <div className="flex-1">
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
      </div>

      {/* Reps input */}
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

      {/* Confirm / Status */}
      <div className="flex w-14 shrink-0 items-center justify-center">
        {confirmed ? (
          <Badge variant="complete">DONE</Badge>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming || confirmed || (!weight.trim() && !reps.trim())}
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
