// ---------------------------------------------------------------------------
// display-setup.ts -- derives default names for personal display auto-gyms
//
// Pure module. Used by the /display dispatcher's zero-gym Panel B CTA and
// the 2+-gym chooser's "Start a personal display" row to name the auto-
// created gym without asking the user to type one.
//
// The code-point clamp is derived from the SQL/Zod constraint (GYM_NAME_MAX)
// minus the derived suffix length, so the result always fits within
// `gyms.name` without needing an independent magic number. The clamp
// iterates code points (not code units) so emoji / grapheme clusters at
// the boundary do not get split into a surrogate half.
// ---------------------------------------------------------------------------

import { GYM_NAME_MAX } from '@/domain/types/gym'

const FALLBACK_NAME = 'My Training'
const NAME_SUFFIX = "'s Training"
// P15-008: Derived from the shared `GYM_NAME_MAX` constant so a future
// refactor that changes NAME_SUFFIX cannot silently push the derived name
// past the `gyms.name` check constraint (currently 60 - 11 = 49).
const DISPLAY_NAME_MAX_CODE_POINTS = GYM_NAME_MAX - NAME_SUFFIX.length

/**
 * Derives a default gym name for the "personal display" flow.
 *
 *   - `"Alice Smith"`                 → `"Alice Smith's Training"`
 *   - `""` / null / undefined / `" "` → `"My Training"`
 *   - 100-char input                   → 49 code-point prefix + `"'s Training"`
 *
 * The clamp keeps the derived name within the `gyms.name` SQL check
 * constraint (GYM_NAME_MAX) by reserving room for the suffix.
 */
export function derivePersonalGymName(displayName: string | null | undefined): string {
  if (displayName == null) return FALLBACK_NAME
  const trimmed = displayName.trim()
  if (trimmed === '') return FALLBACK_NAME

  // Code-point iteration via spread -- handles surrogate pairs correctly
  // where `.length` and `.slice()` would split an emoji mid-pair.
  const codePoints = [...trimmed]
  const clamped =
    codePoints.length > DISPLAY_NAME_MAX_CODE_POINTS
      ? codePoints.slice(0, DISPLAY_NAME_MAX_CODE_POINTS).join('')
      : trimmed

  return `${clamped}${NAME_SUFFIX}`
}
