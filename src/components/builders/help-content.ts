import type { GroupType, BlockType, ProgramSource } from '@/domain/types'

// ---------------------------------------------------------------------------
// Group Type Help
// ---------------------------------------------------------------------------

export const GROUP_TYPE_HELP: Record<GroupType, { label: string; description: string }> = {
  STRAIGHT_SETS: {
    label: 'Straight Sets',
    description: 'One exercise at a time. Complete all sets before moving on.',
  },
  SUPERSET: {
    label: 'Superset',
    description: 'Two exercises alternated set-for-set with minimal rest.',
  },
  CIRCUIT: {
    label: 'Circuit',
    description: 'Three or more exercises performed back-to-back as rounds.',
  },
  COMPLEX: {
    label: 'Complex',
    description: 'Multiple barbell movements performed without releasing the bar.',
  },
  EMOM: {
    label: 'EMOM',
    description: 'Fixed work every minute on the minute for a set duration.',
  },
  AMRAP: {
    label: 'AMRAP',
    description: 'As many rounds as possible within a time cap.',
  },
  COUPLET: {
    label: 'Couplet',
    description: 'Two movements alternated for rounds, typically for time.',
  },
}

// ---------------------------------------------------------------------------
// Block Type Help
// ---------------------------------------------------------------------------

export const BLOCK_TYPE_HELP: Record<
  BlockType,
  { label: string; description: string; oneLiner: string }
> = {
  ACCUMULATION: {
    label: 'Accumulation',
    description:
      'The foundation-laying phase. Training volume is high and intensity stays moderate, ' +
      'building raw work capacity, reinforcing movement patterns, and preparing connective ' +
      'tissue for heavier loads ahead.',
    oneLiner: 'High volume, moderate intensity -- builds work capacity.',
  },
  INTENSIFICATION: {
    label: 'Intensification',
    description:
      'The loading phase. Volume tapers down while intensity climbs. Sets get heavier, ' +
      'rest periods lengthen, and the focus shifts from accumulating reps to driving ' +
      'neuromuscular adaptation under load.',
    oneLiner: 'Moderate volume, high intensity -- shifts toward heavier loads.',
  },
  REALIZATION: {
    label: 'Realization',
    description:
      'The payoff phase. Volume drops to its lowest point and intensity peaks. ' +
      'This is where accumulated fitness is expressed -- heavy singles, doubles, ' +
      'or competition-style efforts that test true capacity.',
    oneLiner: 'Low volume, peak intensity -- tests or expresses strength gains.',
  },
  DELOAD: {
    label: 'Deload',
    description:
      'A planned recovery phase. Both volume and intensity are deliberately reduced ' +
      'to allow systemic recovery, joint health restoration, and mental reset ' +
      'before the next training cycle begins.',
    oneLiner: 'Reduced volume and intensity -- planned recovery.',
  },
  TEST: {
    label: 'Test',
    description:
      'A dedicated assessment phase. Structured around maximal attempts -- 1RM tests, ' +
      'benchmark workouts, or standardized assessments -- to establish baselines ' +
      'and measure progress across training cycles.',
    oneLiner: 'Maximal testing -- 1RM attempts or benchmark assessments.',
  },
}

// ---------------------------------------------------------------------------
// Program Source Help
// ---------------------------------------------------------------------------

export const SOURCE_HELP: Record<ProgramSource, { label: string; description: string }> = {
  CUSTOM: {
    label: 'Custom',
    description: 'Built from scratch. Full control over every block, week, and session.',
  },
  IMPORTED: {
    label: 'Imported',
    description:
      'Brought in from an external file or data source and converted to a local program.',
  },
  SHARED: {
    label: 'Shared',
    description:
      'Received from another user. A copy you can modify without affecting the original.',
  },
  MARKETPLACE: {
    label: 'Marketplace',
    description: 'Acquired from the program marketplace. (Future)',
  },
  AI_GENERATED: {
    label: 'AI Generated',
    description:
      'Produced by the training AI based on your goals, history, and preferences. (Future)',
  },
  COACH_ASSIGNED: {
    label: 'Coach Assigned',
    description: 'Prescribed by a coach. Editable only if the coach grants modification access.',
  },
  TEMPLATE: {
    label: 'Template',
    description:
      'A pre-built starting point. Clone it and tailor blocks, weeks, and sessions to fit your needs.',
  },
}
