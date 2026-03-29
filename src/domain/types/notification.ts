import { z } from 'zod'

// ---------------------------------------------------------------------------
// NotificationPreferences -- user-configurable notification settings
// ---------------------------------------------------------------------------

export const notificationPreferencesSchema = z.object({
  /** Master toggle for all notifications */
  enabled: z.boolean(),

  /** Rest timer alert settings (between-set alerts) */
  restTimer: z.object({
    enabled: z.boolean(),
    soundEnabled: z.boolean(),
    vibrationEnabled: z.boolean(),
  }),

  /** Session reminder settings (opt-in scheduled reminders) */
  sessionReminders: z.object({
    enabled: z.boolean(),
    advanceMinutes: z.number().int().min(1).max(120),
  }),

  /** PR celebration notification settings */
  prCelebrations: z.object({
    enabled: z.boolean(),
  }),

  /** Quiet hours window -- non-rest-timer notifications are suppressed */
  quietHours: z.object({
    enabled: z.boolean(),
    startHour: z.number().int().min(0).max(23),
    startMinute: z.number().int().min(0).max(59),
    endHour: z.number().int().min(0).max(23),
    endMinute: z.number().int().min(0).max(59),
  }),
})
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>

// ---------------------------------------------------------------------------
// Default preferences -- matches docs/11-notification-design.md defaults
// ---------------------------------------------------------------------------

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  restTimer: {
    enabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
  },
  sessionReminders: {
    enabled: false,
    advanceMinutes: 30,
  },
  prCelebrations: {
    enabled: true,
  },
  quietHours: {
    enabled: true,
    startHour: 22,
    startMinute: 0,
    endHour: 6,
    endMinute: 0,
  },
}
