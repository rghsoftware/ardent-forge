import { useRef } from 'react'
import { exerciseCategorySchema, movementPatternSchema, muscleGroupSchema } from '@/domain/types'
import type { ExerciseCategory, MuscleGroup, MovementPattern } from '@/domain/types'
import { formatLabel } from '@/lib/utils'

const CATEGORIES = exerciseCategorySchema.options
const MUSCLE_GROUPS = muscleGroupSchema.options
const MOVEMENT_PATTERNS = movementPatternSchema.options

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

interface ExerciseFilterBarProps {
  activeCategory?: ExerciseCategory
  activeMuscleGroup?: MuscleGroup
  activeMovementPattern?: MovementPattern
  onCategoryChange: (category: ExerciseCategory | undefined) => void
  onMuscleGroupChange: (muscleGroup: MuscleGroup | undefined) => void
  onMovementPatternChange: (movementPattern: MovementPattern | undefined) => void
}

export function ExerciseFilterBar({
  activeCategory,
  activeMuscleGroup,
  activeMovementPattern,
  onCategoryChange,
  onMuscleGroupChange,
  onMovementPatternChange,
}: ExerciseFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="space-y-2">
      {/* Category filters */}
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={formatLabel(cat)}
            active={activeCategory === cat}
            onClick={() => onCategoryChange(activeCategory === cat ? undefined : cat)}
          />
        ))}
      </div>

      {/* Muscle group filters */}
      <div
        className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {MUSCLE_GROUPS.map((mg) => (
          <FilterChip
            key={mg}
            label={formatLabel(mg)}
            active={activeMuscleGroup === mg}
            onClick={() => onMuscleGroupChange(activeMuscleGroup === mg ? undefined : mg)}
          />
        ))}
      </div>

      {/* Movement pattern filters */}
      <div
        className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {MOVEMENT_PATTERNS.map((mp) => (
          <FilterChip
            key={mp}
            label={formatLabel(mp)}
            active={activeMovementPattern === mp}
            onClick={() => onMovementPatternChange(activeMovementPattern === mp ? undefined : mp)}
          />
        ))}
      </div>
    </div>
  )
}
