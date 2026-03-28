import { parseNumeric, computeVariance } from '../set-variance'

// ===========================================================================
// parseNumeric
// ===========================================================================

describe('parseNumeric', () => {
  it('extracts number from "120 lb"', () => {
    expect(parseNumeric('120 lb')).toBe(120)
  })

  it('parses plain integer string "5"', () => {
    expect(parseNumeric('5')).toBe(5)
  })

  it('returns NaN for empty string', () => {
    expect(parseNumeric('')).toBeNaN()
  })

  it('returns NaN for undefined', () => {
    expect(parseNumeric(undefined)).toBeNaN()
  })

  it('returns NaN for non-numeric string "bodyweight"', () => {
    expect(parseNumeric('bodyweight')).toBeNaN()
  })

  it('extracts decimal from "120.5 kg"', () => {
    expect(parseNumeric('120.5 kg')).toBe(120.5)
  })

  it('parses "0" as 0', () => {
    expect(parseNumeric('0')).toBe(0)
  })
})

// ===========================================================================
// computeVariance
// ===========================================================================

describe('computeVariance', () => {
  it('returns "met" when actual weight and reps match prescribed', () => {
    expect(computeVariance('120 lb', '5', '120', '5')).toBe('met')
  })

  it('returns "met" when actual weight exceeds prescribed', () => {
    expect(computeVariance('100 lb', '5', '110', '5')).toBe('met')
  })

  it('returns "under" when actual weight is below prescribed', () => {
    expect(computeVariance('120 lb', '5', '100', '5')).toBe('under')
  })

  it('returns "under" when actual reps are below prescribed', () => {
    expect(computeVariance('120 lb', '5', '120', '3')).toBe('under')
  })

  it('returns null when no prescription exists', () => {
    expect(computeVariance(undefined, undefined, '120', '5')).toBeNull()
  })

  it('returns "under" when prescribed weight exists but no actual weight entered', () => {
    expect(computeVariance('120 lb', undefined, '', '5')).toBe('under')
  })

  it('returns "under" when prescribed reps exist but no actual reps entered', () => {
    expect(computeVariance(undefined, '5', '120', '')).toBe('under')
  })

  it('returns null when no actual values at all and no prescription', () => {
    expect(computeVariance(undefined, undefined, '', '')).toBeNull()
  })

  it('returns "met" when only reps are prescribed and actual reps meet them', () => {
    expect(computeVariance(undefined, '5', '', '5')).toBe('met')
  })

  it('returns "met" when only weight is prescribed and actual weight meets it', () => {
    expect(computeVariance('100 lb', undefined, '100', '')).toBe('met')
  })

  it('returns "met" when actual reps exceed prescribed (no weight prescription)', () => {
    expect(computeVariance(undefined, '5', '', '8')).toBe('met')
  })
})
