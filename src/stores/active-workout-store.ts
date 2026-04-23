import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  Exercise,
  GroupType,
  NoteContent,
} from '@/domain/types'
import { noteContentSchema } from '@/domain/types'
import { UNDO_WINDOW_MS } from '@/lib/workout-utils'
import type { SnapshotContext } from '@/lib/display-snapshot'
import { buildDisplaySnapshot } from '@/lib/display-snapshot'
import { publishDisplaySnapshot, publishSessionEnded } from '@/lib/display-realtime'

// ---------------------------------------------------------------------------
// Nested state: groups contain activities, activities contain sets
// ---------------------------------------------------------------------------

export interface LoggedActivityWithSets extends LoggedActivity {
  sets: LoggedSet[]
}

export interface LoggedActivityGroupWithActivities extends LoggedActivityGroup {
  activities: LoggedActivityWithSets[]
}

// ---------------------------------------------------------------------------
// Undo action -- tracks the last confirmed set for 10s reversal
// ---------------------------------------------------------------------------

export interface UndoAction {
  setId: string
  loggedActivityId: string
  expiresAt: number
}

// ---------------------------------------------------------------------------
// Rest timer state
// ---------------------------------------------------------------------------

interface RestTimer {
  remaining: number
  total: number
  startedAt: number // Date.now() ms when this rest period began
}

// ---------------------------------------------------------------------------
// ActiveWorkoutState
// ---------------------------------------------------------------------------

interface ActiveWorkoutState {
  // Core workout data
  workoutLog: WorkoutLog | null
  loggedGroups: LoggedActivityGroupWithActivities[]

  // Timers
  elapsedSeconds: number
  restTimer: RestTimer | null

  // Undo mechanism
  undoAction: UndoAction | null

  // Surfaced pause-timing error so the bridge/UI layer can react when the
  // store's unpauseWorkout action hits the invalid-pausedAt branch (the
  // store cannot render UI itself). Cleared on successful pause/unpause.
  pauseTimingError: string | null

  skippedActivityIds: Set<string>
}

// ---------------------------------------------------------------------------
// Module-scope interval handles (kept outside Zustand to avoid re-renders)
// ---------------------------------------------------------------------------

// Note: the elapsed timer interval is owned by the workout log page (see
// src/routes/_authenticated/log.$workoutId.tsx) per Tech.md D-1. The store
// only holds the current elapsedSeconds value via setElapsedSeconds.
let _restInterval: ReturnType<typeof setInterval> | null = null
let _onRestExpired: (() => void) | null = null

// Tauri event unlisten handles for the Rust rest timer path.
// In Tauri mode, the timer runs in Rust and ticks arrive via events;
// in browser mode, _restInterval above drives a JS setInterval instead.
// The two paths are mutually exclusive (see startRestTimer below).
let _unlistenTick: UnlistenFn | null = null
let _unlistenExpired: UnlistenFn | null = null

function _cleanupTauriRestListeners(): void {
  _unlistenTick?.()
  _unlistenTick = null
  _unlistenExpired?.()
  _unlistenExpired = null
}

// ---------------------------------------------------------------------------
// Display broadcast -- snapshot context and publish helper
// ---------------------------------------------------------------------------

let _snapshotContext: SnapshotContext | null = null

export function setSnapshotContext(ctx: SnapshotContext | null): void {
  _snapshotContext = ctx
}

function _publishCurrentState(): void {
  // Private-mode workouts have no snapshot context -- publishing is intentionally a no-op.
  if (!_snapshotContext) return
  const state = useActiveWorkoutStore.getState()
  if (!state.workoutLog) return
  try {
    publishDisplaySnapshot(buildDisplaySnapshot(state, _snapshotContext))
  } catch (err) {
    console.error('[display-broadcast] Failed to publish snapshot:', err)
  }
}

export function republishCurrentState(): void {
  _publishCurrentState()
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface ActiveWorkoutActions {
  // Lifecycle
  startWorkout(userId: string, workoutLog: WorkoutLog): void
  startProgrammedWorkout(workoutLog: WorkoutLog, groups: LoggedActivityGroupWithActivities[]): void
  resumeWorkout(
    workoutLog: WorkoutLog,
    groups: LoggedActivityGroupWithActivities[],
    elapsedSeconds: number,
  ): void
  finishWorkout(): void
  discardWorkout(): void
  pauseWorkout(): void
  unpauseWorkout(): void

  // Exercise management
  addExerciseToWorkout(
    exercise: Exercise,
    groupType: GroupType,
    newGroup: LoggedActivityGroup,
    newActivity: LoggedActivity,
  ): void
  skipActivity(activityId: string): void
  removeActivity(activityId: string): void

  // Set management
  confirmSet(loggedActivityId: string, newSet: LoggedSet): void
  updateSetInPlace(loggedActivityId: string, updatedSet: LoggedSet): void
  deleteSet(loggedActivityId: string, setId: string): void
  unconfirmSet(loggedActivityId: string, setId: string): void
  undoLastSet(): void
  clearUndo(): void

  // Rest timer
  startRestTimer(
    seconds: number,
    exerciseName?: string,
    setNumber?: number,
    onExpired?: () => void,
  ): void
  skipRest(): void
  adjustRest(delta: number): void
  // Recalculates remaining time from wall-clock elapsed. If still running,
  // corrects remaining to the current wall-clock value. If the rest period has
  // ended, fires onExpired and clears the timer. Safe to call anytime the timer
  // may have drifted (screen wake, tab resume, etc.).
  recalcRestTimer(): void

  // Elapsed timer setter (owned by the workout log page, see Tech.md D-1)
  setElapsedSeconds(seconds: number): void

  // Notes (F020) -- validate at boundary, store on workoutLog / activity
  setSessionNote(content: NoteContent): void
  setActivityNote(activityId: string, content: NoteContent): void

  // Timer ticks (called by intervals internally)
  tickRest(): void

  // Cleanup
  cleanup(): void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: ActiveWorkoutState = {
  workoutLog: null,
  loggedGroups: [],
  elapsedSeconds: 0,
  restTimer: null,
  undoAction: null,
  pauseTimingError: null,
  skippedActivityIds: new Set<string>(),
}

export const useActiveWorkoutStore = create<ActiveWorkoutState & ActiveWorkoutActions>()(
  (set, get) => ({
    ...initialState,

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    startWorkout(_userId: string, workoutLog: WorkoutLog) {
      const state = get()
      if (state.workoutLog !== null) {
        // Invariant L-8: only one active workout at a time
        throw new Error('Cannot start a new workout while one is already active')
      }

      set({
        workoutLog,
        loggedGroups: [],
        elapsedSeconds: 0,
        restTimer: null,
        undoAction: null,
      })
      _publishCurrentState()
    },

    startProgrammedWorkout(workoutLog: WorkoutLog, groups: LoggedActivityGroupWithActivities[]) {
      const state = get()
      if (state.workoutLog !== null) {
        // Invariant L-8: only one active workout at a time
        throw new Error('Cannot start a new workout while one is already active')
      }

      set({
        workoutLog,
        loggedGroups: groups,
        elapsedSeconds: 0,
        restTimer: null,
        undoAction: null,
      })
      _publishCurrentState()
    },

    resumeWorkout(
      workoutLog: WorkoutLog,
      groups: LoggedActivityGroupWithActivities[],
      elapsedSeconds: number,
    ) {
      // Clear any existing rest interval; the log page owns the elapsed interval.
      if (_restInterval) clearInterval(_restInterval)
      _restInterval = null

      // Ephemeral-only fields (e.g. skippedActivityIds, pauseTimingError) are
      // not persisted and are implicitly cleared by Zustand's non-persistent
      // initialization when the app starts, so they are intentionally omitted
      // from this explicit set() call. finishWorkout/discardWorkout still
      // reset them via `...initialState` because they may have accumulated
      // values mid-session.
      set({
        workoutLog,
        loggedGroups: groups,
        elapsedSeconds,
        restTimer: null,
        undoAction: null,
      })
    },

    finishWorkout() {
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
      _onRestExpired = null
      if (_snapshotContext) publishSessionEnded(_snapshotContext.userId)
      set({ ...initialState })
    },

    pauseWorkout() {
      const state = get()
      if (!state.workoutLog || state.workoutLog.pausedAt) return
      set({
        workoutLog: { ...state.workoutLog, pausedAt: new Date().toISOString() },
        pauseTimingError: null,
      })
      _publishCurrentState()
    },

    unpauseWorkout() {
      const state = get()
      if (!state.workoutLog || !state.workoutLog.pausedAt) return
      const pauseDurationMs = Date.now() - new Date(state.workoutLog.pausedAt).getTime()
      if (!Number.isFinite(pauseDurationMs) || pauseDurationMs < 0) {
        console.error(
          '[active-workout] Invalid pausedAt when unpausing:',
          state.workoutLog.pausedAt,
        )
        set({
          workoutLog: { ...state.workoutLog, pausedAt: undefined },
          pauseTimingError: 'Pause timing data was invalid; resumed without crediting paused time.',
        })
        _publishCurrentState()
        return
      }
      set({
        workoutLog: {
          ...state.workoutLog,
          pausedAt: undefined,
          totalPausedMs: state.workoutLog.totalPausedMs + pauseDurationMs,
        },
        pauseTimingError: null,
      })
      _publishCurrentState()
    },

    discardWorkout() {
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
      _onRestExpired = null
      if (_snapshotContext) publishSessionEnded(_snapshotContext.userId)
      set({ ...initialState })
    },

    // ------------------------------------------------------------------
    // Exercise management
    // ------------------------------------------------------------------

    addExerciseToWorkout(
      _exercise: Exercise,
      _groupType: GroupType,
      newGroup: LoggedActivityGroup,
      newActivity: LoggedActivity,
    ) {
      set((state) => ({
        loggedGroups: [
          ...state.loggedGroups,
          {
            ...newGroup,
            activities: [
              {
                ...newActivity,
                sets: [],
              },
            ],
          },
        ],
      }))
      _publishCurrentState()
    },

    skipActivity(activityId: string) {
      if (!activityId) {
        console.warn('[active-workout] skipActivity called with empty activityId')
        return
      }
      set((state) => ({
        skippedActivityIds: new Set([...state.skippedActivityIds, activityId]),
      }))
    },

    removeActivity(activityId: string) {
      if (!activityId) {
        console.warn('[active-workout] removeActivity called with empty activityId')
        return
      }
      set((state) => ({
        loggedGroups: state.loggedGroups
          .map((group) => ({
            ...group,
            activities: group.activities.filter((a) => a.id !== activityId),
          }))
          .filter((group) => group.activities.length > 0),
        undoAction: state.undoAction?.loggedActivityId === activityId ? null : state.undoAction,
      }))
    },

    // ------------------------------------------------------------------
    // Set management
    // ------------------------------------------------------------------

    confirmSet(loggedActivityId: string, newSet: LoggedSet) {
      set((state) => {
        const updatedGroups = state.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== loggedActivityId) return activity
            return {
              ...activity,
              sets: [...activity.sets, newSet],
            }
          }),
        }))

        return {
          loggedGroups: updatedGroups,
          undoAction: {
            setId: newSet.id,
            loggedActivityId,
            expiresAt: Date.now() + UNDO_WINDOW_MS,
          },
        }
      })
      _publishCurrentState()
    },

    updateSetInPlace(loggedActivityId: string, updatedSet: LoggedSet) {
      set((state) => {
        const updatedGroups = state.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== loggedActivityId) return activity
            return {
              ...activity,
              sets: activity.sets.map((s) => (s.id === updatedSet.id ? updatedSet : s)),
            }
          }),
        }))

        return {
          loggedGroups: updatedGroups,
          undoAction: {
            setId: updatedSet.id,
            loggedActivityId,
            expiresAt: Date.now() + UNDO_WINDOW_MS,
          },
        }
      })
    },

    undoLastSet() {
      const state = get()
      if (!state.undoAction) return

      const { setId, loggedActivityId } = state.undoAction

      set((prev) => ({
        loggedGroups: prev.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== loggedActivityId) return activity
            return {
              ...activity,
              sets: activity.sets.filter((s) => s.id !== setId),
            }
          }),
        })),
        undoAction: null,
      }))
    },

    deleteSet(loggedActivityId: string, setId: string) {
      if (!loggedActivityId || !setId) {
        console.warn('[active-workout] deleteSet called with missing ids')
        return
      }
      set((state) => ({
        loggedGroups: state.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== loggedActivityId) return activity
            return { ...activity, sets: activity.sets.filter((s) => s.id !== setId) }
          }),
        })),
        undoAction: state.undoAction?.setId === setId ? null : state.undoAction,
      }))
    },

    unconfirmSet(loggedActivityId: string, setId: string) {
      if (!loggedActivityId || !setId) {
        console.warn('[active-workout] unconfirmSet called with missing ids')
        return
      }
      set((prev) => ({
        loggedGroups: prev.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== loggedActivityId) return activity
            return {
              ...activity,
              sets: activity.sets.map((s) => (s.id === setId ? { ...s, completed: false } : s)),
            }
          }),
        })),
        undoAction: prev.undoAction?.setId === setId ? null : prev.undoAction,
      }))
      _publishCurrentState()
    },

    clearUndo() {
      set({ undoAction: null })
    },

    // ------------------------------------------------------------------
    // Rest timer
    // ------------------------------------------------------------------

    startRestTimer(
      seconds: number,
      exerciseName?: string,
      setNumber?: number,
      onExpired?: () => void,
    ) {
      // Clear any existing rest interval / Tauri listeners
      if (_restInterval) clearInterval(_restInterval)
      _cleanupTauriRestListeners()

      const startedAt = Date.now()
      set({
        restTimer: { remaining: seconds, total: seconds, startedAt },
      })
      _publishCurrentState()

      _onRestExpired = onExpired ?? null

      if (isTauri()) {
        // Rust-backed timer: register listeners BEFORE invoking the command
        // to avoid missing early tick/expired events.
        Promise.all([
          listen<{ remaining: number; total: number }>('timer_tick', (event) => {
            set((state) => ({
              restTimer: state.restTimer
                ? {
                    ...state.restTimer,
                    remaining: event.payload.remaining,
                    total: event.payload.total,
                  }
                : null,
            }))
          }).then((fn) => {
            _unlistenTick = fn
          }),
          listen<void>('timer_expired', () => {
            _onRestExpired?.()
            _onRestExpired = null
            _cleanupTauriRestListeners()
            set({ restTimer: null })
            _publishCurrentState()
          }).then((fn) => {
            _unlistenExpired = fn
          }),
        ])
          .then(() => {
            invoke('start_rest_timer', {
              seconds,
              exerciseName: exerciseName ?? null,
              setNumber: setNumber ?? null,
            }).catch((err) => {
              console.error('[rest-timer] Failed to start Rust timer:', err)
              set({ restTimer: null })
              _cleanupTauriRestListeners()
            })
          })
          .catch((err) => {
            console.error('[rest-timer] Failed to register listeners:', err)
            set({ restTimer: null })
          })
      } else {
        // Browser path: JS setInterval
        _restInterval = setInterval(() => {
          get().tickRest()
        }, 1000)
      }
    },

    skipRest() {
      if (isTauri()) {
        invoke('skip_rest_timer').catch((err) => {
          console.error('[rest-timer] Failed to skip:', err)
        })
        _cleanupTauriRestListeners()
      } else {
        if (_restInterval) {
          clearInterval(_restInterval)
          _restInterval = null
        }
      }
      _onRestExpired = null
      set({ restTimer: null })
      _publishCurrentState()
    },

    adjustRest(delta: number) {
      if (isTauri()) {
        invoke('adjust_rest_timer', { delta }).catch((err) => {
          console.error('[rest-timer] Failed to adjust:', err)
        })
      }
      // Update local state immediately for responsive UI in both paths.
      // In Tauri mode, the next timer_tick event (~1s) will carry the
      // Rust-adjusted values, which may briefly differ from this optimistic
      // update before converging.
      set((state) => {
        if (!state.restTimer) return {}
        const { total, startedAt } = state.restTimer
        // For positive delta: extend total so remaining grows.
        // For negative delta: shift startedAt earlier so elapsed increases and remaining
        // shrinks -- total is unchanged. Note: Rust saturates via checked_sub on started_at;
        // JS saturates via Math.max on remaining (startedAt may be over-shifted in state).
        const newTotal = delta >= 0 ? total + delta : total
        const newStartedAt = delta < 0 ? startedAt - (-delta) * 1000 : startedAt
        const newRemaining = Math.max(
          0,
          Math.round(newTotal - (Date.now() - newStartedAt) / 1000),
        )
        return {
          restTimer: { ...state.restTimer, total: newTotal, startedAt: newStartedAt, remaining: newRemaining },
        }
      })
      _publishCurrentState()
    },

    // ------------------------------------------------------------------
    // Timer ticks
    // ------------------------------------------------------------------

    setElapsedSeconds(seconds: number) {
      set({ elapsedSeconds: seconds })
    },

    // ------------------------------------------------------------------
    // Notes (F020)
    // ------------------------------------------------------------------

    setSessionNote(content: NoteContent) {
      const parsed = noteContentSchema.safeParse(content)
      if (!parsed.success) {
        console.warn(
          '[active-workout] setSessionNote rejected invalid content:',
          parsed.error.issues,
        )
        return
      }
      const state = get()
      if (!state.workoutLog) {
        console.warn('[active-workout] setSessionNote called with no active workoutLog')
        return
      }
      set({
        workoutLog: {
          ...state.workoutLog,
          overallNotes: parsed.data.text,
          noteTags: parsed.data.tags,
        },
      })
      _publishCurrentState()
    },

    setActivityNote(activityId: string, content: NoteContent) {
      const parsed = noteContentSchema.safeParse(content)
      if (!parsed.success) {
        console.warn(
          '[active-workout] setActivityNote rejected invalid content:',
          parsed.error.issues,
        )
        return
      }
      let found = false
      set((state) => ({
        loggedGroups: state.loggedGroups.map((group) => ({
          ...group,
          activities: group.activities.map((activity) => {
            if (activity.id !== activityId) return activity
            found = true
            return {
              ...activity,
              notes: parsed.data.text,
              noteTags: parsed.data.tags,
            }
          }),
        })),
      }))
      if (!found) {
        console.warn('[active-workout] setActivityNote: activity not found', activityId)
        return
      }
      _publishCurrentState()
    },

    tickRest() {
      const state = get()
      if (!state.restTimer) return

      const newRemaining = Math.max(
        0,
        Math.round(state.restTimer.total - (Date.now() - state.restTimer.startedAt) / 1000),
      )

      if (newRemaining <= 0) {
        // Rest complete -- auto-skip
        try {
          _onRestExpired?.()
        } catch (err) {
          console.error('[rest-timer] onExpired callback threw:', err)
        } finally {
          _onRestExpired = null
          if (_restInterval) {
            clearInterval(_restInterval)
            _restInterval = null
          }
          set({ restTimer: null })
          _publishCurrentState()
        }
        return
      }

      set({
        restTimer: { ...state.restTimer, remaining: newRemaining },
      })
    },

    recalcRestTimer() {
      const state = get()
      if (!state.restTimer) return

      const { total, startedAt } = state.restTimer
      const newRemaining = Math.max(0, Math.round(total - (Date.now() - startedAt) / 1000))

      if (newRemaining <= 0) {
        // Mirror skipRest: stop Rust timer and clean listeners (Tauri), or clear JS interval.
        if (isTauri()) {
          invoke('skip_rest_timer').catch((err) => {
            console.error('[rest-timer] Failed to cancel expired timer:', err)
          })
          _cleanupTauriRestListeners()
        } else {
          if (_restInterval) {
            clearInterval(_restInterval)
            _restInterval = null
          }
        }
        try {
          _onRestExpired?.()
        } catch (err) {
          console.error('[rest-timer] onExpired callback threw:', err)
        } finally {
          _onRestExpired = null
          set({ restTimer: null })
          _publishCurrentState()
        }
        return
      }

      set({ restTimer: { ...state.restTimer, remaining: newRemaining } })
      _publishCurrentState()
    },

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    cleanup() {
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
      _onRestExpired = null
    },
  }),
)

// ---------------------------------------------------------------------------
// Selectors (derived computed values, not stored in state)
// ---------------------------------------------------------------------------

export const selectIsActive = (state: ActiveWorkoutState): boolean => state.workoutLog !== null
