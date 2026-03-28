import type { BlockType } from '@/domain/types'

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
  { dayOfWeek: 1, label: 'M' },
  { dayOfWeek: 2, label: 'T' },
  { dayOfWeek: 3, label: 'W' },
  { dayOfWeek: 4, label: 'T' },
  { dayOfWeek: 5, label: 'F' },
  { dayOfWeek: 6, label: 'S' },
  { dayOfWeek: 0, label: 'S' },
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

// ---------------------------------------------------------------------------
// Source labels for program source badges
// ---------------------------------------------------------------------------

export const SOURCE_LABELS: Record<string, string> = {
  CUSTOM: 'CUSTOM',
  IMPORTED: 'IMPORTED',
  SHARED: 'SHARED',
  MARKETPLACE: 'MARKETPLACE',
  AI_GENERATED: 'AI',
  COACH_ASSIGNED: 'COACH',
  TEMPLATE: 'TEMPLATE',
}
