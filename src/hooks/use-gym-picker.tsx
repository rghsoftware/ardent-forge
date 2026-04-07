import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { GymPickerSheet } from '@/components/workout/gym-picker-sheet'
import type { GymPickerChoice } from '@/lib/gym-picker-storage'

// ---------------------------------------------------------------------------
// useGymPicker -- imperative promise-based wrapper around GymPickerSheet
// (F018, Tech.md D11)
//
// The picker is the gating step for every workout start. The start-workout
// callback needs to await a user decision before creating the workout_log
// row, which reads naturally as:
//
//   const choice = await openGymPicker({ userId })
//   if (choice === null) return
//   configureDisplayPublisher({ gymId: choice === 'private' ? null : choice })
//
// This hook keeps the picker state local to a top-level mount point in the
// route tree (typically the `_authenticated` layout) and exposes:
//
//   - openGymPicker(args) -- returns Promise<GymPickerChoice | null>
//   - GymPickerPortal      -- a component that renders the picker sheet
//
// Calling `openGymPicker` twice in sequence is supported: the first call's
// promise resolves with `null` (effectively cancelled) and the second call
// opens the sheet fresh. This keeps the hook resilient to a double-tapped
// Start Workout button without leaking pending promises.
//
// This file is `.tsx` rather than `.ts` because `GymPickerPortal` returns
// JSX; the hook itself is otherwise standard React hook territory.
// ---------------------------------------------------------------------------

interface OpenGymPickerArgs {
  /** The user whose gym memberships should populate the picker. */
  userId: string
}

interface UseGymPickerResult {
  /**
   * Imperatively open the gym picker and await the user's choice. Resolves
   * with a gym UUID, the literal `'private'`, or `null` if the user
   * cancelled (outside click, Escape, or a second `openGymPicker` call
   * replacing this one).
   *
   * Calling this function while a picker is already open resolves the
   * previous promise with `null` and opens the picker fresh with the new
   * args.
   */
  openGymPicker: (args: OpenGymPickerArgs) => Promise<GymPickerChoice | null>
  /**
   * Portal component -- mount this once near the top of the route tree
   * (e.g., inside the `_authenticated` layout) so the picker can be opened
   * from any descendant. Returns `null` when the picker is closed.
   */
  GymPickerPortal: () => ReactElement | null
}

interface PickerState {
  userId: string
  resolver: (choice: GymPickerChoice | null) => void
}

export function useGymPicker(): UseGymPickerResult {
  const [state, setState] = useState<PickerState | null>(null)
  // Store the current state in a ref so event handlers always see the
  // latest value without needing to re-bind on every render, and so that
  // a second openGymPicker call can read (and cancel) any in-flight
  // resolver before scheduling a React state update.
  //
  // React 19 forbids mutating refs during render (react-hooks/refs).
  // The useEffect-based update runs after commit, which is still "before"
  // any subsequent openGymPicker or user interaction because render +
  // commit + effect all flush before the browser hands control back to
  // the user. Both the single-open and double-open flows rely on this
  // commit ordering, not on the mutation happening inside render.
  const stateRef = useRef<PickerState | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const openGymPicker = useCallback((args: OpenGymPickerArgs): Promise<GymPickerChoice | null> => {
    // If a picker is already open, cancel the previous promise before
    // opening the new one. This keeps double-tap / race scenarios from
    // leaving a pending promise hanging forever.
    const prior = stateRef.current
    if (prior) {
      prior.resolver(null)
    }

    return new Promise<GymPickerChoice | null>((resolve) => {
      setState({ userId: args.userId, resolver: resolve })
    })
  }, [])

  const handleResolve = useCallback((choice: GymPickerChoice) => {
    const current = stateRef.current
    if (!current) return
    current.resolver(choice)
    setState(null)
  }, [])

  const handleCancel = useCallback(() => {
    const current = stateRef.current
    if (!current) return
    current.resolver(null)
    setState(null)
  }, [])

  const GymPickerPortal = useCallback((): ReactElement | null => {
    if (!state) return null
    return (
      <GymPickerSheet
        open
        userId={state.userId}
        onResolve={handleResolve}
        onCancel={handleCancel}
      />
    )
  }, [state, handleResolve, handleCancel])

  return { openGymPicker, GymPickerPortal }
}
