import { applyOverrides } from '@/lib/override-merger'
import type { ResolutionContext } from '@/lib/override-merger'
import type { PrefilledGroup, PrefilledActivity, PrefilledSet } from '@/lib/prescription-resolver'
import type { SessionOverrides, SetScheme } from '@/domain/types'

// ---------------------------------------------------------------------------
// Shared helpers -- factory functions for building test data
// ---------------------------------------------------------------------------

function makeSet(setNumber: number): PrefilledSet {
  return {
    setNumber,
    setType: 'WORKING',
    prescribed: { reps: 5, weight: { value: 135, unit: 'lb' } },
    completed: false,
  }
}

function makePrefilledActivity(
  overrides: Partial<PrefilledActivity> & { templateActivityId: string },
): PrefilledActivity {
  return {
    templateActivityId: overrides.templateActivityId,
    activity: overrides.activity ?? {
      exerciseId: 'ex-squat',
      ordinal: 1,
    },
    sets: overrides.sets ?? [makeSet(1), makeSet(2), makeSet(3)],
  }
}

function makePrefilledGroup(activities: PrefilledActivity[], ordinal = 1): PrefilledGroup {
  return {
    group: {
      groupType: 'STRAIGHT_SETS',
      ordinal,
      actualRoundsCompleted: undefined,
      completionTime: undefined,
    },
    activities,
  }
}

const DEFAULT_CTX: ResolutionContext = {
  exerciseMaxes: {},
  maxReps: {},
  preferredUnit: 'lb',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyOverrides', () => {
  // -----------------------------------------------------------------------
  // No-op cases
  // -----------------------------------------------------------------------

  it('returns the original array when overrides is null', () => {
    const groups = [makePrefilledGroup([makePrefilledActivity({ templateActivityId: 'act-1' })])]
    const result = applyOverrides(groups, null)
    expect(result).toBe(groups)
  })

  it('returns the original array when overrides is undefined', () => {
    const groups = [makePrefilledGroup([makePrefilledActivity({ templateActivityId: 'act-1' })])]
    const result = applyOverrides(groups, undefined)
    expect(result).toBe(groups)
  })

  it('returns the original array when activityOverrides is empty', () => {
    const groups = [makePrefilledGroup([makePrefilledActivity({ templateActivityId: 'act-1' })])]
    const overrides: SessionOverrides = { activityOverrides: {} }
    const result = applyOverrides(groups, overrides)
    expect(result).toBe(groups)
  })

  it('returns the original array when overrides has no activityOverrides key', () => {
    const groups = [makePrefilledGroup([makePrefilledActivity({ templateActivityId: 'act-1' })])]
    const overrides: SessionOverrides = {}
    const result = applyOverrides(groups, overrides)
    expect(result).toBe(groups)
  })

  // -----------------------------------------------------------------------
  // Exercise swap
  // -----------------------------------------------------------------------

  it('swaps exerciseId when an exercise override exists', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
        }),
      ]),
    ]
    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(result[0].activities[0].activity.exerciseId).toBe('ex-front-squat')
  })

  it('preserves other activity fields when swapping exerciseId', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 3 },
        }),
      ]),
    ]
    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(result[0].activities[0].activity.ordinal).toBe(3)
    expect(result[0].activities[0].sets).toHaveLength(3)
  })

  // -----------------------------------------------------------------------
  // SetScheme swap
  // -----------------------------------------------------------------------

  it('re-resolves sets when a setScheme override exists', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
          sets: [makeSet(1), makeSet(2), makeSet(3)],
        }),
      ]),
    ]

    const newScheme: SetScheme = {
      type: 'fixedSets',
      sets: 5,
      reps: 8,
      load: { type: 'unspecified' },
    }

    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { setScheme: newScheme },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    // fixedSets with 5 sets should produce 5 sets
    expect(result[0].activities[0].sets).toHaveLength(5)
    expect(result[0].activities[0].sets[0].prescribed?.reps).toBe(8)
  })

  // -----------------------------------------------------------------------
  // Combined override (exerciseId + setScheme)
  // -----------------------------------------------------------------------

  it('applies both exerciseId and setScheme overrides together', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
          sets: [makeSet(1), makeSet(2), makeSet(3)],
        }),
      ]),
    ]

    const newScheme: SetScheme = {
      type: 'fixedSets',
      sets: 4,
      reps: 10,
      load: { type: 'unspecified' },
    }

    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-leg-press', setScheme: newScheme },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(result[0].activities[0].activity.exerciseId).toBe('ex-leg-press')
    expect(result[0].activities[0].sets).toHaveLength(4)
    expect(result[0].activities[0].sets[0].prescribed?.reps).toBe(10)
  })

  // -----------------------------------------------------------------------
  // Orphaned activity ID
  // -----------------------------------------------------------------------

  it('silently skips overrides for activity IDs not in the groups', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
        }),
      ]),
    ]
    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-nonexistent': { exerciseId: 'ex-bench' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    // Group with no matching overrides returns the same reference
    expect(result[0]).toBe(groups[0])
    expect(result[0].activities[0].activity.exerciseId).toBe('ex-squat')
  })

  // -----------------------------------------------------------------------
  // Immutability
  // -----------------------------------------------------------------------

  it('returns a new array reference when overrides are applied', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
        }),
      ]),
    ]
    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(result).not.toBe(groups)
    expect(result[0]).not.toBe(groups[0])
    expect(result[0].activities[0]).not.toBe(groups[0].activities[0])
  })

  it('does not mutate the original groups', () => {
    const originalActivity = makePrefilledActivity({
      templateActivityId: 'act-1',
      activity: { exerciseId: 'ex-squat', ordinal: 1 },
    })
    const groups = [makePrefilledGroup([originalActivity])]
    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
      },
    }

    applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(groups[0].activities[0].activity.exerciseId).toBe('ex-squat')
  })

  // -----------------------------------------------------------------------
  // Multiple activities across groups
  // -----------------------------------------------------------------------

  it('applies overrides to matching activities across multiple groups', () => {
    const groups = [
      makePrefilledGroup(
        [
          makePrefilledActivity({
            templateActivityId: 'act-1',
            activity: { exerciseId: 'ex-squat', ordinal: 1 },
          }),
        ],
        1,
      ),
      makePrefilledGroup(
        [
          makePrefilledActivity({
            templateActivityId: 'act-2',
            activity: { exerciseId: 'ex-bench', ordinal: 1 },
          }),
        ],
        2,
      ),
    ]

    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
        'act-2': { exerciseId: 'ex-incline-bench' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    expect(result[0].activities[0].activity.exerciseId).toBe('ex-front-squat')
    expect(result[1].activities[0].activity.exerciseId).toBe('ex-incline-bench')
  })

  it('leaves unaffected groups as the same reference', () => {
    const groups = [
      makePrefilledGroup(
        [
          makePrefilledActivity({
            templateActivityId: 'act-1',
            activity: { exerciseId: 'ex-squat', ordinal: 1 },
          }),
        ],
        1,
      ),
      makePrefilledGroup(
        [
          makePrefilledActivity({
            templateActivityId: 'act-2',
            activity: { exerciseId: 'ex-bench', ordinal: 1 },
          }),
        ],
        2,
      ),
    ]

    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { exerciseId: 'ex-front-squat' },
      },
    }

    const result = applyOverrides(groups, overrides, DEFAULT_CTX)

    // Group 1 was changed, so new reference
    expect(result[0]).not.toBe(groups[0])
    // Group 2 was untouched, so same reference
    expect(result[1]).toBe(groups[1])
  })

  // -----------------------------------------------------------------------
  // SetScheme with percentage-based load (needs exerciseMaxes)
  // -----------------------------------------------------------------------

  it('uses exerciseMaxes from ResolutionContext when re-resolving sets', () => {
    const groups = [
      makePrefilledGroup([
        makePrefilledActivity({
          templateActivityId: 'act-1',
          activity: { exerciseId: 'ex-squat', ordinal: 1 },
          sets: [makeSet(1)],
        }),
      ]),
    ]

    const newScheme: SetScheme = {
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: {
        type: 'percentageOf1RM',
        percentage: 0.75,
      },
    }

    const overrides: SessionOverrides = {
      activityOverrides: {
        'act-1': { setScheme: newScheme },
      },
    }

    const ctx: ResolutionContext = {
      exerciseMaxes: {
        'ex-squat': {
          weight: { value: 300, unit: 'lb' },
          testedAt: '2026-01-01T00:00:00Z',
          estimated: false,
        },
      },
      maxReps: {},
      preferredUnit: 'lb',
    }

    const result = applyOverrides(groups, overrides, ctx)

    expect(result[0].activities[0].sets).toHaveLength(3)
    // 75% of 300 lb = 225 lb (exact value depends on plate-calculator rounding)
    expect(result[0].activities[0].sets[0].prescribed?.weight).toBeDefined()
    expect(result[0].activities[0].sets[0].prescribed?.weight?.value).toBeGreaterThan(0)
  })
})
