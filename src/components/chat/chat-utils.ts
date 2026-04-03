// ---------------------------------------------------------------------------
// Pure utility functions shared across chat components and their tests.
// Extracted to avoid react-refresh/only-export-components lint errors.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Relative timestamp (conversation list)
// ---------------------------------------------------------------------------

export function relativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`

  // Beyond a week, show short date (e.g. "Apr 1")
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Initials from display name (conversation list, participant sheet)
// ---------------------------------------------------------------------------

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return (parts[0][0]?.toUpperCase() ?? '') + (parts[parts.length - 1][0]?.toUpperCase() ?? '')
}

// ---------------------------------------------------------------------------
// Typing indicator text formatting
// ---------------------------------------------------------------------------

export function formatTypingText(
  users: Array<{ userId: string; userName: string }>,
): string {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].userName} is typing`
  if (users.length === 2) return `${users[0].userName} and ${users[1].userName} are typing`
  return `${users.length} people are typing`
}
