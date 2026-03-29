import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useExercises } from '@/hooks/use-exercises'
import { useOneRepMaxHistory } from '@/hooks/use-user-profile'
import { OneRmChart } from '@/components/exercises/one-rm-chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export function VaultOneRmTab() {
  const { user } = useAuth()
  const userId = user?.id
  const { data: exercises, isLoading: isLoadingExercises } = useExercises()
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | undefined>(undefined)

  const { data: oneRmHistory, isLoading: isLoadingHistory } = useOneRepMaxHistory(
    userId,
    selectedExerciseId,
  )

  const oneRmExercises = exercises?.filter((e) => e.supports1RM) ?? []

  if (isLoadingExercises) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-10 w-full rounded-none bg-surface-steel" />
        <Skeleton className="h-52 w-full rounded-none bg-surface-steel" />
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <Select
        value={selectedExerciseId ?? ''}
        onValueChange={(val) => setSelectedExerciseId(val || undefined)}
      >
        <SelectTrigger className="min-h-12 w-full border-surface-steel bg-surface-iron font-body text-sm text-bone-white">
          <SelectValue placeholder="Select an exercise" />
        </SelectTrigger>
        <SelectContent className="bg-surface-iron">
          {oneRmExercises.map((exercise) => (
            <SelectItem key={exercise.id} value={exercise.id}>
              {exercise.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!selectedExerciseId && (
        <div className="flex items-center justify-center bg-surface-iron p-8">
          <p className="font-display text-sm text-warm-ash">
            Select an exercise to view 1RM trends
          </p>
        </div>
      )}

      {selectedExerciseId && isLoadingHistory && (
        <Skeleton className="h-52 w-full rounded-none bg-surface-steel" />
      )}

      {selectedExerciseId && !isLoadingHistory && <OneRmChart data={oneRmHistory ?? []} />}
    </div>
  )
}
