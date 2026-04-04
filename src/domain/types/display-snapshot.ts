import { z } from 'zod'
import { sessionTypeSchema } from './session'
import { isoDateTime } from './units'

// ---------------------------------------------------------------------------
// RestTimerState -- discriminated union for rest timer display
//   idle: timer not running
//   running: timer active with start time and total duration
// ---------------------------------------------------------------------------

export const restTimerStateSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('idle') }),
  z.object({
    state: z.literal('running'),
    started_at: isoDateTime,
    total_seconds: z.number().positive(),
  }),
])
export type RestTimerState = z.infer<typeof restTimerStateSchema>

// ---------------------------------------------------------------------------
// DisplaySet -- a single set shown on the remote display
//   weight uses { value, unit } matching the broadcast payload shape
// ---------------------------------------------------------------------------

const displayWeightSchema = z.object({
  value: z.number().nonnegative(),
  unit: z.enum(['lb', 'kg']),
})

export const displaySetSchema = z.object({
  set_number: z.number().int().min(1),
  prescribed: z
    .object({
      reps: z.number().int().nonnegative(),
      weight: displayWeightSchema,
    })
    .optional(),
  actual: z
    .object({
      reps: z.number().int().nonnegative(),
      weight: displayWeightSchema,
    })
    .optional(),
  completed: z.boolean(),
})
export type DisplaySet = z.infer<typeof displaySetSchema>

// ---------------------------------------------------------------------------
// DisplaySnapshot -- the full workout state broadcast to remote displays
//   11 fields representing current workout progress
// ---------------------------------------------------------------------------

export const displaySnapshotSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  session_name: z.string(),
  workout_started_at: isoDateTime,
  current_exercise: z.string(),
  exercise_index: z.number().int().min(0),
  total_exercises: z.number().int().min(1),
  sets: z.array(displaySetSchema),
  rest_timer: restTimerStateSchema,
  session_type: sessionTypeSchema,
  is_visible: z.literal(true),
})
export type DisplaySnapshot = z.infer<typeof displaySnapshotSchema>

// ---------------------------------------------------------------------------
// DisplayEventType -- the types of events sent over the broadcast channel
// ---------------------------------------------------------------------------

export const displayEventTypeSchema = z.enum([
  'workout_snapshot',
  'session_ended',
  'focus',
  'unfocus',
  'idle_snapshot',
])
export type DisplayEventType = z.infer<typeof displayEventTypeSchema>

// ---------------------------------------------------------------------------
// IdleSnapshot -- state broadcast when no workout is active
//   shows scheduled sessions and the next upcoming session
// ---------------------------------------------------------------------------

export const idleSnapshotSchema = z.object({
  server_time: isoDateTime,
  scheduled_sessions: z.array(
    z.object({
      display_name: z.string().min(1),
      session_name: z.string().min(1),
      session_type: sessionTypeSchema,
      day_label: z.string().min(1),
    }),
  ),
  next_session: z
    .object({
      display_name: z.string().min(1),
      session_name: z.string().min(1),
    })
    .nullable(),
})
export type IdleSnapshot = z.infer<typeof idleSnapshotSchema>
