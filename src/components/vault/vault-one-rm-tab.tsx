import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useExercises } from '@/hooks/use-exercises'
import { useUserProfile, useOneRepMaxHistory } from '@/hooks/use-user-profile'
import { OneRmChart } from '@/components/exercises/one-rm-chart'
import { OneRmManagement } from '@/components/profile/one-rm-management'
import { EmptyState } from '@/components/shared/empty-state'
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
  const { data: profile, isLoading: isLoadingProfile } = useUserProfile(userId!)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | undefined>(undefined)

  const { data: oneRmHistory, isLoading: isLoadingHistory } = useOneRepMaxHistory(
    userId,
    selectedExerciseId,
  )

  const oneRmExercises = exercises?.filter((e) => e.supports1RM) ?? []
  const exerciseMaxes = profile?.exerciseMaxes ?? {}
  const preferredUnits = profile?.preferredUnits ?? 'IMPERIAL'

  if (isLoadingExercises || isLoadingProfile) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-10 w-full rounded-none bg-surface-steel" />
        <Skeleton className="h-52 w-full rounded-none bg-surface-steel" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-4">
      {userId && (
        <OneRmManagement
          userId={userId}
          exerciseMaxes={exerciseMaxes}
          preferredUnits={preferredUnits}
        />
      )}

      {oneRmExercises.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xs font-medium uppercase tracking-widest text-warm-ash">
            TRENDS
          </h2>

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
            <EmptyState
              icon="monitoring"
              heading="Select an exercise to view 1RM trends"
              className="bg-surface-iron py-8"
            />
          )}

          {selectedExerciseId && isLoadingHistory && (
            <Skeleton className="h-52 w-full rounded-none bg-surface-steel" />
          )}

          {selectedExerciseId && !isLoadingHistory && <OneRmChart data={oneRmHistory ?? []} />}
        </div>
      )}
    </div>
  )
}
