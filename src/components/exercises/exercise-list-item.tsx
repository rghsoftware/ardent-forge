import { Link } from '@tanstack/react-router'
import type { Exercise } from '@/domain/types'
import { formatLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface ExerciseListItemProps {
  exercise: Exercise
}

export function ExerciseListItem({ exercise }: ExerciseListItemProps) {
  return (
    <Link
      to="/exercises/$exerciseId"
      params={{ exerciseId: exercise.id }}
      className="flex min-h-12 items-center gap-3 border-b border-b-[rgba(91,64,57,0.15)] bg-surface-iron px-4 py-3 transition-colors hover:bg-surface-gunmetal"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm font-medium text-bone-white">
            {exercise.name}
          </span>
          <Badge className="shrink-0 text-[11px]">{formatLabel(exercise.category)}</Badge>
        </div>
        {exercise.muscleGroups.primary.length > 0 && (
          <p className="mt-0.5 truncate text-xs text-warm-ash">
            {exercise.muscleGroups.primary.map(formatLabel).join(', ')}
          </p>
        )}
      </div>
      <span className="material-symbols-outlined text-warm-ash/50 text-lg">chevron_right</span>
    </Link>
  )
}
