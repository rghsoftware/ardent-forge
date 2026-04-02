//! Tauri commands for starting/stopping notification background schedulers
//! (session reminders and event reminders).

use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::error::AppError;
use crate::event_reminder::EventReminderState;
use crate::session_reminder::SessionReminderState;

// ---------------------------------------------------------------------------
// Session reminders
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
) -> Result<(), AppError> {
    reminder_state.start(pool.inner().clone(), app).await;
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

// ---------------------------------------------------------------------------
// Event reminders
// ---------------------------------------------------------------------------

/// Starts the event reminder background scheduler. If a scheduler is already
/// running it is stopped first. This command is intended to be called from the
/// TypeScript side after the user has authenticated, since event reminders
/// require access to session template data.
#[tauri::command]
pub async fn schedule_event_reminders(
    pool: State<'_, SqlitePool>,
    reminder_state: State<'_, EventReminderState>,
    app: AppHandle,
) -> Result<(), AppError> {
    reminder_state.start(pool.inner().clone(), app).await;
    Ok(())
}

/// Stops the event reminder background scheduler.
#[tauri::command]
pub async fn cancel_event_reminders(
    reminder_state: State<'_, EventReminderState>,
) -> Result<(), AppError> {
    reminder_state.stop().await;
    Ok(())
}
