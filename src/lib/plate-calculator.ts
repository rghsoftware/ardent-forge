// src/lib/plate-calculator.ts
// Pure functions for plate-loadable weight calculation.
// Per invariant PR-3: weights always round DOWN to the nearest plate increment
// (5 lb for imperial, 2.5 kg for metric).

export const PLATE_INCREMENT_LB = 5
export const PLATE_INCREMENT_KG = 2.5

/**
 * Round a weight down to the nearest plate-loadable increment.
 * Uses floor division so weights always round DOWN (conservative).
 */
export function roundToPlates(targetWeight: number, unit: 'lb' | 'kg'): number {
  if (targetWeight < 0) return 0
  const increment = unit === 'lb' ? PLATE_INCREMENT_LB : PLATE_INCREMENT_KG
  return Math.floor(targetWeight / increment) * increment
}

/**
 * Calculate a working weight from a 1RM and percentage, then round down to
 * the nearest plate increment.
 */
export function calculateWorkingWeight(
  oneRepMax: number,
  percentage: number,
  unit: 'lb' | 'kg',
): number {
  if (oneRepMax <= 0 || percentage <= 0) return 0
  const raw = oneRepMax * (percentage / 100)
  return roundToPlates(raw, unit)
}
