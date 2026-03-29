import { isTauri, invoke } from '@tauri-apps/api/core'
import {
  notificationPreferencesSchema,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/domain/types/notification'
import type { NotificationPreferences } from '@/domain/types/notification'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const BROWSER_STORAGE_KEY = 'ardentforge:notification_preferences'
const TAURI_CONFIG_KEY = 'notification_preferences'

// ---------------------------------------------------------------------------
// getNotificationPreferences -- read preferences from Tauri or localStorage
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  let raw: string | null = null

  if (isTauri()) {
    raw = await invoke<string | null>('get_app_config', { key: TAURI_CONFIG_KEY })
  } else {
    raw = localStorage.getItem(BROWSER_STORAGE_KEY)
  }

  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    console.warn('[notification-service] Corrupt JSON in preferences, using defaults')
    return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }

  const parsed = notificationPreferencesSchema.safeParse(json)
  if (!parsed.success) {
    console.warn('[notification-service] Schema validation failed, using defaults')
    return { ...DEFAULT_NOTIFICATION_PREFERENCES }
  }
  return parsed.data
}

// ---------------------------------------------------------------------------
// setNotificationPreferences -- persist preferences to Tauri or localStorage
// ---------------------------------------------------------------------------

export async function setNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  const validated = notificationPreferencesSchema.parse(prefs)
  const json = JSON.stringify(validated)

  if (isTauri()) {
    await invoke('set_app_config', { key: TAURI_CONFIG_KEY, value: json })
  } else {
    localStorage.setItem(BROWSER_STORAGE_KEY, json)
  }
}

// ---------------------------------------------------------------------------
// isInQuietHours -- check if the current local time falls within quiet hours
//
// Handles midnight-crossing ranges (e.g. 22:00 - 06:00).
// ---------------------------------------------------------------------------

export function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (!prefs.quietHours.enabled) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = prefs.quietHours.startHour * 60 + prefs.quietHours.startMinute
  const endMinutes = prefs.quietHours.endHour * 60 + prefs.quietHours.endMinute

  if (startMinutes <= endMinutes) {
    // Same-day range (e.g. 08:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  // Midnight-crossing range (e.g. 22:00 - 06:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

// ---------------------------------------------------------------------------
// shouldSendNotification -- determines if a notification type should fire
//
// Combines: master toggle + per-type toggle + quiet hours check.
// Rest timer is EXEMPT from quiet hours (user is actively working out).
// ---------------------------------------------------------------------------

export function shouldSendNotification(
  type: 'restTimer' | 'sessionReminders' | 'prCelebrations',
  prefs: NotificationPreferences,
): boolean {
  // Master toggle must be on
  if (!prefs.enabled) return false

  // Per-type toggle must be on
  if (!prefs[type].enabled) return false

  // Rest timer is exempt from quiet hours per the notification spec
  if (type === 'restTimer') return true

  // All other types respect quiet hours
  return !isInQuietHours(prefs)
}

// ---------------------------------------------------------------------------
// sendPrNotification -- fires a platform notification for a personal record
//
// The in-app banner (PrCelebrationBanner) is ALWAYS shown by the caller
// regardless of this function's result. This function handles the platform-
// level notification (system tray / lock screen) only.
//
// In both Tauri and browser modes, we use the Web Notification API directly
// because PR celebrations are triggered client-side in React -- there is no
// Rust command for them.
// ---------------------------------------------------------------------------

export async function sendPrNotification(
  exerciseName: string,
  weight: number,
  reps: number,
  unit: 'lb' | 'kg',
  prefs: NotificationPreferences,
): Promise<void> {
  if (!shouldSendNotification('prCelebrations', prefs)) return

  const title = 'NEW PR'
  const body = `${exerciseName} \u2014 ${weight}${unit} x ${reps}`

  // Use the Web Notification API if available and permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}
