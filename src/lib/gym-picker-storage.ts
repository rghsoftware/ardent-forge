// ---------------------------------------------------------------------------
// Gym picker sticky-default storage (F018, D8)
//
// The workout-start gym picker remembers the user's last selection so the
// common case is a single tap. The sticky default lives in localStorage on
// the publishing device; cross-device sync is deferred (RD-6, W).
//
// Stored value is either:
//   - a gym UUID (string)
//   - the literal string 'private' (one-off private workout)
//
// All access goes through this module so error handling stays consistent.
// localStorage can throw in environments where it is unavailable (e.g.,
// Safari private mode, quota exceeded, sandboxed iframe). All catch blocks
// log with the `[gym-picker]` prefix per .claude/rules/error-handling.md.
//
// BOTH `readLastGymChoice` AND `writeLastGymChoice` validate against
// `isValidChoice` at the module boundary per .claude/rules/state-management.md
// (Module-State Setter Validation). This file is listed as a canonical
// example in that rule -- garbage cannot enter OR leave the storage
// boundary even if a future caller bypasses upstream validation.
// ---------------------------------------------------------------------------

export const GYM_PICKER_STORAGE_KEY = 'ardent_forge_last_gym_choice'
// Backwards-compatible alias retained until call sites migrate (P14-045).
export const KEY = GYM_PICKER_STORAGE_KEY

/**
 * The user's last gym picker selection. Either a gym UUID or the literal
 * string 'private' (one-off private workout, no broadcast).
 */
export type GymPickerChoice = string | 'private'

// UUID v4-ish shape: 8-4-4-4-12 hex characters. Lenient on the version
// nibble (Postgres gen_random_uuid() emits v4 but we don't strictly require
// it); strict enough that arbitrary garbage is rejected.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidChoice(raw: string): raw is GymPickerChoice {
  return raw === 'private' || UUID_RE.test(raw)
}

/**
 * Read the last gym choice from localStorage. Returns null if no value is
 * stored, if the stored value is not a valid choice, or if localStorage is
 * unavailable.
 *
 * P14-006: validates the stored value at the storage boundary so garbage
 * (`'undefined'`, empty string, serialized null, manually-edited junk)
 * cannot be cast as `GymPickerChoice` and propagated downstream. Mirrors
 * the project's "Zustand store boundary validation" rule applied to
 * localStorage. The picker still re-validates UUIDs against the live
 * membership list.
 */
export function readLastGymChoice(): GymPickerChoice | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(GYM_PICKER_STORAGE_KEY)
  } catch (err) {
    console.warn('[gym-picker] Failed to read last choice:', err)
    return null
  }
  if (raw === null || raw === '') return null
  if (!isValidChoice(raw)) {
    console.warn(
      `[gym-picker] Discarding invalid stored choice: ${JSON.stringify(raw)}. ` +
        'Expected "private" or a UUID; falling back to null.',
    )
    return null
  }
  return raw
}

/**
 * Persist the user's gym picker selection to localStorage. Returns `true`
 * on success and `false` if the write failed (e.g., quota exceeded, Safari
 * private mode). Callers can branch on the result to surface a one-off
 * "could not save preference" toast (P14-014). The current workout still
 * proceeds normally regardless -- the sticky default is a convenience, not
 * a correctness boundary.
 *
 * Validates against `isValidChoice` at the module boundary so a future
 * caller cannot quietly bypass upstream validation
 * (.claude/rules/state-management.md). See P14-006 / module header.
 */
export function writeLastGymChoice(choice: GymPickerChoice): boolean {
  if (!isValidChoice(choice)) {
    console.error(`[gym-picker] Refusing to persist invalid choice: ${JSON.stringify(choice)}`)
    return false
  }
  try {
    localStorage.setItem(GYM_PICKER_STORAGE_KEY, choice)
    return true
  } catch (err) {
    console.warn('[gym-picker] Failed to write last choice:', err)
    return false
  }
}
