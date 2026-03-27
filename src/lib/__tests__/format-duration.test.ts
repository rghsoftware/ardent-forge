import { vi } from 'vitest'
import { formatDuration, formatCountdown, formatTimeAgo, computePace } from '@/lib/format-duration'

// ===========================================================================
// formatDuration
// ===========================================================================

describe('formatDuration', () => {
  it('formats 0 seconds as "00:00"', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formats 59 seconds as "00:59"', () => {
    expect(formatDuration(59)).toBe('00:59')
  })

  it('formats 60 seconds as "01:00"', () => {
    expect(formatDuration(60)).toBe('01:00')
  })

  it('formats 90 seconds as "01:30"', () => {
    expect(formatDuration(90)).toBe('01:30')
  })

  it('formats 3600 seconds as "01:00:00"', () => {
    expect(formatDuration(3600)).toBe('01:00:00')
  })

  it('formats 3661 seconds as "01:01:01"', () => {
    expect(formatDuration(3661)).toBe('01:01:01')
  })
})

// ===========================================================================
// formatCountdown
// ===========================================================================

describe('formatCountdown', () => {
  it('formats 0 as "0:00"', () => {
    expect(formatCountdown(0)).toBe('0:00')
  })

  it('formats 90 as "1:30"', () => {
    expect(formatCountdown(90)).toBe('1:30')
  })

  it('formats 605 as "10:05"', () => {
    expect(formatCountdown(605)).toBe('10:05')
  })
})

// ===========================================================================
// formatTimeAgo
// ===========================================================================

describe('formatTimeAgo', () => {
  it('returns "just now" for < 1 minute ago', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
      // 30 seconds ago
      const date = new Date('2026-03-27T11:59:30Z')
      expect(formatTimeAgo(date)).toBe('just now')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns "30m ago" for 30 minutes ago', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
      const date = new Date('2026-03-27T11:30:00Z')
      expect(formatTimeAgo(date)).toBe('30m ago')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns "2h ago" for 2 hours ago', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
      const date = new Date('2026-03-27T10:00:00Z')
      expect(formatTimeAgo(date)).toBe('2h ago')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns "yesterday" for exactly 1 day ago', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
      const date = new Date('2026-03-26T12:00:00Z')
      expect(formatTimeAgo(date)).toBe('yesterday')
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns "3d ago" for 3 days ago', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
      const date = new Date('2026-03-24T12:00:00Z')
      expect(formatTimeAgo(date)).toBe('3d ago')
    } finally {
      vi.useRealTimers()
    }
  })
})

// ===========================================================================
// computePace
// ===========================================================================

describe('computePace', () => {
  it('computes correct pace for valid inputs', () => {
    // 30 minutes for 3 miles = 10:00/mi
    expect(computePace(1800, 3)).toBe('10:00')
  })

  it('returns "--" when distance is 0', () => {
    expect(computePace(600, 0)).toBe('--')
  })

  it('returns "--" when durationSeconds is 0', () => {
    expect(computePace(0, 3)).toBe('--')
  })
})
