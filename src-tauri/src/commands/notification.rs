//! Tauri commands for starting/stopping the session reminder background
//! scheduler.

use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::session_reminder::SessionReminderState;

/// Starts the session reminder background scheduler. If a scheduler is already
/// running it is stopped first. This command is intended to be called from the
/// TypeScript side after the user has authenticated, since reminders require
/// access to the user's program data.
#[tauri::command]
pub async fn schedule_session_reminder(
    pool: State<'_, SqlitePool>,
    reminder_state: State<'_, SessionReminderState>,
    app: AppHandle,
) -> Result<(), AppError> {
    reminder_state
        .start(pool.inner().clone(), app)
        .await;
    Ok(())
}

/// Stops the session reminder background scheduler.
#[tauri::command]
pub async fn cancel_session_reminder(
    reminder_state: State<'_, SessionReminderState>,
) -> Result<(), AppError> {
    reminder_state.stop().await;
    Ok(())
}
