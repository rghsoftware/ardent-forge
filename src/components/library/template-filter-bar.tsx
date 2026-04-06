import { sessionTypeSchema } from '@/domain/types'
import type { SessionType } from '@/domain/types'
import { formatLabel } from '@/lib/utils'

const SESSION_TYPES = sessionTypeSchema.options

/** formatLabel only replaces underscores; SE needs a human-readable label. */
function sessionTypeLabel(value: SessionType): string {
  if (value === 'SE') return 'STRENGTH-ENDURANCE'
  return formatLabel(value)
}

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

interface TemplateFilterBarProps {
  activeCategory?: SessionType
  onCategoryChange: (category: SessionType | undefined) => void
}

export function TemplateFilterBar({ activeCategory, onCategoryChange }: TemplateFilterBarProps) {
  return (
    <div
      className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {SESSION_TYPES.map((type) => (
        <FilterChip
          key={type}
          label={sessionTypeLabel(type)}
          active={activeCategory === type}
          onClick={() => onCategoryChange(activeCategory === type ? undefined : type)}
        />
      ))}
    </div>
  )
}
