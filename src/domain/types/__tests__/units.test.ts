import {
  weightSchema,
  distanceSchema,
  durationSchema,
  paceSchema,
  numberRangeSchema,
  oneRepMaxSchema,
  entityId,
  isoDateTime,
} from '@/domain/types'

describe('U-1: Weight', () => {
  it('accepts valid weight with lb unit', () => {
    expect(weightSchema.safeParse({ value: 100, unit: 'lb' }).success).toBe(true)
  })
  it('accepts valid weight with kg unit', () => {
    expect(weightSchema.safeParse({ value: 50.5, unit: 'kg' }).success).toBe(true)
  })
  it('rejects value of 0', () => {
    expect(weightSchema.safeParse({ value: 0, unit: 'lb' }).success).toBe(false)
  })
  it('rejects negative value', () => {
    expect(weightSchema.safeParse({ value: -5, unit: 'kg' }).success).toBe(false)
  })
  it('rejects invalid unit', () => {
    expect(weightSchema.safeParse({ value: 100, unit: 'g' }).success).toBe(false)
  })
  it('rejects missing unit', () => {
    expect(weightSchema.safeParse({ value: 100 }).success).toBe(false)
  })
  it('rejects missing value', () => {
    expect(weightSchema.safeParse({ unit: 'lb' }).success).toBe(false)
  })
})

describe('U-2: Distance', () => {
  it('accepts valid distance in km', () => {
    expect(distanceSchema.safeParse({ value: 5, unit: 'km' }).success).toBe(true)
  })
  it('accepts valid distance in mi', () => {
    expect(distanceSchema.safeParse({ value: 3.1, unit: 'mi' }).success).toBe(true)
  })
  it('accepts valid distance in m', () => {
    expect(distanceSchema.safeParse({ value: 400, unit: 'm' }).success).toBe(true)
  })
  it('accepts valid distance in yd', () => {
    expect(distanceSchema.safeParse({ value: 100, unit: 'yd' }).success).toBe(true)
  })
  it('accepts zero value (valid for distance)', () => {
    expect(distanceSchema.safeParse({ value: 0, unit: 'm' }).success).toBe(true)
  })
  it('rejects negative value', () => {
    expect(distanceSchema.safeParse({ value: -1, unit: 'mi' }).success).toBe(false)
  })
  it('rejects invalid unit', () => {
    expect(distanceSchema.safeParse({ value: 5, unit: 'ft' }).success).toBe(false)
  })
})

describe('U-3: Duration', () => {
  it('accepts valid duration of 60 seconds', () => {
    expect(durationSchema.safeParse({ seconds: 60 }).success).toBe(true)
  })
  it('accepts zero seconds', () => {
    expect(durationSchema.safeParse({ seconds: 0 }).success).toBe(true)
  })
  it('accepts large integer seconds', () => {
    expect(durationSchema.safeParse({ seconds: 7200 }).success).toBe(true)
  })
  it('rejects negative seconds', () => {
    expect(durationSchema.safeParse({ seconds: -1 }).success).toBe(false)
  })
  it('rejects non-integer seconds', () => {
    expect(durationSchema.safeParse({ seconds: 1.5 }).success).toBe(false)
  })
  it('rejects missing seconds field', () => {
    expect(durationSchema.safeParse({}).success).toBe(false)
  })
})

describe('U-4: Pace', () => {
  it('accepts valid pace in mi', () => {
    expect(paceSchema.safeParse({ minutesPerUnit: 9.5, unit: 'mi' }).success).toBe(true)
  })
  it('accepts valid pace in km', () => {
    expect(paceSchema.safeParse({ minutesPerUnit: 6.0, unit: 'km' }).success).toBe(true)
  })
  it('rejects zero minutesPerUnit', () => {
    expect(paceSchema.safeParse({ minutesPerUnit: 0, unit: 'km' }).success).toBe(false)
  })
  it('rejects negative minutesPerUnit', () => {
    expect(paceSchema.safeParse({ minutesPerUnit: -5, unit: 'mi' }).success).toBe(false)
  })
  it('rejects invalid unit', () => {
    expect(paceSchema.safeParse({ minutesPerUnit: 8, unit: 'yd' }).success).toBe(false)
  })
})

describe('SS-4: NumberRange', () => {
  it('accepts min < max', () => {
    expect(numberRangeSchema.safeParse({ min: 3, max: 5 }).success).toBe(true)
  })
  it('accepts min equal to max', () => {
    expect(numberRangeSchema.safeParse({ min: 5, max: 5 }).success).toBe(true)
  })
  it('accepts negative numbers where min <= max', () => {
    expect(numberRangeSchema.safeParse({ min: -10, max: -5 }).success).toBe(true)
  })
  it('rejects min > max', () => {
    expect(numberRangeSchema.safeParse({ min: 6, max: 5 }).success).toBe(false)
  })
  it('rejects missing min', () => {
    expect(numberRangeSchema.safeParse({ max: 5 }).success).toBe(false)
  })
  it('rejects missing max', () => {
    expect(numberRangeSchema.safeParse({ min: 3 }).success).toBe(false)
  })
})

describe('PR-1: OneRepMax', () => {
  it('accepts valid 1RM', () => {
    expect(
      oneRepMaxSchema.safeParse({
        weight: { value: 225, unit: 'lb' },
        testedAt: '2025-01-15T00:00:00Z',
        estimated: false,
      }).success,
    ).toBe(true)
  })
  it('accepts estimated 1RM', () => {
    expect(
      oneRepMaxSchema.safeParse({
        weight: { value: 140, unit: 'kg' },
        testedAt: '2025-03-01T00:00:00Z',
        estimated: true,
      }).success,
    ).toBe(true)
  })
  it('rejects zero weight (inherited from Weight invariant U-1)', () => {
    expect(
      oneRepMaxSchema.safeParse({
        weight: { value: 0, unit: 'lb' },
        testedAt: '2025-01-15T00:00:00Z',
        estimated: false,
      }).success,
    ).toBe(false)
  })
  it('rejects negative weight', () => {
    expect(
      oneRepMaxSchema.safeParse({
        weight: { value: -10, unit: 'kg' },
        testedAt: '2025-01-15T00:00:00Z',
        estimated: false,
      }).success,
    ).toBe(false)
  })
  it('rejects missing testedAt', () => {
    expect(
      oneRepMaxSchema.safeParse({
        weight: { value: 225, unit: 'lb' },
        estimated: false,
      }).success,
    ).toBe(false)
  })
})

describe('entityId', () => {
  it('accepts a valid non-empty string', () => {
    expect(entityId.safeParse('abc123').success).toBe(true)
  })
  it('rejects an empty string', () => {
    expect(entityId.safeParse('').success).toBe(false)
  })
  it('rejects undefined', () => {
    expect(entityId.safeParse(undefined).success).toBe(false)
  })
})

describe('isoDateTime', () => {
  it('accepts a valid ISO 8601 datetime with Z suffix', () => {
    expect(isoDateTime.safeParse('2025-01-15T14:00:00Z').success).toBe(true)
  })
  it('accepts Postgres timestamptz format with +00:00 offset and microseconds', () => {
    // Regression: Postgres `timestamptz` returns this exact shape via PostgREST,
    // and Zod's default `datetime()` rejects it because it only allows `Z`.
    expect(isoDateTime.safeParse('2026-04-08T00:38:29.568618+00:00').success).toBe(true)
  })
  it('accepts a positive non-UTC offset', () => {
    expect(isoDateTime.safeParse('2025-01-15T14:00:00+05:30').success).toBe(true)
  })
  it('rejects a plain date without time', () => {
    expect(isoDateTime.safeParse('2025-01-15').success).toBe(false)
  })
  it('rejects a non-ISO string', () => {
    expect(isoDateTime.safeParse('not-a-date').success).toBe(false)
  })
})
