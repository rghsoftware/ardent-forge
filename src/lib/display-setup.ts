// ---------------------------------------------------------------------------
// display-setup.ts -- derives default names for personal display auto-gyms
//
// Pure module. Used by the /display dispatcher's zero-gym Panel B CTA and
// the 2+-gym chooser's "Start a personal display" row to name the auto-
// created gym without asking the user to type one.
//
// The 48-char clamp is load-bearing: the SQL check constraint on
// `gyms.name` is 1..60 chars, and the derived suffix ` 's Training` is
// 11 chars, so `48 + 11 = 59` fits safely. The clamp iterates code
// points (not code units) so emoji / grapheme clusters at the boundary
// do not get split into a surrogate half.
// ---------------------------------------------------------------------------

const DISPLAY_NAME_MAX_CODE_POINTS = 48
const FALLBACK_NAME = 'My Training'
const NAME_SUFFIX = "'s Training"

/**
 * Derives a default gym name for the "personal display" flow.
 *
 *   - `"Alice Smith"`                 → `"Alice Smith's Training"`
 *   - `""` / null / undefined / `" "` → `"My Training"`
 *   - 100-char input                   → 48 code-point prefix + `"'s Training"`
 *
 * The 48-char clamp keeps the derived name under the 60-char
 * `gyms.name` SQL check constraint (48 + len("'s Training") = 48 + 11 = 59).
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
