/**
 * Shared duration / time formatting utilities.
 *
 * Consolidates inline helpers that were duplicated across workout components
 * (cardio-panel, ruck-panel, circuit-panel, rest-timer-overlay,
 * crash-recovery-dialog, workout-summary, workout-header).
 */

/**
 * Format total seconds as MM:SS (under 1 hour) or HH:MM:SS (1 hour or more).
 *
 * Both minutes and seconds are zero-padded to two digits. When hours are
 * present the hours field is also zero-padded.
 *
 * @example formatDuration(0)    // "00:00"
 * @example formatDuration(59)   // "00:59"
 * @example formatDuration(90)   // "01:30"
 * @example formatDuration(3661) // "01:01:01"
 */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/**
 * Format seconds as a M:SS countdown string.
 *
 * Minutes are NOT zero-padded (single digit for values < 10).
 * Seconds are always zero-padded to two digits.
 *
 * @example formatCountdown(0)   // "0:00"
 * @example formatCountdown(90)  // "1:30"
 * @example formatCountdown(605) // "10:05"
 */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format a Date as a relative time string.
 *
 * @example formatTimeAgo(justNow)     // "just now"
 * @example formatTimeAgo(thirtyMinAgo) // "30m ago"
 * @example formatTimeAgo(twoHoursAgo)  // "2h ago"
 * @example formatTimeAgo(yesterday)    // "yesterday"
 * @example formatTimeAgo(threeDaysAgo) // "3d ago"
 */
export function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

/**
 * Format a Date as a short uppercase date label.
 *
 * @example formatDateLabel(new Date('2026-03-27')) // "THU, MAR 27"
 */
export function formatDateLabel(date: Date): string {
  return date
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase()
}

/**
 * Compute pace as M:SS per unit (e.g. per mile or per km).
 *
 * Returns "--" if distance or duration is zero/invalid.
 *
 * @param durationSeconds  Total elapsed seconds.
 * @param distance         Numeric distance value (parsed from string internally
 *                         when called from components that hold distance as a
 *                         string -- callers should pass the already-parsed number
 *                         or use {@link computePaceFromString}).
 */
export function computePace(durationSeconds: number, distance: number): string {
  if (!distance || distance <= 0 || durationSeconds <= 0) return '--'
  const minutesPerUnit = durationSeconds / 60 / distance
  const paceMin = Math.floor(minutesPerUnit)
  const paceSec = Math.round((minutesPerUnit - paceMin) * 60)
  return `${paceMin}:${String(paceSec).padStart(2, '0')}`
}

/**
 * Convenience wrapper around {@link computePace} that accepts the distance as
 * a raw string (as stored in component state). Parses via `parseFloat` and
 * delegates to the numeric variant.
 */
export function computePaceFromString(durationSeconds: number, distanceStr: string): string {
  const dist = parseFloat(distanceStr)
  return computePace(durationSeconds, dist)
}
