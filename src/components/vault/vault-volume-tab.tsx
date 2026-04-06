import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useExercises } from '@/hooks/use-exercises'
import { useWeeklyVolume } from '@/hooks/use-analytics'
import { EmptyState } from '@/components/shared/empty-state'
import { VolumeLoadBar } from '@/components/history/volume-load-bar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export function VaultVolumeTab() {
  const { user } = useAuth()
  const userId = user?.id
  const { data: exercises, isLoading: isLoadingExercises } = useExercises()
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | undefined>(undefined)

  const { data: volumeData, isLoading: isLoadingVolume } = useWeeklyVolume(
    userId,
    selectedExerciseId,
    8,
  )

  const maxTonnage = volumeData ? Math.max(...volumeData.map((e) => e.tonnage)) : 0

  if (isLoadingExercises) {
    return (
      <div className="space-y-4 pt-4">
        <Skeleton className="h-10 w-full rounded-none bg-surface-steel" />
        <Skeleton className="h-64 w-full rounded-none bg-surface-steel" />
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
          {(exercises ?? []).map((exercise) => (
            <SelectItem key={exercise.id} value={exercise.id}>
              {exercise.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!selectedExerciseId && (
        <div className="flex items-center justify-center bg-surface-iron p-8">
          <p className="font-display text-sm text-warm-ash">
            Select an exercise to view volume trends
          </p>
        </div>
      )}

      {selectedExerciseId && isLoadingVolume && (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded-none bg-surface-steel" />
          ))}
        </div>
      )}

      {selectedExerciseId && !isLoadingVolume && volumeData && volumeData.length > 0 && (
        <div className="space-y-3 pt-2">
          {volumeData.map((entry) => (
            <div key={entry.weekStart} className="flex items-center gap-3">
              <div className="flex-1">
                <VolumeLoadBar
                  label={entry.weekLabel}
                  value={entry.tonnage}
                  maxValue={maxTonnage}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-body text-xs tabular-nums text-warm-ash">
                {entry.tonnage.toLocaleString()} {entry.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedExerciseId && !isLoadingVolume && (!volumeData || volumeData.length === 0) && (
        <EmptyState
          icon="bar_chart"
          heading="No volume history for this exercise"
          subtext="Log sessions with this exercise to see volume trends."
          className="bg-surface-iron"
        />
      )}
    </div>
  )
}
