/**
 * Shared workout constants and helpers.
 *
 * Centralises magic numbers, cardio mode definitions, and small pure functions
 * that were previously duplicated across workout components and the store.
 */

import type { Exercise, CardioModality } from '@/domain/types'

/** Undo window in milliseconds. Used by the store and undo banner. See docs/01-prd-core.md. */
export const UNDO_WINDOW_MS = 10_000

/** Default rest duration in seconds after a confirmed set. See docs/01-prd-core.md. */
export const DEFAULT_REST_SECONDS = 90

/** Default target reps for circuit exercises when none is prescribed. */
export const DEFAULT_CIRCUIT_REPS = 30

/** UI-facing cardio mode options mapped to domain CardioModality values. */
export const CARDIO_MODES: { modality: CardioModality; icon: string; label: string }[] = [
  { modality: 'RUNNING', icon: 'directions_run', label: 'RUN' },
  { modality: 'CYCLING', icon: 'pedal_bike', label: 'CYCLE' },
  { modality: 'SWIMMING', icon: 'pool', label: 'SWIM' },
  { modality: 'ROWING', icon: 'rowing', label: 'ROW' },
]

/**
 * Determine the display modality for an exercise within an activity group.
 *
 * Returns 'circuit' for circuit groups, 'ruck' for ruck exercises (by name or
 * equipment), 'cardio' for cardio exercises, 'standard' for everything else.
 */
export function getExerciseModality(
  exercise: Exercise | undefined,
  groupType: string,
): 'cardio' | 'ruck' | 'circuit' | 'standard' {
  if (groupType === 'CIRCUIT') return 'circuit'
  if (!exercise) return 'standard'
  if (exercise.category === 'CARDIO') {
    // Check if it's a ruck exercise by name or equipment
    const isRuck =
      exercise.name.toLowerCase().includes('ruck') ||
      exercise.equipmentRequired.includes('RUCK_PLATE') ||
      exercise.equipmentRequired.includes('WEIGHT_VEST')
    if (isRuck) return 'ruck'
    return 'cardio'
  }
  return 'standard'
}

/** Parse a string input to a positive number, or return undefined. */
export function parseNumericInput(value: string): number | undefined {
  const num = parseFloat(value)
  return !isNaN(num) && num > 0 ? num : undefined
}
