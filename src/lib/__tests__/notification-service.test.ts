// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { NotificationPreferences } from '@/domain/types/notification'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
  invoke: vi.fn(),
}))

// Mock window.Notification before importing the module under test
const MockNotification = vi.fn() as ReturnType<typeof vi.fn> & {
  permission: NotificationPermission
  requestPermission: ReturnType<typeof vi.fn>
}
const permissionGetter = vi.fn(() => 'granted')
Object.defineProperty(MockNotification, 'permission', {
  get: permissionGetter,
  configurable: true,
})
MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')

Object.defineProperty(window, 'Notification', {
  value: MockNotification,
  writable: true,
  configurable: true,
})

// Import after mocks are established
import { sendRestTimerNotification, sendSessionReminderNotification } from '../notification-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    enabled: true,
    restTimer: { enabled: true, soundEnabled: true, vibrationEnabled: true },
    sessionReminders: { enabled: true, advanceMinutes: 30 },
    prCelebrations: { enabled: true },
    quietHours: { enabled: false, startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let savedNotification: typeof window.Notification | undefined

beforeEach(() => {
  vi.clearAllMocks()
  permissionGetter.mockReturnValue('granted')
  MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')
  savedNotification = window.Notification
})

afterEach(() => {
  // Restore Notification if a test removed it
  if (!('Notification' in window) && savedNotification) {
    Object.defineProperty(window, 'Notification', {
      value: savedNotification,
      writable: true,
      configurable: true,
    })
  }
})

// ---------------------------------------------------------------------------
// sendRestTimerNotification
// ---------------------------------------------------------------------------

describe('sendRestTimerNotification', () => {
  it('fires notification when permission granted and toggles on', async () => {
    const prefs = makePrefs()

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification).toHaveBeenCalledOnce()
    const [title, options] = MockNotification.mock.calls[0]
    expect(title).toBe('REST COMPLETE')
    expect(options.body).toContain('Bench Press')
    expect(options.body).toContain('Set 3')
  })

  it('no-op when master toggle off', async () => {
    const prefs = makePrefs({ enabled: false })

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('no-op when rest timer toggle off', async () => {
    const prefs = makePrefs({
      restTimer: { enabled: false, soundEnabled: true, vibrationEnabled: true },
    })

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('no-op when permission denied', async () => {
    permissionGetter.mockReturnValue('denied')
    const prefs = makePrefs()

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification).not.toHaveBeenCalled()
    expect(MockNotification.requestPermission).not.toHaveBeenCalled()
  })

  it('calls requestPermission when permission is default', async () => {
    permissionGetter.mockReturnValue('default')
    MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')
    const prefs = makePrefs()

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification.requestPermission).toHaveBeenCalledOnce()
    expect(MockNotification).toHaveBeenCalledOnce()
  })

  it('does not fire when requestPermission returns denied', async () => {
    permissionGetter.mockReturnValue('default')
    MockNotification.requestPermission = vi.fn().mockResolvedValue('denied')
    const prefs = makePrefs()

    await sendRestTimerNotification('Bench Press', 3, prefs)

    expect(MockNotification.requestPermission).toHaveBeenCalledOnce()
    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('rest timer notification is NOT blocked by quiet hours', async () => {
    const prefs = makePrefs({
      quietHours: { enabled: true, startHour: 0, startMinute: 0, endHour: 23, endMinute: 59 },
    })

    await sendRestTimerNotification('Squat', 1, prefs)

    expect(MockNotification).toHaveBeenCalledOnce()
  })

  it('body shows fallback when exerciseName is undefined', async () => {
    const prefs = makePrefs()

    await sendRestTimerNotification(undefined, undefined, prefs)

    expect(MockNotification).toHaveBeenCalledOnce()
    const [, options] = MockNotification.mock.calls[0]
    expect(options.body).toBe('Time to start your next set')
  })
})

// ---------------------------------------------------------------------------
// sendSessionReminderNotification
// ---------------------------------------------------------------------------

describe('sendSessionReminderNotification', () => {
  it('fires notification when permission granted and toggles on', async () => {
    const prefs = makePrefs()

    await sendSessionReminderNotification('Upper Body', prefs)

    expect(MockNotification).toHaveBeenCalledOnce()
    const [title, options] = MockNotification.mock.calls[0]
    expect(title).toBe('SESSION REMINDER')
    expect(options.body).toContain('Upper Body')
  })

  it('no-op when master toggle off', async () => {
    const prefs = makePrefs({ enabled: false })

    await sendSessionReminderNotification('Upper Body', prefs)

    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('no-op when session reminder toggle off', async () => {
    const prefs = makePrefs({
      sessionReminders: { enabled: false, advanceMinutes: 30 },
    })

    await sendSessionReminderNotification('Upper Body', prefs)

    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('session reminder IS blocked by quiet hours', async () => {
    const prefs = makePrefs({
      quietHours: { enabled: true, startHour: 0, startMinute: 0, endHour: 23, endMinute: 59 },
    })

    await sendSessionReminderNotification('Upper Body', prefs)

    expect(MockNotification).not.toHaveBeenCalled()
  })

  it('calls requestPermission when permission is default', async () => {
    permissionGetter.mockReturnValue('default')
    MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')
    const prefs = makePrefs()

    await sendSessionReminderNotification('Upper Body', prefs)

    expect(MockNotification.requestPermission).toHaveBeenCalledOnce()
    expect(MockNotification).toHaveBeenCalledOnce()
  })

  it('no-op when Notification API unavailable', async () => {
    // Remove Notification from window
    // @ts-expect-error -- intentionally removing for test
    delete window.Notification

    const prefs = makePrefs()

    await sendSessionReminderNotification('Upper Body', prefs)

    // No error thrown, no notification
    expect(MockNotification).not.toHaveBeenCalled()
  })
})
