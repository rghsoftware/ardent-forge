import { useMemo, useState } from 'react'
import { useExercises } from '@/hooks/use-exercises'
import { useSaveOneRepMax, useUpdateUserProfile } from '@/hooks/use-user-profile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ForgeInput, FORGE_LABEL_CLASS } from '@/components/ui/forge-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { OneRepMax } from '@/domain/types'

interface OneRmManagementProps {
  userId: string
  exerciseMaxes: Record<string, OneRepMax>
  preferredUnits: 'IMPERIAL' | 'METRIC'
}

export function OneRmManagement({ userId, exerciseMaxes, preferredUnits }: OneRmManagementProps) {
  const { data: exercises } = useExercises()
  const saveOneRepMax = useSaveOneRepMax()
  const updateProfile = useUpdateUserProfile()

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editEstimated, setEditEstimated] = useState<'TESTED' | 'ESTIMATED'>('TESTED')
  const [weightError, setWeightError] = useState<string | null>(null)

  // Build a lookup map from exercise ID to exercise name
  const exerciseLookup = useMemo(() => {
    if (!exercises) return new Map<string, string>()
    return new Map(exercises.map((e) => [e.id, e.name]))
  }, [exercises])

  const maxEntries = Object.entries(exerciseMaxes)

  const openEditDialog = (exerciseId: string, current: OneRepMax) => {
    setEditingExerciseId(exerciseId)
    setEditWeight(String(current.weight.value))
    setEditEstimated(current.estimated ? 'ESTIMATED' : 'TESTED')
  }

  const closeEditDialog = () => {
    setEditingExerciseId(null)
    setEditWeight('')
    setEditEstimated('TESTED')
    setWeightError(null)
  }

  const handleSave = async () => {
    if (!editingExerciseId) return
    const weightValue = parseFloat(editWeight)
    if (isNaN(weightValue) || weightValue <= 0) {
      setWeightError('Enter a valid weight greater than 0')
      return
    }
    setWeightError(null)

    const currentMax = exerciseMaxes[editingExerciseId]
    const unit = currentMax?.weight.unit ?? (preferredUnits === 'METRIC' ? 'kg' : 'lb')
    const isEstimated = editEstimated === 'ESTIMATED'
    const now = new Date().toISOString()

    try {
      // Save to 1RM history (append-only per PR-2)
      await saveOneRepMax.mutateAsync({
        userId,
        exerciseId: editingExerciseId,
        weight: { value: weightValue, unit },
        estimated: isEstimated,
        recordedAt: now,
      })

      // Update exerciseMaxes map on user profile
      const updatedMaxes = {
        ...exerciseMaxes,
        [editingExerciseId]: {
          weight: { value: weightValue, unit },
          testedAt: now,
          estimated: isEstimated,
        },
      }

      await updateProfile.mutateAsync({
        id: userId,
        exerciseMaxes: updatedMaxes,
      })

      closeEditDialog()
    } catch {
      // Error states available via saveOneRepMax.isError / updateProfile.isError
    }
  }

  const editingMax = editingExerciseId ? exerciseMaxes[editingExerciseId] : null

  // Empty state
  if (maxEntries.length === 0) {
    return (
      <EmptyState
        icon="trophy"
        heading="No maxes recorded"
        subtext="Add your first 1RM from an exercise detail page. Tracking maxes helps you plan progressive overload and see strength gains over time."
        className="py-12"
      />
    )
  }

  return (
    <div className="space-y-[0.4rem]">
      {maxEntries.map(([exerciseId, max]) => (
        <div key={exerciseId} className="flex items-center justify-between bg-surface-iron p-4">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs font-medium text-warm-ash">
              {exerciseLookup.get(exerciseId) ?? exerciseId}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-readout text-bone-white">{max.weight.value}</span>
              <span className="font-sans text-sm uppercase text-warm-ash">{max.weight.unit}</span>
              <Badge variant={max.estimated ? 'pending' : 'complete'}>
                {max.estimated ? 'ESTIMATED' : 'TESTED'}
              </Badge>
            </div>
          </div>
          <Button
            className="min-h-[48px] min-w-[48px] bg-forge text-on-forge hover:bg-forge/80"
            onClick={() => openEditDialog(exerciseId, max)}
          >
            Update
          </Button>
        </div>
      ))}

      {/* 1RM Update Dialog */}
      <Dialog open={editingExerciseId !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="font-display">Update 1RM</DialogTitle>
            {editingExerciseId && (
              <p className="font-sans text-xs font-medium text-warm-ash">
                {exerciseLookup.get(editingExerciseId) ?? editingExerciseId}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
            {/* Weight input -- underline style */}
            <div className="space-y-2">
              <label className={FORGE_LABEL_CLASS}>
                Weight (
                {(
                  editingMax?.weight.unit ?? (preferredUnits === 'METRIC' ? 'kg' : 'lb')
                ).toUpperCase()}
                )
              </label>
              <ForgeInput
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                className="font-display text-3xl"
              />
              {weightError && <p className="text-xs text-warning-flare">{weightError}</p>}
            </div>

            {/* Tested vs Estimated toggle */}
            <div className="space-y-2">
              <label className={FORGE_LABEL_CLASS}>Type</label>
              <ToggleGroup
                type="single"
                value={editEstimated}
                onValueChange={(val) => {
                  if (val === 'TESTED' || val === 'ESTIMATED') {
                    setEditEstimated(val)
                  }
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="TESTED"
                  className="min-h-[48px] flex-1 font-sans text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  Tested
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="ESTIMATED"
                  className="min-h-[48px] flex-1 font-sans text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  Estimated
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <DialogFooter>
            <div className="w-full space-y-2">
              <Button
                className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
                onClick={handleSave}
                disabled={saveOneRepMax.isPending || updateProfile.isPending}
              >
                {saveOneRepMax.isPending || updateProfile.isPending ? 'Saving...' : 'Save'}
              </Button>
              {(saveOneRepMax.isError || updateProfile.isError) && (
                <p className="text-xs text-warning-flare">Failed to save 1RM. Please try again.</p>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
