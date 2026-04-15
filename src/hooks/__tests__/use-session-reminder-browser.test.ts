// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks -- must be declared before importing the hook
// ---------------------------------------------------------------------------

const mockIsTauri = vi.fn(() => false)
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mockIsTauri(),
  invoke: vi.fn(),
}))

const mockGetSupabaseClient = vi.fn()
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => mockGetSupabaseClient(),
}))

const mockGetNotificationPreferences = vi.fn()
const mockIsInQuietHours = vi.fn((_prefs: unknown) => false)
const mockSendSessionReminderNotification = vi.fn()
vi.mock('@/lib/notification-service', () => ({
  getNotificationPreferences: () => mockGetNotificationPreferences(),
  isInQuietHours: (prefs: unknown) => mockIsInQuietHours(prefs),
  sendSessionReminderNotification: (...args: unknown[]) =>
    mockSendSessionReminderNotification(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnabledPrefs() {
  return {
    enabled: true,
    restTimer: { enabled: true, soundEnabled: true, vibrationEnabled: true },
    sessionReminders: { enabled: true, advanceMinutes: 30 },
    prCelebrations: { enabled: true },
    quietHours: { enabled: false, startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 },
  }
}

/** Build a chainable mock Supabase query builder. */
function makeQueryBuilder(resolvedData: unknown, resolvedError: unknown = null) {
  const builder: Record<string, unknown> = {}
  const terminalResult = { data: resolvedData, error: resolvedError }

  // Every chainable method returns the builder itself
  for (const method of ['select', 'eq', 'gte', 'lt', 'limit']) {
    builder[method] = vi.fn(() => builder)
  }
  // Terminal methods resolve the result
  builder.maybeSingle = vi.fn(() => Promise.resolve(terminalResult))
  // When no .maybeSingle() is called (e.g. scheduled_sessions, workout_logs),
  // the builder itself acts as a thenable so `await supabase.from(...)...` resolves
  builder.then = (resolve: (v: unknown) => void) => resolve(terminalResult)

  return builder
}

/**
 * Create a mock Supabase client where `.from(table)` returns a pre-configured
 * query builder per table.
 */
function makeMockSupabase(config: {
  activation?: object | null
  block?: object | null
  blockWeek?: object | null
  sessions?: object[] | null
  todayLogs?: object[] | null
}) {
  const builders: Record<string, ReturnType<typeof makeQueryBuilder>> = {
    program_activations: makeQueryBuilder(config.activation ?? null),
    blocks: makeQueryBuilder(config.block ?? null),
    block_weeks: makeQueryBuilder(config.blockWeek ?? null),
    scheduled_sessions: makeQueryBuilder(config.sessions ?? null),
    workout_logs: makeQueryBuilder(config.todayLogs ?? null),
  }

  return {
    from: vi.fn((table: string) => builders[table] ?? makeQueryBuilder(null)),
  }
}

function defaultSupabaseConfig() {
  return {
    activation: {
      id: 'act-1',
      program_id: 'prog-1',
      current_block_ordinal: 1,
      current_week_number: 1,
    },
    block: { id: 'block-1' },
    blockWeek: { id: 'bw-1' },
    sessions: [
      {
        id: 'ss-1',
        session_template_id: 'st-1',
        session_templates: { name: 'Upper Body' },
      },
    ],
    todayLogs: [] as { id: string }[],
  }
}

// ---------------------------------------------------------------------------
// Module-level _lastRemindedDate persists across tests. We use
// vi.resetModules() + dynamic import to get a fresh module per test.
// ---------------------------------------------------------------------------

let useSessionReminderBrowser: () => void

async function freshImport() {
  vi.resetModules()
  const mod = await import('../use-session-reminder-browser')
  useSessionReminderBrowser = mod.useSessionReminderBrowser
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useSessionReminderBrowser', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    // Pin time to 10:00 on a Wednesday (day_of_week = 3)
    vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0)) // 2026-04-15 10:00

    mockIsTauri.mockReturnValue(false)
    mockIsInQuietHours.mockReturnValue(false)
    mockGetNotificationPreferences.mockResolvedValue(makeEnabledPrefs())
    mockSendSessionReminderNotification.mockResolvedValue(undefined)

    await freshImport()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. fires notification when all conditions pass
  // -------------------------------------------------------------------------
  it('fires notification when all conditions pass', async () => {
    const supabase = makeMockSupabase(defaultSupabaseConfig())
    mockGetSupabaseClient.mockReturnValue(supabase)

    renderHook(() => useSessionReminderBrowser())

    // The hook calls checkAndMaybeNotify() immediately (Promise-based).
    // Flush the microtask queue so all awaits resolve.
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).toHaveBeenCalledTimes(1)
    expect(mockSendSessionReminderNotification).toHaveBeenCalledWith(
      'Upper Body',
      expect.objectContaining({ enabled: true }),
    )
  })

  // -------------------------------------------------------------------------
  // 2. skips when master toggle off
  // -------------------------------------------------------------------------
  it('skips when master toggle off', async () => {
    const prefs = makeEnabledPrefs()
    prefs.enabled = false
    mockGetNotificationPreferences.mockResolvedValue(prefs)
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(defaultSupabaseConfig()))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 3. skips when quiet hours active
  // -------------------------------------------------------------------------
  it('skips when quiet hours active', async () => {
    mockIsInQuietHours.mockReturnValue(true)
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(defaultSupabaseConfig()))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 4. skips when outside 06-20 time window
  // -------------------------------------------------------------------------
  it('skips when outside 06-20 time window (before 6)', async () => {
    vi.setSystemTime(new Date(2026, 3, 15, 4, 0, 0)) // 04:00
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(defaultSupabaseConfig()))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  it('skips when outside 06-20 time window (after 20)', async () => {
    vi.setSystemTime(new Date(2026, 3, 15, 21, 0, 0)) // 21:00
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(defaultSupabaseConfig()))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 5. skips when workout already logged today
  // -------------------------------------------------------------------------
  it('skips when workout already logged today', async () => {
    const config = defaultSupabaseConfig()
    config.todayLogs = [{ id: 'log-1' }]
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(config))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 6. fires at most once per day
  // -------------------------------------------------------------------------
  it('fires at most once per day', async () => {
    const supabase = makeMockSupabase(defaultSupabaseConfig())
    mockGetSupabaseClient.mockReturnValue(supabase)

    renderHook(() => useSessionReminderBrowser())

    // First immediate call fires
    await vi.advanceTimersByTimeAsync(0)
    expect(mockSendSessionReminderNotification).toHaveBeenCalledTimes(1)

    // Advance past one interval (60s) to trigger the second poll
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockSendSessionReminderNotification).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // 7. no-op in Tauri mode
  // -------------------------------------------------------------------------
  it('no-op in Tauri mode', async () => {
    mockIsTauri.mockReturnValue(true)
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(defaultSupabaseConfig()))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockGetSupabaseClient).not.toHaveBeenCalled()
    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 8. skips when no active program
  // -------------------------------------------------------------------------
  it('skips when no active program', async () => {
    const config = defaultSupabaseConfig()
    config.activation = null as unknown as typeof config.activation
    mockGetSupabaseClient.mockReturnValue(makeMockSupabase(config))

    renderHook(() => useSessionReminderBrowser())
    await vi.advanceTimersByTimeAsync(0)

    expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 9. Supabase query error branches
  // -------------------------------------------------------------------------
  describe('Supabase query error branches', () => {
    /**
     * Build a mock Supabase client where all tables return default data
     * except the specified table, which returns an error.
     */
    function makeMockSupabaseWithError(
      errorTable:
        | 'program_activations'
        | 'blocks'
        | 'block_weeks'
        | 'scheduled_sessions'
        | 'workout_logs',
    ) {
      const config = defaultSupabaseConfig()
      const builders: Record<string, ReturnType<typeof makeQueryBuilder>> = {
        program_activations: makeQueryBuilder(config.activation),
        blocks: makeQueryBuilder(config.block),
        block_weeks: makeQueryBuilder(config.blockWeek),
        scheduled_sessions: makeQueryBuilder(config.sessions),
        workout_logs: makeQueryBuilder(config.todayLogs),
      }
      builders[errorTable] = makeQueryBuilder(null, { message: `${errorTable} query failed` })

      return {
        from: vi.fn((table: string) => builders[table] ?? makeQueryBuilder(null)),
      }
    }

    it('logs error and skips notification on program_activations error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSupabaseClient.mockReturnValue(makeMockSupabaseWithError('program_activations'))

      renderHook(() => useSessionReminderBrowser())
      await vi.advanceTimersByTimeAsync(0)

      expect(errorSpy).toHaveBeenCalledWith(
        '[session-reminder-browser] Failed to query program_activations:',
        expect.objectContaining({ message: 'program_activations query failed' }),
      )
      expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('logs error and skips notification on blocks error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSupabaseClient.mockReturnValue(makeMockSupabaseWithError('blocks'))

      renderHook(() => useSessionReminderBrowser())
      await vi.advanceTimersByTimeAsync(0)

      expect(errorSpy).toHaveBeenCalledWith(
        '[session-reminder-browser] Failed to query blocks:',
        expect.objectContaining({ message: 'blocks query failed' }),
      )
      expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('logs error and skips notification on block_weeks error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSupabaseClient.mockReturnValue(makeMockSupabaseWithError('block_weeks'))

      renderHook(() => useSessionReminderBrowser())
      await vi.advanceTimersByTimeAsync(0)

      expect(errorSpy).toHaveBeenCalledWith(
        '[session-reminder-browser] Failed to query block_weeks:',
        expect.objectContaining({ message: 'block_weeks query failed' }),
      )
      expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('logs error and skips notification on scheduled_sessions error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSupabaseClient.mockReturnValue(makeMockSupabaseWithError('scheduled_sessions'))

      renderHook(() => useSessionReminderBrowser())
      await vi.advanceTimersByTimeAsync(0)

      expect(errorSpy).toHaveBeenCalledWith(
        '[session-reminder-browser] Failed to query scheduled_sessions:',
        expect.objectContaining({ message: 'scheduled_sessions query failed' }),
      )
      expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })

    it('logs error and skips notification on workout_logs error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetSupabaseClient.mockReturnValue(makeMockSupabaseWithError('workout_logs'))

      renderHook(() => useSessionReminderBrowser())
      await vi.advanceTimersByTimeAsync(0)

      expect(errorSpy).toHaveBeenCalledWith(
        '[session-reminder-browser] Failed to query workout_logs:',
        expect.objectContaining({ message: 'workout_logs query failed' }),
      )
      expect(mockSendSessionReminderNotification).not.toHaveBeenCalled()
      errorSpy.mockRestore()
    })
  })
})
