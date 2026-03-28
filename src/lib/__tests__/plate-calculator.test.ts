import {
  roundToPlates,
  calculateWorkingWeight,
  PLATE_INCREMENT_LB,
  PLATE_INCREMENT_KG,
} from '@/lib/plate-calculator'

// ===========================================================================
// roundToPlates
// ===========================================================================

describe('roundToPlates', () => {
  it('rounds lb down to nearest 5 (236.25 -> 235)', () => {
    expect(roundToPlates(236.25, 'lb')).toBe(235)
  })

  it('returns exact value when already a multiple of 5 lb', () => {
    expect(roundToPlates(315, 'lb')).toBe(315)
  })

  it('rounds kg down to nearest 2.5 (108 -> 107.5)', () => {
    expect(roundToPlates(108, 'kg')).toBe(107.5)
  })

  it('returns exact value when already a multiple of 2.5 kg', () => {
    expect(roundToPlates(107.5, 'kg')).toBe(107.5)
  })

  it('handles sub-bar weight in lb (e.g. 23 -> 20)', () => {
    expect(roundToPlates(23, 'lb')).toBe(20)
  })

  it('handles sub-bar weight in kg (e.g. 18 -> 17.5)', () => {
    expect(roundToPlates(18, 'kg')).toBe(17.5)
  })

  it('returns 0 for 0 input', () => {
    expect(roundToPlates(0, 'lb')).toBe(0)
    expect(roundToPlates(0, 'kg')).toBe(0)
  })

  it('handles very small positive values (rounds to 0)', () => {
    expect(roundToPlates(4.9, 'lb')).toBe(0)
    expect(roundToPlates(2.4, 'kg')).toBe(0)
  })

  it('handles large weights correctly', () => {
    expect(roundToPlates(1003, 'lb')).toBe(1000)
    expect(roundToPlates(501, 'kg')).toBe(500)
  })
})

// ===========================================================================
// calculateWorkingWeight
// ===========================================================================

describe('calculateWorkingWeight', () => {
  it('computes 75% of 315 lb -> 235 (315 * 0.75 = 236.25, floor to 235)', () => {
    expect(calculateWorkingWeight(315, 75, 'lb')).toBe(235)
  })

  it('returns 1RM rounded to plates at 100% (315 lb -> 315)', () => {
    expect(calculateWorkingWeight(315, 100, 'lb')).toBe(315)
  })

  it('returns 1RM rounded to plates at 100% when non-round (317 lb -> 315)', () => {
    expect(calculateWorkingWeight(317, 100, 'lb')).toBe(315)
  })

  it('returns 0 for zero 1RM', () => {
    expect(calculateWorkingWeight(0, 80, 'lb')).toBe(0)
  })

  it('returns 0 for negative 1RM', () => {
    expect(calculateWorkingWeight(-100, 80, 'lb')).toBe(0)
  })

  it('returns 0 for zero percentage', () => {
    expect(calculateWorkingWeight(315, 0, 'lb')).toBe(0)
  })

  it('returns 0 for negative percentage', () => {
    expect(calculateWorkingWeight(315, -10, 'lb')).toBe(0)
  })

  it('computes kg increments at 2.5 boundaries (140 kg * 80% = 112 -> 110)', () => {
    // 140 * 0.80 = 112.0, 112.0 / 2.5 = 44.8, floor(44.8) * 2.5 = 110
    expect(calculateWorkingWeight(140, 80, 'kg')).toBe(110)
  })

  it('computes kg at exact 2.5 boundary', () => {
    // 100 * 0.50 = 50.0, 50.0 / 2.5 = 20 -> 20 * 2.5 = 50
    expect(calculateWorkingWeight(100, 50, 'kg')).toBe(50)
  })

  it('satisfies PR-3: result is within 5 lb of raw calculated value', () => {
    const oneRM = 405
    const pct = 82.5
    const raw = oneRM * (pct / 100) // 334.125
    const result = calculateWorkingWeight(oneRM, pct, 'lb')
    expect(Math.abs(result - raw)).toBeLessThanOrEqual(PLATE_INCREMENT_LB)
  })

  it('satisfies PR-3: result is within 2.5 kg of raw calculated value', () => {
    const oneRM = 180
    const pct = 72.5
    const raw = oneRM * (pct / 100) // 130.5
    const result = calculateWorkingWeight(oneRM, pct, 'kg')
    expect(Math.abs(result - raw)).toBeLessThanOrEqual(PLATE_INCREMENT_KG)
  })
})

// ===========================================================================
// exported constants
// ===========================================================================

describe('plate increment constants', () => {
  it('lb increment is 5', () => {
    expect(PLATE_INCREMENT_LB).toBe(5)
  })

  it('kg increment is 2.5', () => {
    expect(PLATE_INCREMENT_KG).toBe(2.5)
  })
})
