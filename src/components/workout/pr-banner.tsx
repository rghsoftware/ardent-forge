import type React from 'react'
import type { PersonalRecord } from '@/domain/types'

function riseDelay(seconds: number): React.CSSProperties {
  return { animation: `rise 0.4s ease-out ${seconds}s both` }
}

/**
 * Derive the rep count label from the PersonalRecord type.
 * - 1RM -> 1
 * - 3RM -> 3
 * - 5RM -> 5
 */
function repsFromType(type: PersonalRecord['type']): number | null {
  switch (type) {
    case '1RM':
      return 1
    case '3RM':
      return 3
    case '5RM':
      return 5
    default:
      return null
  }
}

function formatPrLine(record: PersonalRecord): string {
  const name = record.exerciseName.toUpperCase()

  // Strength PRs: show weight x reps
  const reps = repsFromType(record.type)
  if (reps !== null) {
    return `NEW PR: ${name} -- ${record.value}${record.unit} x ${reps}`
  }

  // Max-reps PRs: show rep count
  if (record.type === 'max-reps') {
    return `NEW PR: ${name} -- ${record.value} REPS`
  }

  // Cardio PRs: show value + unit
  return `NEW PR: ${name} -- ${record.value}${record.unit}`
}

interface PrBannerProps {
  records: PersonalRecord[]
}

export function PrBanner({ records }: PrBannerProps) {
  if (records.length === 0) return null

  return (
    <div
      className="mb-8 px-4 py-4"
      style={{
        background: 'linear-gradient(135deg, #FFB59C 0%, #FB5C1C 100%)',
        color: '#511500',
        borderRadius: '0px',
        ...riseDelay(0.55),
      }}
    >
      <span className="font-body text-[11px] uppercase tracking-widest block mb-2">
        Personal Records
      </span>
      <div className="flex flex-col gap-1.5">
        {records.map((record, i) => (
          <p
            key={`${record.exerciseId}-${record.type}`}
            className="font-body text-sm font-semibold leading-snug"
            style={riseDelay(0.6 + i * 0.06)}
          >
            {formatPrLine(record)}
          </p>
        ))}
      </div>
    </div>
  )
}
