import { create } from 'zustand'
import type {
  WorkoutLog,
  LoggedActivityGroup,
  LoggedActivity,
  LoggedSet,
  Exercise,
  GroupType,
} from '@/domain/types'

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

  // Internal interval refs (non-reactive plumbing)
  _elapsedInterval: ReturnType<typeof setInterval> | null
  _restInterval: ReturnType<typeof setInterval> | null
}

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
  setWorkoutFromDb(
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
  adjustRest(newTotal: number): void

  // Timer ticks (called by intervals internally)
  tickElapsed(): void
  tickRest(): void
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
  _elapsedInterval: null,
  _restInterval: null,
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
      const interval = setInterval(() => {
        get().tickElapsed()
      }, 1000)

      set({
        workoutLog,
        loggedGroups: [],
        elapsedSeconds: 0,
        restTimer: null,
        undoAction: null,
        _elapsedInterval: interval,
        _restInterval: null,
      })
    },

    resumeWorkout(
      workoutLog: WorkoutLog,
      groups: LoggedActivityGroupWithActivities[],
      elapsedSeconds: number,
    ) {
      // Clear any existing intervals
      const state = get()
      if (state._elapsedInterval) clearInterval(state._elapsedInterval)
      if (state._restInterval) clearInterval(state._restInterval)

      const interval = setInterval(() => {
        get().tickElapsed()
      }, 1000)

      set({
        workoutLog,
        loggedGroups: groups,
        elapsedSeconds,
        restTimer: null,
        undoAction: null,
        _elapsedInterval: interval,
        _restInterval: null,
      })
    },

    setWorkoutFromDb(
      workoutLog: WorkoutLog,
      groups: LoggedActivityGroupWithActivities[],
      elapsedSeconds: number,
    ) {
      // Alias for resumeWorkout -- used for internal hydration from DB
      get().resumeWorkout(workoutLog, groups, elapsedSeconds)
    },

    finishWorkout() {
      const state = get()
      if (state._elapsedInterval) clearInterval(state._elapsedInterval)
      if (state._restInterval) clearInterval(state._restInterval)
      set({ ...initialState })
    },

    discardWorkout() {
      const state = get()
      if (state._elapsedInterval) clearInterval(state._elapsedInterval)
      if (state._restInterval) clearInterval(state._restInterval)
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
            expiresAt: Date.now() + 10_000,
          },
        }
      })

      // Auto-start rest timer with default 90s
      // The bridge hook can override this with a specific duration
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
      const state = get()
      // Clear any existing rest interval
      if (state._restInterval) clearInterval(state._restInterval)

      const interval = setInterval(() => {
        get().tickRest()
      }, 1000)

      set({
        restTimer: { remaining: seconds, total: seconds },
        _restInterval: interval,
      })
    },

    skipRest() {
      const state = get()
      if (state._restInterval) clearInterval(state._restInterval)
      set({ restTimer: null, _restInterval: null })
    },

    adjustRest(newTotal: number) {
      const state = get()
      if (state._restInterval) clearInterval(state._restInterval)

      const interval = setInterval(() => {
        get().tickRest()
      }, 1000)

      set({
        restTimer: { remaining: newTotal, total: newTotal },
        _restInterval: interval,
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
        if (state._restInterval) clearInterval(state._restInterval)
        set({ restTimer: null, _restInterval: null })
        return
      }

      set({
        restTimer: { ...state.restTimer, remaining: newRemaining },
      })
    },
  }),
)

// ---------------------------------------------------------------------------
// Selectors (derived computed values, not stored in state)
// ---------------------------------------------------------------------------

export const selectIsActive = (state: ActiveWorkoutState): boolean => state.workoutLog !== null

export const selectActiveExercises = (state: ActiveWorkoutState): LoggedActivityWithSets[] =>
  state.loggedGroups.flatMap((group) => group.activities)
