import { describe, it, expect, beforeEach } from 'vitest'
import { SupabaseAdapter } from '../supabase-adapter'
import { createMockSupabaseClient, type MockSupabaseClient } from '@/test/mocks/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExerciseRow,
  WorkoutLogRow,
  LoggedActivityGroupRow,
  LoggedActivityRow,
  LoggedSetRow,
  UserProfileRow,
  OneRepMaxHistoryRow,
  SessionTemplateRow,
  ActivityGroupRow,
  ActivityRow,
  ProgramRow,
  BlockRow,
  BlockWeekRow,
  ScheduledSessionRow,
  ProgramActivationRow,
  ConversationRow,
  ConversationParticipantRow,
  MessageRow,
  MediaAttachmentRow,
} from '../database.types'

// ===========================================================================
// Row fixtures -- realistic data matching actual schema shapes
// ===========================================================================

const now = '2025-06-15T10:00:00Z'
const later = '2025-06-15T11:30:00Z'

const exerciseRow: ExerciseRow = {
  id: 'ex-001',
  name: 'Barbell Back Squat',
  aliases: ['Back Squat', 'Low Bar Squat'],
  category: 'BARBELL',
  movement_pattern: 'SQUAT',
  muscle_groups: { primary: ['QUADS', 'GLUTES'], secondary: ['HAMSTRINGS', 'CORE'] },
  is_bilateral: true,
  supports_1rm: true,
  equipment_required: ['BARBELL', 'SQUAT_RACK'],
  is_custom: false,
  is_public: false,
  user_id: null,
  created_at: now,
  updated_at: now,
}

const exerciseRow2: ExerciseRow = {
  ...exerciseRow,
  id: 'ex-002',
  name: 'Bench Press',
  aliases: [],
  movement_pattern: 'PUSH',
  muscle_groups: { primary: ['CHEST'], secondary: ['TRICEPS'] },
}

const workoutLogRow: WorkoutLogRow = {
  id: 'wl-001',
  user_id: 'user-001',
  title: 'Upper Body Day',
  started_at: now,
  completed_at: later,
  session_template_id: 'st-001',
  program_context: {
    programId: 'prog-001',
    blockId: 'block-001',
    weekNumber: 3,
    dayLabel: 'Monday',
  },
  perceived_difficulty: 7,
  bodyweight_at_session: { value: 185, unit: 'lb' },
  overall_notes: 'Felt strong today',
  event_metadata: null,
  created_at: now,
  updated_at: later,
}

const groupRow: LoggedActivityGroupRow = {
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

const activityRow: LoggedActivityRow = {
  id: 'la-001',
  logged_group_id: 'lag-001',
  user_id: 'user-001',
  exercise_id: 'ex-001',
  ordinal: 1,
  notes: 'Focus on depth',
  created_at: now,
  updated_at: now,
}

const setRow: LoggedSetRow = {
  id: 'ls-001',
  logged_activity_id: 'la-001',
  user_id: 'user-001',
  set_number: 1,
  set_type: 'WORKING',
  prescribed: { reps: 5, weight: { value: 225, unit: 'lb' } },
  actual_reps: 5,
  actual_weight: { value: 225, unit: 'lb' },
  actual_duration: null,
  actual_distance: null,
  actual_pace: null,
  actual_heart_rate: null,
  ruck_load: null,
  elevation_gain: null,
  rpe: 8,
  completed: true,
  notes: 'Solid set',
  created_at: now,
  updated_at: now,
}

const userProfileRow: UserProfileRow = {
  id: 'user-001',
  display_name: 'Coach Hamilton',
  preferred_units: 'IMPERIAL',
  bodyweight: { value: 200, unit: 'lb' },
  training_age: { seconds: 157680000 },
  exercise_maxes: {
    'ex-001': {
      weight: { value: 405, unit: 'lb' },
      testedAt: '2025-06-01T00:00:00Z',
      estimated: false,
    },
  },
  max_reps: { 'ex-pullup-001': 20 },
  display_visible: null,
  created_at: now,
  updated_at: now,
}

const ormhRow: OneRepMaxHistoryRow = {
  id: 'ormh-001',
  user_id: 'user-001',
  exercise_id: 'ex-001',
  weight: { value: 405, unit: 'lb' },
  estimated: false,
  recorded_at: '2025-06-10T09:00:00Z',
  created_at: now,
}

const sessionTemplateRow: SessionTemplateRow = {
  id: 'st-001',
  user_id: 'user-001',
  name: 'Heavy Upper',
  description: 'Upper body strength',
  category: 'STRENGTH',
  rest_between_groups: JSON.stringify({ seconds: 120 }),
  time_cap: null,
  scoring: 'NONE',
  is_public: false,
  event_metadata: null,
  last_assigned_at: null,
  created_at: now,
  updated_at: now,
}

const activityGroupRow: ActivityGroupRow = {
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

const templateActivityRow: ActivityRow = {
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

const programRow: ProgramRow = {
  id: 'prog-001',
  user_id: 'user-001',
  name: 'Test Program',
  description: 'A test program',
  source: 'CUSTOM',
  duration_weeks: 12,
  is_public: false,
  created_by: 'user-001',
  created_at: now,
  updated_at: now,
}

const blockRow: BlockRow = {
  id: 'block-001',
  program_id: 'prog-001',
  name: 'Accumulation',
  ordinal: 1,
  duration_weeks: 4,
  block_type: 'ACCUMULATION',
  created_at: now,
  updated_at: now,
}

const blockWeekRow: BlockWeekRow = {
  id: 'bw-001',
  block_id: 'block-001',
  week_number: 1,
  created_at: now,
  updated_at: now,
}

const scheduledSessionRow: ScheduledSessionRow = {
  id: 'ss-001',
  block_week_id: 'bw-001',
  day_of_week: 1,
  day_label: 'Day 1',
  session_type: 'STRENGTH',
  session_template_id: 'st-001',
  notes: null,
  overrides: null,
  created_at: now,
  updated_at: now,
}

const programActivationRow: ProgramActivationRow = {
  id: 'pa-001',
  user_id: 'user-001',
  program_id: 'prog-001',
  current_block_ordinal: 1,
  current_week_number: 2,
  start_date: '2025-06-01',
  created_at: now,
  updated_at: now,
}

// ===========================================================================
// Test suite
// ===========================================================================

let mockClient: MockSupabaseClient
let adapter: SupabaseAdapter

beforeEach(() => {
  mockClient = createMockSupabaseClient()
  // Mock auth for getCurrentUserId
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-001' } },
    error: null,
  })
  adapter = new SupabaseAdapter(mockClient as unknown as SupabaseClient)
})

// ---------------------------------------------------------------------------
// Exercise operations
// ---------------------------------------------------------------------------

describe('Exercise operations', () => {
  describe('getExercises', () => {
    it('returns mapped exercises with no filters', async () => {
      mockClient.mockResponse('exercises', 'select', [exerciseRow, exerciseRow2])

      const result = await adapter.getExercises()

      expect(mockClient.from).toHaveBeenCalledWith('exercises')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('ex-001')
      expect(result[0].name).toBe('Barbell Back Squat')
      expect(result[0].category).toBe('BARBELL')
      expect(result[0].movementPattern).toBe('SQUAT')
      expect(result[0].muscleGroups).toEqual({
        primary: ['QUADS', 'GLUTES'],
        secondary: ['HAMSTRINGS', 'CORE'],
      })
    })

    it('passes category filter to query builder', async () => {
      mockClient.mockResponse('exercises', 'select', [exerciseRow])

      const result = await adapter.getExercises({ category: 'BARBELL' })

      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('BARBELL')
    })

    it('uses rpc search_exercises when searchQuery is provided', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [exerciseRow],
        error: null,
      })

      const result = await adapter.getExercises({ searchQuery: 'squat' })

      expect(mockClient.rpc).toHaveBeenCalledWith('search_exercises', { query_text: 'squat' })
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Barbell Back Squat')
    })

    it('applies client-side filters when searchQuery with category', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [exerciseRow, { ...exerciseRow2, category: 'DUMBBELL' }],
        error: null,
      })

      const result = await adapter.getExercises({
        searchQuery: 'bench',
        category: 'BARBELL',
      })

      // exerciseRow2 with DUMBBELL category should be filtered out client-side
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('BARBELL')
    })

    it('returns empty array when no exercises found', async () => {
      mockClient.mockResponse('exercises', 'select', [])

      const result = await adapter.getExercises()

      expect(result).toEqual([])
    })

    it('throws on Supabase error', async () => {
      mockClient.mockResponse('exercises', 'select', null, {
        message: 'DB connection lost',
      })

      await expect(adapter.getExercises()).rejects.toEqual({
        message: 'DB connection lost',
      })
    })
  })

  describe('getExercise', () => {
    it('returns mapped exercise when found', async () => {
      mockClient.mockResponse('exercises', 'select', [exerciseRow])

      const result = await adapter.getExercise('ex-001')

      expect(mockClient.from).toHaveBeenCalledWith('exercises')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('ex-001')
      expect(result!.name).toBe('Barbell Back Squat')
    })

    it('returns null when not found', async () => {
      mockClient.mockResponse('exercises', 'select', [])

      const result = await adapter.getExercise('ex-999')

      expect(result).toBeNull()
    })

    it('throws on Supabase error', async () => {
      mockClient.mockResponse('exercises', 'select', null, {
        message: 'Not found',
      })

      await expect(adapter.getExercise('ex-001')).rejects.toEqual({
        message: 'Not found',
      })
    })
  })

  describe('createExercise', () => {
    it('creates exercise with is_custom=true and returns mapped result', async () => {
      const createdRow = {
        ...exerciseRow,
        id: 'ex-new',
        is_custom: true,
        user_id: 'user-001',
      }
      mockClient.mockResponse('exercises', 'insert', [createdRow])

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

      expect(mockClient.from).toHaveBeenCalledWith('exercises')
      expect(result.id).toBe('ex-new')
      expect(result.isCustom).toBe(true)
    })

    it('throws when not authenticated', async () => {
      mockClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(
        adapter.createExercise({
          name: 'Test',
          aliases: [],
          category: 'BODYWEIGHT',
          movementPattern: 'PUSH',
          muscleGroups: { primary: ['CHEST'], secondary: [] },
          isBilateral: true,
          supports1RM: false,
          equipmentRequired: ['NONE'],
          isCustom: true,
          isPublic: false,
        }),
      ).rejects.toThrow('Not authenticated')
    })
  })
})

// ---------------------------------------------------------------------------
// Workout log operations
// ---------------------------------------------------------------------------

describe('Workout log operations', () => {
  describe('getWorkoutLogs', () => {
    it('returns mapped workout logs', async () => {
      mockClient.mockResponse('workout_logs', 'select', [workoutLogRow])

      const result = await adapter.getWorkoutLogs('user-001')

      expect(mockClient.from).toHaveBeenCalledWith('workout_logs')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('wl-001')
      expect(result[0].userId).toBe('user-001')
      expect(result[0].title).toBe('Upper Body Day')
      expect(result[0].completedAt).toBe(later)
    })

    it('returns empty array when no logs exist', async () => {
      mockClient.mockResponse('workout_logs', 'select', [])

      const result = await adapter.getWorkoutLogs('user-001')

      expect(result).toEqual([])
    })
  })

  describe('getWorkoutLog', () => {
    it('returns mapped log when found', async () => {
      mockClient.mockResponse('workout_logs', 'select', [workoutLogRow])

      const result = await adapter.getWorkoutLog('wl-001')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('wl-001')
    })

    it('returns null when not found', async () => {
      mockClient.mockResponse('workout_logs', 'select', [])

      const result = await adapter.getWorkoutLog('wl-999')

      expect(result).toBeNull()
    })
  })

  describe('getWorkoutLogFull', () => {
    it('returns full workout log with groups, activities, and sets', async () => {
      mockClient.mockResponse('workout_logs', 'select', [workoutLogRow])
      mockClient.mockResponse('logged_activity_groups', 'select', [groupRow])
      mockClient.mockResponse('logged_activities', 'select', [activityRow])
      mockClient.mockResponse('logged_sets', 'select', [setRow])

      const result = await adapter.getWorkoutLogFull('wl-001')

      expect(result).not.toBeNull()
      expect(result!.log.id).toBe('wl-001')
      expect(result!.groups).toHaveLength(1)
      expect(result!.groups[0].id).toBe('lag-001')
      expect(result!.activities).toHaveLength(1)
      expect(result!.activities[0].id).toBe('la-001')
      expect(result!.sets).toHaveLength(1)
      expect(result!.sets[0].id).toBe('ls-001')
    })

    it('returns null when workout log not found', async () => {
      mockClient.mockResponse('workout_logs', 'select', [])

      const result = await adapter.getWorkoutLogFull('wl-999')

      expect(result).toBeNull()
    })

    it('returns empty activities and sets when no groups exist', async () => {
      mockClient.mockResponse('workout_logs', 'select', [workoutLogRow])
      mockClient.mockResponse('logged_activity_groups', 'select', [])

      const result = await adapter.getWorkoutLogFull('wl-001')

      expect(result).not.toBeNull()
      expect(result!.groups).toEqual([])
      expect(result!.activities).toEqual([])
      expect(result!.sets).toEqual([])
    })

    it('returns empty sets when no activities exist', async () => {
      mockClient.mockResponse('workout_logs', 'select', [workoutLogRow])
      mockClient.mockResponse('logged_activity_groups', 'select', [groupRow])
      mockClient.mockResponse('logged_activities', 'select', [])

      const result = await adapter.getWorkoutLogFull('wl-001')

      expect(result).not.toBeNull()
      expect(result!.groups).toHaveLength(1)
      expect(result!.activities).toEqual([])
      expect(result!.sets).toEqual([])
    })
  })

  describe('getWorkoutLogsSummary', () => {
    it('returns summary with exercise names and set counts', async () => {
      const nestedRow = {
        ...workoutLogRow,
        logged_activity_groups: [
          {
            logged_activities: [
              {
                exercises: { name: 'Squat' },
                logged_sets: [
                  { id: 'ls-1', completed: true },
                  { id: 'ls-2', completed: true },
                  { id: 'ls-3', completed: false },
                ],
              },
            ],
          },
        ],
      }
      mockClient.mockResponse('workout_logs', 'select', [nestedRow])

      const result = await adapter.getWorkoutLogsSummary('user-001')

      expect(result).toHaveLength(1)
      expect(result[0].exerciseNames).toEqual(['Squat'])
      expect(result[0].setCount).toBe(2) // only completed sets
      expect(result[0].exerciseCount).toBe(1)
      expect(result[0].log.id).toBe('wl-001')
    })
  })

  describe('createWorkoutLog', () => {
    it('creates and returns mapped workout log', async () => {
      mockClient.mockResponse('workout_logs', 'insert', [workoutLogRow])

      const result = await adapter.createWorkoutLog({
        userId: 'user-001',
        startedAt: now,
      })

      expect(mockClient.from).toHaveBeenCalledWith('workout_logs')
      expect(result.id).toBe('wl-001')
      expect(result.userId).toBe('user-001')
    })

    it('throws on insert error', async () => {
      mockClient.mockResponse('workout_logs', 'insert', null, {
        message: 'Insert failed',
      })

      await expect(
        adapter.createWorkoutLog({ userId: 'user-001', startedAt: now }),
      ).rejects.toEqual({ message: 'Insert failed' })
    })
  })

  describe('updateWorkoutLog', () => {
    it('updates and returns mapped workout log', async () => {
      const updated = { ...workoutLogRow, title: 'Updated Title' }
      mockClient.mockResponse('workout_logs', 'update', [updated])

      const domainLog = {
        id: 'wl-001',
        createdAt: now,
        updatedAt: later,
        userId: 'user-001',
        title: 'Updated Title',
        startedAt: now,
        completedAt: later,
      }

      const result = await adapter.updateWorkoutLog(domainLog)

      expect(mockClient.from).toHaveBeenCalledWith('workout_logs')
      expect(result.id).toBe('wl-001')
    })
  })

  describe('deleteWorkoutLog', () => {
    it('deletes workout log without error', async () => {
      mockClient.mockResponse('workout_logs', 'delete', [])

      await expect(adapter.deleteWorkoutLog('wl-001')).resolves.toBeUndefined()
      expect(mockClient.from).toHaveBeenCalledWith('workout_logs')
    })

    it('throws on delete error', async () => {
      mockClient.mockResponse('workout_logs', 'delete', null, {
        message: 'Delete failed',
      })

      await expect(adapter.deleteWorkoutLog('wl-001')).rejects.toEqual({
        message: 'Delete failed',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Logged entity operations
// ---------------------------------------------------------------------------

describe('Logged entity operations', () => {
  describe('createLoggedActivityGroup', () => {
    it('creates and returns mapped group', async () => {
      mockClient.mockResponse('logged_activity_groups', 'insert', [groupRow])

      const result = await adapter.createLoggedActivityGroup(
        {
          workoutLogId: 'wl-001',
          groupType: 'STRAIGHT_SETS',
          ordinal: 1,
        },
        'user-001',
      )

      expect(mockClient.from).toHaveBeenCalledWith('logged_activity_groups')
      expect(result.id).toBe('lag-001')
      expect(result.workoutLogId).toBe('wl-001')
      expect(result.groupType).toBe('STRAIGHT_SETS')
    })
  })

  describe('createLoggedActivity', () => {
    it('creates and returns mapped activity', async () => {
      mockClient.mockResponse('logged_activities', 'insert', [activityRow])

      const result = await adapter.createLoggedActivity(
        {
          loggedGroupId: 'lag-001',
          exerciseId: 'ex-001',
          ordinal: 1,
        },
        'user-001',
      )

      expect(mockClient.from).toHaveBeenCalledWith('logged_activities')
      expect(result.id).toBe('la-001')
      expect(result.exerciseId).toBe('ex-001')
    })
  })

  describe('createLoggedSet', () => {
    it('creates and returns mapped set', async () => {
      mockClient.mockResponse('logged_sets', 'insert', [setRow])

      const result = await adapter.createLoggedSet(
        {
          loggedActivityId: 'la-001',
          setNumber: 1,
          setType: 'WORKING',
          completed: true,
          rpe: 8,
        },
        'user-001',
      )

      expect(mockClient.from).toHaveBeenCalledWith('logged_sets')
      expect(result.id).toBe('ls-001')
      expect(result.setType).toBe('WORKING')
      expect(result.completed).toBe(true)
    })
  })

  describe('updateLoggedSet', () => {
    it('updates and returns mapped set', async () => {
      const updated = { ...setRow, actual_reps: 6, rpe: 9 }
      mockClient.mockResponse('logged_sets', 'update', [updated])

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

      expect(mockClient.from).toHaveBeenCalledWith('logged_sets')
      expect(result.id).toBe('ls-001')
    })
  })
})

// ---------------------------------------------------------------------------
// User profile operations
// ---------------------------------------------------------------------------

describe('User profile operations', () => {
  describe('getUserProfile', () => {
    it('returns mapped profile when found', async () => {
      mockClient.mockResponse('user_profiles', 'select', [userProfileRow])

      const result = await adapter.getUserProfile('user-001')

      expect(mockClient.from).toHaveBeenCalledWith('user_profiles')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('user-001')
      expect(result!.displayName).toBe('Coach Hamilton')
      expect(result!.preferredUnits).toBe('IMPERIAL')
    })

    it('returns null when not found', async () => {
      mockClient.mockResponse('user_profiles', 'select', [])

      const result = await adapter.getUserProfile('user-999')

      expect(result).toBeNull()
    })

    it('throws on Supabase error', async () => {
      mockClient.mockResponse('user_profiles', 'select', null, {
        message: 'Profile error',
      })

      await expect(adapter.getUserProfile('user-001')).rejects.toEqual({
        message: 'Profile error',
      })
    })
  })

  describe('updateUserProfile', () => {
    it('upserts and returns mapped profile', async () => {
      mockClient.mockResponse('user_profiles', 'upsert', [userProfileRow])

      const result = await adapter.updateUserProfile({
        id: 'user-001',
        displayName: 'Coach Hamilton',
        preferredUnits: 'IMPERIAL',
      })

      expect(mockClient.from).toHaveBeenCalledWith('user_profiles')
      expect(result.id).toBe('user-001')
      expect(result.displayName).toBe('Coach Hamilton')
    })
  })
})

// ---------------------------------------------------------------------------
// 1RM operations
// ---------------------------------------------------------------------------

describe('1RM operations', () => {
  describe('saveOneRepMax', () => {
    it('creates and returns mapped 1RM entry', async () => {
      mockClient.mockResponse('one_rep_max_history', 'insert', [ormhRow])

      const result = await adapter.saveOneRepMax({
        userId: 'user-001',
        exerciseId: 'ex-001',
        weight: { value: 405, unit: 'lb' },
        estimated: false,
        recordedAt: '2025-06-10T09:00:00Z',
      })

      expect(mockClient.from).toHaveBeenCalledWith('one_rep_max_history')
      expect(result.id).toBe('ormh-001')
      expect(result.weight).toEqual({ value: 405, unit: 'lb' })
      expect(result.estimated).toBe(false)
    })
  })

  describe('getOneRepMaxHistory', () => {
    it('returns mapped 1RM history sorted by recorded_at', async () => {
      const ormhRow2 = { ...ormhRow, id: 'ormh-002', recorded_at: '2025-06-15T09:00:00Z' }
      mockClient.mockResponse('one_rep_max_history', 'select', [ormhRow, ormhRow2])

      const result = await adapter.getOneRepMaxHistory('user-001', 'ex-001')

      expect(mockClient.from).toHaveBeenCalledWith('one_rep_max_history')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('ormh-001')
      expect(result[1].id).toBe('ormh-002')
    })

    it('returns empty array when no history', async () => {
      mockClient.mockResponse('one_rep_max_history', 'select', [])

      const result = await adapter.getOneRepMaxHistory('user-001', 'ex-999')

      expect(result).toEqual([])
    })
  })
})

// ---------------------------------------------------------------------------
// Session template operations
// ---------------------------------------------------------------------------

describe('Session template operations', () => {
  describe('getSessionTemplates', () => {
    it('returns mapped templates', async () => {
      mockClient.mockResponse('session_templates', 'select', [sessionTemplateRow])

      const result = await adapter.getSessionTemplates('user-001')

      expect(mockClient.from).toHaveBeenCalledWith('session_templates')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('st-001')
      expect(result[0].name).toBe('Heavy Upper')
      expect(result[0].category).toBe('STRENGTH')
    })
  })

  describe('getSessionTemplate', () => {
    it('returns mapped template when found', async () => {
      mockClient.mockResponse('session_templates', 'select', [sessionTemplateRow])

      const result = await adapter.getSessionTemplate('st-001')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('st-001')
      expect(result!.scoring).toBe('NONE')
    })

    it('returns null when not found', async () => {
      mockClient.mockResponse('session_templates', 'select', [])

      const result = await adapter.getSessionTemplate('st-999')

      expect(result).toBeNull()
    })
  })

  describe('getSessionTemplateFull', () => {
    it('returns full template with groups and activities', async () => {
      mockClient.mockResponse('session_templates', 'select', [sessionTemplateRow])
      mockClient.mockResponse('activity_groups', 'select', [activityGroupRow])
      mockClient.mockResponse('activities', 'select', [templateActivityRow])

      const result = await adapter.getSessionTemplateFull('st-001')

      expect(result).not.toBeNull()
      expect(result!.template.id).toBe('st-001')
      expect(result!.groups).toHaveLength(1)
      expect(result!.groups[0].id).toBe('ag-001')
      expect(result!.activities).toHaveLength(1)
      expect(result!.activities[0].id).toBe('act-001')
    })

    it('returns null when template not found', async () => {
      mockClient.mockResponse('session_templates', 'select', [])

      const result = await adapter.getSessionTemplateFull('st-999')

      expect(result).toBeNull()
    })

    it('returns empty activities when no groups', async () => {
      mockClient.mockResponse('session_templates', 'select', [sessionTemplateRow])
      mockClient.mockResponse('activity_groups', 'select', [])

      const result = await adapter.getSessionTemplateFull('st-001')

      expect(result).not.toBeNull()
      expect(result!.groups).toEqual([])
      expect(result!.activities).toEqual([])
    })
  })

  describe('createSessionTemplateFull', () => {
    it('creates template with groups and activities', async () => {
      mockClient.mockResponse('session_templates', 'insert', [sessionTemplateRow])
      mockClient.mockResponse('activity_groups', 'insert', [activityGroupRow])
      mockClient.mockResponse('activities', 'insert', [templateActivityRow])

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

      expect(result.template.id).toBe('st-001')
      expect(result.groups).toHaveLength(1)
      expect(result.activities).toHaveLength(1)
    })
  })

  describe('updateSessionTemplateFull', () => {
    it('updates template, deletes old groups, creates new ones', async () => {
      mockClient.mockResponse('session_templates', 'update', [sessionTemplateRow])
      mockClient.mockResponse('activity_groups', 'delete', [])
      mockClient.mockResponse('activity_groups', 'insert', [activityGroupRow])
      mockClient.mockResponse('activities', 'insert', [templateActivityRow])

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

      expect(result.template.id).toBe('st-001')
    })
  })

  describe('deleteSessionTemplate', () => {
    it('deletes template without error', async () => {
      mockClient.mockResponse('session_templates', 'delete', [])

      await expect(adapter.deleteSessionTemplate('st-001')).resolves.toBeUndefined()
      expect(mockClient.from).toHaveBeenCalledWith('session_templates')
    })
  })
})

// ---------------------------------------------------------------------------
// Program operations
// ---------------------------------------------------------------------------

describe('Program operations', () => {
  describe('getPrograms', () => {
    it('returns mapped programs', async () => {
      mockClient.mockResponse('programs', 'select', [programRow])

      const result = await adapter.getPrograms('user-001')

      expect(mockClient.from).toHaveBeenCalledWith('programs')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('prog-001')
      expect(result[0].name).toBe('Test Program')
      expect(result[0].source).toBe('CUSTOM')
    })
  })

  describe('getProgramFull', () => {
    it('returns full program with blocks, weeks, and sessions', async () => {
      mockClient.mockResponse('programs', 'select', [programRow])
      mockClient.mockResponse('blocks', 'select', [blockRow])
      mockClient.mockResponse('block_weeks', 'select', [blockWeekRow])
      mockClient.mockResponse('scheduled_sessions', 'select', [scheduledSessionRow])

      const result = await adapter.getProgramFull('prog-001')

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
      mockClient.mockResponse('programs', 'select', [])

      const result = await adapter.getProgramFull('prog-999')

      expect(result).toBeNull()
    })

    it('returns empty weeks and sessions when no blocks', async () => {
      mockClient.mockResponse('programs', 'select', [programRow])
      mockClient.mockResponse('blocks', 'select', [])

      const result = await adapter.getProgramFull('prog-001')

      expect(result).not.toBeNull()
      expect(result!.blocks).toEqual([])
      expect(result!.blockWeeks).toEqual([])
      expect(result!.scheduledSessions).toEqual([])
    })

    it('returns empty sessions when no weeks', async () => {
      mockClient.mockResponse('programs', 'select', [programRow])
      mockClient.mockResponse('blocks', 'select', [blockRow])
      mockClient.mockResponse('block_weeks', 'select', [])

      const result = await adapter.getProgramFull('prog-001')

      expect(result).not.toBeNull()
      expect(result!.blocks).toHaveLength(1)
      expect(result!.blockWeeks).toEqual([])
      expect(result!.scheduledSessions).toEqual([])
    })
  })

  describe('createProgramFull', () => {
    it('creates program with nested blocks, weeks, and sessions', async () => {
      // createProgramFull calls insert for each entity, then getProgramFull
      mockClient.mockResponse('programs', 'insert', [programRow])
      mockClient.mockResponse('blocks', 'insert', [blockRow])
      mockClient.mockResponse('block_weeks', 'insert', [blockWeekRow])
      mockClient.mockResponse('scheduled_sessions', 'insert', [scheduledSessionRow])
      // getProgramFull calls
      mockClient.mockResponse('programs', 'select', [programRow])
      mockClient.mockResponse('blocks', 'select', [blockRow])
      mockClient.mockResponse('block_weeks', 'select', [blockWeekRow])
      mockClient.mockResponse('scheduled_sessions', 'select', [scheduledSessionRow])

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

      expect(result.program.id).toBe('prog-001')
      expect(result.blocks).toHaveLength(1)
      expect(result.scheduledSessions).toHaveLength(1)
    })
  })

  describe('updateProgramFull', () => {
    it('updates program, deletes old blocks, and re-creates', async () => {
      mockClient.mockResponse('programs', 'update', [programRow])
      mockClient.mockResponse('blocks', 'delete', [])
      mockClient.mockResponse('blocks', 'insert', [blockRow])
      mockClient.mockResponse('block_weeks', 'insert', [blockWeekRow])
      mockClient.mockResponse('scheduled_sessions', 'insert', [scheduledSessionRow])
      // getProgramFull calls at end
      mockClient.mockResponse('programs', 'select', [programRow])
      mockClient.mockResponse('blocks', 'select', [blockRow])
      mockClient.mockResponse('block_weeks', 'select', [blockWeekRow])
      mockClient.mockResponse('scheduled_sessions', 'select', [scheduledSessionRow])

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

      expect(result.program.id).toBe('prog-001')
    })
  })

  describe('deleteProgram', () => {
    it('deletes program without error', async () => {
      mockClient.mockResponse('programs', 'delete', [])

      await expect(adapter.deleteProgram('prog-001')).resolves.toBeUndefined()
      expect(mockClient.from).toHaveBeenCalledWith('programs')
    })

    it('throws on delete error', async () => {
      mockClient.mockResponse('programs', 'delete', null, {
        message: 'Cascade failed',
      })

      await expect(adapter.deleteProgram('prog-001')).rejects.toEqual({
        message: 'Cascade failed',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Program activation operations
// ---------------------------------------------------------------------------

describe('Program activation operations', () => {
  describe('getActiveProgram', () => {
    it('returns mapped activation when found', async () => {
      mockClient.mockResponse('program_activations', 'select', [programActivationRow])

      const result = await adapter.getActiveProgram('user-001')

      expect(mockClient.from).toHaveBeenCalledWith('program_activations')
      expect(result).not.toBeNull()
      expect(result!.programId).toBe('prog-001')
      expect(result!.currentBlockOrdinal).toBe(1)
      expect(result!.currentWeekNumber).toBe(2)
      expect(result!.startDate).toBe('2025-06-01')
    })

    it('returns null when no active program', async () => {
      mockClient.mockResponse('program_activations', 'select', [])

      const result = await adapter.getActiveProgram('user-001')

      expect(result).toBeNull()
    })
  })

  describe('setActiveProgram', () => {
    it('upserts activation and returns mapped result', async () => {
      mockClient.mockResponse('program_activations', 'upsert', [programActivationRow])

      const result = await adapter.setActiveProgram('user-001', 'prog-001', '2025-06-01')

      expect(mockClient.from).toHaveBeenCalledWith('program_activations')
      expect(result.programId).toBe('prog-001')
      expect(result.userId).toBe('user-001')
    })
  })

  describe('clearActiveProgram', () => {
    it('deletes activation without error', async () => {
      mockClient.mockResponse('program_activations', 'delete', [])

      await expect(adapter.clearActiveProgram('user-001')).resolves.toBeUndefined()
      expect(mockClient.from).toHaveBeenCalledWith('program_activations')
    })

    it('throws on delete error', async () => {
      mockClient.mockResponse('program_activations', 'delete', null, {
        message: 'Delete failed',
      })

      await expect(adapter.clearActiveProgram('user-001')).rejects.toEqual({
        message: 'Delete failed',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Utility / history operations
// ---------------------------------------------------------------------------

describe('Utility operations', () => {
  describe('getRecentlyUsedExerciseIds', () => {
    it('returns deduplicated exercise IDs', async () => {
      // Mock the complex join query on logged_activities table
      const joinRows = [
        {
          exercise_id: 'ex-001',
          logged_activity_groups: { workout_logs: { user_id: 'user-001', started_at: now } },
        },
        {
          exercise_id: 'ex-001', // duplicate
          logged_activity_groups: { workout_logs: { user_id: 'user-001', started_at: now } },
        },
        {
          exercise_id: 'ex-002',
          logged_activity_groups: { workout_logs: { user_id: 'user-001', started_at: later } },
        },
      ]
      mockClient.mockResponse('logged_activities', 'select', joinRows)

      const result = await adapter.getRecentlyUsedExerciseIds('user-001', 10)

      expect(result).toEqual(['ex-001', 'ex-002'])
    })
  })

  describe('getExerciseWorkoutHistory', () => {
    it('returns workout history grouped by workout log', async () => {
      const joinRows = [
        {
          id: 'la-001',
          exercise_id: 'ex-001',
          logged_group_id: 'lag-001',
          logged_activity_groups: {
            workout_log_id: 'wl-001',
            workout_logs: workoutLogRow,
          },
          logged_sets: [setRow],
        },
      ]
      mockClient.mockResponse('logged_activities', 'select', joinRows)

      const result = await adapter.getExerciseWorkoutHistory('user-001', 'ex-001', 10)

      expect(result).toHaveLength(1)
      expect(result[0].log.id).toBe('wl-001')
      expect(result[0].sets).toHaveLength(1)
      expect(result[0].sets[0].id).toBe('ls-001')
    })

    it('groups sets from multiple activities in the same workout', async () => {
      const setRow2: LoggedSetRow = { ...setRow, id: 'ls-002', set_number: 2 }
      const joinRows = [
        {
          id: 'la-001',
          exercise_id: 'ex-001',
          logged_group_id: 'lag-001',
          logged_activity_groups: {
            workout_log_id: 'wl-001',
            workout_logs: workoutLogRow,
          },
          logged_sets: [setRow],
        },
        {
          id: 'la-002',
          exercise_id: 'ex-001',
          logged_group_id: 'lag-002',
          logged_activity_groups: {
            workout_log_id: 'wl-001',
            workout_logs: workoutLogRow,
          },
          logged_sets: [setRow2],
        },
      ]
      mockClient.mockResponse('logged_activities', 'select', joinRows)

      const result = await adapter.getExerciseWorkoutHistory('user-001', 'ex-001', 10)

      // Both activities are in the same workout, so grouped together
      expect(result).toHaveLength(1)
      expect(result[0].sets).toHaveLength(2)
    })
  })
})

// ===========================================================================
// Chat row fixtures
// ===========================================================================

const conversationRow: ConversationRow = {
  id: 'conv-001',
  type: 'direct',
  title: null,
  group_id: null,
  created_at: now,
  updated_at: now,
}

const participantRow: ConversationParticipantRow = {
  id: 'cp-001',
  conversation_id: 'conv-001',
  user_id: 'user-001',
  last_read_at: now,
  is_archived: false,
  joined_at: now,
  left_at: null,
}

const participantRow2: ConversationParticipantRow = {
  ...participantRow,
  id: 'cp-002',
  user_id: 'user-002',
}

const messageRow: MessageRow = {
  id: 'msg-001',
  conversation_id: 'conv-001',
  sender_id: 'user-001',
  message_type: 'text',
  content: 'Hello there',
  created_at: now,
  updated_at: now,
}

const messageRow2: MessageRow = {
  ...messageRow,
  id: 'msg-002',
  sender_id: 'user-002',
  content: 'Hey!',
  created_at: later,
  updated_at: later,
}

const mediaAttachmentRow: MediaAttachmentRow = {
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

// ===========================================================================
// Chat operations
// ===========================================================================

describe('Chat operations', () => {
  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  describe('createConversation', () => {
    it('inserts conversation and participant rows, returns mapped conversation', async () => {
      mockClient.mockResponse('conversations', 'insert', [conversationRow])
      mockClient.mockResponse('conversation_participants', 'insert', [participantRow])

      const result = await adapter.createConversation('direct', ['user-002'])

      expect(mockClient.from).toHaveBeenCalledWith('conversations')
      expect(mockClient.from).toHaveBeenCalledWith('conversation_participants')
      expect(result.id).toBe('conv-001')
      expect(result.type).toBe('direct')
      expect(result.participantUserIds).toContain('user-001')
      expect(result.participantUserIds).toContain('user-002')
    })

    it('throws on conversation insert error', async () => {
      mockClient.mockResponse('conversations', 'insert', null, { message: 'Insert failed' })

      await expect(adapter.createConversation('direct', ['user-002'])).rejects.toEqual({
        message: 'Insert failed',
      })
    })
  })

  describe('getConversations', () => {
    it('returns conversations for the current user', async () => {
      // Mock returns participant rows (used for both participant queries)
      mockClient.mockResponse('conversation_participants', 'select', [
        { conversation_id: 'conv-001', user_id: 'user-001' },
        { conversation_id: 'conv-001', user_id: 'user-002' },
      ])
      mockClient.mockResponse('conversations', 'select', [conversationRow])

      const result = await adapter.getConversations()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('conv-001')
      expect(result[0].participantUserIds).toContain('user-001')
    })

    it('returns empty array when user has no conversations', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [])

      const result = await adapter.getConversations()

      expect(result).toEqual([])
    })

    it('throws on participant query error', async () => {
      mockClient.mockResponse('conversation_participants', 'select', null, {
        message: 'DB error',
      })

      await expect(adapter.getConversations()).rejects.toEqual({ message: 'DB error' })
    })
  })

  describe('getConversation', () => {
    it('returns mapped conversation with participants', async () => {
      mockClient.mockResponse('conversations', 'select', [conversationRow])
      mockClient.mockResponse('conversation_participants', 'select', [
        { user_id: 'user-001' },
        { user_id: 'user-002' },
      ])

      const result = await adapter.getConversation('conv-001')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-001')
      expect(result!.participantUserIds).toEqual(['user-001', 'user-002'])
    })

    it('returns null when conversation not found', async () => {
      mockClient.mockResponse('conversations', 'select', [])
      mockClient.mockResponse('conversation_participants', 'select', [])

      const result = await adapter.getConversation('conv-999')

      expect(result).toBeNull()
    })

    it('throws on query error', async () => {
      mockClient.mockResponse('conversations', 'select', null, { message: 'Not found' })

      await expect(adapter.getConversation('conv-001')).rejects.toEqual({
        message: 'Not found',
      })
    })
  })

  describe('findDirectConversation', () => {
    it('returns null when user has no conversations', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [])

      const result = await adapter.findDirectConversation('user-002')

      expect(result).toBeNull()
    })

    it('returns null when no direct conversations exist', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [
        { conversation_id: 'conv-001' },
      ])
      mockClient.mockResponse('conversations', 'select', [])

      const result = await adapter.findDirectConversation('user-002')

      expect(result).toBeNull()
    })

    it('throws on participant query error', async () => {
      mockClient.mockResponse('conversation_participants', 'select', null, {
        message: 'DB error',
      })

      await expect(adapter.findDirectConversation('user-002')).rejects.toEqual({
        message: 'DB error',
      })
    })
  })

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  describe('sendMessage', () => {
    it('inserts message and returns mapped result', async () => {
      mockClient.mockResponse('messages', 'insert', [messageRow])

      const result = await adapter.sendMessage('conv-001', 'text', 'Hello there')

      expect(mockClient.from).toHaveBeenCalledWith('messages')
      expect(result.id).toBe('msg-001')
      expect(result.conversationId).toBe('conv-001')
      expect(result.senderId).toBe('user-001')
      expect(result.messageType).toBe('text')
      expect(result.content).toBe('Hello there')
    })

    it('throws on insert error', async () => {
      mockClient.mockResponse('messages', 'insert', null, { message: 'Insert failed' })

      await expect(adapter.sendMessage('conv-001', 'text', 'Hello')).rejects.toEqual({
        message: 'Insert failed',
      })
    })
  })

  describe('getMessages', () => {
    it('returns mapped messages in chronological order', async () => {
      mockClient.mockResponse('messages', 'select', [messageRow2, messageRow])

      const result = await adapter.getMessages('conv-001', { limit: 50 })

      expect(result).toHaveLength(2)
      // .reverse() is called on the result, so input [msg-002, msg-001] becomes [msg-001, msg-002]
      expect(result[0].id).toBe('msg-001')
      expect(result[1].id).toBe('msg-002')
    })

    it('returns empty array when no messages', async () => {
      mockClient.mockResponse('messages', 'select', [])

      const result = await adapter.getMessages('conv-001', { limit: 50 })

      expect(result).toEqual([])
    })

    it('throws on query error', async () => {
      mockClient.mockResponse('messages', 'select', null, { message: 'Query failed' })

      await expect(adapter.getMessages('conv-001', { limit: 50 })).rejects.toEqual({
        message: 'Query failed',
      })
    })
  })

  describe('getMessagesSince', () => {
    it('returns messages after the given timestamp', async () => {
      mockClient.mockResponse('messages', 'select', [messageRow2])

      const result = await adapter.getMessagesSince('conv-001', now)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('msg-002')
    })

    it('throws on query error', async () => {
      mockClient.mockResponse('messages', 'select', null, { message: 'Query failed' })

      await expect(adapter.getMessagesSince('conv-001', now)).rejects.toEqual({
        message: 'Query failed',
      })
    })
  })

  // -------------------------------------------------------------------------
  // Participants
  // -------------------------------------------------------------------------

  describe('updateLastRead', () => {
    it('updates last_read_at for the current user', async () => {
      mockClient.mockResponse('conversation_participants', 'update', [])

      await adapter.updateLastRead('conv-001')

      expect(mockClient.from).toHaveBeenCalledWith('conversation_participants')
    })

    it('throws on update error', async () => {
      mockClient.mockResponse('conversation_participants', 'update', null, {
        message: 'Update failed',
      })

      await expect(adapter.updateLastRead('conv-001')).rejects.toEqual({
        message: 'Update failed',
      })
    })
  })

  describe('getUnreadCounts', () => {
    it('returns empty map when user has no active participations', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [])

      const result = await adapter.getUnreadCounts()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })

    it('returns unread counts for conversations with messages after last_read_at', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [
        { conversation_id: 'conv-001', last_read_at: now },
        { conversation_id: 'conv-002', last_read_at: null },
      ])
      // The mock returns the same response for all messages:select calls,
      // so both conversations will report the same count.
      mockClient.mockResponse('messages', 'select', [], undefined, { count: 3 })

      const result = await adapter.getUnreadCounts()

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get('conv-001')).toBe(3)
      expect(result.get('conv-002')).toBe(3)
    })

    it('throws on participation query error', async () => {
      mockClient.mockResponse('conversation_participants', 'select', null, {
        message: 'DB error',
      })

      await expect(adapter.getUnreadCounts()).rejects.toEqual({ message: 'DB error' })
    })
  })

  describe('addParticipant', () => {
    it('inserts participant and returns mapped result', async () => {
      mockClient.mockResponse('conversation_participants', 'insert', [participantRow2])

      const result = await adapter.addParticipant('conv-001', 'user-002')

      expect(mockClient.from).toHaveBeenCalledWith('conversation_participants')
      expect(result.conversationId).toBe('conv-001')
      expect(result.userId).toBe('user-002')
    })

    it('throws on insert error', async () => {
      mockClient.mockResponse('conversation_participants', 'insert', null, {
        message: 'Duplicate',
      })

      await expect(adapter.addParticipant('conv-001', 'user-002')).rejects.toEqual({
        message: 'Duplicate',
      })
    })
  })

  describe('leaveConversation', () => {
    it('sets left_at for the current user', async () => {
      mockClient.mockResponse('conversation_participants', 'update', [])

      await adapter.leaveConversation('conv-001')

      expect(mockClient.from).toHaveBeenCalledWith('conversation_participants')
    })

    it('throws on update error', async () => {
      mockClient.mockResponse('conversation_participants', 'update', null, {
        message: 'Update failed',
      })

      await expect(adapter.leaveConversation('conv-001')).rejects.toEqual({
        message: 'Update failed',
      })
    })
  })

  describe('toggleArchive', () => {
    it('reads current is_archived and toggles it', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [{ is_archived: false }])
      mockClient.mockResponse('conversation_participants', 'update', [])

      await adapter.toggleArchive('conv-001')

      expect(mockClient.from).toHaveBeenCalledWith('conversation_participants')
    })

    it('throws on read error', async () => {
      mockClient.mockResponse('conversation_participants', 'select', null, {
        message: 'Fetch failed',
      })

      await expect(adapter.toggleArchive('conv-001')).rejects.toEqual({
        message: 'Fetch failed',
      })
    })

    it('throws on update error', async () => {
      mockClient.mockResponse('conversation_participants', 'select', [{ is_archived: true }])
      mockClient.mockResponse('conversation_participants', 'update', null, {
        message: 'Update failed',
      })

      await expect(adapter.toggleArchive('conv-001')).rejects.toEqual({
        message: 'Update failed',
      })
    })
  })

  // -------------------------------------------------------------------------
  // Media attachments
  // -------------------------------------------------------------------------

  describe('saveMediaAttachment', () => {
    it('inserts attachment and returns mapped result', async () => {
      mockClient.mockResponse('media_attachments', 'insert', [mediaAttachmentRow])

      const result = await adapter.saveMediaAttachment('msg-001', {
        messageId: 'msg-001',
        provider: 'cloudflare_stream',
        mediaType: 'video',
        status: 'ready',
        originalFilename: 'workout.mp4',
        mimeType: 'video/mp4',
      })

      expect(mockClient.from).toHaveBeenCalledWith('media_attachments')
      expect(result.id).toBe('ma-001')
      expect(result.messageId).toBe('msg-001')
      expect(result.provider).toBe('cloudflare_stream')
      expect(result.mediaType).toBe('video')
      expect(result.status).toBe('ready')
    })

    it('throws on insert error', async () => {
      mockClient.mockResponse('media_attachments', 'insert', null, {
        message: 'Insert failed',
      })

      await expect(
        adapter.saveMediaAttachment('msg-001', {
          messageId: 'msg-001',
          provider: 'cloudflare_stream',
          mediaType: 'video',
          status: 'processing',
        }),
      ).rejects.toEqual({ message: 'Insert failed' })
    })
  })

  describe('getMediaAttachments', () => {
    it('returns mapped attachments for given message IDs', async () => {
      mockClient.mockResponse('media_attachments', 'select', [mediaAttachmentRow])

      const result = await adapter.getMediaAttachments(['msg-001'])

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('ma-001')
      expect(result[0].originalFilename).toBe('workout.mp4')
    })

    it('returns empty array for empty message IDs', async () => {
      const result = await adapter.getMediaAttachments([])

      expect(result).toEqual([])
    })

    it('throws on query error', async () => {
      mockClient.mockResponse('media_attachments', 'select', null, {
        message: 'Query failed',
      })

      await expect(adapter.getMediaAttachments(['msg-001'])).rejects.toEqual({
        message: 'Query failed',
      })
    })
  })

  describe('updateMediaAttachment', () => {
    it('updates specified fields and returns mapped result', async () => {
      const updatedRow = {
        ...mediaAttachmentRow,
        status: 'processing',
        thumbnail_url: 'https://cdn.example.com/new-thumb.jpg',
      }
      mockClient.mockResponse('media_attachments', 'update', [updatedRow])

      const result = await adapter.updateMediaAttachment('ma-001', {
        status: 'processing',
        thumbnailUrl: 'https://cdn.example.com/new-thumb.jpg',
      })

      expect(mockClient.from).toHaveBeenCalledWith('media_attachments')
      expect(result.id).toBe('ma-001')
      expect(result.status).toBe('processing')
      expect(result.thumbnailUrl).toBe('https://cdn.example.com/new-thumb.jpg')
    })

    it('throws on update error', async () => {
      mockClient.mockResponse('media_attachments', 'update', null, {
        message: 'Update failed',
      })

      await expect(adapter.updateMediaAttachment('ma-001', { status: 'failed' })).rejects.toEqual({
        message: 'Update failed',
      })
    })
  })
})
