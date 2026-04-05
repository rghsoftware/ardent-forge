import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/lib/auth'
import { formatLabel } from '@/lib/utils'
import { useExercise, useExerciseWorkoutHistory } from '@/hooks/use-exercises'
import {
  useUserProfile,
  useUpdateUserProfile,
  useOneRepMaxHistory,
  useSaveOneRepMax,
} from '@/hooks/use-user-profile'
import { OneRmChart } from '@/components/exercises/one-rm-chart'
import { ExerciseHistoryList } from '@/components/exercises/exercise-history-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/_authenticated/exercises/$exerciseId')({
  component: ExerciseDetailPage,
})

const oneRmSchema = z.object({
  weight: z.number().positive('Weight must be greater than 0'),
  estimated: z.boolean(),
})

type OneRmFormValues = z.infer<typeof oneRmSchema>

function ExerciseDetailPage() {
  const { exerciseId } = Route.useParams()
  const { user } = useAuth()
  const userId = user?.id

  const { data: exercise, isLoading: isLoadingExercise, isError: isExerciseError } = useExercise(exerciseId)
  const { data: profile } = useUserProfile(userId ?? '')
  const { data: oneRmHistory } = useOneRepMaxHistory(userId, exerciseId)
  const { data: workoutHistory } = useExerciseWorkoutHistory(userId, exerciseId, 10)
  const saveOneRepMax = useSaveOneRepMax()
  const updateProfile = useUpdateUserProfile()

  const [showOneRmDialog, setShowOneRmDialog] = useState(false)

  const currentOneRm = profile?.exerciseMaxes?.[exerciseId]
  const weightUnit = profile?.preferredUnits === 'METRIC' ? 'kg' : 'lb'

  const { threeRepMax, fiveRepMax } = useMemo(() => {
    let threeRepMax: number | null = null
    let fiveRepMax: number | null = null
    if (!workoutHistory) return { threeRepMax, fiveRepMax }

    for (const entry of workoutHistory) {
      for (const set of entry.sets) {
        if (!set.completed) continue
        if (set.setType === 'WARMUP' || set.setType === 'DROP') continue
        if (set.actualWeight?.value == null || set.actualReps == null) continue

        const weight = set.actualWeight.value
        const reps = set.actualReps

        if (reps >= 3 && (threeRepMax === null || weight > threeRepMax)) {
          threeRepMax = weight
        }
        if (reps >= 5 && (fiveRepMax === null || weight > fiveRepMax)) {
          fiveRepMax = weight
        }
      }
    }
    return { threeRepMax, fiveRepMax }
  }, [workoutHistory])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OneRmFormValues>({
    resolver: zodResolver(oneRmSchema),
    defaultValues: {
      weight: currentOneRm?.weight.value ?? 0,
      estimated: false,
    },
  })

  const estimatedValue = watch('estimated')

  const onSubmitOneRm = async (values: OneRmFormValues) => {
    if (!userId) {
      console.error('[exercises] Cannot save 1RM: no authenticated user')
      return
    }

    const weightUnitConst = profile?.preferredUnits === 'METRIC' ? ('kg' as const) : ('lb' as const)
    const now = new Date().toISOString()

    try {
      await saveOneRepMax.mutateAsync({
        userId,
        exerciseId,
        weight: { value: values.weight, unit: weightUnitConst },
        estimated: values.estimated,
        recordedAt: now,
      })

      if (profile) {
        const updatedMaxes = {
          ...profile.exerciseMaxes,
          [exerciseId]: {
            weight: { value: values.weight, unit: weightUnitConst },
            testedAt: now,
            estimated: values.estimated,
          },
        }
        await updateProfile.mutateAsync({
          id: profile.id,
          exerciseMaxes: updatedMaxes,
        })
      }

      reset()
      setShowOneRmDialog(false)
    } catch {
      // Error states available via saveOneRepMax.isError / updateProfile.isError
    }
  }

  if (isLoadingExercise) {
    return (
      <div className="min-h-[100dvh] bg-surface-anvil p-4">
        <Skeleton className="mb-4 h-8 w-48 rounded-none bg-surface-steel" />
        <Skeleton className="mb-2 h-4 w-32 rounded-none bg-surface-steel" />
        <Skeleton className="h-4 w-64 rounded-none bg-surface-steel" />
      </div>
    )
  }

  if (isExerciseError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil px-4">
        <span className="material-symbols-outlined mb-3 text-4xl text-warning-flare">cloud_off</span>
        <p className="font-display text-sm text-warning-flare">
          Failed to load exercise
        </p>
        <p className="mt-2 text-xs text-warm-ash">Check your connection and try again.</p>
        <Link to="/exercises" className="mt-4 text-xs text-ember">
          Back to library
        </Link>
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-surface-anvil px-4">
        <span className="material-symbols-outlined mb-3 text-4xl text-warm-ash/40">
          error_outline
        </span>
        <p className="font-display text-sm text-warm-ash">
          Exercise not found
        </p>
        <Link
          to="/exercises"
          className="mt-4 text-xs text-ember"
        >
          Back to library
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-surface-anvil">
      <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4 md:px-6 lg:px-8">
        <Link
          to="/exercises"
          className="flex min-h-12 min-w-12 items-center justify-center text-warm-ash"
          aria-label="Back to exercise library"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <h1 className="font-display text-xl font-medium text-bone-white">
          {exercise.name}
        </h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="px-4 md:px-6 lg:px-8">
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-b-[rgba(91,64,57,0.15)]"
        >
          <TabsTrigger
            value="details"
            className="min-h-12 font-body text-xs font-medium uppercase tracking-widest data-[state=active]:text-ember"
          >
            DETAILS
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="min-h-12 font-body text-xs font-medium uppercase tracking-widest data-[state=active]:text-ember"
          >
            HISTORY
          </TabsTrigger>
        </TabsList>

        {/* DETAILS TAB */}
        <TabsContent value="details" className="pt-4">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4 pb-6">
            <div>
              <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                CATEGORY
              </span>
              <p className="mt-1 font-display text-sm text-bone-white">
                {formatLabel(exercise.category)}
              </p>
            </div>
            <div>
              <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                MOVEMENT
              </span>
              <p className="mt-1 font-display text-sm text-bone-white">
                {formatLabel(exercise.movementPattern)}
              </p>
            </div>
            <div className="col-span-2">
              <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                EQUIPMENT
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {exercise.equipmentRequired.length > 0 ? (
                  exercise.equipmentRequired.map((eq) => (
                    <Badge key={eq} className="text-[11px]">
                      {formatLabel(eq)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-warm-ash">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Primary muscles */}
          <div className="pb-4">
            <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
              PRIMARY MUSCLES
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {exercise.muscleGroups.primary.map((mg) => (
                <Badge key={mg} variant="complete" className="text-[11px]">
                  {formatLabel(mg)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Secondary muscles */}
          {exercise.muscleGroups.secondary.length > 0 && (
            <div className="pb-6">
              <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                SECONDARY MUSCLES
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {exercise.muscleGroups.secondary.map((mg) => (
                  <Badge key={mg} className="text-[11px]">
                    {formatLabel(mg)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 1RM section */}
          {exercise.supports1RM && (
            <div className="pb-6">
              <div className="flex items-end justify-between pb-4">
                <div>
                  <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                    CURRENT 1RM
                  </span>
                  <p className="text-readout mt-1 text-bone-white">
                    {currentOneRm
                      ? `${currentOneRm.weight.value}`
                      : '--'}
                  </p>
                  {currentOneRm && (
                    <span className="text-xs text-warm-ash">
                      {currentOneRm.weight.unit.toUpperCase()}
                      {currentOneRm.estimated ? ' (EST)' : ' (TESTED)'}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => setShowOneRmDialog(true)}
                  className="min-h-10 bg-forge px-4 text-on-forge text-xs font-medium"
                >
                  Update 1RM
                </Button>
              </div>

              {/* 1RM progression chart */}
              <div className="pb-2">
                <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                  1RM PROGRESSION
                </span>
              </div>
              <OneRmChart data={oneRmHistory ?? []} />
            </div>
          )}

          {/* Personal Records */}
          {exercise.supports1RM && workoutHistory && workoutHistory.length > 0 && (
            <div className="mt-6 space-y-3">
              <span className="font-body text-xs font-medium uppercase tracking-widest text-warm-ash">
                PERSONAL RECORDS
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="font-display text-2xl text-bone-white">
                    {threeRepMax !== null ? `${threeRepMax} ${weightUnit}` : '--'}
                  </span>
                  <span className="font-body text-xs uppercase tracking-widest text-warm-ash">
                    3RM
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-2xl text-bone-white">
                    {fiveRepMax !== null ? `${fiveRepMax} ${weightUnit}` : '--'}
                  </span>
                  <span className="font-body text-xs uppercase tracking-widest text-warm-ash">
                    5RM
                  </span>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="pt-4">
          <ExerciseHistoryList history={workoutHistory ?? []} />
        </TabsContent>
      </Tabs>
      </div>

      {/* 1RM Update Dialog */}
      <Dialog open={showOneRmDialog} onOpenChange={setShowOneRmDialog}>
        <DialogContent className="bg-surface-iron">
          <DialogHeader>
            <DialogTitle className="font-display text-sm text-bone-white">
              Update 1RM
            </DialogTitle>
            <DialogDescription className="text-xs text-warm-ash">
              Record a new 1RM for {exercise.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmitOneRm)} className="space-y-5">
            {/* Weight input */}
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
                WEIGHT ({weightUnit.toUpperCase()})
              </Label>
              <input
                type="number"
                step="0.5"
                {...register('weight', { valueAsNumber: true })}
                placeholder="0"
                className="min-h-12 w-full border-b-2 border-surface-steel bg-transparent px-1 py-2 font-display text-2xl text-bone-white placeholder:text-warm-ash/30 focus:border-ember focus:outline-none"
              />
              {errors.weight && (
                <p className="text-xs text-warning-flare">{errors.weight.message}</p>
              )}
            </div>

            {/* Tested vs Estimated toggle */}
            <div className="space-y-1">
              <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
                METHOD
              </Label>
              <ToggleGroup
                type="single"
                value={estimatedValue ? 'estimated' : 'tested'}
                onValueChange={(val) => {
                  if (val) setValue('estimated', val === 'estimated')
                }}
                className="w-full"
              >
                <ToggleGroupItem
                  value="tested"
                  className="min-h-10 flex-1 text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  Tested
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="estimated"
                  className="min-h-10 flex-1 text-xs font-medium data-[state=on]:bg-forge data-[state=on]:text-on-forge"
                >
                  Estimated
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full bg-forge text-on-forge text-xs font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Save 1RM'}
            </Button>
            {(saveOneRepMax.isError || updateProfile.isError) && (
              <p className="text-xs text-warning-flare">Failed to save 1RM. Please try again.</p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
