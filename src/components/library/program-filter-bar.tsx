import { programSourceSchema } from '@/domain/types'
import type { ProgramSource } from '@/domain/types'
import { formatLabel } from '@/lib/utils'

const SOURCES = programSourceSchema.options

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[36px] shrink-0 items-center px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
        active ? 'bg-surface-gunmetal text-ember' : 'bg-surface-steel text-bone-white/70'
      }`}
    >
      {label}
    </button>
  )
}

interface ProgramFilterBarProps {
  activeSource?: ProgramSource
  onSourceChange: (source: ProgramSource | undefined) => void
}

export function ProgramFilterBar({ activeSource, onSourceChange }: ProgramFilterBarProps) {
  return (
    <div
      className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {SOURCES.map((source) => (
        <FilterChip
          key={source}
          label={formatLabel(source)}
          active={activeSource === source}
          onClick={() => onSourceChange(activeSource === source ? undefined : source)}
        />
      ))}
    </div>
  )
}
