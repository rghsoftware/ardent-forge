import { describe, it, expect } from 'vitest'
import { filterHistoryBySessionNote } from '../filter-history'
import type { WorkoutLogSummary } from '@/lib/data-adapter'
import type { WorkoutLog } from '@/domain/types'

function makeSummary(id: string, overrides: Partial<WorkoutLog>): WorkoutLogSummary {
  return {
    log: {
      id,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      userId: 'u-1',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T01:00:00Z',
      totalPausedMs: 0,
      ...overrides,
    } as WorkoutLog,
    exerciseNames: [],
    setCount: 0,
  }
}

const fixtures: WorkoutLogSummary[] = [
  makeSummary('a', { title: 'Heavy Deadlift Day', overallNotes: 'felt grindy', noteTags: [] }),
  makeSummary('b', { overallNotes: 'perfect form', noteTags: ['FORM BREAKDOWN'] }),
  makeSummary('c', { overallNotes: undefined, noteTags: ['BAR PATH'] }),
  makeSummary('d', { title: 'Squat', overallNotes: undefined, noteTags: [] }),
]

describe('filterHistoryBySessionNote', () => {
  it('returns all summaries for an empty query', () => {
    expect(filterHistoryBySessionNote(fixtures, '').length).toBe(4)
    expect(filterHistoryBySessionNote(fixtures, '   ').length).toBe(4)
  })

  it('matches overallNotes case-insensitively', () => {
    const result = filterHistoryBySessionNote(fixtures, 'GRINDY')
    expect(result.map((s) => s.log.id)).toEqual(['a'])
  })

  it('matches noteTags case-insensitively', () => {
    const result = filterHistoryBySessionNote(fixtures, 'bar path')
    expect(result.map((s) => s.log.id)).toEqual(['c'])
  })

  it('matches title case-insensitively', () => {
    const result = filterHistoryBySessionNote(fixtures, 'squat')
    expect(result.map((s) => s.log.id)).toEqual(['d'])
  })

  it('returns empty list for non-matching query', () => {
    expect(filterHistoryBySessionNote(fixtures, 'zzzzzzz')).toEqual([])
  })
})
