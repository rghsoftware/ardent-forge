import { resolveSessionTemplate } from '@/lib/prescription-resolver'
import type { SessionTemplateFull } from '@/lib/data-adapter'
import type { OneRepMax, Activity, ActivityGroup, SessionTemplate } from '@/domain/types'

// ---------------------------------------------------------------------------
// Shared helpers -- factory functions for building test data
// ---------------------------------------------------------------------------

const NOW = '2026-03-28T12:00:00Z'

function makeTemplate(overrides: Partial<SessionTemplate> = {}): SessionTemplate {
  return {
    id: 'tpl-1',
    userId: 'user-1',
    name: 'Test Session',
    category: 'STRENGTH',
    scoring: 'NONE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeGroup(
  overrides: Partial<Omit<ActivityGroup, 'activities'>> = {},
): Omit<ActivityGroup, 'activities'> {
  return {
    id: 'grp-1',
    sessionTemplateId: 'tpl-1',
    groupType: 'STRAIGHT_SETS',
    ordinal: 1,
    ...overrides,
  }
}

function makeActivity(overrides: Partial<Activity>): Activity {
  return {
    id: 'act-1',
    activityGroupId: 'grp-1',
    exerciseId: 'ex-squat',
    ordinal: 1,
    setScheme: { type: 'fixedSets', sets: 3, reps: 5, load: { type: 'unspecified' } },
    ...overrides,
  }
}

function makeFull(
  groups: Omit<ActivityGroup, 'activities'>[],
  activities: Activity[],
  templateOverrides: Partial<SessionTemplate> = {},
): SessionTemplateFull {
  return {
    template: makeTemplate(templateOverrides),
    groups,
    activities,
    eventItems: [],
  }
}

const SQUAT_ORM: OneRepMax = {
  weight: { value: 315, unit: 'lb' },
  testedAt: NOW,
  estimated: false,
}

// ---------------------------------------------------------------------------
// percentageSets -- with known 1RM
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- percentageSets', () => {
  it('calculates weight from 1RM and produces correct number of sets', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'percentageSets',
            sets: 3,
            reps: 5,
            percentageOf1RM: 0.75,
          },
        }),
      ],
    )
    const maxes: Record<string, OneRepMax> = { 'ex-squat': SQUAT_ORM }

    const result = resolveSessionTemplate(full, maxes, {}, 'lb')

    expect(result).toHaveLength(1)
    const sets = result[0].activities[0].sets
    expect(sets).toHaveLength(3)

    // 315 * 75% = 236.25, floored to nearest 5 lb = 235
    for (const s of sets) {
      expect(s.prescribed?.weight).toEqual({ value: 235, unit: 'lb' })
      expect(s.prescribed?.reps).toBe(5)
      expect(s.setType).toBe('WORKING')
      expect(s.completed).toBe(false)
    }

    // set numbers are 1-indexed
    expect(sets[0].setNumber).toBe(1)
    expect(sets[1].setNumber).toBe(2)
    expect(sets[2].setNumber).toBe(3)
  })

  it('marks last set as AMRAP when lastSetAMRAP is true', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'percentageSets',
            sets: 3,
            reps: 5,
            percentageOf1RM: 0.8,
            lastSetAMRAP: true,
          },
        }),
      ],
    )
    const result = resolveSessionTemplate(full, { 'ex-squat': SQUAT_ORM }, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets[0].setType).toBe('WORKING')
    expect(sets[1].setType).toBe('WORKING')
    expect(sets[2].setType).toBe('AMRAP')
  })
})

// ---------------------------------------------------------------------------
// fixedSets -- with absolute load
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- fixedSets (absolute)', () => {
  it('uses the absolute weight directly', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 4,
            reps: 8,
            load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(4)
    for (const s of sets) {
      expect(s.prescribed?.weight).toEqual({ value: 135, unit: 'lb' })
      expect(s.prescribed?.reps).toBe(8)
    }
  })

  it('resolves percentageOf1RM load spec with known 1RM', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 3,
            reps: 5,
            load: { type: 'percentageOf1RM', percentage: 0.8 },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, { 'ex-squat': SQUAT_ORM }, {}, 'lb')
    const sets = result[0].activities[0].sets

    // 315 * 80% = 252, floored to nearest 5 lb = 250
    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.weight).toEqual({ value: 250, unit: 'lb' })
    }
  })
})

// ---------------------------------------------------------------------------
// Missing 1RM fallback
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- missing 1RM', () => {
  it('adds fallback notes and no weight for percentageSets without 1RM', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'percentageSets',
            sets: 3,
            reps: 5,
            percentageOf1RM: 0.75,
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.weight).toBeUndefined()
      expect(s.prescribed?.notes).toBe('No 1RM on file -- enter weight manually')
      expect(s.prescribed?.reps).toBe(5)
    }
  })

  it('adds fallback notes for fixedSets with percentageOf1RM load and no 1RM', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 2,
            reps: 5,
            load: { type: 'percentageOf1RM', percentage: 0.85 },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(2)
    for (const s of sets) {
      expect(s.prescribed?.weight).toBeUndefined()
      expect(s.prescribed?.notes).toBe('No 1RM on file -- enter weight manually')
    }
  })
})

// ---------------------------------------------------------------------------
// Cardio set scheme resolution
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- cardio variants', () => {
  it('resolves cardioSteadyState with duration and distance', () => {
    const full = makeFull(
      [makeGroup({ groupType: 'STRAIGHT_SETS' })],
      [
        makeActivity({
          exerciseId: 'ex-run',
          setScheme: {
            type: 'cardioSteadyState',
            duration: { seconds: 1800 },
            distance: { value: 3, unit: 'mi' },
            modality: 'RUNNING',
            intensityNotes: 'Zone 2',
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(1)
    expect(sets[0].prescribed?.duration).toEqual({ seconds: 1800 })
    expect(sets[0].prescribed?.distance).toEqual({ value: 3, unit: 'mi' })
    expect(sets[0].prescribed?.notes).toContain('RUNNING')
    expect(sets[0].prescribed?.notes).toContain('Zone 2')
  })

  it('resolves cardioInterval into one set per round', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          exerciseId: 'ex-row',
          setScheme: {
            type: 'cardioInterval',
            workDuration: { seconds: 60 },
            rest: { seconds: 30 },
            rounds: 5,
            modality: 'ROWING',
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(sets[i].setNumber).toBe(i + 1)
      expect(sets[i].prescribed?.duration).toEqual({ seconds: 60 })
    }
  })

  it('resolves ruckMarch with load, duration, and distance', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          exerciseId: 'ex-ruck',
          setScheme: {
            type: 'ruckMarch',
            loadWeight: { value: 45, unit: 'lb' },
            duration: { seconds: 3600 },
            distance: { value: 4, unit: 'mi' },
            modality: 'RUCKING',
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(1)
    expect(sets[0].prescribed?.weight).toEqual({ value: 45, unit: 'lb' })
    expect(sets[0].prescribed?.duration).toEqual({ seconds: 3600 })
    expect(sets[0].prescribed?.distance).toEqual({ value: 4, unit: 'mi' })
  })
})

// ---------------------------------------------------------------------------
// Group ordering
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- group ordering', () => {
  it('preserves group ordinal order and maps activities to correct groups', () => {
    const full = makeFull(
      [
        makeGroup({ id: 'grp-2', ordinal: 2, groupType: 'SUPERSET' }),
        makeGroup({ id: 'grp-1', ordinal: 1, groupType: 'STRAIGHT_SETS' }),
      ],
      [
        makeActivity({
          id: 'act-1',
          activityGroupId: 'grp-1',
          exerciseId: 'ex-squat',
          ordinal: 1,
          setScheme: { type: 'fixedSets', sets: 3, reps: 5, load: { type: 'unspecified' } },
        }),
        makeActivity({
          id: 'act-2',
          activityGroupId: 'grp-2',
          exerciseId: 'ex-bench',
          ordinal: 1,
          setScheme: { type: 'fixedSets', sets: 4, reps: 8, load: { type: 'unspecified' } },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')

    expect(result).toHaveLength(2)
    // grp-1 (ordinal 1) should come first despite being second in input array
    expect(result[0].group.groupType).toBe('STRAIGHT_SETS')
    expect(result[0].group.ordinal).toBe(1)
    expect(result[0].activities).toHaveLength(1)
    expect(result[0].activities[0].activity.exerciseId).toBe('ex-squat')

    // grp-2 (ordinal 2) should come second
    expect(result[1].group.groupType).toBe('SUPERSET')
    expect(result[1].group.ordinal).toBe(2)
    expect(result[1].activities).toHaveLength(1)
    expect(result[1].activities[0].activity.exerciseId).toBe('ex-bench')
  })

  it('sorts activities within a group by ordinal', () => {
    const full = makeFull(
      [makeGroup({ id: 'grp-1' })],
      [
        makeActivity({
          id: 'act-2',
          activityGroupId: 'grp-1',
          exerciseId: 'ex-bench',
          ordinal: 2,
          setScheme: { type: 'fixedSets', sets: 3, reps: 8, load: { type: 'unspecified' } },
        }),
        makeActivity({
          id: 'act-1',
          activityGroupId: 'grp-1',
          exerciseId: 'ex-squat',
          ordinal: 1,
          setScheme: { type: 'fixedSets', sets: 3, reps: 5, load: { type: 'unspecified' } },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const activities = result[0].activities

    expect(activities[0].activity.exerciseId).toBe('ex-squat')
    expect(activities[0].activity.ordinal).toBe(1)
    expect(activities[1].activity.exerciseId).toBe('ex-bench')
    expect(activities[1].activity.ordinal).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Other set scheme variants
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- workToMax', () => {
  it('produces warm-up progression + peak attempt set', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'workToMax', targetRepRange: { min: 1, max: 3 } },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, { 'ex-squat': SQUAT_ORM }, {}, 'lb')
    const sets = result[0].activities[0].sets

    // 5 warm-up sets + 1 peak = 6 total
    expect(sets).toHaveLength(6)

    // First 5 are warmups with calculated weights
    for (let i = 0; i < 5; i++) {
      expect(sets[i].setType).toBe('WARMUP')
      expect(sets[i].prescribed?.weight).toBeDefined()
    }

    // Last set is peak attempt
    expect(sets[5].setType).toBe('PEAK')
    expect(sets[5].prescribed?.notes).toBe('Max attempt')
  })
})

describe('resolveSessionTemplate -- timedHold', () => {
  it('produces sets with prescribed duration', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'timedHold', duration: { seconds: 30 }, sets: 3 },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.duration).toEqual({ seconds: 30 })
    }
  })
})

describe('resolveSessionTemplate -- emom', () => {
  it('produces one set per minute', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'emom',
            repsPerMinute: 5,
            totalMinutes: 10,
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(10)
    expect(sets[0].prescribed?.reps).toBe(5)
    expect(sets[0].prescribed?.duration).toEqual({ seconds: 600 })
  })
})

describe('resolveSessionTemplate -- amrapTimed', () => {
  it('produces 1 AMRAP set with time cap', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'amrapTimed', timeCap: { seconds: 720 } },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(1)
    expect(sets[0].setType).toBe('AMRAP')
    expect(sets[0].prescribed?.duration).toEqual({ seconds: 720 })
  })
})

describe('resolveSessionTemplate -- descendingReps', () => {
  it('produces one set per rep count in the ladder', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'descendingReps', repLadder: [10, 8, 6, 4, 2] },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(5)
    expect(sets[0].prescribed?.reps).toBe(10)
    expect(sets[1].prescribed?.reps).toBe(8)
    expect(sets[2].prescribed?.reps).toBe(6)
    expect(sets[3].prescribed?.reps).toBe(4)
    expect(sets[4].prescribed?.reps).toBe(2)
  })
})

describe('resolveSessionTemplate -- percentageOfMaxReps', () => {
  it('calculates reps from known max reps', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'percentageOfMaxReps', percentage: 0.5, sets: 3 },
        }),
      ],
    )

    // ex-squat has max reps of 20
    const result = resolveSessionTemplate(full, {}, { 'ex-squat': 20 }, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.reps).toBe(10) // 50% of 20
    }
  })

  it('adds fallback notes when max reps not on file', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'percentageOfMaxReps', percentage: 0.5 },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(1)
    expect(sets[0].prescribed?.reps).toBeUndefined()
    expect(sets[0].prescribed?.notes).toContain('no max reps on file')
  })
})

describe('resolveSessionTemplate -- forReps', () => {
  it('produces a single set with target reps', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: { type: 'forReps', targetReps: 50 },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(1)
    expect(sets[0].prescribed?.reps).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// LoadSpec variants -- RPE, bodyweight, bodyweightPlus
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- fixedSets with RPE load', () => {
  it('sets notes containing RPE target', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 3,
            reps: 5,
            load: { type: 'rpe', target: 8 },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.notes).toContain('RPE')
      expect(s.prescribed?.notes).toContain('8')
      // RPE load should not produce a concrete weight
      expect(s.prescribed?.weight).toBeUndefined()
    }
  })
})

describe('resolveSessionTemplate -- fixedSets with bodyweight load', () => {
  it('does not set a prescribed weight', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 3,
            reps: 10,
            load: { type: 'bodyweight' },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.weight).toBeUndefined()
      expect(s.prescribed?.reps).toBe(10)
    }
  })
})

describe('resolveSessionTemplate -- fixedSets with bodyweightPlus load', () => {
  it('sets prescribed weight to the additional weight', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 3,
            reps: 8,
            load: { type: 'bodyweightPlus', additionalWeight: { value: 25, unit: 'lb' } },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.weight).toEqual({ value: 25, unit: 'lb' })
      expect(s.prescribed?.reps).toBe(8)
    }
  })
})

// ---------------------------------------------------------------------------
// Range sets and reps inputs
// ---------------------------------------------------------------------------

describe('resolveSessionTemplate -- fixedSets with range sets', () => {
  it('uses min value when sets is a range (3-5 produces 3 sets)', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: { min: 3, max: 5 },
            reps: 8,
            load: { type: 'unspecified' },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
  })
})

describe('resolveSessionTemplate -- fixedSets with range reps', () => {
  it('uses min value when reps is a range (8-12 prescribes 8)', () => {
    const full = makeFull(
      [makeGroup()],
      [
        makeActivity({
          setScheme: {
            type: 'fixedSets',
            sets: 3,
            reps: { min: 8, max: 12 },
            load: { type: 'unspecified' },
          },
        }),
      ],
    )

    const result = resolveSessionTemplate(full, {}, {}, 'lb')
    const sets = result[0].activities[0].sets

    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.prescribed?.reps).toBe(8)
    }
  })
})
