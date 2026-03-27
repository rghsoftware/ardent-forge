import {
  setSchemeSchema,
  loadSpecSchema,
  parseSetScheme,
  type ParseSetSchemeResult,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// SS-1: Each SetScheme variant validates with correct fields
// ---------------------------------------------------------------------------

describe('SS-1: FixedSets variant', () => {
  it('accepts valid fixedSets with absolute load', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'fixedSets',
        sets: 3,
        reps: 5,
        load: { type: 'absolute', weight: { value: 100, unit: 'lb' } },
      }).success,
    ).toBe(true)
  })
  it('accepts fixedSets with NumberRange for sets and reps', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'fixedSets',
        sets: { min: 3, max: 5 },
        reps: { min: 8, max: 12 },
        load: { type: 'bodyweight' },
      }).success,
    ).toBe(true)
  })
  it('accepts fixedSets with optional lastSetAMRAP', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'fixedSets',
        sets: 5,
        reps: 5,
        load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
        lastSetAMRAP: true,
      }).success,
    ).toBe(true)
  })
  it('rejects fixedSets missing reps', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'fixedSets',
        sets: 3,
        load: { type: 'bodyweight' },
      }).success,
    ).toBe(false)
  })
  it('rejects fixedSets missing load', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'fixedSets',
        sets: 3,
        reps: 5,
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: PercentageSets variant', () => {
  it('accepts valid percentageSets', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 0.75,
      }).success,
    ).toBe(true)
  })
  it('rejects percentageSets missing percentageOf1RM', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: WorkToMax variant', () => {
  it('accepts valid workToMax', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'workToMax',
        targetRepRange: { min: 1, max: 3 },
      }).success,
    ).toBe(true)
  })
  it('rejects workToMax missing targetRepRange', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'workToMax',
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: TimedHold variant', () => {
  it('accepts valid timedHold', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'timedHold',
        duration: { seconds: 30 },
        sets: 3,
      }).success,
    ).toBe(true)
  })
  it('rejects timedHold missing sets', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'timedHold',
        duration: { seconds: 30 },
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: ForReps variant', () => {
  it('accepts valid forReps', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'forReps',
        targetReps: 21,
      }).success,
    ).toBe(true)
  })
  it('accepts forReps with optional load', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'forReps',
        targetReps: 10,
        load: { type: 'bodyweight' },
      }).success,
    ).toBe(true)
  })
})

describe('SS-1 + SS-5: CardioSteadyState variant', () => {
  it('accepts cardioSteadyState with duration and modality', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioSteadyState',
        duration: { seconds: 1800 },
        modality: 'RUNNING',
      }).success,
    ).toBe(true)
  })
  it('accepts cardioSteadyState with distance and modality', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioSteadyState',
        distance: { value: 5, unit: 'km' },
        modality: 'CYCLING',
      }).success,
    ).toBe(true)
  })
  it('accepts cardioSteadyState with both duration and distance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioSteadyState',
        duration: { seconds: 3600 },
        distance: { value: 10, unit: 'km' },
        modality: 'RUNNING',
      }).success,
    ).toBe(true)
  })
  it('rejects cardioSteadyState with neither duration nor distance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioSteadyState',
        modality: 'RUNNING',
      }).success,
    ).toBe(false)
  })
  it('rejects cardioSteadyState missing modality (SS-5)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioSteadyState',
        duration: { seconds: 1800 },
      }).success,
    ).toBe(false)
  })
})

describe('SS-1 + SS-5: CardioInterval variant', () => {
  it('accepts cardioInterval with workDuration', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioInterval',
        workDuration: { seconds: 30 },
        rest: { seconds: 30 },
        rounds: 8,
        modality: 'ROWING',
      }).success,
    ).toBe(true)
  })
  it('accepts cardioInterval with workDistance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioInterval',
        workDistance: { value: 400, unit: 'm' },
        rest: { seconds: 90 },
        rounds: 6,
        modality: 'RUNNING',
      }).success,
    ).toBe(true)
  })
  it('rejects cardioInterval with neither workDuration nor workDistance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioInterval',
        rest: { seconds: 30 },
        rounds: 8,
        modality: 'ROWING',
      }).success,
    ).toBe(false)
  })
  it('rejects cardioInterval missing modality (SS-5)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'cardioInterval',
        workDuration: { seconds: 30 },
        rest: { seconds: 30 },
        rounds: 8,
      }).success,
    ).toBe(false)
  })
})

describe('SS-1 + SS-5: RuckMarch variant', () => {
  it('accepts ruckMarch with duration', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'ruckMarch',
        loadWeight: { value: 45, unit: 'lb' },
        duration: { seconds: 3600 },
        modality: 'RUCKING',
      }).success,
    ).toBe(true)
  })
  it('accepts ruckMarch with distance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'ruckMarch',
        loadWeight: { value: 20, unit: 'kg' },
        distance: { value: 12, unit: 'km' },
        modality: 'RUCKING',
      }).success,
    ).toBe(true)
  })
  it('rejects ruckMarch with neither duration nor distance', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'ruckMarch',
        loadWeight: { value: 45, unit: 'lb' },
        modality: 'RUCKING',
      }).success,
    ).toBe(false)
  })
  it('rejects ruckMarch missing modality (SS-5)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'ruckMarch',
        loadWeight: { value: 45, unit: 'lb' },
        duration: { seconds: 3600 },
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: EMOM variant', () => {
  it('accepts valid emom', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'emom',
        repsPerMinute: 10,
        totalMinutes: 20,
      }).success,
    ).toBe(true)
  })
  it('rejects emom missing totalMinutes', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'emom',
        repsPerMinute: 10,
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: AMRAPTimed variant', () => {
  it('accepts valid amrapTimed', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'amrapTimed',
        timeCap: { seconds: 1200 },
      }).success,
    ).toBe(true)
  })
  it('rejects amrapTimed missing timeCap', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'amrapTimed',
      }).success,
    ).toBe(false)
  })
})

describe('SS-1: PercentageOfMaxReps variant', () => {
  it('accepts valid percentageOfMaxReps', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 0.65,
      }).success,
    ).toBe(true)
  })
  it('accepts percentageOfMaxReps with optional sets', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 0.8,
        sets: 3,
      }).success,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SS-2: Percentage range 0.01 to 1.0
// ---------------------------------------------------------------------------

describe('SS-2: PercentageSets percentageOf1RM range', () => {
  it('accepts minimum valid percentage 0.01', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 0.01,
      }).success,
    ).toBe(true)
  })
  it('accepts maximum valid percentage 1.0', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 1,
        reps: 1,
        percentageOf1RM: 1.0,
      }).success,
    ).toBe(true)
  })
  it('rejects percentage below 0.01 (zero)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 0,
      }).success,
    ).toBe(false)
  })
  it('rejects percentage above 1.0', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 1.5,
      }).success,
    ).toBe(false)
  })
  it('rejects integer percentage not in decimal form (e.g. 75 instead of 0.75)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageSets',
        sets: 3,
        reps: 5,
        percentageOf1RM: 75,
      }).success,
    ).toBe(false)
  })
})

describe('SS-2: PercentageOfMaxReps percentage range', () => {
  it('accepts minimum valid percentage 0.01', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 0.01,
      }).success,
    ).toBe(true)
  })
  it('accepts maximum valid percentage 1.0', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 1.0,
      }).success,
    ).toBe(true)
  })
  it('rejects zero percentage', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 0,
      }).success,
    ).toBe(false)
  })
  it('rejects percentage above 1.0', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'percentageOfMaxReps',
        percentage: 1.1,
      }).success,
    ).toBe(false)
  })
})

describe('SS-2: LoadSpec percentageOf1RM percentage range', () => {
  it('accepts valid percentageOf1RM load spec', () => {
    expect(
      loadSpecSchema.safeParse({
        type: 'percentageOf1RM',
        percentage: 0.85,
      }).success,
    ).toBe(true)
  })
  it('accepts minimum valid percentage 0.01', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentageOf1RM', percentage: 0.01 }).success).toBe(
      true,
    )
  })
  it('accepts maximum valid percentage 1.0', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentageOf1RM', percentage: 1.0 }).success).toBe(
      true,
    )
  })
  it('rejects percentage of 0', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentageOf1RM', percentage: 0 }).success).toBe(false)
  })
  it('rejects percentage above 1.0', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentageOf1RM', percentage: 1.5 }).success).toBe(
      false,
    )
  })
})

// ---------------------------------------------------------------------------
// SS-3: DescendingReps repLadder must be strictly decreasing, length >= 2
// ---------------------------------------------------------------------------

describe('SS-3: DescendingReps repLadder', () => {
  it('accepts valid strictly decreasing ladder [21, 15, 9]', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [21, 15, 9],
      }).success,
    ).toBe(true)
  })
  it('accepts two-element strictly decreasing ladder', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [10, 5],
      }).success,
    ).toBe(true)
  })
  it('accepts long strictly decreasing ladder [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      }).success,
    ).toBe(true)
  })
  it('rejects single element ladder (length < 2)', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [21],
      }).success,
    ).toBe(false)
  })
  it('rejects ascending ladder [9, 15, 21]', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [9, 15, 21],
      }).success,
    ).toBe(false)
  })
  it('rejects ladder with duplicate adjacent values [21, 21, 9]', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [21, 21, 9],
      }).success,
    ).toBe(false)
  })
  it('rejects empty ladder', () => {
    expect(
      setSchemeSchema.safeParse({
        type: 'descendingReps',
        repLadder: [],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LoadSpec: Each of 7 variants validates correctly
// ---------------------------------------------------------------------------

describe('LoadSpec variants', () => {
  it('accepts absolute load spec', () => {
    expect(
      loadSpecSchema.safeParse({ type: 'absolute', weight: { value: 225, unit: 'lb' } }).success,
    ).toBe(true)
  })
  it('rejects absolute with invalid weight (zero)', () => {
    expect(
      loadSpecSchema.safeParse({ type: 'absolute', weight: { value: 0, unit: 'lb' } }).success,
    ).toBe(false)
  })
  it('accepts rpe load spec', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 8 }).success).toBe(true)
  })
  it('rejects rpe below 1', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 0 }).success).toBe(false)
  })
  it('rejects rpe above 10', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 11 }).success).toBe(false)
  })
  it('accepts percentMaxReps load spec', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentMaxReps', percentage: 0.7 }).success).toBe(true)
  })
  it('rejects percentMaxReps above 1.0', () => {
    expect(loadSpecSchema.safeParse({ type: 'percentMaxReps', percentage: 1.5 }).success).toBe(
      false,
    )
  })
  it('accepts bodyweight load spec', () => {
    expect(loadSpecSchema.safeParse({ type: 'bodyweight' }).success).toBe(true)
  })
  it('accepts bodyweightPlus load spec', () => {
    expect(
      loadSpecSchema.safeParse({
        type: 'bodyweightPlus',
        additionalWeight: { value: 25, unit: 'lb' },
      }).success,
    ).toBe(true)
  })
  it('rejects bodyweightPlus with invalid additionalWeight', () => {
    expect(
      loadSpecSchema.safeParse({
        type: 'bodyweightPlus',
        additionalWeight: { value: -5, unit: 'lb' },
      }).success,
    ).toBe(false)
  })
  it('accepts unspecified load spec', () => {
    expect(loadSpecSchema.safeParse({ type: 'unspecified' }).success).toBe(true)
  })
  it('rejects unknown load spec type', () => {
    expect(loadSpecSchema.safeParse({ type: 'unknown' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseSetScheme two-stage parser
// ---------------------------------------------------------------------------

describe('parseSetScheme helper', () => {
  it('returns success for a valid fixedSets input', () => {
    const result = parseSetScheme({
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'bodyweight' },
    })
    expect(result.success).toBe(true)
  })

  it('returns error for missing type field', () => {
    const result = parseSetScheme({ sets: 3, reps: 5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/missing|invalid.*type/i)
    }
  })

  it('returns error for unknown type value', () => {
    const result = parseSetScheme({ type: 'unknownType', sets: 3 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
      expect(result.error).toMatch(/unknown setscheme type/i)
    }
  })

  it('returns schema errors for invalid variant data', () => {
    const result: ParseSetSchemeResult = parseSetScheme({ type: 'fixedSets', sets: -1, reps: 5 })
    // sets must be positive; error branch now returns { success: false, error: string }
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(typeof result.error).toBe('string')
    }
  })

  it('returns data field on success result', () => {
    const result: ParseSetSchemeResult = parseSetScheme({
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'bodyweight' },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty('type', 'fixedSets')
    }
  })
})

// ---------------------------------------------------------------------------
// I5: LoadSpec RPE multipleOf(0.5) constraint
// ---------------------------------------------------------------------------

describe('LoadSpec RPE multipleOf(0.5)', () => {
  it('accepts RPE target of 7.5 (valid half-value)', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 7.5 }).success).toBe(true)
  })

  it('rejects RPE target of 7.3 (not a multiple of 0.5)', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 7.3 }).success).toBe(false)
  })

  it('accepts RPE target of 10 (integer, valid multiple of 0.5)', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 10 }).success).toBe(true)
  })

  it('accepts RPE target of 1 (minimum, valid multiple of 0.5)', () => {
    expect(loadSpecSchema.safeParse({ type: 'rpe', target: 1 }).success).toBe(true)
  })
})
