import { describe, it, expect } from 'vitest'
import { setSchemeSchema, parseSetScheme } from '@/domain/types'
import { defaultScheme } from '../set-scheme-defaults'
import type { SetScheme } from '@/domain/types'

// ---------------------------------------------------------------------------
// All valid SetScheme type names (mirrors the internal setSchemeTypeNames
// array in set-scheme.ts which is not exported)
// ---------------------------------------------------------------------------

const setSchemeTypeNames: SetScheme['type'][] = [
  'fixedSets',
  'percentageSets',
  'workToMax',
  'timedHold',
  'forReps',
  'cardioSteadyState',
  'cardioInterval',
  'ruckMarch',
  'emom',
  'amrapTimed',
  'descendingReps',
  'percentageOfMaxReps',
]

// ---------------------------------------------------------------------------
// defaultScheme
// ---------------------------------------------------------------------------

describe('defaultScheme', () => {
  describe.each(setSchemeTypeNames)('for type %s', (type) => {
    it('produces a value that passes setSchemeSchema validation', () => {
      const scheme = defaultScheme(type)
      const result = setSchemeSchema.safeParse(scheme)
      expect(result.success).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// parseSetScheme
// ---------------------------------------------------------------------------

describe('parseSetScheme', () => {
  it('returns { success: false, error: string } for invalid variant', () => {
    const result = parseSetScheme({ type: 'madeUpType', sets: 3 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
      expect(result.error).toContain('Unknown SetScheme type')
    }
  })

  it('joins multiple issues with "; "', () => {
    // fixedSets requires sets (positive int), reps (positive int), and load.
    // Passing invalid values for sets and reps, and omitting load, should
    // produce multiple validation issues joined by '; '.
    const result = parseSetScheme({
      type: 'fixedSets',
      sets: -1,
      reps: -1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
      expect(result.error).toContain('; ')
    }
  })

  it('returns { success: true, data: SetScheme } for valid input', () => {
    const result = parseSetScheme({
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'bodyweight' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('fixedSets')
    }
  })
})
