import type { BlockType, ProgramSource, SessionType } from '@/domain/types'

// ---------------------------------------------------------------------------
// DayOfWeek type alias (0=Sun, 1=Mon, ..., 6=Sat -- JS convention)
// ---------------------------------------------------------------------------

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export const BLOCK_TYPES: Array<{ value: BlockType; label: string }> = [
  { value: 'ACCUMULATION', label: 'ACCUMULATION' },
  { value: 'INTENSIFICATION', label: 'INTENSIFICATION' },
  { value: 'REALIZATION', label: 'REALIZATION' },
  { value: 'DELOAD', label: 'DELOAD' },
  { value: 'TEST', label: 'TEST' },
]

// ---------------------------------------------------------------------------
// Day column headers for 7-day grids (Mon through Sun)
// ---------------------------------------------------------------------------

export const DAY_COLUMNS: Array<{ dayOfWeek: DayOfWeek; label: string }> = [
  { dayOfWeek: 1, label: 'Mo' },
  { dayOfWeek: 2, label: 'Tu' },
  { dayOfWeek: 3, label: 'We' },
  { dayOfWeek: 4, label: 'Th' },
  { dayOfWeek: 5, label: 'Fr' },
  { dayOfWeek: 6, label: 'Sa' },
  { dayOfWeek: 0, label: 'Su' },
]

// ---------------------------------------------------------------------------
// Weekday-only columns (Mon through Fri) -- default view for readability
// ---------------------------------------------------------------------------

export const WEEKDAY_COLUMNS: Array<{ dayOfWeek: DayOfWeek; label: string }> = [
  { dayOfWeek: 1, label: 'Mo' },
  { dayOfWeek: 2, label: 'Tu' },
  { dayOfWeek: 3, label: 'We' },
  { dayOfWeek: 4, label: 'Th' },
  { dayOfWeek: 5, label: 'Fr' },
]

// ---------------------------------------------------------------------------
// Day labels -- full names, keyed 0-6
// ---------------------------------------------------------------------------

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

// ---------------------------------------------------------------------------
// Day abbreviations -- short names, keyed 0-6
// ---------------------------------------------------------------------------

export const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

// ---------------------------------------------------------------------------
// Day order for iteration (Mon through Sun)
// ---------------------------------------------------------------------------

export const DAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5]

// ---------------------------------------------------------------------------
// Session type visual mappings (tint, badge colours, borders)
// ---------------------------------------------------------------------------

export const SESSION_TINT = {
  STRENGTH: 'session-tint-strength',
  CONDITIONING: 'session-tint-conditioning',
  SE: 'session-tint-se',
  MIXED: 'session-tint-mixed',
  EVENT: 'session-tint-event',
} satisfies Record<SessionType, string>

export const SESSION_TYPE_BADGE = {
  STRENGTH: 'bg-ember/10 text-ember',
  CONDITIONING: 'bg-quenched/10 text-quenched',
  SE: 'bg-arc/10 text-arc',
  MIXED: 'bg-bone-white/10 text-bone-white',
  EVENT: 'bg-ember/15 text-ember',
} satisfies Record<SessionType, string>

// ---------------------------------------------------------------------------
// Source labels for program source badges
// ---------------------------------------------------------------------------

export const BLOCK_TYPE_STYLES = {
  ACCUMULATION: 'bg-quenched/15 text-quenched',
  INTENSIFICATION: 'bg-ember/15 text-ember',
  REALIZATION: 'bg-forge/15 text-forge',
  DELOAD: 'bg-arc/15 text-arc',
  TEST: 'bg-warm-ash/15 text-warm-ash',
} satisfies Record<BlockType, string>

export const SOURCE_LABELS = {
  CUSTOM: 'CUSTOM',
  IMPORTED: 'IMPORTED',
  SHARED: 'SHARED',
  MARKETPLACE: 'MARKETPLACE',
  AI_GENERATED: 'AI',
  COACH_ASSIGNED: 'COACH',
  TEMPLATE: 'TEMPLATE',
} satisfies Record<ProgramSource, string>

export const SESSION_BORDER = {
  STRENGTH: 'border-l-2 border-ember',
  CONDITIONING: 'border-l-2 border-quenched',
  SE: 'border-l-2 border-arc',
  MIXED: 'border-l-2 border-bone-white/40',
  EVENT: 'border-l-2 border-ember',
} satisfies Record<SessionType, string>
