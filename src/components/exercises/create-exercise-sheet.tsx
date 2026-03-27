import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  exerciseCategorySchema,
  movementPatternSchema,
  muscleGroupSchema,
  type ExerciseCategory,
  type MovementPattern,
  type MuscleGroup,
  type Equipment,
} from '@/domain/types'
import { useCreateExercise } from '@/hooks/use-exercises'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const EQUIPMENT_OPTIONS: Equipment[] = [
  'BARBELL',
  'DUMBBELL',
  'KETTLEBELL',
  'CABLE_MACHINE',
  'BENCH',
  'SQUAT_RACK',
  'PULL_UP_BAR',
  'DIP_BARS',
  'RESISTANCE_BAND',
  'TREADMILL',
  'ROWER',
  'BIKE',
]

const CATEGORIES = exerciseCategorySchema.options
const MOVEMENT_PATTERNS = movementPatternSchema.options
const MUSCLE_GROUPS = muscleGroupSchema.options

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ')
}

const createExerciseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  category: exerciseCategorySchema,
  movementPattern: movementPatternSchema,
  primaryMuscles: z.array(muscleGroupSchema).min(1, 'Select at least one primary muscle group'),
  equipment: z.array(z.string()),
  supports1RM: z.boolean(),
  isBilateral: z.boolean(),
})

type CreateExerciseFormValues = z.infer<typeof createExerciseSchema>

interface CreateExerciseSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateExerciseSheet({ open, onOpenChange }: CreateExerciseSheetProps) {
  const createExercise = useCreateExercise()

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateExerciseFormValues>({
    resolver: zodResolver(createExerciseSchema),
    defaultValues: {
      name: '',
      category: 'BARBELL' as ExerciseCategory,
      movementPattern: 'PUSH' as MovementPattern,
      primaryMuscles: [],
      equipment: [],
      supports1RM: true,
      isBilateral: true,
    },
  })

  const category = watch('category')

  const onSubmit = async (values: CreateExerciseFormValues) => {
    await createExercise.mutateAsync({
      name: values.name,
      aliases: [],
      category: values.category,
      movementPattern: values.movementPattern,
      muscleGroups: {
        primary: values.primaryMuscles,
        secondary: [],
      },
      equipmentRequired: values.equipment as Equipment[],
      supports1RM: values.supports1RM,
      isBilateral: values.isBilateral,
      isCustom: true,
    })
    reset()
    onOpenChange(false)
  }

  // Auto-adjust supports1RM default when category changes
  const isCardioCategory = category === 'CARDIO'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto bg-surface-iron"
        showCloseButton={false}
      >
        <SheetHeader>
          <SheetTitle className="font-display text-sm uppercase tracking-widest text-bone-white">
            CREATE CUSTOM EXERCISE
          </SheetTitle>
          <SheetDescription className="text-xs text-warm-ash">
            Define a new exercise for your library.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-4 pb-4">
          {/* Name */}
          <div className="space-y-1">
            <Label
              htmlFor="exercise-name"
              className="text-xs font-medium uppercase tracking-widest text-warm-ash"
            >
              NAME
            </Label>
            <input
              id="exercise-name"
              type="text"
              {...register('name')}
              placeholder="e.g. Barbell Hip Thrust"
              className="min-h-12 w-full border-b-2 border-surface-steel bg-transparent px-1 py-2 font-body text-sm text-bone-white placeholder:text-warm-ash/40 focus:border-ember focus:outline-none"
            />
            {errors.name && <p className="text-xs text-warning-flare">{errors.name.message}</p>}
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
              CATEGORY
            </Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="min-h-12 w-full border-surface-steel bg-transparent text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-iron">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {formatLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Movement Pattern */}
          <div className="space-y-1">
            <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
              MOVEMENT PATTERN
            </Label>
            <Controller
              name="movementPattern"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="min-h-12 w-full border-surface-steel bg-transparent text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-iron">
                    {MOVEMENT_PATTERNS.map((mp) => (
                      <SelectItem key={mp} value={mp}>
                        {formatLabel(mp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Primary Muscle Groups */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
              PRIMARY MUSCLES
            </Label>
            {errors.primaryMuscles && (
              <p className="text-xs text-warning-flare">{errors.primaryMuscles.message}</p>
            )}
            <Controller
              name="primaryMuscles"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {MUSCLE_GROUPS.map((mg) => {
                    const checked = field.value.includes(mg)
                    return (
                      <label
                        key={mg}
                        className="flex min-h-10 cursor-pointer items-center gap-2 px-1"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            if (isChecked) {
                              field.onChange([...field.value, mg])
                            } else {
                              field.onChange(field.value.filter((v: MuscleGroup) => v !== mg))
                            }
                          }}
                          className="border-surface-steel data-[state=checked]:border-ember data-[state=checked]:bg-ember data-[state=checked]:text-on-ember"
                        />
                        <span className="text-xs text-bone-white">{formatLabel(mg)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>

          {/* Equipment */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-widest text-warm-ash">
              EQUIPMENT
            </Label>
            <Controller
              name="equipment"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((eq) => {
                    const checked = field.value.includes(eq)
                    return (
                      <label
                        key={eq}
                        className="flex min-h-10 cursor-pointer items-center gap-2 px-1"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => {
                            if (isChecked) {
                              field.onChange([...field.value, eq])
                            } else {
                              field.onChange(field.value.filter((v: string) => v !== eq))
                            }
                          }}
                          className="border-surface-steel data-[state=checked]:border-ember data-[state=checked]:bg-ember data-[state=checked]:text-on-ember"
                        />
                        <span className="text-xs text-bone-white">{formatLabel(eq)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>

          {/* Toggles row */}
          <div className="flex gap-6">
            <label className="flex min-h-12 cursor-pointer items-center gap-2">
              <Checkbox
                {...register('supports1RM')}
                defaultChecked={!isCardioCategory}
                className="border-surface-steel data-[state=checked]:border-ember data-[state=checked]:bg-ember data-[state=checked]:text-on-ember"
              />
              <span className="text-xs uppercase tracking-wider text-bone-white">SUPPORTS 1RM</span>
            </label>
            <label className="flex min-h-12 cursor-pointer items-center gap-2">
              <Checkbox
                {...register('isBilateral')}
                defaultChecked
                className="border-surface-steel data-[state=checked]:border-ember data-[state=checked]:bg-ember data-[state=checked]:text-on-ember"
              />
              <span className="text-xs uppercase tracking-wider text-bone-white">BILATERAL</span>
            </label>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-h-12 w-full bg-forge text-on-forge text-xs font-medium uppercase tracking-widest"
          >
            {isSubmitting ? 'CREATING...' : 'CREATE EXERCISE'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
