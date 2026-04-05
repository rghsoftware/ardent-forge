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
} from '@/domain/types'
import { UNDO_WINDOW_MS } from '@/lib/workout-utils'
import type { SnapshotContext } from '@/lib/display-snapshot'
import { buildDisplaySnapshot } from '@/lib/display-snapshot'
import { publishDisplaySnapshot, publishSessionEnded } from '@/lib/display-publisher'

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

interface UndoAction {
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
}

// ---------------------------------------------------------------------------
// Module-scope interval handles (kept outside Zustand to avoid re-renders)
// ---------------------------------------------------------------------------

let _elapsedInterval: ReturnType<typeof setInterval> | null = null
let _restInterval: ReturnType<typeof setInterval> | null = null

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

  // Exercise management
  addExerciseToWorkout(
    exercise: Exercise,
    groupType: GroupType,
    newGroup: LoggedActivityGroup,
    newActivity: LoggedActivity,
  ): void

  // Set management
  confirmSet(loggedActivityId: string, newSet: LoggedSet): void
  updateSetInPlace(loggedActivityId: string, updatedSet: LoggedSet): void
  undoLastSet(): void
  clearUndo(): void

  // Rest timer
  startRestTimer(seconds: number, exerciseName?: string, setNumber?: number): void
  skipRest(): void
  adjustRest(delta: number): void

  // Timer ticks (called by intervals internally)
  tickElapsed(): void
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

      // Start the elapsed timer
      if (_elapsedInterval) clearInterval(_elapsedInterval)
      _elapsedInterval = setInterval(() => {
        get().tickElapsed()
      }, 1000)

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
      if (!workoutLog.programContext) {
        throw new Error('startProgrammedWorkout requires a WorkoutLog with programContext')
      }

      const state = get()
      if (state.workoutLog !== null) {
        // Invariant L-8: only one active workout at a time
        throw new Error('Cannot start a new workout while one is already active')
      }

      // Start the elapsed timer
      if (_elapsedInterval) clearInterval(_elapsedInterval)
      _elapsedInterval = setInterval(() => {
        get().tickElapsed()
      }, 1000)

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
      // Clear any existing intervals
      if (_elapsedInterval) clearInterval(_elapsedInterval)
      if (_restInterval) clearInterval(_restInterval)
      _restInterval = null

      _elapsedInterval = setInterval(() => {
        get().tickElapsed()
      }, 1000)

      set({
        workoutLog,
        loggedGroups: groups,
        elapsedSeconds,
        restTimer: null,
        undoAction: null,
      })
    },

    finishWorkout() {
      if (_elapsedInterval) {
        clearInterval(_elapsedInterval)
        _elapsedInterval = null
      }
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
      if (_snapshotContext) publishSessionEnded(_snapshotContext.userId)
      set({ ...initialState })
    },

    discardWorkout() {
      if (_elapsedInterval) {
        clearInterval(_elapsedInterval)
        _elapsedInterval = null
      }
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
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

    clearUndo() {
      set({ undoAction: null })
    },

    // ------------------------------------------------------------------
    // Rest timer
    // ------------------------------------------------------------------

    startRestTimer(seconds: number, exerciseName?: string, setNumber?: number) {
      // Clear any existing rest interval / Tauri listeners
      if (_restInterval) clearInterval(_restInterval)
      _cleanupTauriRestListeners()

      set({
        restTimer: { remaining: seconds, total: seconds },
      })
      _publishCurrentState()

      if (isTauri()) {
        // Rust-backed timer: register listeners BEFORE invoking the command
        // to avoid missing early tick/expired events.
        Promise.all([
          listen<{ remaining: number }>('timer_tick', (event) => {
            set({
              restTimer: {
                remaining: event.payload.remaining,
                total: get().restTimer?.total ?? seconds,
              },
            })
          }).then((fn) => {
            _unlistenTick = fn
          }),
          listen<void>('timer_expired', () => {
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
        const newRemaining = Math.max(0, state.restTimer.remaining + delta)
        // For negative delta: only change remaining, not total (matches Rust behavior)
        const newTotal = delta >= 0 ? state.restTimer.total + delta : state.restTimer.total
        return {
          restTimer: {
            remaining: newRemaining,
            total: newTotal,
          },
        }
      })
      _publishCurrentState()
    },

    // ------------------------------------------------------------------
    // Timer ticks
    // ------------------------------------------------------------------

    tickElapsed() {
      set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }))
    },

    tickRest() {
      const state = get()
      if (!state.restTimer) return

      const newRemaining = state.restTimer.remaining - 1

      if (newRemaining <= 0) {
        // Rest complete -- auto-skip
        if (_restInterval) {
          clearInterval(_restInterval)
          _restInterval = null
        }
        set({ restTimer: null })
        _publishCurrentState()
        return
      }

      set({
        restTimer: { ...state.restTimer, remaining: newRemaining },
      })
    },

    // ------------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------------

    cleanup() {
      if (_elapsedInterval) {
        clearInterval(_elapsedInterval)
        _elapsedInterval = null
      }
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      _cleanupTauriRestListeners()
    },
  }),
)

// ---------------------------------------------------------------------------
// Selectors (derived computed values, not stored in state)
// ---------------------------------------------------------------------------

export const selectIsActive = (state: ActiveWorkoutState): boolean => state.workoutLog !== null
