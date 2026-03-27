import { useMemo, useState } from 'react'
import { useExercises } from '@/hooks/use-exercises'
import { useSaveOneRepMax, useUpdateUserProfile } from '@/hooks/use-user-profile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
}

export function OneRmManagement({ userId, exerciseMaxes }: OneRmManagementProps) {
  const { data: exercises } = useExercises()
  const saveOneRepMax = useSaveOneRepMax()
  const updateProfile = useUpdateUserProfile()

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editEstimated, setEditEstimated] = useState<'TESTED' | 'ESTIMATED'>('TESTED')

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
  }

  const handleSave = async () => {
    if (!editingExerciseId) return
    const weightValue = parseFloat(editWeight)
    if (isNaN(weightValue) || weightValue <= 0) return

    const currentMax = exerciseMaxes[editingExerciseId]
    const unit = currentMax?.weight.unit ?? 'lb'
    const isEstimated = editEstimated === 'ESTIMATED'
    const now = new Date().toISOString()

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
  }

  const editingMax = editingExerciseId ? exerciseMaxes[editingExerciseId] : null

  // Empty state
  if (maxEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="font-display text-lg font-bold uppercase tracking-wider text-bone-white">
          NO MAXES RECORDED
        </p>
        <p className="mt-2 text-sm text-warm-ash">
          Add your first 1RM from an exercise detail page
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-[0.4rem]">
      {maxEntries.map(([exerciseId, max]) => (
        <div key={exerciseId} className="flex items-center justify-between bg-surface-iron p-4">
          <div className="flex flex-col gap-1">
            <span className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
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
            UPDATE
          </Button>
        </div>
      ))}

      {/* 1RM Update Dialog */}
      <Dialog open={editingExerciseId !== null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-wider">UPDATE 1RM</DialogTitle>
            {editingExerciseId && (
              <p className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                {exerciseLookup.get(editingExerciseId) ?? editingExerciseId}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
            {/* Weight input -- underline style */}
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                WEIGHT ({editingMax?.weight.unit ?? 'lb'})
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                className="w-full border-b-2 border-surface-steel bg-transparent px-0 py-2 font-display text-3xl text-bone-white outline-none transition-colors focus:border-ember"
              />
            </div>

            {/* Tested vs Estimated toggle */}
            <div className="space-y-2">
              <label className="font-sans text-xs font-medium uppercase tracking-widest text-warm-ash">
                TYPE
              </label>
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
                  className="min-h-[48px] flex-1 font-sans text-xs font-medium uppercase tracking-widest data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  TESTED
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="ESTIMATED"
                  className="min-h-[48px] flex-1 font-sans text-xs font-medium uppercase tracking-widest data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  ESTIMATED
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="min-h-[48px] w-full bg-forge text-on-forge hover:bg-forge/80"
              onClick={handleSave}
              disabled={saveOneRepMax.isPending || updateProfile.isPending}
            >
              {saveOneRepMax.isPending || updateProfile.isPending ? 'SAVING...' : 'SAVE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
