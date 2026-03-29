//! Notification infrastructure: channel registration, quiet-hours logic, and
//! a convenience wrapper around `tauri-plugin-notification`.

use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::NotificationExt;

/// Default notification preferences as a JSON string.
/// Mirrors the TypeScript `DEFAULT_NOTIFICATION_PREFERENCES` shape exactly.
pub const DEFAULT_PREFS_JSON: &str = r#"{
  "enabled": true,
  "restTimer": {
    "enabled": true,
    "soundEnabled": true,
    "vibrationEnabled": true
  },
  "sessionReminders": {
    "enabled": false,
    "advanceMinutes": 30
  },
  "prCelebrations": {
    "enabled": true
  },
  "quietHours": {
    "enabled": true,
    "startHour": 22,
    "startMinute": 0,
    "endHour": 6,
    "endMinute": 0
  }
}"#;

// ---------------------------------------------------------------------------
// Android notification channels
// ---------------------------------------------------------------------------

/// Register Android notification channels. On non-Android targets this is a
/// no-op, so it is always safe to call during app setup.
pub fn register_channels<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "android")]
    {
        use tauri_plugin_notification::{Channel, Importance};

        let channels = [
            Channel::builder("rest_timer", "Rest Timer")
                .description("Between-set rest timer alerts")
                .importance(Importance::High)
                .vibration(true)
                .build(),
            Channel::builder("workout_reminders", "Workout Reminders")
                .description("Scheduled session reminders")
                .importance(Importance::Default)
                .build(),
            Channel::builder("personal_records", "Personal Records")
                .description("PR celebration notifications")
                .importance(Importance::Default)
                .build(),
            Channel::builder("system", "System")
                .description("Sync errors and app updates")
                .importance(Importance::Low)
                .build(),
        ];

        let notification = app.notification();
        for channel in channels {
            if let Err(e) = notification.create_channel(channel) {
                log::error!("[notification] Failed to create channel: {e}");
            }
        }

        log::info!("[notification] Registered {} Android notification channels", 4);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app; // suppress unused warning
        log::info!("[notification] Skipping channel registration (not Android)");
    }
}

// ---------------------------------------------------------------------------
// Quiet hours
// ---------------------------------------------------------------------------

/// Returns `true` when the current local time falls within the user's quiet
/// hours window. Handles midnight-crossing ranges (e.g. 22:00-06:00).
///
/// Expects `prefs_json` to match the TypeScript `NotificationPreferences` shape:
/// `quietHours.{enabled, startHour, startMinute, endHour, endMinute}` as integers.
pub fn is_in_quiet_hours(prefs_json: &str) -> bool {
    let parsed: serde_json::Value = match serde_json::from_str(prefs_json) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[notification] Failed to parse prefs JSON: {e}");
            return false;
        }
    };

    let quiet = match parsed.get("quietHours") {
        Some(q) => q,
        None => return false,
    };

    let enabled = quiet
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !enabled {
        return false;
    }

    let start_hour = quiet.get("startHour").and_then(|v| v.as_u64()).unwrap_or(22) as u32;
    let start_minute = quiet.get("startMinute").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let end_hour = quiet.get("endHour").and_then(|v| v.as_u64()).unwrap_or(6) as u32;
    let end_minute = quiet.get("endMinute").and_then(|v| v.as_u64()).unwrap_or(0) as u32;

    let start_mins = start_hour * 60 + start_minute;
    let end_mins = end_hour * 60 + end_minute;

    let now = chrono::Local::now();
    let now_mins = now.hour() * 60 + now.minute();

    if start_mins <= end_mins {
        // Same-day range (e.g. 01:00-06:00)
        now_mins >= start_mins && now_mins < end_mins
    } else {
        // Midnight-crossing range (e.g. 22:00-06:00)
        now_mins >= start_mins || now_mins < end_mins
    }
}

// ---------------------------------------------------------------------------
// Send notification helper
// ---------------------------------------------------------------------------

/// Send a platform notification via `tauri-plugin-notification`.
///
/// - `channel`: the notification channel id (used on Android; ignored on desktop)
/// - `title` / `body`: notification content
/// - `id`: optional fixed id so repeated notifications replace previous ones
pub fn send_notification<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
    title: &str,
    body: &str,
    id: Option<i32>,
) {
    let mut builder = app
        .notification()
        .builder()
        .channel_id(channel)
        .title(title)
        .body(body)
        .auto_cancel();

    if let Some(notification_id) = id {
        builder = builder.id(notification_id);
    }

    if let Err(e) = builder.show() {
        log::error!(
            "[notification] Failed to send notification (channel={channel}, title={title}): {e}"
        );
    }
}

// ---------------------------------------------------------------------------
// Allow chrono usage without fully qualifying
// ---------------------------------------------------------------------------
use chrono::Timelike;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quiet_hours_disabled_returns_false() {
        let prefs = r#"{"quietHours":{"enabled":false,"startHour":22,"startMinute":0,"endHour":6,"endMinute":0}}"#;
        assert!(!is_in_quiet_hours(prefs));
    }

    #[test]
    fn quiet_hours_missing_field_returns_false() {
        let prefs = r#"{"enabled":true}"#;
        assert!(!is_in_quiet_hours(prefs));
    }

    #[test]
    fn quiet_hours_invalid_json_returns_false() {
        assert!(!is_in_quiet_hours("not json"));
    }

    #[test]
    fn quiet_hours_enabled_uses_integer_fields() {
        // With enabled=true and integer hour/minute fields, parsing should succeed
        // (time-of-day dependent, so we just verify it doesn't panic)
        let prefs = r#"{"quietHours":{"enabled":true,"startHour":22,"startMinute":0,"endHour":6,"endMinute":0}}"#;
        let _ = is_in_quiet_hours(prefs); // should not panic
    }

    #[test]
    fn default_prefs_json_is_valid() {
        let parsed: Result<serde_json::Value, _> = serde_json::from_str(DEFAULT_PREFS_JSON);
        assert!(parsed.is_ok(), "DEFAULT_PREFS_JSON must be valid JSON");
        let val = parsed.unwrap();
        assert!(val.get("quietHours").is_some());
        assert!(val.get("restTimer").is_some());
        assert!(val.get("sessionReminders").is_some());
        assert!(val.get("prCelebrations").is_some());
        // Verify integer fields match TypeScript shape
        let qh = val.get("quietHours").unwrap();
        assert_eq!(qh.get("startHour").and_then(|v| v.as_u64()), Some(22));
        assert_eq!(qh.get("endHour").and_then(|v| v.as_u64()), Some(6));
    }
}
