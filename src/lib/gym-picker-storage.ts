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
// ---------------------------------------------------------------------------

export const KEY = 'ardent_forge_last_gym_choice'

/**
 * The user's last gym picker selection. Either a gym UUID or the literal
 * string 'private' (one-off private workout, no broadcast).
 */
export type GymPickerChoice = string | 'private'

/**
 * Read the last gym choice from localStorage. Returns null if no value is
 * stored or if localStorage is unavailable. The picker is responsible for
 * validating that a stored UUID still corresponds to a current gym
 * membership; this function does not perform that check.
 */
export function readLastGymChoice(): GymPickerChoice | null {
  try {
    const raw = localStorage.getItem(KEY)
    return (raw as GymPickerChoice | null) || null
  } catch (err) {
    console.warn('[gym-picker] Failed to read last choice:', err)
    return null
  }
}

/**
 * Persist the user's gym picker selection to localStorage. Silently
 * tolerates failures (e.g., quota exceeded) -- the picker still works in
 * the current session, the user just loses the sticky default next time.
 */
export function writeLastGymChoice(choice: GymPickerChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch (err) {
    console.warn('[gym-picker] Failed to write last choice:', err)
  }
}
