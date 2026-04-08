import { z } from 'zod'

// ---------------------------------------------------------------------------
// display-url.ts -- display URL parser, builder, and dev-origin detection
//
// Pure module with zero runtime dependencies on React, Tauri, or globals.
// Exported from F019 for:
//   - The 0-gym setup panel (parses pasted URLs / scanned QR content)
//   - The profile Show-display inline panel (builds the canonical URL)
//   - The dev-origin warning caption beneath the URL
// ---------------------------------------------------------------------------

/**
 * Strict UUID validation. Matches the validation used in
 * `src/routes/display/gym/$gymId.tsx` so the parser rejects input that
 * would trip the TV route's own guard. Uses the Zod 4 top-level
 * `z.uuid()` API rather than the deprecated `z.string().uuid()`.
 */
const uuidSchema = z.uuid()

export type ParseResult =
  | { ok: true; gymId: string }
  | { ok: false; reason: 'empty' | 'malformed' | 'not-a-uuid' }

/**
 * Normalizes a user-provided string into a gym UUID. Accepts:
 *   - `https://any-origin/display/gym/{uuid}`
 *   - `/display/gym/{uuid}` (path-only)
 *   - bare `{uuid}`
 *
 * Strips trailing slashes, query strings, and fragments before extracting
 * the UUID. Rejects empty input, malformed URL shapes, and tails that are
 * not valid UUIDs.
 */
export function parseDisplayUrlInput(raw: string): ParseResult {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { ok: false, reason: 'empty' }
  }

  // Strip query string and fragment regardless of input shape. The UUID
  // always precedes both in the canonical URL form.
  const withoutFragment = trimmed.split('#')[0]!
  const withoutQuery = withoutFragment.split('?')[0]!
  const withoutTrailingSlash = withoutQuery.replace(/\/+$/, '')

  if (withoutTrailingSlash === '') {
    return { ok: false, reason: 'empty' }
  }

  // Bare UUID path: no slashes at all.
  if (!withoutTrailingSlash.includes('/')) {
    const result = uuidSchema.safeParse(withoutTrailingSlash)
    return result.success ? { ok: true, gymId: result.data } : { ok: false, reason: 'not-a-uuid' }
  }

  // Full URL or path-only: the UUID is the last segment, and the preceding
  // segments must match `display/gym`.
  const segments = withoutTrailingSlash.split('/').filter((s) => s.length > 0)
  if (segments.length < 3) {
    return { ok: false, reason: 'malformed' }
  }
  const [last, parent, grandparent] = [
    segments[segments.length - 1]!,
    segments[segments.length - 2]!,
    segments[segments.length - 3]!,
  ]
  if (parent !== 'gym' || grandparent !== 'display') {
    return { ok: false, reason: 'malformed' }
  }

  const result = uuidSchema.safeParse(last)
  return result.success ? { ok: true, gymId: result.data } : { ok: false, reason: 'not-a-uuid' }
}

/**
 * Builds a canonical display URL for a given gym ID. The `origin` argument
 * is passed in by the caller (not read from a global) so the function stays
 * pure and unit-testable.
 *
 * Returns `null` when `origin` is null so the caller (ShowDisplayPanel) can
 * branch into the D22 backfill form instead of rendering a broken URL.
 *
 * Callers resolve origin as follows:
 *   - Web:   `window.location.origin`
 *   - Tauri: `config.appUrl` from the persisted BackendConfig
 */
export function buildDisplayUrl(gymId: string, origin: string | null): string | null {
  if (origin === null) return null
  // Strip trailing slashes so `${origin}/display/gym/${id}` never doubles up.
  const cleanOrigin = origin.replace(/\/+$/, '')
  return `${cleanOrigin}/display/gym/${gymId}`
}

/**
 * True when an origin string looks like a development loopback URL
 * (`localhost`, `127.0.0.1`, `[::1]`). Used for the dev-origin warning
 * caption in `ShowDisplayPanel` (Spec.md M24/TA21).
 *
 * Accepts both bare hosts and full origin URLs. Returns false on parse
 * failure (non-URL strings without a recognizable loopback substring).
 */
export function isDevOrigin(origin: string): boolean {
  const trimmed = origin.trim().toLowerCase()
  if (trimmed === '') return false

  // Try parsing as URL first -- this correctly handles IPv6 `[::1]` and
  // non-standard ports.
  try {
    const url = new URL(trimmed)
    const host = url.hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
  } catch {
    // Not a full URL -- check for loopback substrings directly.
    return (
      trimmed.startsWith('localhost') ||
      trimmed.startsWith('127.0.0.1') ||
      trimmed.startsWith('[::1]') ||
      trimmed === '::1'
    )
  }
}
