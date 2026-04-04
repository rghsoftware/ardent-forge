import type { SessionType, GroupType, SetScheme, LoadSpec } from '@/domain/types'

// ---------------------------------------------------------------------------
// Derived helper types for map values
// ---------------------------------------------------------------------------

type SetSchemeType = SetScheme['type']
type LoadSpecType = LoadSpec['type']

/** Fields on SessionTemplate whose visibility depends on the session category. */
interface CategoryFieldVisibility {
  scoring: boolean
  timeCap: boolean
}

/** Fields on ActivityGroup whose visibility depends on the group type. */
interface GroupFieldVisibility {
  restBetweenRounds: boolean
  restBetweenActivities: boolean
  rounds: boolean
}

// ---------------------------------------------------------------------------
// 1. CATEGORY_FIELD_VISIBILITY
//    Maps SessionType to which session-level fields are visible.
// ---------------------------------------------------------------------------

export const CATEGORY_FIELD_VISIBILITY = {
  STRENGTH: { scoring: false, timeCap: false },
  CONDITIONING: { scoring: true, timeCap: true },
  SE: { scoring: false, timeCap: true },
  MIXED: { scoring: true, timeCap: true },
  EVENT: { scoring: false, timeCap: false },
} satisfies Record<SessionType, CategoryFieldVisibility>

// ---------------------------------------------------------------------------
// 2. CATEGORY_SCHEME_TYPES
//    Maps SessionType to the set-scheme types shown by default.
//    An empty array means "show all scheme types" (no filtering).
// ---------------------------------------------------------------------------

export const CATEGORY_SCHEME_TYPES = {
  STRENGTH: ['fixedSets', 'percentageSets', 'workToMax'],
  CONDITIONING: [
    'cardioSteadyState',
    'cardioInterval',
    'ruckMarch',
    'emom',
    'amrapTimed',
    'descendingReps',
  ],
  SE: ['forReps', 'timedHold', 'percentageOfMaxReps'],
  MIXED: [],
  EVENT: [],
} satisfies Record<SessionType, SetSchemeType[]>

// ---------------------------------------------------------------------------
// 3. SCHEME_LOAD_VISIBILITY
//    Maps SetScheme type to the LoadSpec types available for that scheme.
//    `null` means the scheme manages its own load internally (no user-facing
//    load picker).
// ---------------------------------------------------------------------------

export const SCHEME_LOAD_VISIBILITY = {
  fixedSets: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  percentageSets: null,
  workToMax: ['absolute', 'rpe', 'unspecified'],
  forReps: ['absolute', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  timedHold: ['absolute', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  percentageOfMaxReps: null,
  cardioSteadyState: null,
  cardioInterval: null,
  ruckMarch: null,
  emom: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  amrapTimed: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
  descendingReps: ['absolute', 'rpe', 'bodyweight', 'bodyweightPlus', 'unspecified'],
} satisfies Record<SetSchemeType, LoadSpecType[] | null>

// ---------------------------------------------------------------------------
// 4. GROUP_FIELD_VISIBILITY
//    Maps GroupType to which activity-group-level fields are visible.
// ---------------------------------------------------------------------------

export const GROUP_FIELD_VISIBILITY = {
  STRAIGHT_SETS: { restBetweenRounds: false, restBetweenActivities: true, rounds: false },
  SUPERSET: { restBetweenRounds: false, restBetweenActivities: true, rounds: false },
  CIRCUIT: { restBetweenRounds: true, restBetweenActivities: true, rounds: true },
  COMPLEX: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  EMOM: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  AMRAP: { restBetweenRounds: false, restBetweenActivities: false, rounds: false },
  COUPLET: { restBetweenRounds: false, restBetweenActivities: true, rounds: true },
} satisfies Record<GroupType, GroupFieldVisibility>
