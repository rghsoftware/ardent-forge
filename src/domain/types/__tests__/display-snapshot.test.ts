import { describe, it, expect } from 'vitest'
import {
  displaySnapshotSchema,
  displaySetSchema,
  displayEventTypeSchema,
  restTimerStateSchema,
  idleSnapshotSchema,
} from '@/domain/types'

// ---------------------------------------------------------------------------
// Helpers -- minimal valid fixtures
// ---------------------------------------------------------------------------

const validSet = {
  set_number: 1,
  prescribed: { reps: 5, weight: { value: 225, unit: 'lb' } },
  actual: { reps: 5, weight: { value: 225, unit: 'lb' } },
  completed: true,
}

const validSnapshot = {
  user_id: 'user-abc',
  display_name: 'Robert',
  session_name: 'Push Day',
  workout_started_at: '2026-04-03T10:00:00Z',
  current_exercise: 'Bench Press',
  exercise_index: 0,
  total_exercises: 3,
  sets: [validSet],
  rest_timer: { state: 'idle' as const },
  session_type: 'STRENGTH' as const,
  is_visible: true as const,
}

// ---------------------------------------------------------------------------
// displaySnapshotSchema
// ---------------------------------------------------------------------------

describe('displaySnapshotSchema', () => {
  it('accepts a valid complete snapshot', () => {
    expect(displaySnapshotSchema.safeParse(validSnapshot).success).toBe(true)
  })

  it('rejects when user_id is missing', () => {
    const { user_id: _, ...bad } = validSnapshot
    expect(displaySnapshotSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects when current_exercise is missing', () => {
    const { current_exercise: _, ...bad } = validSnapshot
    expect(displaySnapshotSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts rest_timer with state running when started_at and total_seconds are present', () => {
    const snapshot = {
      ...validSnapshot,
      rest_timer: {
        state: 'running' as const,
        started_at: '2026-04-03T10:05:00Z',
        total_seconds: 90,
      },
    }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejects rest_timer with state running when started_at is missing', () => {
    const snapshot = {
      ...validSnapshot,
      rest_timer: { state: 'running', total_seconds: 90 },
    }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects rest_timer with state running when total_seconds is missing', () => {
    const snapshot = {
      ...validSnapshot,
      rest_timer: { state: 'running', started_at: '2026-04-03T10:05:00Z' },
    }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('accepts rest_timer with state idle and no extra fields', () => {
    const snapshot = { ...validSnapshot, rest_timer: { state: 'idle' as const } }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejects is_visible set to false', () => {
    const snapshot = { ...validSnapshot, is_visible: false }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects negative exercise_index', () => {
    const snapshot = { ...validSnapshot, exercise_index: -1 }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects total_exercises of zero', () => {
    const snapshot = { ...validSnapshot, total_exercises: 0 }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('accepts exercise_index of zero', () => {
    const snapshot = { ...validSnapshot, exercise_index: 0 }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejects non-integer exercise_index', () => {
    const snapshot = { ...validSnapshot, exercise_index: 1.5 }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('accepts empty sets array', () => {
    const snapshot = { ...validSnapshot, sets: [] }
    expect(displaySnapshotSchema.safeParse(snapshot).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// restTimerStateSchema
// ---------------------------------------------------------------------------

describe('restTimerStateSchema', () => {
  it('accepts idle state', () => {
    expect(restTimerStateSchema.safeParse({ state: 'idle' }).success).toBe(true)
  })

  it('accepts running state with required fields', () => {
    const result = restTimerStateSchema.safeParse({
      state: 'running',
      started_at: '2026-04-03T10:00:00Z',
      total_seconds: 60,
    })
    expect(result.success).toBe(true)
  })

  it('rejects running state with zero total_seconds', () => {
    const result = restTimerStateSchema.safeParse({
      state: 'running',
      started_at: '2026-04-03T10:00:00Z',
      total_seconds: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects running state with negative total_seconds', () => {
    const result = restTimerStateSchema.safeParse({
      state: 'running',
      started_at: '2026-04-03T10:00:00Z',
      total_seconds: -10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown state value', () => {
    expect(restTimerStateSchema.safeParse({ state: 'paused' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// displaySetSchema
// ---------------------------------------------------------------------------

describe('displaySetSchema', () => {
  it('accepts a valid set with prescribed and actual', () => {
    expect(displaySetSchema.safeParse(validSet).success).toBe(true)
  })

  it('accepts a set without prescribed or actual (both optional)', () => {
    const minimal = { set_number: 1, completed: false }
    expect(displaySetSchema.safeParse(minimal).success).toBe(true)
  })

  it('accepts a set with only prescribed', () => {
    const result = displaySetSchema.safeParse({
      set_number: 2,
      prescribed: { reps: 8, weight: { value: 135, unit: 'lb' } },
      completed: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a set with only actual', () => {
    const result = displaySetSchema.safeParse({
      set_number: 3,
      actual: { reps: 10, weight: { value: 100, unit: 'kg' } },
      completed: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects set_number less than 1', () => {
    const bad = { set_number: 0, completed: false }
    expect(displaySetSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects negative set_number', () => {
    const bad = { set_number: -1, completed: false }
    expect(displaySetSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects non-integer set_number', () => {
    const bad = { set_number: 1.5, completed: false }
    expect(displaySetSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects missing completed field', () => {
    const bad = { set_number: 1 }
    expect(displaySetSchema.safeParse(bad).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// displayEventTypeSchema
// ---------------------------------------------------------------------------

describe('displayEventTypeSchema', () => {
  it.each(['workout_snapshot', 'session_ended', 'focus', 'unfocus', 'idle_snapshot'] as const)(
    'accepts valid event type "%s"',
    (eventType) => {
      expect(displayEventTypeSchema.safeParse(eventType).success).toBe(true)
    },
  )

  it('rejects an invalid event type', () => {
    expect(displayEventTypeSchema.safeParse('pause').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(displayEventTypeSchema.safeParse('').success).toBe(false)
  })

  it('rejects a number', () => {
    expect(displayEventTypeSchema.safeParse(42).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// idleSnapshotSchema
// ---------------------------------------------------------------------------

describe('idleSnapshotSchema', () => {
  const validIdleSnapshot = {
    server_time: '2026-04-04T10:00:00Z',
    scheduled_sessions: [
      {
        display_name: 'Robert',
        session_name: 'Push Day',
        session_type: 'STRENGTH' as const,
        day_label: 'Day 1',
      },
    ],
    next_session: {
      display_name: 'Robert',
      session_name: 'Push Day',
    },
  }

  it('accepts a valid payload with sessions and next_session', () => {
    expect(idleSnapshotSchema.safeParse(validIdleSnapshot).success).toBe(true)
  })

  it('accepts a valid payload with next_session null', () => {
    const snapshot = { ...validIdleSnapshot, next_session: null }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejects when server_time is missing', () => {
    const { server_time: _, ...bad } = validIdleSnapshot
    expect(idleSnapshotSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects scheduled_sessions entry with missing display_name', () => {
    const snapshot = {
      ...validIdleSnapshot,
      scheduled_sessions: [
        {
          session_name: 'Push Day',
          session_type: 'STRENGTH' as const,
          day_label: 'Day 1',
        },
      ],
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('idle_snapshot is a valid DisplayEventType', () => {
    expect(displayEventTypeSchema.safeParse('idle_snapshot').success).toBe(true)
  })

  it('rejects invalid session_type value', () => {
    const snapshot = {
      ...validIdleSnapshot,
      scheduled_sessions: [
        {
          display_name: 'Robert',
          session_name: 'Push Day',
          session_type: 'YOGA',
          day_label: 'Day 1',
        },
      ],
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('accepts empty scheduled_sessions array', () => {
    const snapshot = { ...validIdleSnapshot, scheduled_sessions: [] }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(true)
  })

  it('rejects invalid ISO date string for server_time', () => {
    const snapshot = { ...validIdleSnapshot, server_time: 'not-a-date' }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects empty string display_name in scheduled_sessions', () => {
    const snapshot = {
      ...validIdleSnapshot,
      scheduled_sessions: [
        {
          display_name: '',
          session_name: 'Push Day',
          session_type: 'STRENGTH' as const,
          day_label: 'Day 1',
        },
      ],
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects empty string session_name in scheduled_sessions', () => {
    const snapshot = {
      ...validIdleSnapshot,
      scheduled_sessions: [
        {
          display_name: 'Robert',
          session_name: '',
          session_type: 'STRENGTH' as const,
          day_label: 'Day 1',
        },
      ],
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects empty string day_label in scheduled_sessions', () => {
    const snapshot = {
      ...validIdleSnapshot,
      scheduled_sessions: [
        {
          display_name: 'Robert',
          session_name: 'Push Day',
          session_type: 'STRENGTH' as const,
          day_label: '',
        },
      ],
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it('rejects empty string display_name in next_session', () => {
    const snapshot = {
      ...validIdleSnapshot,
      next_session: {
        display_name: '',
        session_name: 'Push Day',
      },
    }
    expect(idleSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })
})
