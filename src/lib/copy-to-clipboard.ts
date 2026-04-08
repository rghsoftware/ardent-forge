import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// copy-to-clipboard.ts -- shared clipboard helper
//
// Wraps `navigator.clipboard.writeText` with toast feedback and the
// `[module-name]` console.error logging required by `.claude/rules/
// error-handling.md`. Returns a Promise<boolean> so callers can chain on
// success (e.g., close a dialog on copy success) or await both branches.
//
// Four existing call sites currently inline this try/catch/log/toast
// pattern (`backend-settings.tsx`, `share-dialog.tsx`, `invite-code-
// display.tsx`); F019 introduces a fifth at the display setup panel, so
// the helper is earned. Existing call sites can migrate opportunistically.
// ---------------------------------------------------------------------------

export interface CopyOptions {
  /** Toast message shown on success (required — silent success is confusing). */
  successMessage: string
  /** Toast message shown on failure (required — silent failure violates rules). */
  failureMessage: string
  /** Module prefix for console error logging. Defaults to 'clipboard'. */
  logPrefix?: string
}

/**
 * Writes the given text to the clipboard via `navigator.clipboard.writeText`
 * and surfaces toast feedback on both branches. On failure, logs via
 * `console.error` with a bracketed module prefix (defaults to `[clipboard]`).
 *
 * Returns `true` on success and `false` on failure so callers can chain
 * additional behavior (for example, transitioning state on success only).
 */
export async function copyToClipboard(text: string, options: CopyOptions): Promise<boolean> {
  const prefix = options.logPrefix ?? 'clipboard'
  try {
    await navigator.clipboard.writeText(text)
    toast(options.successMessage)
    return true
  } catch (err) {
    console.error(`[${prefix}] Failed to write to clipboard:`, err)
    toast(options.failureMessage)
    return false
  }
}
