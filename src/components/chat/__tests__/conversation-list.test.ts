import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { relativeTime, getInitials } from '../chat-utils'

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe('relativeTime', () => {
  const NOW = new Date('2026-04-03T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" for a future date', () => {
    expect(relativeTime('2026-04-03T13:00:00Z')).toBe('now')
  })

  it('returns "now" for less than 60 seconds ago', () => {
    expect(relativeTime('2026-04-03T11:59:30Z')).toBe('now')
  })

  it('returns minutes for 1-59 minutes ago', () => {
    // 5 minutes ago
    expect(relativeTime('2026-04-03T11:55:00Z')).toBe('5m')
    // 1 minute ago
    expect(relativeTime('2026-04-03T11:59:00Z')).toBe('1m')
    // 59 minutes ago
    expect(relativeTime('2026-04-03T11:01:00Z')).toBe('59m')
  })

  it('returns hours for 1-23 hours ago', () => {
    // 3 hours ago
    expect(relativeTime('2026-04-03T09:00:00Z')).toBe('3h')
    // 1 hour ago
    expect(relativeTime('2026-04-03T11:00:00Z')).toBe('1h')
  })

  it('returns days for 1-6 days ago', () => {
    // 2 days ago
    expect(relativeTime('2026-04-01T12:00:00Z')).toBe('2d')
    // 6 days ago
    expect(relativeTime('2026-03-28T12:00:00Z')).toBe('6d')
  })

  it('returns a formatted date beyond a week', () => {
    // 10 days ago
    const result = relativeTime('2026-03-24T12:00:00Z')
    expect(result).toMatch(/Mar\s+24/)
  })
})

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------

describe('getInitials', () => {
  it('returns first + last initials for two words', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('returns a single initial for one word', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('returns "?" for an empty string', () => {
    expect(getInitials('')).toBe('?')
  })

  it('returns "?" for whitespace only', () => {
    expect(getInitials('   ')).toBe('?')
  })

  it('returns first + last initials for three words', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MW')
  })
})
