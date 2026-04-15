// @vitest-environment happy-dom
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render-helpers'
import { NotificationSettings } from '@/components/profile/notification-settings'
import type { NotificationPreferences } from '@/domain/types/notification'

// ---------------------------------------------------------------------------
// Default prefs for tests
// ---------------------------------------------------------------------------

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  restTimer: { enabled: true, soundEnabled: true, vibrationEnabled: true },
  sessionReminders: { enabled: true, advanceMinutes: 30 },
  prCelebrations: { enabled: true },
  quietHours: {
    enabled: false,
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
  },
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockIsTauri = vi.fn(() => false)

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mockIsTauri(),
  invoke: vi.fn(),
}))

const mockUpdatePreferences = { mutate: vi.fn(), isError: false }

vi.mock('@/hooks/use-notification-preferences', () => ({
  useNotificationPreferences: vi.fn(() => ({
    data: { ...DEFAULT_PREFS },
    isLoading: false,
    error: null,
    updatePreferences: mockUpdatePreferences,
  })),
}))

// ---------------------------------------------------------------------------
// Browser API helpers
// ---------------------------------------------------------------------------

/** Override Notification.permission (read-only in real browsers) */
function setNotificationPermission(state: NotificationPermission) {
  Object.defineProperty(window, 'Notification', {
    value: {
      permission: state,
      requestPermission: vi.fn().mockResolvedValue(state),
    },
    writable: true,
    configurable: true,
  })
}

/** Set up navigator.permissions.query to resolve with a given state */
function mockPermissionsQuery(state: PermissionState) {
  Object.defineProperty(navigator, 'permissions', {
    value: {
      query: vi.fn().mockResolvedValue({
        state,
        onchange: null,
      }),
    },
    writable: true,
    configurable: true,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationSettings -- browser mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsTauri.mockReturnValue(false)
  })

  it('BrowserPermissionStatus renders nothing when permission is granted', () => {
    setNotificationPermission('granted')
    mockPermissionsQuery('granted')

    renderWithProviders(<NotificationSettings />)

    expect(screen.queryByText(/blocked/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/when prompted/i)).not.toBeInTheDocument()
  })

  it('BrowserPermissionStatus renders guidance when permission is default', () => {
    setNotificationPermission('default')
    mockPermissionsQuery('prompt')

    renderWithProviders(<NotificationSettings />)

    expect(
      screen.getByText('Enable notifications in your browser when prompted'),
    ).toBeInTheDocument()
  })

  it('BrowserPermissionStatus renders blocked warning when permission is denied', () => {
    setNotificationPermission('denied')
    mockPermissionsQuery('denied')

    renderWithProviders(<NotificationSettings />)

    expect(
      screen.getByText('Notifications are blocked. Enable them in your browser settings.'),
    ).toBeInTheDocument()

    // No re-request button should exist
    expect(screen.queryByRole('button', { name: /enable|allow|request/i })).not.toBeInTheDocument()
  })

  it('"requires native app" string is absent in browser mode', () => {
    setNotificationPermission('granted')
    mockPermissionsQuery('granted')

    renderWithProviders(<NotificationSettings />)

    expect(screen.queryByText(/require the native app/i)).not.toBeInTheDocument()
  })

  it('tab must remain open note is present when session reminders enabled', () => {
    setNotificationPermission('granted')
    mockPermissionsQuery('granted')

    renderWithProviders(<NotificationSettings />)

    expect(screen.getByText(/while this tab is open/i)).toBeInTheDocument()
  })

  it('BrowserPermissionStatus does not render in Tauri mode', () => {
    mockIsTauri.mockReturnValue(true)
    setNotificationPermission('denied')
    mockPermissionsQuery('denied')

    renderWithProviders(<NotificationSettings />)

    expect(
      screen.queryByText('Notifications are blocked. Enable them in your browser settings.'),
    ).not.toBeInTheDocument()
  })
})
