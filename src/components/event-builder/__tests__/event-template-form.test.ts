import { describe, it, expect } from 'vitest'
import { splitDateTime, combineDateTime } from '../date-time-utils'

// ===========================================================================
// splitDateTime
// ===========================================================================

describe('splitDateTime', () => {
  it('returns empty strings for undefined input', () => {
    expect(splitDateTime(undefined)).toEqual({ date: '', time: '' })
  })

  it('returns empty strings for empty string input', () => {
    expect(splitDateTime('')).toEqual({ date: '', time: '' })
  })

  it('parses plain YYYY-MM-DD date (no time component)', () => {
    expect(splitDateTime('2026-04-15')).toEqual({ date: '2026-04-15', time: '' })
  })

  it('parses YYYY-MM-DDTHH:MM:SS local time', () => {
    expect(splitDateTime('2026-04-15T08:30:00')).toEqual({ date: '2026-04-15', time: '08:30' })
  })

  it('parses full ISO-8601 with timezone', () => {
    expect(splitDateTime('2026-04-15T08:30:00Z')).toEqual({ date: '2026-04-15', time: '08:30' })
  })

  it('parses ISO-8601 with offset', () => {
    expect(splitDateTime('2026-04-15T08:30:00-05:00')).toEqual({
      date: '2026-04-15',
      time: '08:30',
    })
  })

  it('returns empty strings for invalid format', () => {
    expect(splitDateTime('not-a-date')).toEqual({ date: '', time: '' })
  })

  it('handles midnight correctly', () => {
    expect(splitDateTime('2026-04-15T00:00:00')).toEqual({ date: '2026-04-15', time: '00:00' })
  })
})

// ===========================================================================
// combineDateTime
// ===========================================================================

describe('combineDateTime', () => {
  it('returns undefined for empty date', () => {
    expect(combineDateTime('', '')).toBeUndefined()
    expect(combineDateTime('', '08:30')).toBeUndefined()
  })

  it('returns plain date string when no time provided', () => {
    expect(combineDateTime('2026-04-15', '')).toBe('2026-04-15')
  })

  it('returns local datetime string when time provided', () => {
    expect(combineDateTime('2026-04-15', '08:30')).toBe('2026-04-15T08:30:00')
  })

  it('does not convert to UTC (no Z suffix or offset)', () => {
    const result = combineDateTime('2026-04-15', '23:45')
    expect(result).toBe('2026-04-15T23:45:00')
    expect(result).not.toContain('Z')
    expect(result).not.toMatch(/[+-]\d{2}:\d{2}$/)
  })

  it('roundtrips through splitDateTime for date-only', () => {
    const combined = combineDateTime('2026-04-15', '')!
    const split = splitDateTime(combined)
    expect(split.date).toBe('2026-04-15')
    expect(split.time).toBe('')
  })

  it('roundtrips through splitDateTime for date+time', () => {
    const combined = combineDateTime('2026-04-15', '14:30')!
    const split = splitDateTime(combined)
    expect(split.date).toBe('2026-04-15')
    expect(split.time).toBe('14:30')
  })
})
