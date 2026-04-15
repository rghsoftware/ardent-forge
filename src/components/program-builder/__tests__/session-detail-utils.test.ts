import { describe, it, expect } from 'vitest'
import type { SetScheme } from '@/domain/types'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import {
  formatSetsReps,
  formatLoad,
  formatLoadSpec,
  formatSeconds,
  buildGroupedActivities,
} from '../session-detail-utils'

// ---------------------------------------------------------------------------
// formatSeconds
// ---------------------------------------------------------------------------

describe('formatSeconds', () => {
  it('returns seconds with S suffix for values under 60', () => {
    expect(formatSeconds(30)).toBe('30S')
  })

  it('returns 0S for zero seconds', () => {
    expect(formatSeconds(0)).toBe('0S')
  })

  it('returns minutes:00 for exact minute values', () => {
    expect(formatSeconds(60)).toBe('1:00')
    expect(formatSeconds(120)).toBe('2:00')
    expect(formatSeconds(300)).toBe('5:00')
  })

  it('returns minutes:seconds with zero-padded seconds', () => {
    expect(formatSeconds(90)).toBe('1:30')
    expect(formatSeconds(65)).toBe('1:05')
    expect(formatSeconds(601)).toBe('10:01')
  })

  it('returns 59S for 59 seconds (boundary)', () => {
    expect(formatSeconds(59)).toBe('59S')
  })
})

// ---------------------------------------------------------------------------
// formatLoadSpec
// ---------------------------------------------------------------------------

describe('formatLoadSpec', () => {
  it('returns weight with uppercase unit for absolute load', () => {
    expect(formatLoadSpec({ type: 'absolute', weight: { value: 225, unit: 'lb' } })).toBe('225LB')
    expect(formatLoadSpec({ type: 'absolute', weight: { value: 100, unit: 'kg' } })).toBe('100KG')
  })

  it('returns -- for absolute load missing weight', () => {
    expect(formatLoadSpec({ type: 'absolute' })).toBe('--')
  })

  it('returns percentage of 1RM for percentageOf1RM load', () => {
    expect(formatLoadSpec({ type: 'percentageOf1RM', percentage: 0.85 })).toBe('85% 1RM')
    expect(formatLoadSpec({ type: 'percentageOf1RM', percentage: 0.725 })).toBe('73% 1RM')
  })

  it('returns -- for percentageOf1RM missing percentage', () => {
    expect(formatLoadSpec({ type: 'percentageOf1RM' })).toBe('--')
  })

  it('returns RPE with target for rpe load', () => {
    expect(formatLoadSpec({ type: 'rpe', target: 8 })).toBe('RPE 8')
    expect(formatLoadSpec({ type: 'rpe', target: 7.5 })).toBe('RPE 7.5')
  })

  it('returns -- for rpe missing target', () => {
    expect(formatLoadSpec({ type: 'rpe' })).toBe('--')
  })

  it('returns BW for bodyweight load', () => {
    expect(formatLoadSpec({ type: 'bodyweight' })).toBe('BW')
  })

  it('returns BW+ with additional weight for bodyweightPlus', () => {
    expect(
      formatLoadSpec({ type: 'bodyweightPlus', additionalWeight: { value: 25, unit: 'lb' } }),
    ).toBe('BW+25LB')
  })

  it('returns BW+ for bodyweightPlus missing additionalWeight', () => {
    expect(formatLoadSpec({ type: 'bodyweightPlus' })).toBe('BW+')
  })

  it('returns percentage for percentMaxReps load', () => {
    expect(formatLoadSpec({ type: 'percentMaxReps', percentage: 0.7 })).toBe('70% MAX')
  })

  it('returns -- for percentMaxReps missing percentage', () => {
    expect(formatLoadSpec({ type: 'percentMaxReps' })).toBe('--')
  })

  it('returns -- for unspecified load', () => {
    expect(formatLoadSpec({ type: 'unspecified' })).toBe('--')
  })

  it('returns -- for unknown load type', () => {
    expect(formatLoadSpec({ type: 'somethingElse' })).toBe('--')
  })
})

// ---------------------------------------------------------------------------
// formatSetsReps
// ---------------------------------------------------------------------------

describe('formatSetsReps', () => {
  it('returns setsxreps for fixedSets with numeric sets and reps', () => {
    const scheme = {
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'bodyweight' },
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('3x5')
  })

  it('appends + for fixedSets with lastSetAMRAP', () => {
    const scheme = {
      type: 'fixedSets',
      sets: 5,
      reps: 5,
      load: { type: 'bodyweight' },
      lastSetAMRAP: true,
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('5x5+')
  })

  it('returns range for fixedSets with NumberRange sets and reps', () => {
    const scheme = {
      type: 'fixedSets',
      sets: { min: 3, max: 5 },
      reps: { min: 8, max: 12 },
      load: { type: 'bodyweight' },
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('3-5x8-12')
  })

  it('returns setsxreps for percentageSets', () => {
    const scheme = {
      type: 'percentageSets',
      sets: 5,
      reps: 3,
      percentageOf1RM: 0.85,
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('5x3')
  })

  it('appends + for percentageSets with lastSetAMRAP', () => {
    const scheme = {
      type: 'percentageSets',
      sets: 5,
      reps: 3,
      percentageOf1RM: 0.85,
      lastSetAMRAP: true,
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('5x3+')
  })

  it('returns rep range with RM for workToMax', () => {
    const scheme = { type: 'workToMax', targetRepRange: { min: 1, max: 3 } } as SetScheme
    expect(formatSetsReps(scheme)).toBe('1-3RM')
  })

  it('returns setsxduration for timedHold', () => {
    const scheme = { type: 'timedHold', sets: 3, duration: { seconds: 30 } } as SetScheme
    expect(formatSetsReps(scheme)).toBe('3x30S')
  })

  it('returns timedHold with minutes format', () => {
    const scheme = { type: 'timedHold', sets: 2, duration: { seconds: 90 } } as SetScheme
    expect(formatSetsReps(scheme)).toBe('2x1:30')
  })

  it('returns target reps with REPS for forReps', () => {
    const scheme = { type: 'forReps', targetReps: 21 } as SetScheme
    expect(formatSetsReps(scheme)).toBe('21 REPS')
  })

  it('returns formatted duration for cardioSteadyState with duration', () => {
    const scheme = {
      type: 'cardioSteadyState',
      duration: { seconds: 1800 },
      modality: 'RUNNING',
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('30:00')
  })

  it('returns STEADY STATE for cardioSteadyState without duration', () => {
    const scheme = {
      type: 'cardioSteadyState',
      modality: 'RUNNING',
      distance: { value: 5, unit: 'km' },
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('STEADY STATE')
  })

  it('returns rounds for cardioInterval', () => {
    const scheme = {
      type: 'cardioInterval',
      workDuration: { seconds: 30 },
      rest: { seconds: 30 },
      rounds: 8,
      modality: 'ROWING',
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('8 ROUNDS')
  })

  it('returns formatted duration for ruckMarch with duration', () => {
    const scheme = {
      type: 'ruckMarch',
      loadWeight: { value: 45, unit: 'lb' },
      duration: { seconds: 3600 },
      modality: 'RUCKING',
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('60:00')
  })

  it('returns RUCK for ruckMarch without duration', () => {
    const scheme = {
      type: 'ruckMarch',
      loadWeight: { value: 45, unit: 'lb' },
      distance: { value: 12, unit: 'km' },
      modality: 'RUCKING',
    } as SetScheme
    expect(formatSetsReps(scheme)).toBe('RUCK')
  })

  it('returns EMOM with total minutes', () => {
    const scheme = { type: 'emom', repsPerMinute: 10, totalMinutes: 20 } as SetScheme
    expect(formatSetsReps(scheme)).toBe('EMOM 20MIN')
  })

  it('returns AMRAP with time cap', () => {
    const scheme = { type: 'amrapTimed', timeCap: { seconds: 1200 } } as SetScheme
    expect(formatSetsReps(scheme)).toBe('AMRAP 20:00')
  })

  it('returns rep ladder joined by dashes for descendingReps', () => {
    const scheme = { type: 'descendingReps', repLadder: [21, 15, 9] } as SetScheme
    expect(formatSetsReps(scheme)).toBe('21-15-9')
  })

  it('returns percentage for percentageOfMaxReps', () => {
    const scheme = { type: 'percentageOfMaxReps', percentage: 0.65 } as SetScheme
    expect(formatSetsReps(scheme)).toBe('65% MAX REPS')
  })
})

// ---------------------------------------------------------------------------
// formatLoad
// ---------------------------------------------------------------------------

describe('formatLoad', () => {
  const emptyMaxes = {} as Record<
    string,
    { weight: { value: number; unit: string }; testedAt: string; estimated: boolean }
  >

  it('returns calculated weight for percentageSets with known 1RM', () => {
    const scheme = {
      type: 'percentageSets',
      sets: 5,
      reps: 3,
      percentageOf1RM: 0.85,
    } as SetScheme
    const maxes = {
      'ex-1': { weight: { value: 300, unit: 'lb' }, testedAt: '2025-01-01', estimated: false },
    }
    // 300 * 0.85 = 255, rounded down to nearest 5 = 255
    expect(formatLoad(scheme, maxes, 'ex-1')).toBe('255LB')
  })

  it('rounds calculated weight down to nearest 5 for percentageSets', () => {
    const scheme = {
      type: 'percentageSets',
      sets: 3,
      reps: 5,
      percentageOf1RM: 0.725,
    } as SetScheme
    const maxes = {
      'ex-1': { weight: { value: 315, unit: 'lb' }, testedAt: '2025-01-01', estimated: false },
    }
    // 315 * 0.725 = 228.375, floor(228.375 / 5) * 5 = 225
    expect(formatLoad(scheme, maxes, 'ex-1')).toBe('225LB')
  })

  it('returns percentage string for percentageSets without known 1RM', () => {
    const scheme = {
      type: 'percentageSets',
      sets: 3,
      reps: 5,
      percentageOf1RM: 0.75,
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('75% 1RM')
  })

  it('returns formatted load spec for fixedSets with load', () => {
    const scheme = {
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('135LB')
  })

  it('returns -- for fixedSets without load', () => {
    const scheme = {
      type: 'fixedSets',
      sets: 3,
      reps: 5,
      load: { type: 'unspecified' },
    } as SetScheme
    // unspecified load returns '--' via formatLoadSpec
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('--')
  })

  it('returns formatted load spec for forReps with load', () => {
    const scheme = {
      type: 'forReps',
      targetReps: 21,
      load: { type: 'rpe', target: 8 },
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('RPE 8')
  })

  it('returns -- for forReps without load', () => {
    const scheme = { type: 'forReps', targetReps: 21 } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('--')
  })

  it('returns WORK TO MAX for workToMax', () => {
    const scheme = { type: 'workToMax', targetRepRange: { min: 1, max: 3 } } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('WORK TO MAX')
  })

  it('returns HOLD for timedHold', () => {
    const scheme = { type: 'timedHold', sets: 3, duration: { seconds: 30 } } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('HOLD')
  })

  it('returns AMRAP for amrapTimed', () => {
    const scheme = { type: 'amrapTimed', timeCap: { seconds: 1200 } } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('AMRAP')
  })

  it('returns modality for cardioSteadyState', () => {
    const scheme = {
      type: 'cardioSteadyState',
      duration: { seconds: 1800 },
      modality: 'RUNNING',
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('RUNNING')
  })

  it('returns modality for cardioInterval', () => {
    const scheme = {
      type: 'cardioInterval',
      workDuration: { seconds: 30 },
      rest: { seconds: 30 },
      rounds: 8,
      modality: 'ROWING',
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('ROWING')
  })

  it('returns load weight with uppercase unit for ruckMarch', () => {
    const scheme = {
      type: 'ruckMarch',
      loadWeight: { value: 45, unit: 'lb' },
      duration: { seconds: 3600 },
      modality: 'RUCKING',
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('45LB')
  })

  it('returns percentage for percentageOfMaxReps', () => {
    const scheme = { type: 'percentageOfMaxReps', percentage: 0.65 } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('65% MAX')
  })

  it('returns formatted load spec for emom with load', () => {
    const scheme = {
      type: 'emom',
      repsPerMinute: 10,
      totalMinutes: 20,
      load: { type: 'bodyweight' },
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('BW')
  })

  it('returns formatted load spec for descendingReps with load', () => {
    const scheme = {
      type: 'descendingReps',
      repLadder: [21, 15, 9],
      load: { type: 'absolute', weight: { value: 95, unit: 'lb' } },
    } as SetScheme
    expect(formatLoad(scheme, emptyMaxes, 'ex-1')).toBe('95LB')
  })
})

// ---------------------------------------------------------------------------
// buildGroupedActivities
// ---------------------------------------------------------------------------

describe('buildGroupedActivities', () => {
  function makeTemplateFull(
    groups: Array<{ id: string; ordinal: number }>,
    activities: Array<{
      activityGroupId: string
      ordinal: number
      exerciseId: string
      setScheme: SetScheme
    }>,
  ): SessionTemplateFull {
    return {
      template: {
        id: 'tpl-1',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        name: 'Test',
        userId: 'u1',
        category: 'STRENGTH',
        scoring: 'NONE',
        isPublic: false,
      } as SessionTemplateFull['template'],
      groups: groups.map((g) => ({
        id: g.id,
        sessionTemplateId: 'tpl-1',
        groupType: 'STRAIGHT_SETS' as const,
        ordinal: g.ordinal,
      })),
      activities: activities.map((a) => ({
        id: `act-${a.exerciseId}`,
        activityGroupId: a.activityGroupId,
        exerciseId: a.exerciseId,
        ordinal: a.ordinal,
        setScheme: a.setScheme,
      })) as SessionTemplateFull['activities'],
      eventItems: [],
    }
  }

  const bwScheme = {
    type: 'fixedSets',
    sets: 3,
    reps: 10,
    load: { type: 'bodyweight' },
  } as SetScheme
  const rpeScheme = {
    type: 'fixedSets',
    sets: 5,
    reps: 5,
    load: { type: 'rpe', target: 8 },
  } as SetScheme

  it('returns activities sorted by group ordinal then activity ordinal', () => {
    const tpl = makeTemplateFull(
      [
        { id: 'g2', ordinal: 2 },
        { id: 'g1', ordinal: 1 },
      ],
      [
        { activityGroupId: 'g2', ordinal: 1, exerciseId: 'ex-c', setScheme: bwScheme },
        { activityGroupId: 'g1', ordinal: 2, exerciseId: 'ex-b', setScheme: rpeScheme },
        { activityGroupId: 'g1', ordinal: 1, exerciseId: 'ex-a', setScheme: bwScheme },
      ],
    )

    const result = buildGroupedActivities(tpl)
    expect(result.map((r) => r.exerciseId)).toEqual(['ex-a', 'ex-b', 'ex-c'])
  })

  it('returns empty array for template with no groups', () => {
    const tpl = makeTemplateFull([], [])
    expect(buildGroupedActivities(tpl)).toEqual([])
  })

  it('returns empty array for groups with no activities', () => {
    const tpl = makeTemplateFull([{ id: 'g1', ordinal: 1 }], [])
    expect(buildGroupedActivities(tpl)).toEqual([])
  })

  it('preserves set scheme on each activity', () => {
    const tpl = makeTemplateFull(
      [{ id: 'g1', ordinal: 1 }],
      [
        { activityGroupId: 'g1', ordinal: 1, exerciseId: 'ex-1', setScheme: bwScheme },
        { activityGroupId: 'g1', ordinal: 2, exerciseId: 'ex-2', setScheme: rpeScheme },
      ],
    )

    const result = buildGroupedActivities(tpl)
    expect(result[0].setScheme).toBe(bwScheme)
    expect(result[1].setScheme).toBe(rpeScheme)
  })

  it('handles multiple groups each with multiple activities', () => {
    const tpl = makeTemplateFull(
      [
        { id: 'g1', ordinal: 1 },
        { id: 'g2', ordinal: 2 },
      ],
      [
        { activityGroupId: 'g1', ordinal: 1, exerciseId: 'ex-1', setScheme: bwScheme },
        { activityGroupId: 'g1', ordinal: 2, exerciseId: 'ex-2', setScheme: bwScheme },
        { activityGroupId: 'g2', ordinal: 1, exerciseId: 'ex-3', setScheme: rpeScheme },
        { activityGroupId: 'g2', ordinal: 2, exerciseId: 'ex-4', setScheme: rpeScheme },
      ],
    )

    const result = buildGroupedActivities(tpl)
    expect(result).toHaveLength(4)
    expect(result.map((r) => r.exerciseId)).toEqual(['ex-1', 'ex-2', 'ex-3', 'ex-4'])
  })
})
