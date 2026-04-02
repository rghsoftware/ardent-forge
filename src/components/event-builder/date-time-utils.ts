export function splitDateTime(dateStr?: string): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' }
  // Plain YYYY-MM-DD (no time component)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { date: dateStr, time: '' }
  }
  // YYYY-MM-DDTHH:MM:SS (local time, no timezone) or full ISO-8601
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
  if (match) {
    return { date: match[1], time: `${match[2]}:${match[3]}` }
  }
  return { date: '', time: '' }
}

export function combineDateTime(date: string, time: string): string | undefined {
  if (!date) return undefined
  // Store as local date/time string to avoid UTC conversion shifting the calendar day.
  // Downstream consumers (Rust event_reminder, useNextUpcomingEvent) parse only the
  // YYYY-MM-DD portion, so omitting timezone info is safe and intentional.
  if (!time) return date // plain YYYY-MM-DD
  return `${date}T${time}:00`
}
