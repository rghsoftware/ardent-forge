import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ShareToken } from '../../domain/types'
import { TauriAdapter, AdapterError } from '../tauri-adapter'

// ===========================================================================
// Mock @tauri-apps/api/core
// ===========================================================================

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// ===========================================================================
// Timestamps
// ===========================================================================

const now = '2025-06-15T10:00:00Z'
const later = '2025-06-15T11:30:00Z'

// ===========================================================================
// Tauri Response Fixtures
//
// These match the Tauri*Response interfaces in tauri-adapter.ts:
// - booleans as 0/1 integers
// - JSON columns as stringified JSON
// - snake_case field names
// ===========================================================================

const tauriExerciseResponse = {
  id: 'ex-001',
  name: 'Barbell Back Squat',
  aliases: JSON.stringify(['Back Squat', 'Low Bar Squat']),
  category: 'BARBELL',
  movement_pattern: 'SQUAT',
  muscle_groups: JSON.stringify({
    primary: ['QUADS', 'GLUTES'],
    secondary: ['HAMSTRINGS', 'CORE'],
  }),
  is_bilateral: 1,
  supports_1rm: 1,
  equipment_required: JSON.stringify(['BARBELL', 'SQUAT_RACK']),
  is_custom: 0,
  is_public: 0,
  created_at: now,
  updated_at: now,
}

const tauriExerciseResponse2 = {
  ...tauriExerciseResponse,
  id: 'ex-002',
  name: 'Bench Press',
  aliases: JSON.stringify([]),
  movement_pattern: 'PUSH',
  muscle_groups: JSON.stringify({ primary: ['CHEST'], secondary: ['TRICEPS'] }),
}

const tauriWorkoutLogResponse = {
  id: 'wl-001',
  user_id: 'user-001',
  title: 'Upper Body Day',
  started_at: now,
  completed_at: later,
  session_template_id: 'st-001',
  program_context: JSON.stringify({
    programId: 'prog-001',
    blockId: 'block-001',
    weekNumber: 3,
    dayLabel: 'Monday',
  }),
  overall_notes: 'Felt strong today',
  perceived_difficulty: 7,
  bodyweight_at_session: JSON.stringify({ value: 185, unit: 'lb' }),
  created_at: now,
  updated_at: later,
}

const tauriLoggedActivityGroupResponse = {
  id: 'lag-001',
  workout_log_id: 'wl-001',
  user_id: 'user-001',
  group_type: 'STRAIGHT_SETS',
  ordinal: 1,
  actual_rounds_completed: null,
  completion_time: null,
  created_at: now,
  updated_at: now,
}

const tauriLoggedActivityResponse = {
  id: 'la-001',
  logged_group_id: 'lag-001',
  user_id: 'user-001',
  exercise_id: 'ex-001',
  ordinal: 1,
  notes: 'Focus on depth',
  created_at: now,
  updated_at: now,
}

const tauriLoggedSetResponse = {
  id: 'ls-001',
  logged_activity_id: 'la-001',
  user_id: 'user-001',
  set_number: 1,
  set_type: 'WORKING',
  prescribed: JSON.stringify({ reps: 5, weight: { value: 225, unit: 'lb' } }),
  actual_reps: 5,
  actual_weight: JSON.stringify({ value: 225, unit: 'lb' }),
  actual_duration: null,
  actual_distance: null,
  actual_pace: null,
  actual_heart_rate: null,
  ruck_load: null,
  elevation_gain: null,
  rpe: 8,
  completed: 1,
  notes: 'Solid set',
  created_at: now,
  updated_at: now,
}

const tauriUserProfileResponse = {
  id: 'user-001',
  display_name: 'Coach Hamilton',
  display_visible: 1,
  preferred_units: 'IMPERIAL',
  bodyweight: JSON.stringify({ value: 200, unit: 'lb' }),
  training_age: JSON.stringify({ seconds: 157680000 }),
  exercise_maxes: JSON.stringify({
    'ex-001': {
      weight: { value: 405, unit: 'lb' },
      testedAt: '2025-06-01T00:00:00Z',
      estimated: false,
    },
  }),
  max_reps: JSON.stringify({ 'ex-pullup-001': 20 }),
  created_at: now,
  updated_at: now,
}

const tauriOneRepMaxHistoryResponse = {
  id: 'ormh-001',
  user_id: 'user-001',
  exercise_id: 'ex-001',
  weight: JSON.stringify({ value: 405, unit: 'lb' }),
  estimated: 0,
  recorded_at: '2025-06-10T09:00:00Z',
  created_at: now,
}

const tauriSessionTemplateResponse = {
  id: 'st-001',
  user_id: 'user-001',
  name: 'Heavy Upper',
  description: 'Upper body strength',
  category: 'STRENGTH',
  rest_between_groups: JSON.stringify({ seconds: 120 }),
  time_cap: null,
  scoring: 'NONE',
  is_public: 0,
  last_assigned_at: null,
  created_at: now,
  updated_at: now,
}

const tauriActivityGroupResponse = {
  id: 'ag-001',
  session_template_id: 'st-001',
  group_type: 'STRAIGHT_SETS',
  ordinal: 1,
  rounds: null,
  rest_between_rounds: null,
  rest_between_activities: null,
  created_at: now,
  updated_at: now,
}

const tauriActivityResponse = {
  id: 'act-001',
  activity_group_id: 'ag-001',
  exercise_id: 'ex-001',
  ordinal: 1,
  set_scheme: JSON.stringify({
    type: 'fixedSets',
    sets: 3,
    reps: 5,
    load: { type: 'absolute', weight: { value: 135, unit: 'lb' } },
  }),
  notes: null,
  created_at: now,
  updated_at: now,
}

const tauriProgramResponse = {
  id: 'prog-001',
  user_id: 'user-001',
  name: 'Test Program',
  description: 'A test program',
  source: 'CUSTOM',
  duration_weeks: 12,
  is_public: 0,
  created_by: 'user-001',
  created_at: now,
  updated_at: now,
}

const tauriBlockResponse = {
  id: 'block-001',
  program_id: 'prog-001',
  name: 'Accumulation',
  ordinal: 1,
  duration_weeks: 4,
  block_type: 'ACCUMULATION',
  created_at: now,
  updated_at: now,
}

const tauriBlockWeekResponse = {
  id: 'bw-001',
  block_id: 'block-001',
  week_number: 1,
  created_at: now,
  updated_at: now,
}

const tauriScheduledSessionResponse = {
  id: 'ss-001',
  block_week_id: 'bw-001',
  day_of_week: 1,
  day_label: 'Day 1',
  session_type: 'STRENGTH',
  session_template_id: 'st-001',
  notes: null,
  created_at: now,
  updated_at: now,
}

const tauriProgramActivationResponse = {
  id: 'pa-001',
  user_id: 'user-001',
  program_id: 'prog-001',
  current_block_ordinal: 1,
  current_week_number: 2,
  start_date: '2025-06-01',
  created_at: now,
  updated_at: now,
}

const tauriWeekStatusResponse = {
  id: 'ws-001',
  activation_id: 'pa-001',
  block_ordinal: 1,
  week_number: 1,
  status: 'done',
  created_at: now,
}

const tauriWeekStatusResponse2 = {
  id: 'ws-002',
  activation_id: 'pa-001',
  block_ordinal: 1,
  week_number: 2,
  status: 'skipped',
  created_at: now,
}

const tauriAccountabilityGroupResponse = {
  id: 'grp-001',
  user_id: 'user-001',
  name: 'Morning Crew',
  description: 'Early morning training group',
  data_retention_days: 30,
  created_by: 'user-001',
  created_at: now,
  updated_at: now,
}

const tauriGroupMemberResponse = {
  id: 'gm-001',
  group_id: 'grp-001',
  user_id: 'user-001',
  role: 'COACH',
  share_history_before_join: 1,
  joined_at: now,
  created_at: now,
  updated_at: now,
}

const tauriGroupInviteResponse = {
  id: 'gi-001',
  group_id: 'grp-001',
  code: 'ABC123',
  created_by: 'user-001',
  expires_at: '2025-07-15T10:00:00Z',
  is_active: 1,
  created_at: now,
  updated_at: now,
}

const tauriDirectConnectionResponse = {
  id: 'dc-001',
  requester_id: 'user-001',
  recipient_id: 'user-002',
  status: 'ACTIVE',
  requester_grants_write: 1,
  recipient_grants_write: 0,
  accepted_at: later,
  created_at: now,
  updated_at: now,
}

const tauriConversationResponse = {
  id: 'conv-001',
  type: 'direct',
  title: null,
  group_id: null,
  created_at: now,
  updated_at: now,
}

const tauriConversationParticipantResponse = {
  id: 'cp-001',
  conversation_id: 'conv-001',
  user_id: 'user-001',
  last_read_at: now,
  is_archived: 0,
  joined_at: now,
  left_at: null,
}

const tauriConversationParticipantResponse2 = {
  ...tauriConversationParticipantResponse,
  id: 'cp-002',
  user_id: 'user-002',
}

const tauriMessageResponse = {
  id: 'msg-001',
  conversation_id: 'conv-001',
  sender_id: 'user-001',
  message_type: 'text',
  content: 'Hello there',
  created_at: now,
  updated_at: now,
  sync_status: null,
}

const tauriMessageResponse2 = {
  ...tauriMessageResponse,
  id: 'msg-002',
  sender_id: 'user-002',
  content: 'Hey!',
  created_at: later,
  updated_at: later,
}

const tauriMediaAttachmentResponse = {
  id: 'ma-001',
  message_id: 'msg-001',
  provider: 'cloudflare_stream',
  provider_asset_id: 'asset-001',
  media_type: 'video',
  original_filename: 'workout.mp4',
  mime_type: 'video/mp4',
  thumbnail_url: 'https://cdn.example.com/thumb.jpg',
  playback_url: 'https://cdn.example.com/play.m3u8',
  duration_seconds: 120,
  file_size_bytes: 5242880,
  status: 'ready',
  created_at: now,
  updated_at: now,
}

const tauriGroupActivityFeedEntry = {
  id: 'wl-feed-001',
  user_id: 'user-002',
  title: 'Leg Day',
  started_at: now,
  completed_at: later,
  duration_seconds: 5400,
  exercise_count: 5,
  group_id: 'grp-001',
  member_role: 'MEMBER',
}

const tauriConnectionActivityFeedEntry = {
  id: 'wl-feed-002',
  user_id: 'user-002',
  title: 'Upper Body',
  started_at: now,
  completed_at: later,
  duration_seconds: 3600,
  exercise_count: 4,
  connection_id: 'dc-001',
}

// ===========================================================================
// Test suite
// ===========================================================================

let adapter: TauriAdapter

beforeEach(() => {
  vi.clearAllMocks()
  adapter = new TauriAdapter('user-001')
})

// ===========================================================================
// Error handling & AdapterError
// ===========================================================================

describe('Error handling', () => {
  describe('AdapterError wrapping', () => {
    it('wraps TauriAppError into AdapterError with kind and message', async () => {
      const appError = { kind: 'NOT_FOUND', message: 'Exercise not found', field: 'id' }
      mockInvoke.mockRejectedValue(appError)

      try {
        await adapter.getExercise('ex-999')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AdapterError)
        const ae = err as AdapterError
        expect(ae.kind).toBe('NOT_FOUND')
        expect(ae.message).toBe('Exercise not found')
        expect(ae.field).toBe('id')
        expect(ae.name).toBe('AdapterError')
      }
    })

    it('wraps VALIDATION errors with field info', async () => {
      const appError = { kind: 'VALIDATION', message: 'Name too short', field: 'name' }
      mockInvoke.mockRejectedValue(appError)

      try {
        await adapter.getExercise('ex-001')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AdapterError)
        const ae = err as AdapterError
        expect(ae.kind).toBe('VALIDATION')
        expect(ae.field).toBe('name')
      }
    })

    it('passes through non-TauriAppError errors unchanged', async () => {
      const rawError = new Error('Network failure')
      mockInvoke.mockRejectedValue(rawError)

      try {
        await adapter.getExercise('ex-001')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBe(rawError)
        expect(err).not.toBeInstanceOf(AdapterError)
      }
    })

    it('passes through string errors unchanged', async () => {
      mockInvoke.mockRejectedValue('some string error')

      try {
        await adapter.getExercise('ex-001')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBe('some string error')
      }
    })

    it('wraps DATABASE errors into AdapterError', async () => {
      const appError = { kind: 'DATABASE', message: 'disk I/O error' }
      mockInvoke.mockRejectedValue(appError)

      try {
        await adapter.getExercises()
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AdapterError)
        const ae = err as AdapterError
        expect(ae.kind).toBe('DATABASE')
        expect(ae.message).toBe('disk I/O error')
        expect(ae.name).toBe('AdapterError')
      }
    })

    it('wraps INTERNAL errors into AdapterError', async () => {
      const appError = { kind: 'INTERNAL', message: 'unexpected state' }
      mockInvoke.mockRejectedValue(appError)

      try {
        await adapter.getExercise('ex-001')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(AdapterError)
        const ae = err as AdapterError
        expect(ae.kind).toBe('INTERNAL')
        expect(ae.message).toBe('unexpected state')
        expect(ae.name).toBe('AdapterError')
      }
    })
  })
})

// ===========================================================================
// Malformed JSON handling (parseJson edge cases)
// ===========================================================================

describe('Malformed JSON handling', () => {
  it('throws when aliases contains malformed JSON', async () => {
    const badResponse = { ...tauriExerciseResponse, aliases: 'not-valid-json{' }
    mockInvoke.mockResolvedValue([badResponse])

    await expect(adapter.getExercises()).rejects.toThrow('Invalid JSON in column "aliases"')
  })

  it('throws when muscle_groups contains malformed JSON', async () => {
    const badResponse = { ...tauriExerciseResponse, muscle_groups: '{broken' }
    mockInvoke.mockResolvedValue(badResponse)

    await expect(adapter.getExercise('ex-001')).rejects.toThrow(
      'Invalid JSON in column "muscle_groups"',
    )
  })

  it('throws when equipment_required contains malformed JSON', async () => {
    const badResponse = { ...tauriExerciseResponse, equipment_required: '[not,json' }
    mockInvoke.mockResolvedValue([badResponse])

    await expect(adapter.getExercises()).rejects.toThrow(
      'Invalid JSON in column "equipment_required"',
    )
  })

  it('propagates downstream errors when parseJson returns null for null input', async () => {
    const nullFieldsResponse = {
      ...tauriExerciseResponse,
      aliases: null,
    }
    mockInvoke.mockResolvedValue([nullFieldsResponse])

    // parseJson returns null for null input, but the downstream Zod schema
    // in toExercise expects an array, so it throws a validation error
    await expect(adapter.getExercises()).rejects.toThrow()
  })

  it('includes raw value preview in error message for malformed JSON', async () => {
    const longBadJson = 'x'.repeat(200)
    const badResponse = { ...tauriExerciseResponse, aliases: longBadJson }
    mockInvoke.mockResolvedValue(badResponse)

    try {
      await adapter.getExercise('ex-001')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      const msg = (err as Error).message
      // parseJson truncates raw value to first 100 chars
      expect(msg).toContain('Raw value (first 100 chars)')
      expect(msg).toContain('x'.repeat(100))
    }
  })
})

// ===========================================================================
// Exercise operations
// ===========================================================================

describe('Exercise operations', () => {
  describe('getExercises', () => {
    it('returns mapped exercises with no filters', async () => {
      mockInvoke.mockResolvedValue([tauriExerciseResponse, tauriExerciseResponse2])

      const result = await adapter.getExercises()

      expect(mockInvoke).toHaveBeenCalledWith('get_exercises', { filters: null })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('ex-001')
      expect(result[0].name).toBe('Barbell Back Squat')
      expect(result[0].category).toBe('BARBELL')
      expect(result[0].movementPattern).toBe('SQUAT')
      // Verifies JSON parsing of muscle_groups
      expect(result[0].muscleGroups).toEqual({
        primary: ['QUADS', 'GLUTES'],
        secondary: ['HAMSTRINGS', 'CORE'],
      })
      // Verifies intToBool conversion
      expect(result[0].isBilateral).toBe(true)
      expect(result[0].supports1RM).toBe(true)
      expect(result[0].isCustom).toBe(false)
      // Verifies JSON parsing of aliases
      expect(result[0].aliases).toEqual(['Back Squat', 'Low Bar Squat'])
      // Verifies JSON parsing of equipment
      expect(result[0].equipmentRequired).toEqual(['BARBELL', 'SQUAT_RACK'])
    })

    it('passes filter arguments through to invoke correctly', async () => {
      mockInvoke.mockResolvedValue([tauriExerciseResponse])

      await adapter.getExercises({
        category: 'BARBELL',
        movementPattern: 'SQUAT',
        searchQuery: 'squat',
        isCustom: false,
      })

      expect(mockInvoke).toHaveBeenCalledWith('get_exercises', {
        filters: {
          category: 'BARBELL',
          movement_pattern: 'SQUAT',
          search: 'squat',
          is_custom: false,
        },
      })
    })

    it('applies client-side muscle group filtering', async () => {
      mockInvoke.mockResolvedValue([tauriExerciseResponse, tauriExerciseResponse2])

      const result = await adapter.getExercises({ muscleGroup: 'QUADS' })

      // Only ex-001 has QUADS in primary
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ex-001')
    })

    it('returns empty array when no exercises found', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getExercises()

      expect(result).toEqual([])
    })
  })

  describe('getExercise', () => {
    it('returns mapped exercise when found', async () => {
      mockInvoke.mockResolvedValue(tauriExerciseResponse)

      const result = await adapter.getExercise('ex-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_exercise', { id: 'ex-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('ex-001')
      expect(result!.name).toBe('Barbell Back Squat')
    })

    it('returns null when not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getExercise('ex-999')

      expect(result).toBeNull()
    })
  })

  describe('createExercise', () => {
    it('creates exercise and returns mapped result', async () => {
      const createdResponse = { ...tauriExerciseResponse, id: 'ex-new', is_custom: 1 }
      mockInvoke.mockResolvedValue(createdResponse)

      const result = await adapter.createExercise({
        name: 'Barbell Back Squat',
        aliases: ['Back Squat', 'Low Bar Squat'],
        category: 'BARBELL',
        movementPattern: 'SQUAT',
        muscleGroups: { primary: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'CORE'] },
        isBilateral: true,
        supports1RM: true,
        equipmentRequired: ['BARBELL', 'SQUAT_RACK'],
        isCustom: true,
        isPublic: false,
      })

      expect(mockInvoke).toHaveBeenCalledWith('create_exercise', {
        exercise: expect.objectContaining({
          name: 'Barbell Back Squat',
          category: 'BARBELL',
          movement_pattern: 'SQUAT',
        }),
      })
      expect(result.id).toBe('ex-new')
      expect(result.isCustom).toBe(true)
    })
  })
})

// ===========================================================================
// Workout log operations
// ===========================================================================

describe('Workout log operations', () => {
  describe('getWorkoutLogs', () => {
    it('returns mapped workout logs', async () => {
      mockInvoke.mockResolvedValue([tauriWorkoutLogResponse])

      const result = await adapter.getWorkoutLogs('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_logs', {
        user_id: 'user-001',
        limit: null,
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('wl-001')
      expect(result[0].userId).toBe('user-001')
      expect(result[0].title).toBe('Upper Body Day')
      expect(result[0].completedAt).toBe(later)
      // Verifies JSON parsing of program_context
      expect(result[0].programContext).toEqual({
        programId: 'prog-001',
        blockId: 'block-001',
        weekNumber: 3,
        dayLabel: 'Monday',
      })
      // Verifies JSON parsing of bodyweight_at_session
      expect(result[0].bodyweightAtSession).toEqual({ value: 185, unit: 'lb' })
    })

    it('passes limit parameter', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getWorkoutLogs('user-001', 5)

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_logs', {
        user_id: 'user-001',
        limit: 5,
      })
    })

    it('returns empty array when no logs exist', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getWorkoutLogs('user-001')

      expect(result).toEqual([])
    })
  })

  describe('getWorkoutLogsSummary', () => {
    it('returns summary with exercise names and set counts', async () => {
      mockInvoke.mockResolvedValue([
        {
          log: tauriWorkoutLogResponse,
          exercise_names: ['Squat', 'Bench'],
          set_count: 12,
          exercise_count: 2,
        },
      ])

      const result = await adapter.getWorkoutLogsSummary('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_logs_summary', {
        user_id: 'user-001',
        limit: null,
        offset: null,
      })
      expect(result).toHaveLength(1)
      expect(result[0].exerciseNames).toEqual(['Squat', 'Bench'])
      expect(result[0].setCount).toBe(12)
      expect(result[0].exerciseCount).toBe(2)
      expect(result[0].log.id).toBe('wl-001')
    })

    it('passes limit and offset options', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getWorkoutLogsSummary('user-001', { limit: 10, offset: 5 })

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_logs_summary', {
        user_id: 'user-001',
        limit: 10,
        offset: 5,
      })
    })
  })

  describe('getWorkoutLog', () => {
    it('returns mapped log when found', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      const result = await adapter.getWorkoutLog('wl-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_log', { id: 'wl-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('wl-001')
    })

    it('returns null when not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getWorkoutLog('wl-999')

      expect(result).toBeNull()
    })
  })

  describe('getWorkoutLogFull', () => {
    it('returns full workout log with groups, activities, and sets', async () => {
      mockInvoke.mockResolvedValue({
        log: tauriWorkoutLogResponse,
        groups: [tauriLoggedActivityGroupResponse],
        activities: [tauriLoggedActivityResponse],
        sets: [tauriLoggedSetResponse],
      })

      const result = await adapter.getWorkoutLogFull('wl-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_workout_log_full', { id: 'wl-001' })
      expect(result).not.toBeNull()
      expect(result!.log.id).toBe('wl-001')
      expect(result!.groups).toHaveLength(1)
      expect(result!.groups[0].id).toBe('lag-001')
      expect(result!.groups[0].groupType).toBe('STRAIGHT_SETS')
      expect(result!.activities).toHaveLength(1)
      expect(result!.activities[0].id).toBe('la-001')
      expect(result!.activities[0].exerciseId).toBe('ex-001')
      expect(result!.sets).toHaveLength(1)
      expect(result!.sets[0].id).toBe('ls-001')
      // Verifies intToBool on completed
      expect(result!.sets[0].completed).toBe(true)
      // Verifies JSON parsing of prescribed
      expect(result!.sets[0].prescribed).toEqual({ reps: 5, weight: { value: 225, unit: 'lb' } })
    })

    it('returns null when workout log not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getWorkoutLogFull('wl-999')

      expect(result).toBeNull()
    })
  })

  describe('createWorkoutLog', () => {
    it('creates and returns mapped workout log', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      const result = await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: now,
      })

      expect(mockInvoke).toHaveBeenCalledWith('create_workout_log', {
        log: expect.objectContaining({
          user_id: 'user-001',
          started_at: expect.any(Number), // isoToUnixSeconds
        }),
      })
      expect(result.id).toBe('wl-001')
      expect(result.userId).toBe('user-001')
    })

    it('converts ISO timestamps to unix seconds for Rust', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: now,
        completedAt: later,
      })

      const callArgs = mockInvoke.mock.calls[0][1] as {
        log: { started_at: number; completed_at: number }
      }
      expect(callArgs.log.started_at).toBe(Math.floor(new Date(now).getTime() / 1000))
      expect(callArgs.log.completed_at).toBe(Math.floor(new Date(later).getTime() / 1000))
    })
  })

  describe('isoToUnixSeconds edge cases', () => {
    it('converts date-only ISO string to correct unix seconds', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: '2025-01-01T00:00:00Z',
      })

      const callArgs = mockInvoke.mock.calls[0][1] as {
        log: { started_at: number }
      }
      // 2025-01-01T00:00:00Z = 1735689600 unix seconds
      expect(callArgs.log.started_at).toBe(1735689600)
    })

    it('passes null completed_at when not provided', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: now,
      })

      const callArgs = mockInvoke.mock.calls[0][1] as {
        log: { completed_at: number | null }
      }
      expect(callArgs.log.completed_at).toBeNull()
    })

    it('converts timezone-offset ISO strings correctly', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      // +05:00 offset means 5 hours earlier in UTC
      await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: '2025-06-15T15:00:00+05:00',
      })

      const callArgs = mockInvoke.mock.calls[0][1] as {
        log: { started_at: number }
      }
      // 2025-06-15T15:00:00+05:00 = 2025-06-15T10:00:00Z
      expect(callArgs.log.started_at).toBe(
        Math.floor(new Date('2025-06-15T10:00:00Z').getTime() / 1000),
      )
    })

    it('produces NaN for invalid date strings (documents current behavior)', async () => {
      mockInvoke.mockResolvedValue(tauriWorkoutLogResponse)

      await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: 'not-a-date',
      })

      const callArgs = mockInvoke.mock.calls[0][1] as {
        log: { started_at: number }
      }
      // isoToUnixSeconds does not validate: new Date('not-a-date') => NaN
      expect(callArgs.log.started_at).toBeNaN()
    })
  })

  describe('updateWorkoutLog', () => {
    it('updates and returns mapped workout log', async () => {
      const updated = { ...tauriWorkoutLogResponse, title: 'Updated Title' }
      mockInvoke.mockResolvedValue(updated)

      const result = await adapter.updateWorkoutLog({
        id: 'wl-001',
        createdAt: now,
        updatedAt: later,
        userId: 'user-001',
        title: 'Updated Title',
        startedAt: now,
        completedAt: later,
      })

      expect(mockInvoke).toHaveBeenCalledWith('update_workout_log', {
        id: 'wl-001',
        title: 'Updated Title',
        completed_at: expect.any(Number),
        overall_notes: null,
        perceived_difficulty: null,
      })
      expect(result.id).toBe('wl-001')
    })
  })

  describe('deleteWorkoutLog', () => {
    it('deletes workout log without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.deleteWorkoutLog('wl-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('delete_workout_log', { id: 'wl-001' })
    })
  })

  describe('createWorkoutLogFull', () => {
    it('sends full workout data in correct shape and returns mapped result', async () => {
      mockInvoke.mockResolvedValue({
        log: tauriWorkoutLogResponse,
        groups: [tauriLoggedActivityGroupResponse],
        activities: [tauriLoggedActivityResponse],
        sets: [tauriLoggedSetResponse],
      })

      const result = await adapter.createWorkoutLogFull(
        {
          userId: 'user-001',
          startedAt: now,
          completedAt: later,
        },
        [
          {
            group: {
              workoutLogId: 'wl-001',
              groupType: 'STRAIGHT_SETS',
              ordinal: 1,
            },
            activities: [
              {
                activity: {
                  loggedGroupId: 'lag-001',
                  exerciseId: 'ex-001',
                  ordinal: 1,
                },
                sets: [
                  {
                    loggedActivityId: 'la-001',
                    setNumber: 1,
                    setType: 'WORKING',
                    completed: true,
                    rpe: 8,
                  },
                ],
              },
            ],
          },
        ],
        'user-001',
      )

      expect(mockInvoke).toHaveBeenCalledWith('create_workout_log_full', {
        input: expect.objectContaining({
          log: expect.objectContaining({ user_id: 'user-001' }),
          groups: expect.any(Array),
        }),
        user_id: 'user-001',
      })
      expect(result.log.id).toBe('wl-001')
      expect(result.groups).toHaveLength(1)
      expect(result.activities).toHaveLength(1)
      expect(result.sets).toHaveLength(1)
    })
  })
})

// ===========================================================================
// Logged entity operations
// ===========================================================================

describe('Logged entity operations', () => {
  describe('createLoggedActivityGroup', () => {
    it('creates and returns mapped group', async () => {
      mockInvoke.mockResolvedValue(tauriLoggedActivityGroupResponse)

      const result = await adapter.createLoggedActivityGroup(
        {
          workoutLogId: 'wl-001',
          groupType: 'STRAIGHT_SETS',
          ordinal: 1,
        },
        'user-001',
      )

      expect(mockInvoke).toHaveBeenCalledWith('create_logged_activity_group', {
        group: expect.objectContaining({
          workout_log_id: 'wl-001',
          group_type: 'STRAIGHT_SETS',
          ordinal: 1,
        }),
        user_id: 'user-001',
      })
      expect(result.id).toBe('lag-001')
      expect(result.workoutLogId).toBe('wl-001')
      expect(result.groupType).toBe('STRAIGHT_SETS')
    })
  })

  describe('createLoggedActivity', () => {
    it('creates and returns mapped activity', async () => {
      mockInvoke.mockResolvedValue(tauriLoggedActivityResponse)

      const result = await adapter.createLoggedActivity(
        {
          loggedGroupId: 'lag-001',
          exerciseId: 'ex-001',
          ordinal: 1,
        },
        'user-001',
      )

      expect(mockInvoke).toHaveBeenCalledWith('create_logged_activity', {
        activity: expect.objectContaining({
          logged_group_id: 'lag-001',
          exercise_id: 'ex-001',
          ordinal: 1,
        }),
        user_id: 'user-001',
      })
      expect(result.id).toBe('la-001')
      expect(result.exerciseId).toBe('ex-001')
    })
  })

  describe('createLoggedSet', () => {
    it('creates and returns mapped set with JSON-serialized fields', async () => {
      mockInvoke.mockResolvedValue(tauriLoggedSetResponse)

      const result = await adapter.createLoggedSet(
        {
          loggedActivityId: 'la-001',
          setNumber: 1,
          setType: 'WORKING',
          completed: true,
          rpe: 8,
          actualReps: 5,
          actualWeight: { value: 225, unit: 'lb' },
        },
        'user-001',
      )

      expect(mockInvoke).toHaveBeenCalledWith('create_logged_set', {
        set: expect.objectContaining({
          logged_activity_id: 'la-001',
          set_number: 1,
          set_type: 'WORKING',
        }),
        user_id: 'user-001',
      })
      expect(result.id).toBe('ls-001')
      expect(result.setType).toBe('WORKING')
      expect(result.completed).toBe(true)
      expect(result.actualWeight).toEqual({ value: 225, unit: 'lb' })
    })
  })

  describe('updateLoggedSet', () => {
    it('updates and returns mapped set', async () => {
      const updated = { ...tauriLoggedSetResponse, actual_reps: 6, rpe: 9 }
      mockInvoke.mockResolvedValue(updated)

      const result = await adapter.updateLoggedSet(
        {
          id: 'ls-001',
          loggedActivityId: 'la-001',
          setNumber: 1,
          setType: 'WORKING',
          completed: true,
          actualReps: 6,
          rpe: 9,
        },
        'user-001',
      )

      expect(mockInvoke).toHaveBeenCalledWith('update_logged_set', {
        set: expect.objectContaining({
          id: 'ls-001',
          logged_activity_id: 'la-001',
        }),
        user_id: 'user-001',
      })
      expect(result.id).toBe('ls-001')
    })
  })
})

// ===========================================================================
// User profile operations
// ===========================================================================

describe('User profile operations', () => {
  describe('getUserProfile', () => {
    it('returns mapped profile when found', async () => {
      mockInvoke.mockResolvedValue(tauriUserProfileResponse)

      const result = await adapter.getUserProfile('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_user_profile', { user_id: 'user-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('user-001')
      expect(result!.displayName).toBe('Coach Hamilton')
      expect(result!.preferredUnits).toBe('IMPERIAL')
      // Verifies JSON parsing of bodyweight
      expect(result!.bodyweight).toEqual({ value: 200, unit: 'lb' })
      // Verifies intToBool on display_visible
      expect(result!.displayVisible).toBe(true)
    })

    it('returns null when not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getUserProfile('user-999')

      expect(result).toBeNull()
    })
  })

  describe('updateUserProfile', () => {
    it('updates and returns mapped profile', async () => {
      mockInvoke.mockResolvedValue(tauriUserProfileResponse)

      const result = await adapter.updateUserProfile({
        id: 'user-001',
        displayName: 'Coach Hamilton',
        preferredUnits: 'IMPERIAL',
      })

      expect(mockInvoke).toHaveBeenCalledWith('update_user_profile', {
        profile: expect.objectContaining({
          id: 'user-001',
          display_name: 'Coach Hamilton',
          preferred_units: 'IMPERIAL',
        }),
      })
      expect(result.id).toBe('user-001')
      expect(result.displayName).toBe('Coach Hamilton')
    })
  })
})

// ===========================================================================
// 1RM operations
// ===========================================================================

describe('1RM operations', () => {
  describe('saveOneRepMax', () => {
    it('creates and returns mapped 1RM entry', async () => {
      mockInvoke.mockResolvedValue(tauriOneRepMaxHistoryResponse)

      const result = await adapter.saveOneRepMax({
        userId: 'user-001',
        exerciseId: 'ex-001',
        weight: { value: 405, unit: 'lb' },
        estimated: false,
        recordedAt: '2025-06-10T09:00:00Z',
      })

      expect(mockInvoke).toHaveBeenCalledWith('save_one_rep_max', {
        user_id: 'user-001',
        exercise_id: 'ex-001',
        weight: JSON.stringify({ value: 405, unit: 'lb' }),
        estimated: false,
        recorded_at: expect.any(Number), // isoToUnixSeconds
      })
      expect(result.id).toBe('ormh-001')
      expect(result.weight).toEqual({ value: 405, unit: 'lb' })
      // Verifies intToBool on estimated
      expect(result.estimated).toBe(false)
    })
  })

  describe('getOneRepMaxHistory', () => {
    it('returns mapped 1RM history', async () => {
      const ormh2 = { ...tauriOneRepMaxHistoryResponse, id: 'ormh-002' }
      mockInvoke.mockResolvedValue([tauriOneRepMaxHistoryResponse, ormh2])

      const result = await adapter.getOneRepMaxHistory('user-001', 'ex-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_one_rep_max_history', {
        user_id: 'user-001',
        exercise_id: 'ex-001',
      })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('ormh-001')
      expect(result[1].id).toBe('ormh-002')
    })

    it('returns empty array when no history', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getOneRepMaxHistory('user-001', 'ex-999')

      expect(result).toEqual([])
    })
  })
})

// ===========================================================================
// Exercise history operations
// ===========================================================================

describe('Exercise history operations', () => {
  describe('getRecentlyUsedExerciseIds', () => {
    it('returns exercise IDs from Rust command', async () => {
      mockInvoke.mockResolvedValue(['ex-001', 'ex-002'])

      const result = await adapter.getRecentlyUsedExerciseIds('user-001', 10)

      expect(mockInvoke).toHaveBeenCalledWith('get_recently_used_exercise_ids', {
        user_id: 'user-001',
        limit: 10,
      })
      expect(result).toEqual(['ex-001', 'ex-002'])
    })

    it('uses default limit of 10', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getRecentlyUsedExerciseIds('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_recently_used_exercise_ids', {
        user_id: 'user-001',
        limit: 10,
      })
    })
  })

  describe('getExerciseWorkoutHistory', () => {
    it('returns workout history with mapped logs and sets', async () => {
      mockInvoke.mockResolvedValue([
        {
          log: tauriWorkoutLogResponse,
          sets: [tauriLoggedSetResponse],
        },
      ])

      const result = await adapter.getExerciseWorkoutHistory('user-001', 'ex-001', 10)

      expect(mockInvoke).toHaveBeenCalledWith('get_exercise_workout_history', {
        user_id: 'user-001',
        exercise_id: 'ex-001',
        limit: 10,
      })
      expect(result).toHaveLength(1)
      expect(result[0].log.id).toBe('wl-001')
      expect(result[0].sets).toHaveLength(1)
      expect(result[0].sets[0].id).toBe('ls-001')
      expect(result[0].sets[0].completed).toBe(true)
    })

    it('uses default limit of 10', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getExerciseWorkoutHistory('user-001', 'ex-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_exercise_workout_history', {
        user_id: 'user-001',
        exercise_id: 'ex-001',
        limit: 10,
      })
    })
  })
})

// ===========================================================================
// Session template operations
// ===========================================================================

describe('Session template operations', () => {
  describe('getSessionTemplates', () => {
    it('returns mapped templates', async () => {
      mockInvoke.mockResolvedValue([tauriSessionTemplateResponse])

      const result = await adapter.getSessionTemplates('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_session_templates', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('st-001')
      expect(result[0].name).toBe('Heavy Upper')
      expect(result[0].category).toBe('STRENGTH')
      expect(result[0].scoring).toBe('NONE')
    })
  })

  describe('getSessionTemplate', () => {
    it('returns mapped template when found', async () => {
      mockInvoke.mockResolvedValue(tauriSessionTemplateResponse)

      const result = await adapter.getSessionTemplate('st-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_session_template', { id: 'st-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('st-001')
      expect(result!.scoring).toBe('NONE')
    })

    it('returns null when not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getSessionTemplate('st-999')

      expect(result).toBeNull()
    })
  })

  describe('getSessionTemplateFull', () => {
    it('returns full template with groups and activities', async () => {
      mockInvoke.mockResolvedValue({
        template: tauriSessionTemplateResponse,
        groups: [tauriActivityGroupResponse],
        activities: [tauriActivityResponse],
      })

      const result = await adapter.getSessionTemplateFull('st-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_session_template_full', { id: 'st-001' })
      expect(result).not.toBeNull()
      expect(result!.template.id).toBe('st-001')
      expect(result!.groups).toHaveLength(1)
      expect(result!.groups[0].id).toBe('ag-001')
      expect(result!.activities).toHaveLength(1)
      expect(result!.activities[0].id).toBe('act-001')
      expect(result!.eventItems).toEqual([])
    })

    it('returns null when template not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getSessionTemplateFull('st-999')

      expect(result).toBeNull()
    })
  })

  describe('createSessionTemplateFull', () => {
    it('creates template with groups and activities', async () => {
      mockInvoke.mockResolvedValue({
        template: tauriSessionTemplateResponse,
        groups: [tauriActivityGroupResponse],
        activities: [tauriActivityResponse],
      })

      const result = await adapter.createSessionTemplateFull(
        {
          userId: 'user-001',
          name: 'Heavy Upper',
          category: 'STRENGTH',
          scoring: 'NONE',
          isPublic: false,
        },
        [
          {
            group: {
              sessionTemplateId: 'st-001',
              groupType: 'STRAIGHT_SETS',
              ordinal: 1,
            },
            activities: [
              {
                exerciseId: 'ex-001',
                ordinal: 1,
                setScheme: {
                  type: 'fixedSets' as const,
                  sets: 3,
                  reps: 5,
                  load: { type: 'absolute' as const, weight: { value: 135, unit: 'lb' as const } },
                },
              },
            ],
          },
        ],
      )

      expect(mockInvoke).toHaveBeenCalledWith('create_session_template_full', {
        template: expect.objectContaining({
          name: 'Heavy Upper',
          category: 'STRENGTH',
        }),
        groups: expect.any(Array),
      })
      expect(result.template.id).toBe('st-001')
      expect(result.groups).toHaveLength(1)
      expect(result.activities).toHaveLength(1)
      expect(result.eventItems).toEqual([])
    })
  })

  describe('updateSessionTemplateFull', () => {
    it('updates template and returns mapped result', async () => {
      mockInvoke.mockResolvedValue({
        template: tauriSessionTemplateResponse,
        groups: [tauriActivityGroupResponse],
        activities: [tauriActivityResponse],
      })

      const result = await adapter.updateSessionTemplateFull(
        {
          id: 'st-001',
          createdAt: now,
          updatedAt: now,
          userId: 'user-001',
          name: 'Heavy Upper Updated',
          category: 'STRENGTH',
          scoring: 'NONE',
          isPublic: false,
        },
        [
          {
            group: {
              id: 'ag-001',
              sessionTemplateId: 'st-001',
              groupType: 'STRAIGHT_SETS',
              ordinal: 1,
            },
            activities: [
              {
                exerciseId: 'ex-001',
                ordinal: 1,
                setScheme: {
                  type: 'fixedSets' as const,
                  sets: 3,
                  reps: 5,
                  load: { type: 'absolute' as const, weight: { value: 135, unit: 'lb' as const } },
                },
              },
            ],
          },
        ],
      )

      expect(mockInvoke).toHaveBeenCalledWith('update_session_template_full', {
        template: expect.objectContaining({
          id: 'st-001',
          name: 'Heavy Upper Updated',
        }),
        groups: expect.any(Array),
      })
      expect(result.template.id).toBe('st-001')
    })
  })

  describe('deleteSessionTemplate', () => {
    it('deletes template without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.deleteSessionTemplate('st-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('delete_session_template', { id: 'st-001' })
    })
  })

  describe('touchSessionTemplateLastAssigned', () => {
    it('invokes touch command', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await adapter.touchSessionTemplateLastAssigned('st-001')

      expect(mockInvoke).toHaveBeenCalledWith('touch_session_template_last_assigned', {
        id: 'st-001',
      })
    })
  })

  describe('cloneSessionTemplate', () => {
    it('throws not implemented error', async () => {
      await expect(adapter.cloneSessionTemplate('st-001', 'user-001')).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })
  })
})

// ===========================================================================
// Program operations
// ===========================================================================

describe('Program operations', () => {
  describe('getPrograms', () => {
    it('returns mapped programs', async () => {
      mockInvoke.mockResolvedValue([tauriProgramResponse])

      const result = await adapter.getPrograms('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_programs', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('prog-001')
      expect(result[0].name).toBe('Test Program')
      expect(result[0].source).toBe('CUSTOM')
      // Verifies is_public 0 -> false
      expect(result[0].isPublic).toBe(false)
    })
  })

  describe('getProgramFull', () => {
    it('returns full program with blocks, weeks, and sessions', async () => {
      mockInvoke.mockResolvedValue({
        program: tauriProgramResponse,
        blocks: [tauriBlockResponse],
        block_weeks: [tauriBlockWeekResponse],
        scheduled_sessions: [tauriScheduledSessionResponse],
      })

      const result = await adapter.getProgramFull('prog-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_program_full', { id: 'prog-001' })
      expect(result).not.toBeNull()
      expect(result!.program.id).toBe('prog-001')
      expect(result!.blocks).toHaveLength(1)
      expect(result!.blocks[0].name).toBe('Accumulation')
      expect(result!.blockWeeks).toHaveLength(1)
      expect(result!.blockWeeks[0].weekNumber).toBe(1)
      expect(result!.scheduledSessions).toHaveLength(1)
      expect(result!.scheduledSessions[0].dayLabel).toBe('Day 1')
    })

    it('returns null when program not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getProgramFull('prog-999')

      expect(result).toBeNull()
    })
  })

  describe('createProgramFull', () => {
    it('creates program with nested blocks, weeks, and sessions', async () => {
      mockInvoke.mockResolvedValue({
        program: tauriProgramResponse,
        blocks: [tauriBlockResponse],
        block_weeks: [tauriBlockWeekResponse],
        scheduled_sessions: [tauriScheduledSessionResponse],
      })

      const result = await adapter.createProgramFull(
        {
          userId: 'user-001',
          name: 'Test Program',
          source: 'CUSTOM',
          isPublic: false,
          createdBy: 'user-001',
        },
        [
          {
            block: {
              name: 'Accumulation',
              ordinal: 1,
              durationWeeks: 4,
              blockType: 'ACCUMULATION',
            },
            weeks: [
              {
                week: { weekNumber: 1 },
                sessions: [
                  {
                    dayLabel: 'Day 1',
                    sessionType: 'STRENGTH',
                    sessionTemplateId: 'st-001',
                  },
                ],
              },
            ],
          },
        ],
      )

      expect(mockInvoke).toHaveBeenCalledWith(
        'create_program_full',
        expect.objectContaining({
          program: expect.objectContaining({
            user_id: 'user-001',
            name: 'Test Program',
            source: 'CUSTOM',
          }),
          blocks: expect.any(Array),
        }),
      )
      expect(result.program.id).toBe('prog-001')
      expect(result.blocks).toHaveLength(1)
      expect(result.scheduledSessions).toHaveLength(1)
    })
  })

  describe('updateProgramFull', () => {
    it('updates program and returns mapped result', async () => {
      mockInvoke.mockResolvedValue({
        program: tauriProgramResponse,
        blocks: [tauriBlockResponse],
        block_weeks: [tauriBlockWeekResponse],
        scheduled_sessions: [tauriScheduledSessionResponse],
      })

      const result = await adapter.updateProgramFull(
        {
          id: 'prog-001',
          createdAt: now,
          updatedAt: now,
          userId: 'user-001',
          name: 'Test Program Updated',
          source: 'CUSTOM',
          isPublic: false,
          createdBy: 'user-001',
        },
        [
          {
            block: {
              id: 'block-001',
              name: 'Accumulation',
              ordinal: 1,
              durationWeeks: 4,
              blockType: 'ACCUMULATION',
            },
            weeks: [
              {
                week: { id: 'bw-001', weekNumber: 1 },
                sessions: [
                  {
                    dayLabel: 'Day 1',
                    sessionType: 'STRENGTH',
                    sessionTemplateId: 'st-001',
                  },
                ],
              },
            ],
          },
        ],
      )

      expect(mockInvoke).toHaveBeenCalledWith(
        'update_program_full',
        expect.objectContaining({
          program: expect.objectContaining({
            id: 'prog-001',
            name: 'Test Program Updated',
          }),
        }),
      )
      expect(result.program.id).toBe('prog-001')
    })
  })

  describe('deleteProgram', () => {
    it('deletes program without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.deleteProgram('prog-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('delete_program', { id: 'prog-001' })
    })
  })

  describe('assignProgramToMember', () => {
    it('assigns program and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriProgramResponse)

      const result = await adapter.assignProgramToMember('prog-001', 'user-002', 'grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('assign_program_to_member', {
        caller_id: 'user-001',
        program_id: 'prog-001',
        member_id: 'user-002',
        group_id: 'grp-001',
      })
      expect(result.id).toBe('prog-001')
    })
  })
})

// ===========================================================================
// Program activation operations
// ===========================================================================

describe('Program activation operations', () => {
  describe('getActiveProgram', () => {
    it('returns mapped activation when found', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      const result = await adapter.getActiveProgram('user-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_active_program', { user_id: 'user-001' })
      expect(result).not.toBeNull()
      expect(result!.programId).toBe('prog-001')
      expect(result!.currentBlockOrdinal).toBe(1)
      expect(result!.currentWeekNumber).toBe(2)
      expect(result!.startDate).toBe('2025-06-01')
    })

    it('returns null when no active program', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getActiveProgram('user-001')

      expect(result).toBeNull()
    })
  })

  describe('setActiveProgram', () => {
    it('sets activation and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      const result = await adapter.setActiveProgram('user-001', 'prog-001', '2025-06-01')

      expect(mockInvoke).toHaveBeenCalledWith('set_active_program', {
        user_id: 'user-001',
        program_id: 'prog-001',
        start_date: '2025-06-01',
      })
      expect(result.programId).toBe('prog-001')
      expect(result.userId).toBe('user-001')
    })

    it('passes null start_date when not provided', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      await adapter.setActiveProgram('user-001', 'prog-001')

      expect(mockInvoke).toHaveBeenCalledWith('set_active_program', {
        user_id: 'user-001',
        program_id: 'prog-001',
        start_date: null,
      })
    })
  })

  describe('updateActiveProgram', () => {
    it('updates activation and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      const result = await adapter.updateActiveProgram('user-001', {
        currentBlockOrdinal: 2,
        currentWeekNumber: 1,
      })

      expect(mockInvoke).toHaveBeenCalledWith('update_active_program', {
        user_id: 'user-001',
        current_block_ordinal: 2,
        current_week_number: 1,
        start_date: null,
      })
      expect(result.programId).toBe('prog-001')
    })

    it('passes start_date when provided', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      const result = await adapter.updateActiveProgram('user-001', {
        currentBlockOrdinal: 2,
        currentWeekNumber: 1,
        startDate: '2025-07-01',
      })

      expect(mockInvoke).toHaveBeenCalledWith('update_active_program', {
        user_id: 'user-001',
        current_block_ordinal: 2,
        current_week_number: 1,
        start_date: '2025-07-01',
      })
      expect(result.programId).toBe('prog-001')
    })

    it('passes null start_date when not provided', async () => {
      mockInvoke.mockResolvedValue(tauriProgramActivationResponse)

      await adapter.updateActiveProgram('user-001', {
        currentBlockOrdinal: 1,
        currentWeekNumber: 3,
      })

      expect(mockInvoke).toHaveBeenCalledWith('update_active_program', {
        user_id: 'user-001',
        current_block_ordinal: 1,
        current_week_number: 3,
        start_date: null,
      })
    })
  })

  describe('clearActiveProgram', () => {
    it('clears activation without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.clearActiveProgram('user-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('clear_active_program', { user_id: 'user-001' })
    })
  })
})

// ===========================================================================
// Week status operations
// ===========================================================================

describe('Week status operations', () => {
  describe('getWeekStatuses', () => {
    it('invokes correct command with activation_id and maps results', async () => {
      mockInvoke.mockResolvedValue([tauriWeekStatusResponse, tauriWeekStatusResponse2])

      const result = await adapter.getWeekStatuses('pa-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_week_statuses', {
        activation_id: 'pa-001',
      })
      expect(result).toHaveLength(2)
      expect(result[0].blockOrdinal).toBe(1)
      expect(result[0].weekNumber).toBe(1)
      expect(result[0].status).toBe('done')
      expect(result[1].weekNumber).toBe(2)
      expect(result[1].status).toBe('skipped')
    })

    it('returns empty array when no statuses exist', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getWeekStatuses('pa-001')

      expect(result).toEqual([])
    })
  })

  describe('upsertWeekStatuses', () => {
    it('invokes correct command with statuses array and returns mapped results', async () => {
      mockInvoke.mockResolvedValue([tauriWeekStatusResponse, tauriWeekStatusResponse2])

      const statuses = [
        { blockOrdinal: 1, weekNumber: 1, status: 'done' as const },
        { blockOrdinal: 1, weekNumber: 2, status: 'skipped' as const },
      ]
      const result = await adapter.upsertWeekStatuses('pa-001', statuses)

      expect(mockInvoke).toHaveBeenCalledWith('upsert_week_statuses', {
        activation_id: 'pa-001',
        statuses,
      })
      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('done')
      expect(result[1].status).toBe('skipped')
    })

    it('returns empty array when upserting empty statuses', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.upsertWeekStatuses('pa-001', [])

      expect(mockInvoke).toHaveBeenCalledWith('upsert_week_statuses', {
        activation_id: 'pa-001',
        statuses: [],
      })
      expect(result).toEqual([])
    })
  })
})

// ===========================================================================
// Accountability Group operations
// ===========================================================================

describe('Accountability Group operations', () => {
  describe('createGroup', () => {
    it('creates and returns mapped group', async () => {
      mockInvoke.mockResolvedValue(tauriAccountabilityGroupResponse)

      const result = await adapter.createGroup({
        name: 'Morning Crew',
        description: 'Early morning training group',
        dataRetentionDays: 30,
      })

      expect(mockInvoke).toHaveBeenCalledWith('create_group', {
        name: 'Morning Crew',
        description: 'Early morning training group',
        data_retention_days: 30,
        user_id: 'user-001',
      })
      expect(result.id).toBe('grp-001')
      expect(result.name).toBe('Morning Crew')
    })
  })

  describe('getGroups', () => {
    it('returns mapped groups', async () => {
      mockInvoke.mockResolvedValue([tauriAccountabilityGroupResponse])

      const result = await adapter.getGroups()

      expect(mockInvoke).toHaveBeenCalledWith('get_groups', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('grp-001')
      expect(result[0].name).toBe('Morning Crew')
    })
  })

  describe('getGroup', () => {
    it('returns mapped group when found', async () => {
      mockInvoke.mockResolvedValue(tauriAccountabilityGroupResponse)

      const result = await adapter.getGroup('grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_group', { id: 'grp-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('grp-001')
    })

    it('returns null when not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getGroup('grp-999')

      expect(result).toBeNull()
    })
  })

  describe('updateGroup', () => {
    it('updates and returns mapped group', async () => {
      mockInvoke.mockResolvedValue({
        ...tauriAccountabilityGroupResponse,
        name: 'Updated Crew',
      })

      const result = await adapter.updateGroup('grp-001', { name: 'Updated Crew' })

      expect(mockInvoke).toHaveBeenCalledWith('update_group', {
        id: 'grp-001',
        name: 'Updated Crew',
        description: null,
        data_retention_days: null,
      })
      expect(result.name).toBe('Updated Crew')
    })
  })

  describe('deleteGroup', () => {
    it('deletes group without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.deleteGroup('grp-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('delete_group', {
        id: 'grp-001',
        user_id: 'user-001',
      })
    })
  })
})

// ===========================================================================
// Group Member operations
// ===========================================================================

describe('Group Member operations', () => {
  describe('getGroupMembers', () => {
    it('returns mapped members', async () => {
      mockInvoke.mockResolvedValue([tauriGroupMemberResponse])

      const result = await adapter.getGroupMembers('grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_group_members', { group_id: 'grp-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('gm-001')
      expect(result[0].role).toBe('COACH')
      // Verifies intToBool on share_history_before_join
      expect(result[0].shareHistoryBeforeJoin).toBe(true)
    })
  })

  describe('removeGroupMember', () => {
    it('removes member without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.removeGroupMember('grp-001', 'user-002')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('remove_group_member', {
        group_id: 'grp-001',
        user_id: 'user-002',
        caller_id: 'user-001',
      })
    })
  })

  describe('updateMemberRole', () => {
    it('updates role and returns mapped member', async () => {
      mockInvoke.mockResolvedValue({
        ...tauriGroupMemberResponse,
        role: 'MEMBER',
      })

      const result = await adapter.updateMemberRole('grp-001', 'user-001', 'MEMBER')

      expect(mockInvoke).toHaveBeenCalledWith('update_member_role', {
        group_id: 'grp-001',
        user_id: 'user-001',
        role: 'MEMBER',
        caller_id: 'user-001',
      })
      expect(result.role).toBe('MEMBER')
    })
  })
})

// ===========================================================================
// Group Invite operations
// ===========================================================================

describe('Group Invite operations', () => {
  describe('createInvite', () => {
    it('creates and returns mapped invite', async () => {
      mockInvoke.mockResolvedValue(tauriGroupInviteResponse)

      const result = await adapter.createInvite('grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('create_invite', {
        group_id: 'grp-001',
        user_id: 'user-001',
      })
      expect(result.id).toBe('gi-001')
      expect(result.code).toBe('ABC123')
      // Verifies intToBool on is_active
      expect(result.isActive).toBe(true)
    })
  })

  describe('getGroupInvites', () => {
    it('returns mapped invites', async () => {
      mockInvoke.mockResolvedValue([tauriGroupInviteResponse])

      const result = await adapter.getGroupInvites('grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_group_invites', { group_id: 'grp-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('gi-001')
    })
  })

  describe('revokeInvite', () => {
    it('revokes invite without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.revokeInvite('gi-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('revoke_invite', {
        invite_id: 'gi-001',
        user_id: 'user-001',
      })
    })
  })

  describe('joinGroupByCode', () => {
    it('joins group and returns mapped member', async () => {
      mockInvoke.mockResolvedValue(tauriGroupMemberResponse)

      const result = await adapter.joinGroupByCode('ABC123')

      expect(mockInvoke).toHaveBeenCalledWith('join_group_by_code', {
        code: 'ABC123',
        user_id: 'user-001',
      })
      expect(result.id).toBe('gm-001')
    })
  })
})

// ===========================================================================
// Direct Connection operations
// ===========================================================================

describe('Direct Connection operations', () => {
  describe('requestConnection', () => {
    it('creates connection request and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriDirectConnectionResponse)

      const result = await adapter.requestConnection('user-002')

      expect(mockInvoke).toHaveBeenCalledWith('request_connection', {
        requester_id: 'user-001',
        recipient_id: 'user-002',
      })
      expect(result.id).toBe('dc-001')
      expect(result.status).toBe('ACTIVE')
      // Verifies intToBool on write access flags
      expect(result.requesterGrantsWrite).toBe(true)
      expect(result.recipientGrantsWrite).toBe(false)
    })
  })

  describe('getConnections', () => {
    it('returns mapped connections', async () => {
      mockInvoke.mockResolvedValue([tauriDirectConnectionResponse])

      const result = await adapter.getConnections()

      expect(mockInvoke).toHaveBeenCalledWith('get_connections', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('dc-001')
    })
  })

  describe('getPendingConnections', () => {
    it('returns mapped pending connections', async () => {
      const pending = { ...tauriDirectConnectionResponse, status: 'PENDING' }
      mockInvoke.mockResolvedValue([pending])

      const result = await adapter.getPendingConnections()

      expect(mockInvoke).toHaveBeenCalledWith('get_pending_connections', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('PENDING')
    })
  })

  describe('acceptConnection', () => {
    it('accepts and returns mapped connection', async () => {
      mockInvoke.mockResolvedValue(tauriDirectConnectionResponse)

      const result = await adapter.acceptConnection('dc-001')

      expect(mockInvoke).toHaveBeenCalledWith('accept_connection', {
        connection_id: 'dc-001',
        user_id: 'user-001',
      })
      expect(result.id).toBe('dc-001')
    })
  })

  describe('declineConnection', () => {
    it('declines and returns mapped connection', async () => {
      const declined = { ...tauriDirectConnectionResponse, status: 'DECLINED' }
      mockInvoke.mockResolvedValue(declined)

      const result = await adapter.declineConnection('dc-001')

      expect(mockInvoke).toHaveBeenCalledWith('decline_connection', {
        connection_id: 'dc-001',
        user_id: 'user-001',
      })
      expect(result.status).toBe('DECLINED')
    })
  })

  describe('removeConnection', () => {
    it('removes connection without error', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(adapter.removeConnection('dc-001')).resolves.toBeUndefined()
      expect(mockInvoke).toHaveBeenCalledWith('remove_connection', {
        connection_id: 'dc-001',
        user_id: 'user-001',
      })
    })
  })

  describe('updateConnectionWriteAccess', () => {
    it('updates write access and returns mapped connection', async () => {
      mockInvoke.mockResolvedValue(tauriDirectConnectionResponse)

      const result = await adapter.updateConnectionWriteAccess('dc-001', true)

      expect(mockInvoke).toHaveBeenCalledWith('update_connection_write_access', {
        connection_id: 'dc-001',
        user_id: 'user-001',
        grants_write: true,
      })
      expect(result.id).toBe('dc-001')
    })
  })
})

// ===========================================================================
// Activity Feed operations
// ===========================================================================

describe('Activity Feed operations', () => {
  describe('getGroupActivityFeed', () => {
    it('returns mapped feed entries', async () => {
      mockInvoke.mockResolvedValue([tauriGroupActivityFeedEntry])

      const result = await adapter.getGroupActivityFeed('grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_group_activity_feed', {
        group_id: 'grp-001',
        user_id: 'user-001',
        before: null,
        limit: 20,
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('wl-feed-001')
      expect(result[0].userId).toBe('user-002')
      expect(result[0].groupId).toBe('grp-001')
      expect(result[0].memberRole).toBe('MEMBER')
      expect(result[0].exerciseCount).toBe(5)
    })

    it('passes before and limit options', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getGroupActivityFeed('grp-001', { before: now, limit: 10 })

      expect(mockInvoke).toHaveBeenCalledWith('get_group_activity_feed', {
        group_id: 'grp-001',
        user_id: 'user-001',
        before: Math.floor(new Date(now).getTime() / 1000),
        limit: 10,
      })
    })
  })

  describe('getConnectionActivityFeed', () => {
    it('returns mapped feed entries', async () => {
      mockInvoke.mockResolvedValue([tauriConnectionActivityFeedEntry])

      const result = await adapter.getConnectionActivityFeed()

      expect(mockInvoke).toHaveBeenCalledWith('get_connection_activity_feed', {
        user_id: 'user-001',
        before: null,
        limit: 20,
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('wl-feed-002')
      expect(result[0].connectionId).toBe('dc-001')
    })
  })
})

// ===========================================================================
// Chat operations
// ===========================================================================

describe('Chat operations', () => {
  describe('createConversation', () => {
    it('creates conversation with participants and returns mapped result', async () => {
      mockInvoke.mockResolvedValue({
        conversation: tauriConversationResponse,
        participants: [tauriConversationParticipantResponse, tauriConversationParticipantResponse2],
      })

      const result = await adapter.createConversation('direct', ['user-002'])

      expect(mockInvoke).toHaveBeenCalledWith('create_conversation', {
        input: {
          conversation_type: 'direct',
          title: null,
          group_id: null,
          participant_user_ids: ['user-002'],
        },
      })
      expect(result.id).toBe('conv-001')
      expect(result.type).toBe('direct')
      expect(result.participantUserIds).toContain('user-001')
      expect(result.participantUserIds).toContain('user-002')
    })

    it('passes title and groupId when provided', async () => {
      mockInvoke.mockResolvedValue({
        conversation: {
          ...tauriConversationResponse,
          type: 'group',
          group_id: 'grp-001',
          title: 'Group Chat',
        },
        participants: [tauriConversationParticipantResponse],
      })

      await adapter.createConversation('group', ['user-002'], 'Group Chat', 'grp-001')

      expect(mockInvoke).toHaveBeenCalledWith('create_conversation', {
        input: {
          conversation_type: 'group',
          title: 'Group Chat',
          group_id: 'grp-001',
          participant_user_ids: ['user-002'],
        },
      })
    })

    it('excludes participants with left_at set', async () => {
      const leftParticipant = {
        ...tauriConversationParticipantResponse2,
        left_at: later,
      }
      mockInvoke.mockResolvedValue({
        conversation: tauriConversationResponse,
        participants: [tauriConversationParticipantResponse, leftParticipant],
      })

      const result = await adapter.createConversation('direct', ['user-002'])

      // user-002 left, so only user-001 should be in participantUserIds
      expect(result.participantUserIds).toContain('user-001')
      expect(result.participantUserIds).not.toContain('user-002')
    })
  })

  describe('getConversations', () => {
    it('returns conversations for the current user', async () => {
      mockInvoke.mockResolvedValue([
        {
          conversation: tauriConversationResponse,
          participants: [
            tauriConversationParticipantResponse,
            tauriConversationParticipantResponse2,
          ],
        },
      ])

      const result = await adapter.getConversations()

      expect(mockInvoke).toHaveBeenCalledWith('get_conversations', { user_id: 'user-001' })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('conv-001')
      expect(result[0].participantUserIds).toContain('user-001')
    })

    it('returns empty array when user has no conversations', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getConversations()

      expect(result).toEqual([])
    })
  })

  describe('getConversation', () => {
    it('returns mapped conversation with participants', async () => {
      mockInvoke.mockResolvedValue({
        conversation: tauriConversationResponse,
        participants: [tauriConversationParticipantResponse, tauriConversationParticipantResponse2],
      })

      const result = await adapter.getConversation('conv-001')

      expect(mockInvoke).toHaveBeenCalledWith('get_conversation', { id: 'conv-001' })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-001')
      expect(result!.participantUserIds).toEqual(['user-001', 'user-002'])
    })

    it('returns null when conversation not found', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await adapter.getConversation('conv-999')

      expect(result).toBeNull()
    })
  })

  describe('findDirectConversation', () => {
    it('returns direct conversation matching other user', async () => {
      mockInvoke.mockResolvedValueOnce({
        conversation: tauriConversationResponse,
        participants: [tauriConversationParticipantResponse, tauriConversationParticipantResponse2],
      })

      const result = await adapter.findDirectConversation('user-002')

      expect(mockInvoke).toHaveBeenCalledWith('find_direct_conversation', {
        user_id: 'user-001',
        other_user_id: 'user-002',
      })
      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-001')
    })

    it('returns null when no direct conversation with other user', async () => {
      mockInvoke.mockResolvedValueOnce(null)

      const result = await adapter.findDirectConversation('user-002')

      expect(result).toBeNull()
    })

    it('returns null when other user has left the conversation', async () => {
      mockInvoke.mockResolvedValueOnce(null) // Rust command handles left_at filtering

      const result = await adapter.findDirectConversation('user-003')

      expect(result).toBeNull()
    })
  })

  describe('sendMessage', () => {
    it('sends message and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriMessageResponse)

      const result = await adapter.sendMessage('conv-001', 'text', 'Hello there')

      expect(mockInvoke).toHaveBeenCalledWith('send_message', {
        input: {
          conversation_id: 'conv-001',
          sender_id: 'user-001',
          message_type: 'text',
          content: 'Hello there',
        },
      })
      expect(result.id).toBe('msg-001')
      expect(result.conversationId).toBe('conv-001')
      expect(result.senderId).toBe('user-001')
      expect(result.messageType).toBe('text')
      expect(result.content).toBe('Hello there')
    })

    it('sends message with null content when not provided', async () => {
      mockInvoke.mockResolvedValue({ ...tauriMessageResponse, content: null })

      await adapter.sendMessage('conv-001', 'system')

      expect(mockInvoke).toHaveBeenCalledWith('send_message', {
        input: expect.objectContaining({ content: null }),
      })
    })
  })

  describe('getMessages', () => {
    it('returns mapped messages', async () => {
      mockInvoke.mockResolvedValue([tauriMessageResponse, tauriMessageResponse2])

      const result = await adapter.getMessages('conv-001', { limit: 50 })

      expect(mockInvoke).toHaveBeenCalledWith('get_messages', {
        conversation_id: 'conv-001',
        before: undefined,
        limit: 50,
      })
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('msg-001')
      expect(result[1].id).toBe('msg-002')
    })

    it('passes before as unix timestamp', async () => {
      mockInvoke.mockResolvedValue([])

      await adapter.getMessages('conv-001', { before: later, limit: 50 })

      expect(mockInvoke).toHaveBeenCalledWith('get_messages', {
        conversation_id: 'conv-001',
        before: Math.floor(new Date(later).getTime() / 1000),
        limit: 50,
      })
    })

    it('returns empty array when no messages', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getMessages('conv-001', { limit: 50 })

      expect(result).toEqual([])
    })
  })

  describe('getMessagesSince', () => {
    it('returns messages after the given timestamp', async () => {
      mockInvoke.mockResolvedValue([tauriMessageResponse2])

      const result = await adapter.getMessagesSince('conv-001', now)

      expect(mockInvoke).toHaveBeenCalledWith('get_messages_since', {
        conversation_id: 'conv-001',
        since: Math.floor(new Date(now).getTime() / 1000),
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('msg-002')
    })
  })

  describe('updateLastRead', () => {
    it('updates last_read_at for the current user', async () => {
      mockInvoke.mockResolvedValue({})

      await adapter.updateLastRead('conv-001')

      expect(mockInvoke).toHaveBeenCalledWith('update_last_read', {
        conversation_id: 'conv-001',
        user_id: 'user-001',
      })
    })
  })

  describe('getUnreadCounts', () => {
    it('returns unread counts as a Map', async () => {
      mockInvoke.mockResolvedValue([
        { conversation_id: 'conv-001', count: 3 },
        { conversation_id: 'conv-002', count: 1 },
      ])

      const result = await adapter.getUnreadCounts()

      expect(mockInvoke).toHaveBeenCalledWith('get_unread_counts', { user_id: 'user-001' })
      expect(result).toBeInstanceOf(Map)
      expect(result.get('conv-001')).toBe(3)
      expect(result.get('conv-002')).toBe(1)
    })

    it('returns empty map when no unread', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getUnreadCounts()

      expect(result.size).toBe(0)
    })
  })

  describe('addParticipant', () => {
    it('throws not supported error', async () => {
      await expect(adapter.addParticipant('conv-001', 'user-002')).rejects.toThrow(
        'addParticipant is not supported in offline mode',
      )
    })
  })

  describe('leaveConversation', () => {
    it('leaves conversation without error', async () => {
      mockInvoke.mockResolvedValue({})

      await adapter.leaveConversation('conv-001')

      expect(mockInvoke).toHaveBeenCalledWith('leave_conversation', {
        conversation_id: 'conv-001',
        user_id: 'user-001',
      })
    })
  })

  describe('toggleArchive', () => {
    it('toggles archive status', async () => {
      mockInvoke.mockResolvedValue({})

      await adapter.toggleArchive('conv-001')

      expect(mockInvoke).toHaveBeenCalledWith('toggle_archive', {
        conversation_id: 'conv-001',
        user_id: 'user-001',
      })
    })
  })

  describe('saveMediaAttachment', () => {
    it('saves attachment and returns mapped result', async () => {
      mockInvoke.mockResolvedValue(tauriMediaAttachmentResponse)

      const result = await adapter.saveMediaAttachment('msg-001', {
        messageId: 'msg-001',
        provider: 'cloudflare_stream',
        mediaType: 'video',
        status: 'ready',
        originalFilename: 'workout.mp4',
        mimeType: 'video/mp4',
      })

      expect(mockInvoke).toHaveBeenCalledWith('save_media_attachment', {
        input: expect.objectContaining({
          message_id: 'msg-001',
          provider: 'cloudflare_stream',
          media_type: 'video',
          status: 'ready',
        }),
      })
      expect(result.id).toBe('ma-001')
      expect(result.messageId).toBe('msg-001')
      expect(result.provider).toBe('cloudflare_stream')
      expect(result.mediaType).toBe('video')
      expect(result.status).toBe('ready')
      expect(result.originalFilename).toBe('workout.mp4')
    })
  })

  describe('getMediaAttachments', () => {
    it('returns mapped attachments for given message IDs', async () => {
      mockInvoke.mockResolvedValue([tauriMediaAttachmentResponse])

      const result = await adapter.getMediaAttachments(['msg-001'])

      expect(mockInvoke).toHaveBeenCalledWith('get_media_attachments', {
        message_ids: ['msg-001'],
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ma-001')
      expect(result[0].originalFilename).toBe('workout.mp4')
    })

    it('returns empty array for empty message IDs', async () => {
      const result = await adapter.getMediaAttachments([])

      expect(result).toEqual([])
      // Should not invoke the command
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('updateMediaAttachment', () => {
    it('throws not supported error', async () => {
      await expect(adapter.updateMediaAttachment('ma-001', { status: 'failed' })).rejects.toThrow(
        'updateMediaAttachment is not supported in offline mode',
      )
    })
  })
})

// ===========================================================================
// Analytics operations
// ===========================================================================

describe('Analytics operations', () => {
  describe('getWeeklyVolume', () => {
    it('aggregates volume from exercise workout history', async () => {
      // getWeeklyVolume calls getExerciseWorkoutHistory internally
      mockInvoke.mockResolvedValue([
        {
          log: {
            ...tauriWorkoutLogResponse,
            started_at: '2025-06-09T10:00:00Z', // Monday
          },
          sets: [
            {
              ...tauriLoggedSetResponse,
              actual_reps: 5,
              actual_weight: JSON.stringify({ value: 225, unit: 'lb' }),
              completed: 1,
            },
            {
              ...tauriLoggedSetResponse,
              id: 'ls-002',
              actual_reps: 5,
              actual_weight: JSON.stringify({ value: 225, unit: 'lb' }),
              completed: 1,
            },
          ],
        },
      ])

      const result = await adapter.getWeeklyVolume('user-001', 'ex-001', 8)

      expect(mockInvoke).toHaveBeenCalledWith('get_exercise_workout_history', {
        user_id: 'user-001',
        exercise_id: 'ex-001',
        limit: 56, // 8 * 7
      })
      expect(result.length).toBeGreaterThanOrEqual(1)
      // 225 * 5 + 225 * 5 = 2250
      expect(result[0].tonnage).toBe(2250)
      expect(result[0].unit).toBe('lb')
    })

    it('returns empty array when no history', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getWeeklyVolume('user-001', 'ex-001')

      expect(result).toEqual([])
    })

    it('skips incomplete sets', async () => {
      mockInvoke.mockResolvedValue([
        {
          log: {
            ...tauriWorkoutLogResponse,
            started_at: '2025-06-09T10:00:00Z',
          },
          sets: [
            {
              ...tauriLoggedSetResponse,
              actual_reps: 5,
              actual_weight: JSON.stringify({ value: 225, unit: 'lb' }),
              completed: 0, // not completed
            },
          ],
        },
      ])

      const result = await adapter.getWeeklyVolume('user-001', 'ex-001')

      expect(result).toEqual([])
    })
  })

  describe('getVaultSummary', () => {
    it('computes vault summary from workout logs', async () => {
      // First call: getWorkoutLogs
      mockInvoke.mockResolvedValueOnce([tauriWorkoutLogResponse])
      // Second call: getWorkoutLogFull for the completed log
      mockInvoke.mockResolvedValueOnce({
        log: tauriWorkoutLogResponse,
        groups: [tauriLoggedActivityGroupResponse],
        activities: [tauriLoggedActivityResponse],
        sets: [tauriLoggedSetResponse],
      })

      const result = await adapter.getVaultSummary('user-001')

      expect(result.totalWorkouts).toBe(1)
      expect(result.totalVolumeLb).toBeGreaterThan(0)
    })

    it('returns zeros when no workout logs', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await adapter.getVaultSummary('user-001')

      expect(result.totalWorkouts).toBe(0)
      expect(result.totalVolumeLb).toBe(0)
      expect(result.thisWeekWorkouts).toBe(0)
      expect(result.thisWeekVolumeLb).toBe(0)
    })
  })
})

// ===========================================================================
// Not-implemented stubs
// ===========================================================================

describe('Not-implemented stubs', () => {
  describe('Event item operations', () => {
    it('getEventItems throws', async () => {
      await expect(adapter.getEventItems('st-001', 'template')).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })

    it('saveEventItem throws', async () => {
      await expect(
        adapter.saveEventItem(
          {
            sessionTemplateId: 'st-001',
            userId: 'user-001',
            name: 'Item',
            quantity: 1,
            isPacked: false,
            sortOrder: 0,
          },
          'st-001',
          'template',
        ),
      ).rejects.toThrow('Not implemented in offline mode')
    })

    it('updateEventItem throws', async () => {
      await expect(
        adapter.updateEventItem({
          id: 'ei-001',
          createdAt: now,
          updatedAt: now,
          sessionTemplateId: 'st-001',
          userId: 'user-001',
          name: 'Item',
          quantity: 1,
          isPacked: false,
          sortOrder: 0,
        }),
      ).rejects.toThrow('Not implemented in offline mode')
    })

    it('deleteEventItem throws', async () => {
      await expect(adapter.deleteEventItem('ei-001')).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })

    it('toggleEventItemPacked throws', async () => {
      await expect(adapter.toggleEventItemPacked('ei-001', true)).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })

    it('reorderEventItems throws', async () => {
      await expect(adapter.reorderEventItems([{ id: 'ei-001', sortOrder: 0 }])).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })
  })

  describe('Share link operations', () => {
    it('getShareLinks throws', async () => {
      await expect(adapter.getShareLinks('user-001')).rejects.toThrow(
        'Share links are not supported in offline mode',
      )
    })

    it('getShareLinksForEntity throws', async () => {
      await expect(adapter.getShareLinksForEntity('PROGRAM', 'prog-001')).rejects.toThrow(
        'Share links are not supported in offline mode',
      )
    })

    it('createShareLink throws', async () => {
      await expect(
        adapter.createShareLink({
          token: 'abc123def456' as unknown as ShareToken,
          entityType: 'PROGRAM',
          entityId: 'prog-001',
          createdBy: 'user-001',
        }),
      ).rejects.toThrow('Share links are not supported in offline mode')
    })

    it('revokeShareLink throws', async () => {
      await expect(adapter.revokeShareLink('sl-001')).rejects.toThrow(
        'Share links are not supported in offline mode',
      )
    })

    it('deleteShareLink throws', async () => {
      await expect(adapter.deleteShareLink('sl-001')).rejects.toThrow(
        'Share links are not supported in offline mode',
      )
    })
  })

  describe('cloneSessionTemplate', () => {
    it('throws not implemented', async () => {
      await expect(adapter.cloneSessionTemplate('st-001', 'user-001')).rejects.toThrow(
        'Not implemented in offline mode',
      )
    })
  })

  describe('addParticipant', () => {
    it('throws not supported', async () => {
      await expect(adapter.addParticipant('conv-001', 'user-002')).rejects.toThrow(
        'addParticipant is not supported in offline mode',
      )
    })
  })

  describe('updateMediaAttachment', () => {
    it('throws not supported', async () => {
      await expect(adapter.updateMediaAttachment('ma-001', { status: 'ready' })).rejects.toThrow(
        'updateMediaAttachment is not supported in offline mode',
      )
    })
  })
})
