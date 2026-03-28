// src/lib/set-variance.ts
// Pure utilities for comparing actual performance against prescribed targets.

// ---------------------------------------------------------------------------
// parseNumeric
// ---------------------------------------------------------------------------

/**
 * Parse a string like "120 lb" or "5" to extract the leading numeric value.
 * Returns NaN if no number can be extracted.
 */
export function parseNumeric(value: string | undefined): number {
  if (!value) return NaN
  const match = value.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : NaN
}

// ---------------------------------------------------------------------------
// computeVariance
// ---------------------------------------------------------------------------

/**
 * Compare actual performance against a prescription.
 *
 * Returns:
 * - 'met'   if actual >= prescribed for every prescribed dimension
 * - 'under' if any prescribed dimension was missed or has no actual value
 * - null    if no prescription exists or comparison is not possible
 */
export function computeVariance(
  prescribedWeight: string | undefined,
  prescribedReps: string | undefined,
  actualWeight: string | undefined,
  actualReps: string | undefined,
): 'met' | 'under' | null {
  const pw = parseNumeric(prescribedWeight)
  const pr = parseNumeric(prescribedReps)
  const aw = parseNumeric(actualWeight)
  const ar = parseNumeric(actualReps)

  // If no prescription at all, return null
  if (isNaN(pw) && isNaN(pr)) return null

  // If prescribed dimension has no actual value, that's 'under'
  if (!isNaN(pw) && isNaN(aw)) return 'under'
  if (!isNaN(pr) && isNaN(ar)) return 'under'

  // Both missing actual
  if (isNaN(aw) && isNaN(ar)) return null

  // Check if met
  const weightMet = isNaN(pw) || aw >= pw
  const repsMet = isNaN(pr) || ar >= pr
  return weightMet && repsMet ? 'met' : 'under'
}
