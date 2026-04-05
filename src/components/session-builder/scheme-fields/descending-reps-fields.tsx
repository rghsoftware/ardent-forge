import { useState, useEffect } from 'react'
import { LoadSpecEditor } from '../inputs'
import type { SetScheme } from '@/domain/types'

interface DescendingRepsFieldsProps {
  value: SetScheme & { type: 'descendingReps' }
  onChange: (s: SetScheme & { type: 'descendingReps' }) => void
  exerciseSupports1RM: boolean
}

export function DescendingRepsFields({
  value,
  onChange,
  exerciseSupports1RM,
}: DescendingRepsFieldsProps) {
  const [ladderText, setLadderText] = useState(value.repLadder.join(', '))

  // Sync local text when repLadder changes externally (e.g. scheme type reset)
  const externalLadder = value.repLadder.join(', ')
  useEffect(() => {
    setLadderText(externalLadder)
  }, [externalLadder])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          REP LADDER (DESCENDING)
        </span>
        <input
          type="text"
          value={ladderText}
          onChange={(e) => {
            setLadderText(e.target.value)
            const nums = e.target.value
              .split(/[,\s]+/)
              .map(Number)
              .filter((n) => !isNaN(n) && n > 0)
            // Always sync parent with whatever valid numbers are parsed,
            // even if fewer than 2 (prevents parent state divergence)
            onChange({ ...value, repLadder: nums.length > 0 ? nums : [] })
          }}
          placeholder="10, 8, 6, 4, 2"
          className="min-h-12 w-full border-0 border-b border-warm-ash/30 bg-transparent py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
          aria-label="Rep ladder"
        />
        {ladderText.trim().length > 0 &&
          (() => {
            const nums = ladderText
              .split(/[,\s]+/)
              .map(Number)
              .filter((n) => !isNaN(n) && n > 0)
            return nums.length < 2 ? (
              <span className="text-[11px] text-warning-flare/80">
                Enter at least 2 numbers separated by commas
              </span>
            ) : null
          })()}
      </div>
      <LoadSpecEditor
        value={value.load ?? { type: 'unspecified' }}
        onChange={(load) => onChange({ ...value, load })}
        schemeType={value.type}
        exerciseSupports1RM={exerciseSupports1RM}
      />
    </div>
  )
}

export type { DescendingRepsFieldsProps }
