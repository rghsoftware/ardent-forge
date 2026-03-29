//! Tauri commands for reading and writing notification preferences, and for
//! starting/stopping the session reminder background scheduler.
//!
//! Preferences are stored in the local `app_config` table under the key
//! `notification_preferences` as a JSON string. They are never synced to
//! Supabase -- they are device-local settings.

use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::notification::DEFAULT_PREFS_JSON;
use crate::session_reminder::SessionReminderState;

const PREFS_KEY: &str = "notification_preferences";

/// Returns the notification preferences JSON string from the `app_config`
/// table. If no row exists yet, returns the built-in defaults.
#[tauri::command]
pub async fn get_notification_preferences(
    pool: State<'_, SqlitePool>,
) -> Result<String, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
            .bind(PREFS_KEY)
            .fetch_optional(pool.inner())
            .await?;

    Ok(row.map(|(v,)| v).unwrap_or_else(|| DEFAULT_PREFS_JSON.to_string()))
}

/// Persists notification preferences. The caller is expected to pass a
/// complete, valid JSON string matching the `NotificationPreferences` schema.
#[tauri::command]
pub async fn set_notification_preferences(
    pool: State<'_, SqlitePool>,
    prefs_json: String,
) -> Result<(), AppError> {
    // Validate that the incoming string is at least valid JSON before storing
    serde_json::from_str::<serde_json::Value>(&prefs_json).map_err(|e| {
        AppError::validation("prefs_json", &format!("Invalid JSON: {e}"))
    })?;

    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)")
        .bind(PREFS_KEY)
        .bind(&prefs_json)
        .execute(pool.inner())
        .await?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Session reminder scheduler commands
// ---------------------------------------------------------------------------

/// Starts the session reminder background scheduler. If a scheduler is already
/// running it is stopped first. This command is intended to be called from the
/// TypeScript side after the user has authenticated, since reminders require
/// access to the user's program data.
#[tauri::command]
pub async fn schedule_session_reminder(
    pool: State<'_, SqlitePool>,
    reminder_state: State<'_, SessionReminderState>,
    app: AppHandle,
) -> Result<(), String> {
    reminder_state
        .start(pool.inner().clone(), app)
        .await;
    Ok(())
}

/// Stops the session reminder background scheduler.
#[tauri::command]
pub async fn cancel_session_reminder(
    reminder_state: State<'_, SessionReminderState>,
) -> Result<(), String> {
    reminder_state.stop().await;
    Ok(())
}
