import { create } from 'zustand'
import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  Exercise,
  GroupType,
} from '@/domain/types'
import { UNDO_WINDOW_MS } from '@/lib/workout-utils'

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

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface ActiveWorkoutActions {
  // Lifecycle
  startWorkout(userId: string, workoutLog: WorkoutLog): void
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
  undoLastSet(): void
  clearUndo(): void

  // Rest timer
  startRestTimer(seconds: number): void
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

    startRestTimer(seconds: number) {
      // Clear any existing rest interval
      if (_restInterval) clearInterval(_restInterval)

      _restInterval = setInterval(() => {
        get().tickRest()
      }, 1000)

      set({
        restTimer: { remaining: seconds, total: seconds },
      })
    },

    skipRest() {
      if (_restInterval) {
        clearInterval(_restInterval)
        _restInterval = null
      }
      set({ restTimer: null })
    },

    adjustRest(delta: number) {
      set((state) => {
        if (!state.restTimer) return {}
        return {
          restTimer: {
            ...state.restTimer,
            remaining: Math.max(0, state.restTimer.remaining + delta),
            total: Math.max(0, state.restTimer.total + delta),
          },
        }
      })
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
    },
  }),
)

// ---------------------------------------------------------------------------
// Selectors (derived computed values, not stored in state)
// ---------------------------------------------------------------------------

export const selectIsActive = (state: ActiveWorkoutState): boolean => state.workoutLog !== null
