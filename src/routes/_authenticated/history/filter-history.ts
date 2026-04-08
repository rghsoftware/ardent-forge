import type { WorkoutLogSummary } from '@/lib/data-adapter'

/**
 * Pure filter helper for the history list search input (F020).
 * Session-level scope only: matches on title, overallNotes, and noteTags.
 * Case-insensitive substring match, whitespace-trimmed query.
 */
export function filterHistoryBySessionNote(
  summaries: WorkoutLogSummary[],
  query: string,
): WorkoutLogSummary[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return summaries
  return summaries.filter((s) => {
    const { log } = s
    if (log.title && log.title.toLowerCase().includes(needle)) return true
    if (log.overallNotes && log.overallNotes.toLowerCase().includes(needle)) return true
    if (log.noteTags && log.noteTags.some((t) => t.toLowerCase().includes(needle))) return true
    return false
  })
}
