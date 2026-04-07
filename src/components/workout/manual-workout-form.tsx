import { useCallback, useMemo, useState } from 'react'
import { useForm, useFieldArray, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCreateWorkoutLog,
  useUpdateWorkoutLog,
  useCreateLoggedActivityGroup,
  useUpdateLoggedActivityGroup,
  useDeleteLoggedActivityGroup,
  useCreateLoggedActivity,
  useUpdateLoggedActivity,
  useDeleteLoggedActivity,
  useCreateLoggedSet,
  useUpdateLoggedSet,
  useDeleteLoggedSet,
} from '@/hooks/use-workout-logs'
import { useExercises } from '@/hooks/use-exercises'
import { useUserProfile } from '@/hooks/use-user-profile'
import { AddExerciseSheet } from '@/components/workout/add-exercise-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { groupTypeSchema } from '@/domain/types/session'
import { setTypeSchema } from '@/domain/types/workout-log'
import type {
  Exercise,
  GroupType,
  LoggedActivity,
  LoggedActivityGroup,
  LoggedSet,
  SetType,
  WorkoutLog,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkoutLogFull = {
  log: WorkoutLog
  groups: LoggedActivityGroup[]
  activities: LoggedActivity[]
  sets: LoggedSet[]
}

interface ManualWorkoutFormProps {
  mode: 'create' | 'edit'
  initialValue?: WorkoutLogFull
  userId: string
  onSaved: (workoutId: string) => void
}

// Form-layer schemas. Manual entry has stricter rules than the domain schema:
//   - completedAt required
//   - completedAt must not be in the future
//   - at least one completed set with a measurement
const formSetSchema = z
  .object({
    id: z.string().optional(),
    tempId: z.string().optional(),
    setNumber: z.number().int().min(1),
    setType: setTypeSchema,
    actualReps: z.number().int().nonnegative().optional(),
    actualWeight: z.number().nonnegative().optional(),
    actualDuration: z.number().nonnegative().optional(),
    actualDistance: z.number().nonnegative().optional(),
    actualHeartRate: z.number().int().positive().optional(),
    rpe: z.number().min(1).max(10).optional(),
    completed: z.boolean(),
    notes: z.string().optional(),
    ruckLoad: z.number().nonnegative().optional(),
    elevationGain: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (!data.completed) return true
      return (
        data.actualReps !== undefined ||
        data.actualWeight !== undefined ||
        data.actualDuration !== undefined ||
        data.actualDistance !== undefined ||
        data.actualHeartRate !== undefined
      )
    },
    { message: 'Completed sets need at least one measurement', path: ['completed'] },
  )

const formActivitySchema = z.object({
  id: z.string().optional(),
  tempId: z.string().optional(),
  exerciseId: z.string().min(1, 'Pick an exercise'),
  exerciseName: z.string().optional(),
  notes: z.string().optional(),
  sets: z.array(formSetSchema),
})

const formGroupSchema = z.object({
  id: z.string().optional(),
  tempId: z.string().optional(),
  groupType: groupTypeSchema,
  actualRoundsCompleted: z.number().int().positive().optional(),
  completionTime: z.number().nonnegative().optional(),
  activities: z.array(formActivitySchema),
})

const formSchema = z
  .object({
    title: z.string().optional(),
    startedAt: z.string().min(1, 'Start time is required'),
    completedAt: z.string().min(1, 'Completion time is required'),
    bodyweightAtSession: z.number().positive().optional(),
    perceivedDifficulty: z.number().int().min(1).max(10).optional(),
    overallNotes: z.string().optional(),
    groups: z.array(formGroupSchema),
  })
  .refine((data) => new Date(data.completedAt).getTime() > new Date(data.startedAt).getTime(), {
    message: 'Completion time must be after start time',
    path: ['completedAt'],
  })
  .refine((data) => new Date(data.completedAt).getTime() <= Date.now(), {
    message: 'Completion time cannot be in the future',
    path: ['completedAt'],
  })
  .refine(
    (data) => {
      // At least one completed set somewhere in the workout
      return data.groups.some((g) => g.activities.some((a) => a.sets.some((s) => s.completed)))
    },
    { message: 'A workout needs at least one completed set', path: ['groups'] },
  )

type FormValues = z.infer<typeof formSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_TYPE_OPTIONS: GroupType[] = [
  'STRAIGHT_SETS',
  'SUPERSET',
  'CIRCUIT',
  'EMOM',
  'AMRAP',
  'COUPLET',
]

const SET_TYPE_OPTIONS: SetType[] = ['WORKING', 'WARMUP', 'DROP', 'AMRAP', 'PEAK', 'BACKOFF']

function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(local: string): string {
  if (!local) return ''
  const d = new Date(local)
  return d.toISOString()
}

function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString())
}

function makeTempId(): string {
  return 'tmp-' + Math.random().toString(36).slice(2, 11)
}

type WeightUnit = 'lb' | 'kg'
type DistanceUnit = 'mi' | 'km' | 'm' | 'yd'

function toWeight(n: number | undefined, unit: WeightUnit) {
  return n === undefined || n === null || isNaN(n) ? undefined : { value: n, unit }
}
function fromWeight(w: { value: number; unit: WeightUnit } | undefined): number | undefined {
  return w?.value
}
function toDistance(n: number | undefined, unit: DistanceUnit) {
  return n === undefined || n === null || isNaN(n) ? undefined : { value: n, unit }
}
function fromDistance(d: { value: number; unit: DistanceUnit } | undefined): number | undefined {
  return d?.value
}
function toDuration(n: number | undefined) {
  return n === undefined || n === null || isNaN(n) ? undefined : { seconds: Math.round(n) }
}
function fromDuration(d: { seconds: number } | undefined): number | undefined {
  return d?.seconds
}

function buildDefaults(initial: WorkoutLogFull | undefined): FormValues {
  if (!initial) {
    return {
      title: '',
      startedAt: nowLocalInput(),
      completedAt: nowLocalInput(),
      bodyweightAtSession: undefined,
      perceivedDifficulty: undefined,
      overallNotes: '',
      groups: [],
    }
  }
  const groups = [...initial.groups]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((g) => {
      const activities = initial.activities
        .filter((a) => a.loggedGroupId === g.id)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((a) => {
          const sets = initial.sets
            .filter((s) => s.loggedActivityId === a.id)
            .sort((s1, s2) => s1.setNumber - s2.setNumber)
            .map((s) => ({
              id: s.id,
              setNumber: s.setNumber,
              setType: s.setType,
              actualReps: s.actualReps,
              actualWeight: fromWeight(s.actualWeight),
              actualDuration: fromDuration(s.actualDuration),
              actualDistance: fromDistance(s.actualDistance),
              actualHeartRate: s.actualHeartRate,
              rpe: s.rpe,
              completed: s.completed,
              notes: s.notes ?? '',
              ruckLoad: fromWeight(s.ruckLoad),
              elevationGain: fromDistance(s.elevationGain),
            }))
          return {
            id: a.id,
            exerciseId: a.exerciseId,
            exerciseName: undefined,
            notes: a.notes ?? '',
            sets,
          }
        })
      return {
        id: g.id,
        groupType: g.groupType,
        actualRoundsCompleted: g.actualRoundsCompleted,
        completionTime: fromDuration(g.completionTime),
        activities,
      }
    })
  return {
    title: initial.log.title ?? '',
    startedAt: isoToLocalInput(initial.log.startedAt),
    completedAt: isoToLocalInput(initial.log.completedAt),
    bodyweightAtSession: fromWeight(initial.log.bodyweightAtSession),
    perceivedDifficulty: initial.log.perceivedDifficulty,
    overallNotes: initial.log.overallNotes ?? '',
    groups,
  }
}

// ---------------------------------------------------------------------------
// Set rows -- compact, dense, gym-floor friendly
// ---------------------------------------------------------------------------

interface SetRowsProps {
  control: Control<FormValues>
  groupIndex: number
  activityIndex: number
}

function SetRows({ control, groupIndex, activityIndex }: SetRowsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `groups.${groupIndex}.activities.${activityIndex}.sets` as const,
  })

  const addSet = () => {
    append({
      tempId: makeTempId(),
      setNumber: fields.length + 1,
      setType: 'WORKING',
      completed: true,
      notes: '',
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-12 gap-1 text-[10px] uppercase tracking-wider text-warm-ash/60 px-1">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2">Reps</div>
        <div className="col-span-2">Weight</div>
        <div className="col-span-2">RPE</div>
        <div className="col-span-2">Done</div>
        <div className="col-span-1" />
      </div>
      {fields.map((field, setIndex) => (
        <div
          key={field.id}
          className={`grid grid-cols-12 gap-1 items-center px-1 py-1 ${
            setIndex % 2 === 0 ? 'bg-surface-iron' : 'bg-surface-charcoal'
          }`}
        >
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.setNumber`}
            render={({ field: f }) => (
              <span className="col-span-1 text-xs text-warm-ash tabular-nums">{f.value}</span>
            )}
          />
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.setType`}
            render={({ field: f }) => (
              <select
                {...f}
                className="col-span-2 h-12 bg-surface-pit text-bone-white text-xs px-1"
              >
                {SET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          />
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.actualReps`}
            render={({ field: f }) => (
              <input
                type="number"
                inputMode="numeric"
                value={f.value ?? ''}
                onChange={(e) =>
                  f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
                onBlur={f.onBlur}
                className="col-span-2 h-12 bg-surface-pit text-bone-white text-sm px-2 tabular-nums"
              />
            )}
          />
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.actualWeight`}
            render={({ field: f }) => (
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={f.value ?? ''}
                onChange={(e) =>
                  f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
                onBlur={f.onBlur}
                className="col-span-2 h-12 bg-surface-pit text-bone-white text-sm px-2 tabular-nums"
              />
            )}
          />
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.rpe`}
            render={({ field: f }) => (
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={1}
                max={10}
                value={f.value ?? ''}
                onChange={(e) =>
                  f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
                onBlur={f.onBlur}
                className="col-span-2 h-12 bg-surface-pit text-bone-white text-sm px-2 tabular-nums"
              />
            )}
          />
          <Controller
            control={control}
            name={`groups.${groupIndex}.activities.${activityIndex}.sets.${setIndex}.completed`}
            render={({ field: f }) => (
              <label className="col-span-2 flex items-center justify-center h-12">
                <input
                  type="checkbox"
                  checked={f.value}
                  onChange={(e) => f.onChange(e.target.checked)}
                  className="h-6 w-6 accent-ember"
                  aria-label="Set completed"
                />
              </label>
            )}
          />
          <button
            type="button"
            onClick={() => remove(setIndex)}
            aria-label="Remove set"
            className="col-span-1 h-12 w-12 flex items-center justify-center text-warm-ash hover:text-warning-flare"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addSet}
        className="mt-1 self-start min-h-[48px]"
      >
        Add set
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity rows
// ---------------------------------------------------------------------------

interface ActivityRowsProps {
  control: Control<FormValues>
  groupIndex: number
  exercises: Exercise[]
  userId: string
}

function ActivityRows({ control, groupIndex, exercises, userId }: ActivityRowsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `groups.${groupIndex}.activities` as const,
  })
  const [pickerOpen, setPickerOpen] = useState(false)

  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of exercises) m.set(e.id, e.name)
    return m
  }, [exercises])

  const handleExerciseSelected = (exercise: Exercise) => {
    append({
      tempId: makeTempId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      notes: '',
      sets: [
        {
          tempId: makeTempId(),
          setNumber: 1,
          setType: 'WORKING',
          completed: true,
          notes: '',
        },
      ],
    })
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {fields.map((field, activityIndex) => (
        <div key={field.id} className="bg-surface-pit/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-heading text-sm text-bone-white">
              {field.exerciseName ?? exerciseNameById.get(field.exerciseId) ?? 'Exercise'}
            </span>
            <button
              type="button"
              onClick={() => remove(activityIndex)}
              aria-label="Remove exercise"
              className="h-12 w-12 flex items-center justify-center text-warm-ash hover:text-warning-flare"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
          <SetRows control={control} groupIndex={groupIndex} activityIndex={activityIndex} />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setPickerOpen(true)}
        className="self-start min-h-[48px]"
      >
        Add exercise
      </Button>
      <AddExerciseSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onExerciseSelected={handleExerciseSelected}
        userId={userId}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function ManualWorkoutForm({ mode, initialValue, userId, onSaved }: ManualWorkoutFormProps) {
  const { data: exercises = [] } = useExercises()
  const { data: profile } = useUserProfile(userId)
  const weightUnit: WeightUnit = profile?.preferredUnits === 'METRIC' ? 'kg' : 'lb'
  const distanceUnit: DistanceUnit = profile?.preferredUnits === 'METRIC' ? 'km' : 'mi'
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const defaultValues = useMemo(() => buildDefaults(initialValue), [initialValue])

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const {
    fields: groupFields,
    append: appendGroup,
    remove: removeGroup,
  } = useFieldArray({ control, name: 'groups' })

  const createWorkoutLog = useCreateWorkoutLog()
  const updateWorkoutLog = useUpdateWorkoutLog()
  const createGroup = useCreateLoggedActivityGroup()
  const updateGroup = useUpdateLoggedActivityGroup()
  const deleteGroup = useDeleteLoggedActivityGroup()
  const createActivity = useCreateLoggedActivity()
  const updateActivity = useUpdateLoggedActivity()
  const deleteActivity = useDeleteLoggedActivity()
  const createSet = useCreateLoggedSet()
  const updateSet = useUpdateLoggedSet()
  const deleteSet = useDeleteLoggedSet()

  const addGroup = () => {
    appendGroup({
      tempId: makeTempId(),
      groupType: 'STRAIGHT_SETS',
      activities: [],
    })
  }

  const buildLogPayload = useCallback(
    (values: FormValues, base?: WorkoutLog): Omit<WorkoutLog, 'id' | 'createdAt' | 'updatedAt'> => {
      return {
        userId,
        title: values.title || undefined,
        startedAt: localInputToIso(values.startedAt),
        completedAt: localInputToIso(values.completedAt),
        sessionTemplateId: base?.sessionTemplateId,
        programContext: base?.programContext,
        overallNotes: values.overallNotes || undefined,
        perceivedDifficulty: values.perceivedDifficulty,
        bodyweightAtSession: toWeight(values.bodyweightAtSession, weightUnit),
        eventMetadata: base?.eventMetadata,
        pausedAt: undefined,
        totalPausedMs: base?.totalPausedMs ?? 0,
      }
    },
    [userId, weightUnit],
  )

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSaveError(null)
      setIsSaving(true)
      try {
        if (mode === 'create') {
          // Create workout log first to get its id
          const created = await createWorkoutLog.mutateAsync(buildLogPayload(values))
          // Sequentially create groups -> activities -> sets
          let groupOrdinal = 1
          for (const g of values.groups) {
            const newGroup = await createGroup.mutateAsync({
              group: {
                workoutLogId: created.id,
                groupType: g.groupType,
                ordinal: groupOrdinal++,
                actualRoundsCompleted: g.actualRoundsCompleted,
                completionTime: toDuration(g.completionTime),
              },
              userId,
            })
            let activityOrdinal = 1
            for (const a of g.activities) {
              const newActivity = await createActivity.mutateAsync({
                activity: {
                  loggedGroupId: newGroup.id,
                  exerciseId: a.exerciseId,
                  ordinal: activityOrdinal++,
                  notes: a.notes || undefined,
                },
                userId,
              })
              for (const s of a.sets) {
                await createSet.mutateAsync({
                  workoutLogId: created.id,
                  userId,
                  loggedActivityId: newActivity.id,
                  setNumber: s.setNumber,
                  setType: s.setType,
                  actualReps: s.actualReps,
                  actualWeight: toWeight(s.actualWeight, weightUnit),
                  actualDuration: toDuration(s.actualDuration),
                  actualDistance: toDistance(s.actualDistance, distanceUnit),
                  actualHeartRate: s.actualHeartRate,
                  rpe: s.rpe,
                  completed: s.completed,
                  notes: s.notes || undefined,
                  ruckLoad: toWeight(s.ruckLoad, weightUnit),
                  elevationGain: toDistance(s.elevationGain, distanceUnit),
                })
              }
            }
          }
          onSaved(created.id)
          return
        }

        // EDIT MODE -- diff against initialValue
        if (!initialValue) {
          throw new Error('Edit mode requires initialValue')
        }
        const workoutLogId = initialValue.log.id

        // 1. Update top-level workout log
        await updateWorkoutLog.mutateAsync({
          ...initialValue.log,
          ...buildLogPayload(values, initialValue.log),
          id: workoutLogId,
        } as WorkoutLog)

        // Index initial entities by id for diff
        const initialGroupIds = new Set(initialValue.groups.map((g) => g.id))
        const initialActivityIds = new Set(initialValue.activities.map((a) => a.id))
        const initialSetIds = new Set(initialValue.sets.map((s) => s.id))

        const formGroupIds = new Set(values.groups.map((g) => g.id).filter(Boolean) as string[])
        const formActivityIds = new Set(
          values.groups
            .flatMap((g) => g.activities)
            .map((a) => a.id)
            .filter(Boolean) as string[],
        )
        const formSetIds = new Set(
          values.groups
            .flatMap((g) => g.activities)
            .flatMap((a) => a.sets)
            .map((s) => s.id)
            .filter(Boolean) as string[],
        )

        // 2. Delete removed sets, then activities, then groups (children first)
        for (const s of initialValue.sets) {
          if (!formSetIds.has(s.id)) {
            await deleteSet.mutateAsync({ id: s.id, workoutLogId })
          }
        }
        for (const a of initialValue.activities) {
          if (!formActivityIds.has(a.id)) {
            await deleteActivity.mutateAsync({ id: a.id, workoutLogId })
          }
        }
        for (const g of initialValue.groups) {
          if (!formGroupIds.has(g.id)) {
            await deleteGroup.mutateAsync({ id: g.id, workoutLogId })
          }
        }

        // 3. Upsert groups -> activities -> sets, capturing newly-created ids
        let groupOrdinal = 1
        for (const g of values.groups) {
          let groupId = g.id
          if (groupId && initialGroupIds.has(groupId)) {
            await updateGroup.mutateAsync({
              group: {
                id: groupId,
                workoutLogId,
                groupType: g.groupType,
                ordinal: groupOrdinal,
                actualRoundsCompleted: g.actualRoundsCompleted,
                completionTime: toDuration(g.completionTime),
              },
              userId,
              workoutLogId,
            })
          } else {
            const created = await createGroup.mutateAsync({
              group: {
                workoutLogId,
                groupType: g.groupType,
                ordinal: groupOrdinal,
                actualRoundsCompleted: g.actualRoundsCompleted,
                completionTime: toDuration(g.completionTime),
              },
              userId,
            })
            groupId = created.id
          }
          groupOrdinal++

          let activityOrdinal = 1
          for (const a of g.activities) {
            let activityId = a.id
            if (activityId && initialActivityIds.has(activityId)) {
              await updateActivity.mutateAsync({
                activity: {
                  id: activityId,
                  loggedGroupId: groupId,
                  exerciseId: a.exerciseId,
                  ordinal: activityOrdinal,
                  notes: a.notes || undefined,
                },
                userId,
                workoutLogId,
              })
            } else {
              const created = await createActivity.mutateAsync({
                activity: {
                  loggedGroupId: groupId,
                  exerciseId: a.exerciseId,
                  ordinal: activityOrdinal,
                  notes: a.notes || undefined,
                },
                userId,
              })
              activityId = created.id
            }
            activityOrdinal++

            for (const s of a.sets) {
              if (s.id && initialSetIds.has(s.id)) {
                await updateSet.mutateAsync({
                  id: s.id,
                  loggedActivityId: activityId,
                  setNumber: s.setNumber,
                  setType: s.setType,
                  actualReps: s.actualReps,
                  actualWeight: toWeight(s.actualWeight, weightUnit),
                  actualDuration: toDuration(s.actualDuration),
                  actualDistance: toDistance(s.actualDistance, distanceUnit),
                  actualHeartRate: s.actualHeartRate,
                  rpe: s.rpe,
                  completed: s.completed,
                  notes: s.notes || undefined,
                  ruckLoad: toWeight(s.ruckLoad, weightUnit),
                  elevationGain: toDistance(s.elevationGain, distanceUnit),
                  workoutLogId,
                  userId,
                })
              } else {
                await createSet.mutateAsync({
                  workoutLogId,
                  userId,
                  loggedActivityId: activityId,
                  setNumber: s.setNumber,
                  setType: s.setType,
                  actualReps: s.actualReps,
                  actualWeight: toWeight(s.actualWeight, weightUnit),
                  actualDuration: toDuration(s.actualDuration),
                  actualDistance: toDistance(s.actualDistance, distanceUnit),
                  actualHeartRate: s.actualHeartRate,
                  rpe: s.rpe,
                  completed: s.completed,
                  notes: s.notes || undefined,
                  ruckLoad: toWeight(s.ruckLoad, weightUnit),
                  elevationGain: toDistance(s.elevationGain, distanceUnit),
                })
              }
            }
          }
        }

        onSaved(workoutLogId)
      } catch (err) {
        console.error('[manual-workout-form] Save failed:', err)
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Failed to save workout. Check your connection and try again.',
        )
      } finally {
        setIsSaving(false)
      }
    },
    [
      mode,
      initialValue,
      userId,
      onSaved,
      createWorkoutLog,
      updateWorkoutLog,
      createGroup,
      updateGroup,
      deleteGroup,
      createActivity,
      updateActivity,
      deleteActivity,
      createSet,
      updateSet,
      deleteSet,
      weightUnit,
      distanceUnit,
      buildLogPayload,
    ],
  )

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 pb-12 motion-safe:transition-none"
    >
      {/* Session meta */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xs uppercase tracking-widest text-warm-ash/60">SESSION</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register('title')} placeholder="Optional title" className="h-12" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="startedAt">Started at</Label>
            <input
              id="startedAt"
              type="datetime-local"
              {...register('startedAt')}
              className="h-12 bg-surface-pit text-bone-white px-3"
            />
            {errors.startedAt && (
              <p className="text-xs text-warning-flare">{errors.startedAt.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="completedAt">Completed at</Label>
            <input
              id="completedAt"
              type="datetime-local"
              {...register('completedAt')}
              className="h-12 bg-surface-pit text-bone-white px-3"
            />
            {errors.completedAt && (
              <p className="text-xs text-warning-flare">{errors.completedAt.message}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bodyweight">Bodyweight</Label>
            <Controller
              control={control}
              name="bodyweightAtSession"
              render={({ field }) => (
                <input
                  id="bodyweight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onBlur={field.onBlur}
                  className="h-12 bg-surface-pit text-bone-white px-3"
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rpe">Difficulty (1-10)</Label>
            <Controller
              control={control}
              name="perceivedDifficulty"
              render={({ field }) => (
                <input
                  id="rpe"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onBlur={field.onBlur}
                  className="h-12 bg-surface-pit text-bone-white px-3"
                />
              )}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="overallNotes">Notes</Label>
          <textarea
            id="overallNotes"
            {...register('overallNotes')}
            rows={3}
            className="bg-surface-pit text-bone-white px-3 py-2 text-sm"
          />
        </div>
      </section>

      {/* Blocks */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xs uppercase tracking-widest text-warm-ash/60">
            BLOCKS
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGroup}
            className="min-h-[48px]"
          >
            Add block
          </Button>
        </div>
        {errors.groups?.message && (
          <p className="text-xs text-warning-flare">{errors.groups.message}</p>
        )}
        {groupFields.map((group, groupIndex) => (
          <div key={group.id} className="bg-surface-iron p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Controller
                control={control}
                name={`groups.${groupIndex}.groupType`}
                render={({ field }) => (
                  <select {...field} className="h-12 bg-surface-pit text-bone-white text-xs px-2">
                    {GROUP_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              />
              <button
                type="button"
                onClick={() => removeGroup(groupIndex)}
                aria-label="Remove block"
                className="h-12 w-12 flex items-center justify-center text-warm-ash hover:text-warning-flare"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
            <ActivityRows
              control={control}
              groupIndex={groupIndex}
              exercises={exercises}
              userId={userId}
            />
          </div>
        ))}
      </section>

      {saveError && (
        <p role="alert" className="text-xs text-warning-flare">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="molten" disabled={isSaving} className="min-h-[48px] flex-1">
          {isSaving ? 'Saving...' : mode === 'create' ? 'Save workout' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
